/**
 * POST /api/visa-demo/pre-fund — devnet SOL gas-sponsor for the Visa demo.
 *
 * Idempotent + rate-limited:
 *   - If the caller's wallet already has > THRESHOLD_LAMPORTS, return the
 *     current balance without sending anything (idempotent skip).
 *   - Otherwise, transfer GAS_GRANT_LAMPORTS from the server-held fee-payer.
 *   - Each wallet can call at most once per RATE_LIMIT_MS window.
 *
 * Auth: Privy session via requireCallerWallet (or the mock-wallet header in
 * dev mode — see lib/auth-server.ts for the gate).
 *
 * Response shape (PreFundResponse) is locked by lib/visa-demo-types.ts:
 *   { ok: true, lamports: number }                            — current balance
 *   { ok: false, error: "auth" | "rpc" | "rate-limit" }       — failure
 *
 * Hand-off 41 § E2.
 */

import { NextResponse, type NextRequest } from "next/server";
import { PublicKey } from "@solana/web3.js";
import { requireCallerWallet } from "@/lib/auth-server";
import {
  getDevnetConnection,
  getLamports,
  transferLamports,
  SOL,
} from "@/lib/visa-demo-rpc";
import { isFeePayerConfigured } from "@/lib/visa-demo-fee-payer";
import { takeRateLimit } from "@/lib/visa-demo-rate-limit";
import { isVisaApiEnabled } from "@/lib/visa-demo-mode";
import type { PreFundResponse } from "@/lib/visa-demo-types";

export const runtime = "nodejs";

const THRESHOLD_LAMPORTS = 5_000_000;   // 0.005 SOL — above this, skip
const GAS_GRANT_LAMPORTS = 10_000_000;  // 0.01 SOL — covers many commits
const RATE_LIMIT_MS = 60_000;           // 1 pre-fund per wallet per 60s

type PreFundErrorCode = "auth" | "rpc" | "rate-limit" | "demo-api-disabled";

function jsonError(error: PreFundErrorCode, status: number): NextResponse {
  const body: PreFundResponse = { ok: false, error };
  return NextResponse.json(body, { status });
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  // 0. Server-side feature gate (Codex M1). Independent of the FE
  //    NEXT_PUBLIC_VISA_SANDBOX flag. Must come BEFORE auth so a disabled
  //    deploy doesn't burn an auth roundtrip + log auth-success messages
  //    for traffic the route is configured to refuse.
  if (!isVisaApiEnabled()) {
    return jsonError("demo-api-disabled", 503);
  }

  // 1. Auth.
  const authed = await requireCallerWallet(req);
  if (authed instanceof Response) {
    // requireCallerWallet returns its own JSON on failure; rewrap into the
    // visa-demo error shape so the client's `PreFundResponse` is always
    // tag-matched.
    return jsonError("auth", authed.status);
  }
  const { wallet: walletStr } = authed;

  let wallet: PublicKey;
  try {
    wallet = new PublicKey(walletStr);
  } catch {
    return jsonError("auth", 401);
  }

  // 2. Rate limit (per wallet).
  if (!takeRateLimit(walletStr, RATE_LIMIT_MS)) {
    return jsonError("rate-limit", 429);
  }

  // 3. Read current balance.
  let lamports: number;
  try {
    lamports = await getLamports(wallet);
  } catch (e) {
    console.warn("[visa-demo/pre-fund] balance read failed:", e);
    return jsonError("rpc", 502);
  }

  // 4. Idempotent skip if already funded.
  if (lamports >= THRESHOLD_LAMPORTS) {
    return NextResponse.json<PreFundResponse>({ ok: true, lamports });
  }

  // 5. Fee-payer must be configured to actually send.
  if (!isFeePayerConfigured()) {
    // No keypair available — sandbox can't sponsor. Return rpc so the
    // frontend's error path lights up cleanly. Logged so an operator
    // notices the misconfiguration in Vercel logs.
    console.warn(
      "[visa-demo/pre-fund] KOMMIT_DEVNET_FEE_PAYER_SECRET unset; cannot sponsor gas. See web/src/lib/visa-demo-fee-payer.ts for setup steps.",
    );
    return jsonError("rpc", 503);
  }

  // 6. Transfer + confirm.
  try {
    await transferLamports(wallet, GAS_GRANT_LAMPORTS);
  } catch (e) {
    console.warn("[visa-demo/pre-fund] transferLamports failed:", e);
    return jsonError("rpc", 502);
  }

  // 7. Re-read post-transfer balance to return ground truth.
  let after: number;
  try {
    // Force-fresh read against the latest finalized slot — the just-sent
    // transfer should be visible after the confirmTransaction inside
    // transferLamports, but defensive re-read is cheap.
    after = await getDevnetConnection().getBalance(wallet, "confirmed");
  } catch {
    after = lamports + GAS_GRANT_LAMPORTS;
  }

  // Sanity: at least one full SOL is suspicious — log if so.
  if (after >= 1 * SOL) {
    console.info(
      `[visa-demo/pre-fund] caller wallet now holds ${after} lamports (≈ ${(after / SOL).toFixed(3)} SOL); fee-payer drain risk if heavily called.`,
    );
  }

  return NextResponse.json<PreFundResponse>({ ok: true, lamports: after });
}
