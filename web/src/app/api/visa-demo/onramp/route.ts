/**
 * POST /api/visa-demo/onramp — create a MoonPay Commerce charge and
 * return the hosted-checkout URL the frontend should redirect to.
 *
 * The flow (handoff 44, β2):
 *   1. Auth caller (Privy session).
 *   2. Validate body (amountEUR + projectPda + projectSlug + idempotencyKey).
 *      Card details are NOT collected here — the user enters them on
 *      MoonPay's hosted page after the redirect.
 *   3. Idempotency check on (wallet, idempotencyKey).
 *   4. Rate limit.
 *   5. createCharge against the configured parent Pay Link.
 *   6. Record the charge in `visa-demo-charge-store` keyed by chargeId
 *      (with idempotencyKey as a secondary index) so the webhook can
 *      complete it and the FE can poll its state.
 *   7. Return `{ chargeId, hostedUrl, ... }` — caller redirects.
 *
 * Codex closures applied here:
 *   - M1 (server-side gate)         — VISA_DEMO_API_ENABLED checked first
 *   - M2 (fail-closed live mode)    — no mock fallback; createCharge
 *                                      throws and we 502 on real failures
 *   - M3 (ignore caller fxRate)     — moot in the new shape; amount is
 *                                      whole-EUR and reference USDC is
 *                                      derived server-side
 *   - H1 (idempotency)              — request-level dedup; webhook-level
 *                                      dedup lives in the webhook route
 *   - H2 (amount bounds)            — amountEURSchema (integer, finite,
 *                                      [1, MAX_DEMO_EUR])
 *   - L3 (trim secrets)             — readSecret used in moonpay client
 *
 * Hand-off 44 § D.
 */

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { PublicKey } from "@solana/web3.js";

import { requireCallerWallet } from "@/lib/auth-server";
import { takeRateLimit } from "@/lib/visa-demo-rate-limit";
import { isVisaApiEnabled } from "@/lib/visa-demo-mode";
import {
  amountEURSchema,
  idempotencyKeySchema,
} from "@/lib/visa-demo-bounds";
import { lookup, cache } from "@/lib/visa-demo-idempotency";
import {
  createCharge,
  isMoonPayConfigured,
  referenceUsdcBaseUnits,
} from "@/lib/visa-demo-moonpay";
import { recordPending } from "@/lib/visa-demo-charge-store";
import type { OnrampResponse } from "@/lib/visa-demo-types";

export const runtime = "nodejs";

const RATE_LIMIT_MS = 5_000; // 1 onramp per wallet per 5s

const REFERENCE_FX_RATE = 1.087;

const REQ = z.object({
  amountEUR: amountEURSchema,
  projectPda: z.string().min(32).max(64),
  projectSlug: z.string().min(1).max(80),
  idempotencyKey: idempotencyKeySchema,
});

type OnrampErrorCode =
  | "charge-failed"
  | "rate-limit"
  | "idempotency-conflict"
  | "demo-api-disabled"
  | "moonpay-not-configured";

type OnrampSuccess = Extract<OnrampResponse, { ok: true }>;

function jsonError(error: OnrampErrorCode, status: number): NextResponse {
  const body: OnrampResponse = { ok: false, error };
  return NextResponse.json(body, { status });
}

/** Build the success-redirect URL. We embed the idempotencyKey so the
 *  /visa-demo/success page can poll the right charge state via the
 *  charge-store's secondary index, regardless of how MoonPay encodes
 *  any extra query params it appends. */
function buildSuccessRedirect(req: NextRequest, idempotencyKey: string): string {
  const origin = new URL(req.url).origin;
  return `${origin}/visa-demo/success?ik=${encodeURIComponent(idempotencyKey)}`;
}

function buildCancelRedirect(req: NextRequest): string {
  const origin = new URL(req.url).origin;
  return `${origin}/visa-demo/cancel`;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  // 0. Server-side feature gate (Codex M1).
  if (!isVisaApiEnabled()) {
    return jsonError("demo-api-disabled", 503);
  }

  // 1. Auth.
  const authed = await requireCallerWallet(req);
  if (authed instanceof Response) {
    return jsonError("charge-failed", authed.status);
  }
  const callerWallet = authed.wallet;

  // 2. Validate body BEFORE rate-limit so an idempotent retry of an
  //    already-cached operation can short-circuit even if the caller is
  //    inside the rate-limit window.
  let body: z.infer<typeof REQ>;
  try {
    body = REQ.parse(await req.json());
  } catch {
    return jsonError("charge-failed", 400);
  }

  // 3. Idempotency check (Codex H1).
  const dedup = lookup<OnrampSuccess>(callerWallet, body.idempotencyKey);
  if (dedup.kind === "hit") {
    return NextResponse.json<OnrampResponse>(dedup.result);
  }
  if (dedup.kind === "conflict") {
    return jsonError("idempotency-conflict", 409);
  }

  // 4. Rate limit.
  if (!takeRateLimit(callerWallet, RATE_LIMIT_MS)) {
    return jsonError("rate-limit", 429);
  }

  // 5. Validate the projectPda parses as a real public key — surface a
  //    400 cleanly rather than letting the downstream commit step blow up.
  try {
    new PublicKey(body.projectPda);
  } catch {
    return jsonError("charge-failed", 400);
  }

  // 6. MoonPay readiness — fail closed if env isn't configured (Codex M2).
  if (!isMoonPayConfigured()) {
    console.warn(
      "[visa-demo/onramp] MoonPay Commerce not configured (HELIO_API_KEY or HELIO_PAYMENT_REQUEST_ID unset); failing closed.",
    );
    return jsonError("moonpay-not-configured", 503);
  }

  // 7. Create the charge.
  let charge;
  try {
    charge = await createCharge({
      amountEUR: body.amountEUR,
      successRedirectUrl: buildSuccessRedirect(req, body.idempotencyKey),
      cancelRedirectUrl: buildCancelRedirect(req),
      idempotencyKey: body.idempotencyKey,
      kommitterWallet: callerWallet,
      projectPda: body.projectPda,
      projectSlug: body.projectSlug,
    });
  } catch (e) {
    console.warn(
      "[visa-demo/onramp] createCharge threw:",
      e instanceof Error ? e.message : e,
    );
    return jsonError("charge-failed", 502);
  }

  // 8. Record the pending charge so the webhook handler can complete it
  //    and the FE can poll its state.
  recordPending({
    chargeId: charge.chargeId,
    kommitterWallet: callerWallet,
    projectPda: body.projectPda,
    projectSlug: body.projectSlug,
    amountUSDCReference: referenceUsdcBaseUnits(body.amountEUR),
    idempotencyKey: body.idempotencyKey,
  });

  // 9. Cache the response keyed by (wallet, idempotencyKey) before
  //    returning, so the next retry within IDEMPOTENCY_TTL_MS is a no-op
  //    that returns the same chargeId/hostedUrl.
  const result: OnrampSuccess = {
    ok: true,
    chargeId: charge.chargeId,
    hostedUrl: charge.hostedUrl,
    amountUSDC: charge.amountUSDC,
    fxRate: REFERENCE_FX_RATE,
    idempotencyKey: body.idempotencyKey,
  };
  cache(callerWallet, body.idempotencyKey, result);

  return NextResponse.json<OnrampResponse>(result);
}
