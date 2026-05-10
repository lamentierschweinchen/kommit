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
 * Idempotency (Codex Pass 1 H2 closure): wallet-keyed lock backed by the
 * `sandbox_airdrops` Supabase table (migration 0007). The previous
 * in-memory rate limiter doesn't survive Vercel cold starts, so concurrent
 * cold instances could each observe pre-airdrop balance below threshold
 * and all transfer — draining the fee-payer at ~0.05 SOL per cold instance
 * per wallet. The shared Supabase row is the dedup primitive; the
 * in-memory rate limiter still runs as a defense-in-depth burst guard.
 *
 * Cluster confinement (Codex Pass 1 M3): `isDevnetCluster()` short-circuits
 * the route if `NEXT_PUBLIC_HELIUS_RPC_URL` points at non-devnet. Stops a
 * mis-pointed RPC from minting real SPL tokens or transferring real SOL.
 *
 * Hard UI rule: response payload calls the token-funding amount `tokenFundedUSD`
 * (no symbol). The Solscan tx detail will show the SPL mint symbol on its own.
 */

import "server-only";

import { NextResponse, type NextRequest } from "next/server";
import { PublicKey, Transaction } from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TokenAccountNotFoundError,
  TokenInvalidAccountOwnerError,
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
  isDevnetCluster,
  transferLamports,
} from "@/lib/visa-demo-rpc";
import { getFeePayer, isFeePayerConfigured } from "@/lib/visa-demo-fee-payer";
import { getSandboxMintOrNull, SANDBOX_MINT_DECIMALS } from "@/lib/sandbox-mint";
import {
  markAirdropFunded,
  releaseAirdropLock,
  tryAcquireAirdropLock,
} from "@/lib/sandbox-airdrop-store";

export const runtime = "nodejs";

const RATE_LIMIT_MS = 60_000;

const GAS_THRESHOLD_LAMPORTS = 10_000_000; // 0.01 SOL — above this, skip
const GAS_GRANT_LAMPORTS = 50_000_000; //     0.05 SOL — ~5K commits worth of gas

const TOKEN_DECIMALS_DIVISOR = 10n ** BigInt(SANDBOX_MINT_DECIMALS);
const TOKEN_THRESHOLD_USD = 100n; //  $100 floor — above this, skip
const TOKEN_GRANT_USD = 10_000n; //   $10,000 grant — the mint authority is ours, supply is unlimited; generous fund so judges don't run out
const TOKEN_THRESHOLD_BASE = TOKEN_THRESHOLD_USD * TOKEN_DECIMALS_DIVISOR;
const TOKEN_GRANT_BASE = TOKEN_GRANT_USD * TOKEN_DECIMALS_DIVISOR;

