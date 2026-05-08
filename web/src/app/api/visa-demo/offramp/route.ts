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
import type { OfframpResponse } from "@/lib/visa-demo-types";

export const runtime = "nodejs";

const RATE_LIMIT_MS = 5_000;

const STUB_FX_RATE = 1.087; // mirrors visa-demo-stub.ts

const REQ = z.object({
  amountUSDC: z.number().positive(), // base units (6 decimals)
  projectPda: z.string().min(32).max(64),
  projectSlug: z.string().min(1).max(80),
  cardLast4: z.string().min(4).max(4),
});

type OfframpErrorCode = "withdraw-failed" | "offramp-failed" | "rate-limit";

function jsonError(error: OfframpErrorCode, status: number): NextResponse {
  const body: OfframpResponse = { ok: false, error };
  return NextResponse.json(body, { status });
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  // 1. Auth.
  const authed = await requireCallerWallet(req);
  if (authed instanceof Response) {
    return jsonError("offramp-failed", authed.status);
  }
  const callerWallet = authed.wallet;

  // 2. Rate limit.
  if (!takeRateLimit(callerWallet, RATE_LIMIT_MS)) {
    return jsonError("rate-limit", 429);
  }

  // 3. Validate body.
  let body: z.infer<typeof REQ>;
  try {
    body = REQ.parse(await req.json());
  } catch {
    return jsonError("offramp-failed", 400);
  }

  let user: PublicKey;
  let projectPda: PublicKey;
  try {
    user = new PublicKey(callerWallet);
    projectPda = new PublicKey(body.projectPda);
  } catch {
    return jsonError("offramp-failed", 400);
  }

  // 4. Helio payout.
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

  // 5. Memo tx.
  let withdrawTxHash = `sandbox-no-feepayer-${Date.now()}`;
  if (isFeePayerConfigured()) {
    try {
      withdrawTxHash = await recordMemo("offramp", {
        user,
        projectPda,
        amountUSDC: body.amountUSDC,
      });
    } catch (e) {
      console.warn(
        "[visa-demo/offramp] recordMemo failed; withdraw hash will be a placeholder:",
        e,
      );
    }
  } else {
    console.warn(
      "[visa-demo/offramp] KOMMIT_DEVNET_FEE_PAYER_SECRET unset; withdrawTxHash will be a placeholder.",
    );
  }

  // EUR amount returned to the user (USDC base units → dollars → EUR via FX).
  const amountUSDCDollars = body.amountUSDC / 1_000_000;
  const amountEUR = amountUSDCDollars / STUB_FX_RATE;

  return NextResponse.json<OfframpResponse>({
    ok: true,
    amountEUR,
    withdrawTxHash,
    payoutId: payout.payoutId,
  });
}
