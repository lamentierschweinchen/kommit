/**
 * POST /api/sandbox/card-deposit — handoff 64 card-as-deposit top-up.
 *
 * Server-side sandbox-SPL mint dressed up as a fiat card top-up. The
 * narrative the demo tells is "card → settles onchain"; the implementation
 * underneath is the same mint-authority pattern /api/sandbox/airdrop uses
 * for the $10K demo-entry grant. There is no real card processor, no KYC,
 * and no Stripe/MoonPay call out — this is a controlled-mint route gated
 * by Privy auth and a $1K per-call cap.
 *
 * What it does on success:
 *   1. Verifies Privy session, parses + validates the requested USD amount.
 *   2. Mints `amount * 10^6` sandbox SPL base units to the caller's ATA
 *      (creating the ATA idempotently if missing).
 *   3. Records the deposit as a `kind='card-deposit'` row in
 *      `sandbox_airdrops` (migration 0008).
 *   4. Returns `{ amountUsd, txSignature }` so the client can toast +
 *      Solscan-link the proof.
 *
 * Differences vs. /api/sandbox/airdrop:
 *   - Idempotency is per-call, NOT per-wallet. The user explicitly wants
 *     to deposit repeatedly (no lifetime cap). Each POST writes its own
 *     row. Burst protection comes from the in-memory rate limiter
 *     (60s/wallet), which catches double-click + brief retries; persistent
 *     replay protection isn't needed because the per-call $1K cap bounds
 *     the worst-case fee-payer drain.
 *   - Amount is caller-supplied (1 ≤ usd ≤ 1000) instead of fixed at
 *     $10K. The cap is enforced both at the input (request body) and
 *     downstream (multiplied into mint base units only after validation).
 *   - No SOL top-up. The user has already passed through the /demo
 *     entry by the time they see DepositModal; they have devnet SOL
 *     from that route. Skipping SOL here keeps the fee-payer drain
 *     per call to (mint tx fee + 0 transfer).
 *
 * Cluster confinement, mint config, fee-payer config: same gates as the
 * airdrop route. Failing any of them returns the same structured error
 * codes so the client can render a consistent message.
 */

import "server-only";

import { NextResponse, type NextRequest } from "next/server";
import { PublicKey, Transaction } from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountIdempotentInstruction,
  createMintToInstruction,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";

import { requireCallerWallet } from "@/lib/auth-server";
import { takeRateLimit } from "@/lib/visa-demo-rate-limit";
import { isSandboxApiEnabled } from "@/lib/sandbox-mode";
import {
  getDevnetConnection,
  isDevnetCluster,
} from "@/lib/visa-demo-rpc";
import { getFeePayer, isFeePayerConfigured } from "@/lib/visa-demo-fee-payer";
import { getSandboxMintOrNull, SANDBOX_MINT_DECIMALS } from "@/lib/sandbox-mint";
import { recordCardDeposit } from "@/lib/sandbox-airdrop-store";

export const runtime = "nodejs";

const RATE_LIMIT_MS = 60_000;
const MAX_USD_PER_DEPOSIT = 1000;
const TOKEN_DECIMALS_DIVISOR = 10n ** BigInt(SANDBOX_MINT_DECIMALS);

type ErrorCode =
  | "auth"
  | "rpc"
  | "rate-limit"
  | "demo-api-disabled"
  | "wrong-cluster"
  | "mint-not-configured"
  | "fee-payer-not-configured"
  | "invalid-amount";

type SuccessBody = {
  ok: true;
  amountUsd: number;
  txSignature: string;
};

type ResponseBody = SuccessBody | { ok: false; error: ErrorCode };

function jsonError(error: ErrorCode, status: number): NextResponse<ResponseBody> {
  return NextResponse.json<ResponseBody>({ ok: false, error }, { status });
}

/** Parse and validate the amount from the request body. Returns the
 *  normalized integer-dollar value, or null if invalid. Accepts integers
 *  and 2-decimal values; rounds half-up to whole cents internally but the
 *  mint operates in whole-dollar base units (USD * 10^6) so we floor to
 *  integer dollars after validation. */
