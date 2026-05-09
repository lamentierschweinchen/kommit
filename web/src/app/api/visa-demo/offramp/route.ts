/**
 * POST /api/visa-demo/offramp — USDC → fiat sandbox payout.
 *
 * Mirror of /onramp:
 *   1. Auth caller (Privy session).
 *   2. Validate body (amountUSDC + projectPda + cardLast4).
 *   3. Execute the payout at Helio sandbox (mock fallback if no key).
 *   4. Record a structured Memo on devnet — fee-payer signs + submits;
 *      result is the `withdrawTxHash` returned to the client.
 *
 * Same sandbox-honesty caveats as onramp: this does NOT fire the on-chain
 * Anchor `withdraw` instruction. The Memo tx is the Solscan-traceable
 * record of the demo event.
 *
 * Hand-off 41 § E4.
 */

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { PublicKey } from "@solana/web3.js";
import { requireCallerWallet } from "@/lib/auth-server";
import { executePayout } from "@/lib/visa-demo-helio";
import { recordMemo } from "@/lib/visa-demo-rpc";
import { isFeePayerConfigured } from "@/lib/visa-demo-fee-payer";
import { takeRateLimit } from "@/lib/visa-demo-rate-limit";
import { isVisaApiEnabled } from "@/lib/visa-demo-mode";
import {
  amountUSDCBaseSchema,
  idempotencyKeySchema,
} from "@/lib/visa-demo-bounds";
import { lookup, cache } from "@/lib/visa-demo-idempotency";
import type { OfframpResponse } from "@/lib/visa-demo-types";

export const runtime = "nodejs";

const RATE_LIMIT_MS = 5_000;

const STUB_FX_RATE = 1.087; // mirrors visa-demo-stub.ts

// Codex H2: amount is integer + finite + bounded. Codex H1: idempotency key.
const REQ = z.object({
  amountUSDC: amountUSDCBaseSchema,
  projectPda: z.string().min(32).max(64),
  projectSlug: z.string().min(1).max(80),
  cardLast4: z.string().min(4).max(4),
  idempotencyKey: idempotencyKeySchema,
});

type OfframpErrorCode =
  | "withdraw-failed"
  | "offramp-failed"
  | "rate-limit"
  | "idempotency-conflict"
  | "demo-api-disabled";

type OfframpSuccess = Extract<OfframpResponse, { ok: true }>;

function jsonError(error: OfframpErrorCode, status: number): NextResponse {
  const body: OfframpResponse = { ok: false, error };
  return NextResponse.json(body, { status });
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  // 0. Server-side feature gate (Codex M1).
  if (!isVisaApiEnabled()) {
    return jsonError("demo-api-disabled", 503);
  }

  // 1. Auth.
  const authed = await requireCallerWallet(req);
  if (authed instanceof Response) {
    return jsonError("offramp-failed", authed.status);
  }
  const callerWallet = authed.wallet;

  // 2. Validate body BEFORE rate-limit (see onramp comment for rationale).
  let body: z.infer<typeof REQ>;
  try {
    body = REQ.parse(await req.json());
  } catch {
    return jsonError("offramp-failed", 400);
  }

  // 3. Idempotency check (Codex H1).
  const dedup = lookup<OfframpSuccess>(callerWallet, body.idempotencyKey);
  if (dedup.kind === "hit") {
    return NextResponse.json<OfframpResponse>(dedup.result);
  }
  if (dedup.kind === "conflict") {
    return jsonError("idempotency-conflict", 409);
  }

  // 4. Rate limit.
  if (!takeRateLimit(callerWallet, RATE_LIMIT_MS)) {
    return jsonError("rate-limit", 429);
  }

  let user: PublicKey;
  let projectPda: PublicKey;
  try {
    user = new PublicKey(callerWallet);
    projectPda = new PublicKey(body.projectPda);
  } catch {
    return jsonError("offramp-failed", 400);
  }

  // 5. Helio payout.
  let payout;
  try {
    payout = await executePayout({
      amountUSDC: body.amountUSDC,
      destinationCardLast4: body.cardLast4,
    });
    if (payout.status === "failed") {
      return jsonError("offramp-failed", 502);
    }
  } catch (e) {
    console.warn("[visa-demo/offramp] executePayout threw:", e);
    return jsonError("offramp-failed", 502);
  }

  // 6. Memo tx (Codex I1: this is the `memoTxHash` field in the response).
  let memoTxHash = `sandbox-no-feepayer-${Date.now()}`;
  if (isFeePayerConfigured()) {
    try {
      memoTxHash = await recordMemo("offramp", {
        user,
        projectPda,
        amountUSDC: body.amountUSDC,
      });
    } catch (e) {
      console.warn(
        "[visa-demo/offramp] recordMemo failed; memoTxHash will be a placeholder:",
        e,
      );
    }
  } else {
    console.warn(
      "[visa-demo/offramp] KOMMIT_DEVNET_FEE_PAYER_SECRET unset; memoTxHash will be a placeholder.",
    );
  }

  // EUR amount returned to the user (USDC base units → dollars → EUR via FX).
  const amountUSDCDollars = body.amountUSDC / 1_000_000;
  const amountEUR = amountUSDCDollars / STUB_FX_RATE;

  // 7. Cache + return (Codex H1).
  const result: OfframpSuccess = {
    ok: true,
    amountEUR,
    memoTxHash,
    payoutId: payout.payoutId,
  };
  cache(callerWallet, body.idempotencyKey, result);

  return NextResponse.json<OfframpResponse>(result);
}
