/**
 * POST /api/sandbox/airdrop — devnet kUSD + SOL airdrop for the Lane B
 * judge surface.
 *
 * Drops two things on first call (idempotent above thresholds):
 *
 *   1. SOL gas — if the caller's wallet is below GAS_THRESHOLD_LAMPORTS,
 *      transfer GAS_GRANT_LAMPORTS from the visa-demo fee-payer.
 *   2. Sandbox SPL token — if the caller's ATA is below TOKEN_THRESHOLD_BASE,
 *      mint TOKEN_GRANT_BASE base units to the caller's ATA. The fee-payer
 *      is the mint authority (set up by scripts/setup-sandbox-mint.mjs).
 *
 * Auth: Privy session via requireCallerWallet.
 *
 * Rate-limit: 1 airdrop per wallet per 60s. Above the thresholds the route
 * is idempotent so a judge hitting Refresh doesn't drain the fee-payer; the
 * rate limit just stops a runaway loop.
 *
 * Hard UI rule: response payload calls the token-funding amount `tokenFundedUSD`
 * (no symbol). The Solscan tx detail will show the SPL mint symbol on its own.
 */

import { NextResponse, type NextRequest } from "next/server";
import { PublicKey, Transaction } from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountIdempotentInstruction,
  createMintToInstruction,
  getAccount,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";

import { requireCallerWallet } from "@/lib/auth-server";
import { takeRateLimit } from "@/lib/visa-demo-rate-limit";
import { isSandboxApiEnabled } from "@/lib/sandbox-mode";
import {
  getDevnetConnection,
  getLamports,
  transferLamports,
} from "@/lib/visa-demo-rpc";
import { getFeePayer, isFeePayerConfigured } from "@/lib/visa-demo-fee-payer";
import { getSandboxMintOrNull, SANDBOX_MINT_DECIMALS } from "@/lib/sandbox-mint";

export const runtime = "nodejs";

const RATE_LIMIT_MS = 60_000;

const GAS_THRESHOLD_LAMPORTS = 10_000_000; // 0.01 SOL — above this, skip
const GAS_GRANT_LAMPORTS = 50_000_000; //     0.05 SOL — ~5K commits worth of gas

const TOKEN_DECIMALS_DIVISOR = 10n ** BigInt(SANDBOX_MINT_DECIMALS);
const TOKEN_THRESHOLD_USD = 10n; //  $10 floor — above this, skip
const TOKEN_GRANT_USD = 100n; //     $100 grant
const TOKEN_THRESHOLD_BASE = TOKEN_THRESHOLD_USD * TOKEN_DECIMALS_DIVISOR;
const TOKEN_GRANT_BASE = TOKEN_GRANT_USD * TOKEN_DECIMALS_DIVISOR;

type ErrorCode =
  | "auth"
  | "rpc"
  | "rate-limit"
  | "demo-api-disabled"
  | "mint-not-configured"
  | "fee-payer-not-configured";

type SuccessBody = {
  ok: true;
  /** Pre-airdrop balance, in lamports. */
  lamportsBefore: number;
  /** Post-airdrop balance, in lamports. */
  lamportsAfter: number;
  /** Lamports transferred this call (0 if already above threshold). */
  gasFundedLamports: number;
  /** USD-nominal sandbox tokens minted this call (0 if already above threshold). */
  tokenFundedUSD: number;
  /** Total tokens now in caller's ATA, USD-nominal (post-airdrop). */
  tokenBalanceUSD: number;
  /** SPL mint tx signature, or null if no tokens were minted this call. */
  signature: string | null;
};

type ResponseBody = SuccessBody | { ok: false; error: ErrorCode };

function jsonError(error: ErrorCode, status: number): NextResponse<ResponseBody> {
  return NextResponse.json<ResponseBody>({ ok: false, error }, { status });
}

function baseToUSD(base: bigint): number {
  const usd = Number(base / TOKEN_DECIMALS_DIVISOR);
  const cents = Number(base % TOKEN_DECIMALS_DIVISOR) / Number(TOKEN_DECIMALS_DIVISOR);
  return usd + cents;
}