function parseAmount(raw: unknown): number | null {
  if (typeof raw !== "number") return null;
  if (!Number.isFinite(raw)) return null;
  if (raw <= 0) return null;
  if (raw > MAX_USD_PER_DEPOSIT) return null;
  // Round to two decimals to avoid floating-point cruft, then floor to
  // integer dollars (the sandbox mint surfaces USD-nominal balances and
  // every existing balance read in the FE — useSandboxBalance, dashboard
  // StatCard — is integer-dollar). 2-decimal precision would require
  // refactoring those reads, out of scope for this handoff.
  const rounded = Math.round(raw * 100) / 100;
  const dollars = Math.floor(rounded);
  if (dollars <= 0) return null;
  if (dollars > MAX_USD_PER_DEPOSIT) return null;
  return dollars;
}

export async function POST(req: NextRequest): Promise<NextResponse<ResponseBody>> {
  // 0. Feature gate.
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

  // 2. Parse + validate amount before doing anything else. A bad amount
  // means the client UI failed its own cap; surface 400 cleanly without
  // burning a rate-limit token.
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError("invalid-amount", 400);
  }
  const amountUsd = parseAmount(
    (body as { amountUsd?: unknown } | null)?.amountUsd,
  );
  if (amountUsd === null) {
    return jsonError("invalid-amount", 400);
  }

  // 3. Rate limit (60s/wallet) — burst protection for double-click and
  // brief retries. The handoff explicitly does NOT want lifetime
  // dedupe; this is purely "don't accidentally mint twice in 5 seconds."
  if (!takeRateLimit(`card:${walletStr}`, RATE_LIMIT_MS)) {
    return jsonError("rate-limit", 429);
  }

  // 4. Mint must be configured.
  const mint = getSandboxMintOrNull();
  if (!mint) {
    console.warn(
      "[sandbox/card-deposit] sandbox mint unconfigured — run scripts/setup-sandbox-mint.mjs.",
    );
    return jsonError("mint-not-configured", 503);
  }

  // 5. Fee-payer (= mint authority) must be configured.
  if (!isFeePayerConfigured()) {
    console.warn(
      "[sandbox/card-deposit] KOMMIT_DEVNET_FEE_PAYER_SECRET unset; cannot mint.",
    );
    return jsonError("fee-payer-not-configured", 503);
  }

  // 6. Cluster confinement — refuse to mint anywhere but devnet.
  try {
    if (!(await isDevnetCluster())) {
      console.warn(
        "[sandbox/card-deposit] configured RPC is not devnet; refusing to mint.",
      );
      return jsonError("wrong-cluster", 503);
    }
  } catch (e) {
    console.warn("[sandbox/card-deposit] cluster check failed:", e);
    return jsonError("rpc", 502);
  }

  // 7. Build + send the mint tx. `createAssociatedTokenAccountIdempotentInstruction`
  // is a no-op if the ATA already exists (the airdrop route created it on
  // first /demo entry), so this tx is safe for both first-and-Nth deposit
  // paths.
  const conn = getDevnetConnection();
  const fp = getFeePayer();
  const ata = getAssociatedTokenAddressSync(mint, wallet, false);
  const mintBase = BigInt(amountUsd) * TOKEN_DECIMALS_DIVISOR;

  const tx = new Transaction();
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
  tx.add(createMintToInstruction(mint, ata, fp.publicKey, mintBase));
  tx.feePayer = fp.publicKey;

  let signature: string;
  try {
    const { blockhash, lastValidBlockHeight } =
      await conn.getLatestBlockhash("confirmed");
    tx.recentBlockhash = blockhash;
    tx.lastValidBlockHeight = lastValidBlockHeight;
    tx.sign(fp);
    signature = await conn.sendRawTransaction(tx.serialize(), {
      skipPreflight: false,
      preflightCommitment: "confirmed",
    });
    await conn.confirmTransaction(
      { signature, blockhash, lastValidBlockHeight },
      "confirmed",
    );
  } catch (e) {
    console.warn("[sandbox/card-deposit] mintTo failed:", e);
    return jsonError("rpc", 502);
  }

  // 8. Record the deposit row. Logged-and-swallowed if it fails — the
  // user already has the tokens onchain, an audit-row gap is non-fatal
  // for the demo and recoverable from Solscan if needed.
  await recordCardDeposit({ wallet: walletStr, amountUsd, signature });

  return NextResponse.json<ResponseBody>({
    ok: true,
    amountUsd,
    txSignature: signature,
  });
}
