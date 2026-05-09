/**
 * GET /api/visa-demo/charge/{chargeId} — read charge state for FE polling.
 *
 * Polled by `/visa-demo/success` after MoonPay redirects the user back.
 * Returns the charge state from the in-memory charge-store written by the
 * webhook handler. The FE gates its "kommit confirmed" UI on
 * `status === "completed"` AND `relaySignature` truthy — intermediate
 * states (`settled`, `relay_pending`, `relay_failed`) keep the FE on
 * the polling page so a still-resolving on-chain relay doesn't surface
 * as a misleading success. (Handoff 46 Codex M2 closure.)
 *
 * Auth: Privy session + caller-wallet-must-match-record check. We
 * deliberately scope visibility per-wallet so an attacker who guesses a
 * chargeId can't probe other users' charge states (the chargeId is
 * MongoDB-objectId-shaped, so guessable in principle).
 *
 * Hand-off 44 § C; hand-off 46 § C.
 */

import { NextResponse, type NextRequest } from "next/server";

import { requireCallerWallet } from "@/lib/auth-server";
import { isVisaApiEnabled } from "@/lib/visa-demo-mode";
import { getByChargeId } from "@/lib/visa-demo-charge-store";
import type { ChargeStatusResponse } from "@/lib/visa-demo-types";

export const runtime = "nodejs";

function jsonError(
  error: Extract<ChargeStatusResponse, { ok: false }>["error"],
  status: number,
): NextResponse {
  const body: ChargeStatusResponse = { ok: false, error };
  return NextResponse.json(body, { status });
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ chargeId: string }> },
): Promise<NextResponse> {
  if (!isVisaApiEnabled()) {
    return jsonError("demo-api-disabled", 503);
  }

  const authed = await requireCallerWallet(req);
  if (authed instanceof Response) {
    return jsonError("auth", authed.status);
  }
  const callerWallet = authed.wallet;

  const { chargeId } = await params;
  if (!chargeId || typeof chargeId !== "string" || chargeId.length > 64) {
    return jsonError("not-found", 404);
  }

  const record = getByChargeId(chargeId);
  if (!record) {
    return jsonError("not-found", 404);
  }

  // Auth-gate: only the wallet that initiated the charge can read it.
  if (record.kommitterWallet !== callerWallet) {
    return jsonError("wrong-wallet", 403);
  }

  const body: ChargeStatusResponse = {
    ok: true,
    chargeId: record.chargeId,
    status: record.status,
    amountUSDCSettled: record.amountUSDCSettled,
    settlementSignature: record.settlementSignature,
    relaySignature: record.relaySignature,
    relayFailureReason: record.relayFailureReason,
    failureReason: record.failureReason,
    projectPda: record.projectPda,
    projectSlug: record.projectSlug,
    idempotencyKey: record.idempotencyKey,
  };
  return NextResponse.json(body);
}