type ErrorCode =
  | "auth"
  | "rpc"
  | "rate-limit"
  | "demo-api-disabled"
  | "wrong-cluster"
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

  // 2. Rate limit (still useful as a defense-in-depth burst guard, but the
  // load-bearing idempotency primitive now lives in Supabase below).
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

  // 5. Codex M3: cluster confinement. Refuse to do anything if the configured
  // RPC isn't devnet — stops a mis-pointed env var from minting real tokens
  // or moving real SOL.
  try {
    if (!(await isDevnetCluster())) {
      console.warn(
        "[sandbox/airdrop] configured RPC is not devnet; refusing to airdrop.",
      );
      return jsonError("wrong-cluster", 503);
    }
  } catch (e) {
    console.warn("[sandbox/airdrop] cluster check failed:", e);
    return jsonError("rpc", 502);
  }

  // 6. Codex H2: persistent wallet-keyed lock acquisition. Atomic across
  // concurrent Vercel cold starts. If acquisition succeeds we own the
  // airdrop and proceed; if the row was already there the wallet was
  // funded by a prior request and we return an idempotent response after
  // re-reading the on-chain balances.
  const acquire = await tryAcquireAirdropLock(walletStr);
  if (acquire.kind === "error") {
    console.warn(
      "[sandbox/airdrop] tryAcquireAirdropLock failed:",
      acquire.message,
    );
    return jsonError("rpc", 502);
  }

  if (acquire.kind === "already-granted") {
    return readBalancesAndRespond({
      wallet,
      mint,
      lamportsBefore: null,
      gasFundedLamports: 0,
      mintedBase: 0n,
      signature: null,
    });
  }

  // From here on we hold the lock. Any failure path must release it so a
  // retry can re-acquire (otherwise a transient RPC error locks the wallet
  // out forever).

  // 7. Read current SOL balance.
  let lamportsBefore: number;
  try {
    lamportsBefore = await getLamports(wallet);
  } catch (e) {
    console.warn("[sandbox/airdrop] balance read failed:", e);
    await releaseAirdropLock(walletStr);
    return jsonError("rpc", 502);
  }

  // 8. Top up SOL if below threshold.
  let gasFundedLamports = 0;
  if (lamportsBefore < GAS_THRESHOLD_LAMPORTS) {
    try {
      await transferLamports(wallet, GAS_GRANT_LAMPORTS);
      gasFundedLamports = GAS_GRANT_LAMPORTS;
      await markAirdropFunded(walletStr, "sol");
    } catch (e) {
      console.warn("[sandbox/airdrop] transferLamports failed:", e);
      await releaseAirdropLock(walletStr);
      return jsonError("rpc", 502);
    }
  } else {
    // Wallet was already above the SOL threshold — record the timestamp
    // so audits can see this wallet went through the route even though it
    // didn't need a SOL transfer this time.
    await markAirdropFunded(walletStr, "sol");
  }

  // 9. Read existing sandbox-token balance (if any). Codex M1: distinguish
  // between "ATA doesn't exist yet" (expected — fall through and create it)
  // and "RPC/decode/owner failure" (transient — surface as rpc error so the
  // caller doesn't get an extra grant after a transient outage).
  const conn = getDevnetConnection();
  const ata = getAssociatedTokenAddressSync(mint, wallet, false);
  let existingTokenBase: bigint = 0n;
  let ataExists = false;
  try {
    const acc = await getAccount(conn, ata);
    existingTokenBase = acc.amount;
    ataExists = true;
  } catch (e) {
    if (e instanceof TokenAccountNotFoundError) {
      // Expected: first-time wallet, ATA hasn't been created yet.
      ataExists = false;
    } else if (e instanceof TokenInvalidAccountOwnerError) {
      // Account exists at the ATA address but isn't owned by the SPL Token
      // program. This shouldn't happen for a getAssociatedTokenAddress-derived
      // address unless something is very wrong on-chain — surface as rpc.
      console.warn(
        "[sandbox/airdrop] ATA exists but is not a token account:",
        e,
      );
      await releaseAirdropLock(walletStr);
      return jsonError("rpc", 502);
    } else {
      // Any other failure (RPC timeout, 429, decode error) is transport-
      // level, not "ATA missing." Don't fall through to mint another grant.
      console.warn("[sandbox/airdrop] getAccount failed:", e);
      await releaseAirdropLock(walletStr);
      return jsonError("rpc", 502);
    }
  }

  // 10. Mint sandbox tokens if below threshold.
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
      await markAirdropFunded(walletStr, "token");
    } catch (e) {
      console.warn("[sandbox/airdrop] mintTo failed:", e);
      await releaseAirdropLock(walletStr);
      return jsonError("rpc", 502);
    }
  } else {
    // Already above token threshold — stamp the timestamp without spending.
    await markAirdropFunded(walletStr, "token");
  }

  return readBalancesAndRespond({
    wallet,
    mint,
    lamportsBefore,
    gasFundedLamports,
    mintedBase,
    signature,
  });
}

/**
 * Re-read post-airdrop balances and build the success response. Shared by
 * the "we-just-airdropped" path and the "already-granted" idempotent path —
 * both need a ground-truth response so the FE doesn't render stale numbers.
 *
 * Errors here are non-fatal: we fall back to the optimistic computed values
 * from the pre-airdrop reads.
 */
async function readBalancesAndRespond(args: {
  wallet: PublicKey;
  mint: PublicKey;
  /** null when the caller didn't read pre-airdrop SOL (idempotent path). */
  lamportsBefore: number | null;
  gasFundedLamports: number;
  mintedBase: bigint;
  signature: string | null;
}): Promise<NextResponse<ResponseBody>> {
  const conn = getDevnetConnection();

  let lamportsAfter = (args.lamportsBefore ?? 0) + args.gasFundedLamports;
  try {
    lamportsAfter = await conn.getBalance(args.wallet, "confirmed");
  } catch {
    /* fall back to optimistic computed value */
  }

  let tokenBalanceBase: bigint;
  try {
    const ata = getAssociatedTokenAddressSync(args.mint, args.wallet, false);
    const acc = await getAccount(conn, ata);
    tokenBalanceBase = acc.amount;
  } catch (e) {
    if (e instanceof TokenAccountNotFoundError) {
      tokenBalanceBase = 0n;
    } else {
      // Transient — fall back to optimistic value.
      tokenBalanceBase = args.mintedBase;
    }
  }

  const lamportsBeforeOut =
    args.lamportsBefore ?? Math.max(lamportsAfter - args.gasFundedLamports, 0);

  return NextResponse.json<ResponseBody>({
    ok: true,
    lamportsBefore: lamportsBeforeOut,
    lamportsAfter,
    gasFundedLamports: args.gasFundedLamports,
    tokenFundedUSD: Number(args.mintedBase / TOKEN_DECIMALS_DIVISOR),
    tokenBalanceUSD: baseToUSD(tokenBalanceBase),
    signature: args.signature,
  });
}