export async function POST(req: NextRequest): Promise<NextResponse<ResponseBody>> {
  // 0. Server-side feature gate.
  if (!isSandboxApiEnabled()) {
    return jsonError("demo-api-disabled", 503);
  }

  // 1. Auth.
  const authed = await requireCallerWallet(req);
  if (authed instanceof Response) {
    return jsonError("auth", authed.status);
  }
  const { wallet: walletStr } = authed;

  let wallet: PublicKey;
  try {
    wallet = new PublicKey(walletStr);
  } catch {
    return jsonError("auth", 401);
  }

  // 2. Rate limit.
  if (!takeRateLimit(walletStr, RATE_LIMIT_MS)) {
    return jsonError("rate-limit", 429);
  }

  // 3. Sandbox mint must be configured (the operator ran setup-sandbox-mint.mjs).
  const mint = getSandboxMintOrNull();
  if (!mint) {
    console.warn(
      "[sandbox/airdrop] sandbox mint unconfigured — run scripts/setup-sandbox-mint.mjs and commit the resulting sandbox-mint.json.",
    );
    return jsonError("mint-not-configured", 503);
  }

  // 4. Fee-payer must be configured (mint authority + SOL sponsor).
  if (!isFeePayerConfigured()) {
    console.warn(
      "[sandbox/airdrop] KOMMIT_DEVNET_FEE_PAYER_SECRET unset; cannot airdrop. See web/src/lib/visa-demo-fee-payer.ts.",
    );
    return jsonError("fee-payer-not-configured", 503);
  }

  // 5. Read current SOL balance.
  let lamportsBefore: number;
  try {
    lamportsBefore = await getLamports(wallet);
  } catch (e) {
    console.warn("[sandbox/airdrop] balance read failed:", e);
    return jsonError("rpc", 502);
  }

  // 6. Top up SOL if below threshold.
  let gasFundedLamports = 0;
  if (lamportsBefore < GAS_THRESHOLD_LAMPORTS) {
    try {
      await transferLamports(wallet, GAS_GRANT_LAMPORTS);
      gasFundedLamports = GAS_GRANT_LAMPORTS;
    } catch (e) {
      console.warn("[sandbox/airdrop] transferLamports failed:", e);
      return jsonError("rpc", 502);
    }
  }

  // 7. Read existing sandbox-token balance (if any).
  const conn = getDevnetConnection();
  const ata = getAssociatedTokenAddressSync(mint, wallet, false);
  let existingTokenBase: bigint = 0n;
  let ataExists = false;
  try {
    const acc = await getAccount(conn, ata);
    existingTokenBase = acc.amount;
    ataExists = true;
  } catch {
    // ATA doesn't exist yet — fall through and create it.
    ataExists = false;
  }

  // 8. Mint sandbox tokens if below threshold.
  let signature: string | null = null;
  let mintedBase: bigint = 0n;
  if (existingTokenBase < TOKEN_THRESHOLD_BASE) {
    const fp = getFeePayer();
    const tx = new Transaction();
    if (!ataExists) {
      tx.add(
        createAssociatedTokenAccountIdempotentInstruction(
          fp.publicKey,
          ata,
          wallet,
          mint,
          TOKEN_PROGRAM_ID,
          ASSOCIATED_TOKEN_PROGRAM_ID,
        ),
      );
    }
    tx.add(
      createMintToInstruction(
        mint,
        ata,
        fp.publicKey,
        TOKEN_GRANT_BASE,
      ),
    );
    tx.feePayer = fp.publicKey;
    const { blockhash, lastValidBlockHeight } =
      await conn.getLatestBlockhash("confirmed");
    tx.recentBlockhash = blockhash;
    tx.lastValidBlockHeight = lastValidBlockHeight;
    tx.sign(fp);
    try {
      signature = await conn.sendRawTransaction(tx.serialize(), {
        skipPreflight: false,
        preflightCommitment: "confirmed",
      });
      await conn.confirmTransaction(
        { signature, blockhash, lastValidBlockHeight },
        "confirmed",
      );
      mintedBase = TOKEN_GRANT_BASE;
    } catch (e) {
      console.warn("[sandbox/airdrop] mintTo failed:", e);
      return jsonError("rpc", 502);
    }
  }

  // 9. Re-read post-airdrop balances for ground-truth response.
  let lamportsAfter = lamportsBefore + gasFundedLamports;
  try {
    lamportsAfter = await conn.getBalance(wallet, "confirmed");
  } catch {
    /* fall back to optimistic computed value */
  }
  const tokenBalanceBase = existingTokenBase + mintedBase;

  return NextResponse.json<ResponseBody>({
    ok: true,
    lamportsBefore,
    lamportsAfter,
    gasFundedLamports,
    tokenFundedUSD: Number(mintedBase / TOKEN_DECIMALS_DIVISOR),
    tokenBalanceUSD: baseToUSD(tokenBalanceBase),
    signature,
  });
}
