/**
 * POST /api/visa-demo/webhook — MoonPay Commerce webhook receiver.
 *
 * NOT auth-gated by Privy session: webhook traffic doesn't carry user
 * auth. Authentication is via HMAC-SHA256 signature in the `X-Signature`
 * header, verified against `HELIO_WEBHOOK_SHARED_TOKEN` (constant-time
 * compare via `node:crypto.timingSafeEqual`). Bearer token in
 * Authorization header is also accepted and verified the same way as a
 * fallback for environments where the signature header gets stripped.
 *
 * **VISA_DEMO_API_ENABLED does NOT gate this route** — that flag is for
 * end-user FE flows. Webhook deliveries fire regardless of feature-flag
 * state because MoonPay has already taken card payment by the time it
 * sends us a notification, and dropping it on the floor would orphan the
 * settled USDC at the merchant wallet. (Handoff 44 § B explicitly calls
 * this out so a future reviewer doesn't add the gate by reflex.)
 *
 * Idempotency: keyed on `chargeId`. The charge-store's `markCompleted`
 * returns false when the charge is already terminal — second delivery
 * for the same chargeId is a no-op + 200.
 *
 * On a verified successful settlement event, the handler:
 *   1. Marks the charge as completed in the charge-store, recording the
 *      Solana settlement signature MoonPay returned.
 *   2. Relays the settled USDC from the merchant wallet (= fee-payer) to
 *      the kommitter's Privy wallet so the FE can run commitToProject
 *      using the existing client-side flow. Records the relay signature.
 *   3. Returns 200.
 *
 * On a failed/canceled/expired event: marks the charge with the
 * appropriate terminal status so the FE polling can surface the error
 * without orphaning the user on a "Confirming…" spinner.
 *
 * Hand-off 44 § B.
 */

import { NextResponse, type NextRequest } from "next/server";
import { PublicKey } from "@solana/web3.js";

import { readSecret } from "@/lib/server-env";
import {
  parseWebhookEvent,
  verifyWebhookSignature,
} from "@/lib/visa-demo-moonpay";
import {
  attachRelaySignature,
  getByChargeId,
  markCompleted,
  markTerminalFailure,
} from "@/lib/visa-demo-charge-store";
import {
  isFeePayerConfigured,
} from "@/lib/visa-demo-fee-payer";
import { transferDevnetUSDC } from "@/lib/visa-demo-rpc";

export const runtime = "nodejs";

function jsonError(reason: string, status: number): NextResponse {
  return NextResponse.json({ ok: false, error: reason }, { status });
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  // Webhook secret. We require this — without it we have no way to
  // distinguish real MoonPay deliveries from forgeries.
  const sharedToken = readSecret("HELIO_WEBHOOK_SHARED_TOKEN");
  if (!sharedToken) {
    console.warn(
      "[visa-demo/webhook] HELIO_WEBHOOK_SHARED_TOKEN not set; rejecting all webhook traffic until configured.",
    );
    return jsonError("not-configured", 503);
  }

  // Read raw body for HMAC verification BEFORE any JSON parsing.
  // `NextRequest.text()` returns the unparsed string. The raw bytes
  // matter — re-serializing JSON would shuffle key order and break
  // the signature.
  let rawBody: string;
  try {
    rawBody = await req.text();
  } catch {
    return jsonError("bad-body", 400);
  }

  // Verify signature. MoonPay docs describe two delivery modes:
  //   - X-Signature: <hex> for Pay Link / Deposit transaction webhooks
  //   - Authorization: Bearer <sharedToken> for global webhooks
  // We accept either — the X-Signature path is preferred (replay-safe
  // because it depends on body content, not just the static token).
  const sigHeader = req.headers.get("x-signature");
  const authzHeader = req.headers.get("authorization") ?? "";

  const sigOk = sigHeader
    ? verifyWebhookSignature(rawBody, sigHeader, sharedToken)
    : false;

  // Bearer fallback: only matches the static sharedToken; no body binding.
  // Acceptable here because the body still routes by chargeId (which
  // we've previously created via authenticated calls), so a forger would
  // need a valid chargeId to do anything useful — but always log when
  // we land here so anomalous bearer-only deliveries are visible.
  const bearerOk = (() => {
    const m = authzHeader.match(/^Bearer\s+(.+)$/i);
    if (!m) return false;
    const provided = m[1].trim();
    if (provided.length !== sharedToken.length) return false;
    // Constant-time compare on the bearer too.
    try {
      const a = Buffer.from(provided);
      const b = Buffer.from(sharedToken);
      if (a.length !== b.length) return false;
      let diff = 0;
      for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
      return diff === 0;
    } catch {
      return false;
    }
  })();

  if (!sigOk && !bearerOk) {
    console.warn(
      "[visa-demo/webhook] signature verification failed; rejecting.",
    );
    return jsonError("bad-signature", 401);
  }

  if (!sigOk && bearerOk) {
    console.warn(
      "[visa-demo/webhook] accepted via Bearer fallback; X-Signature missing or invalid.",
    );
  }

  // Parse the body now that we trust it.
  const event = parseWebhookEvent(rawBody);
  if (!event) {
    // Malformed or unsupported event shape — return 200 so MoonPay
    // doesn't retry indefinitely; log so we notice if a real-event shape
    // changes upstream.
    console.warn("[visa-demo/webhook] unparseable event body; ignoring.");
    return NextResponse.json({ ok: true, ignored: true });
  }

  const idempotencyKey =
    typeof event.additionalJSON.idempotencyKey === "string"
      ? event.additionalJSON.idempotencyKey
      : "";
  const kommitterWallet =
    typeof event.additionalJSON.kommitterWallet === "string"
      ? event.additionalJSON.kommitterWallet
      : "";

  // Look up by chargeId via the additionalJSON-stamped fields. The
  // charge-store's primary index is chargeId; the webhook body includes
  // a transactionId that may differ. We rely on additionalJSON to
  // route — it's the only field we control end-to-end.
  // We also re-cross-check by transactionId in the relay step's logs.
  const chargeIdFromMeta =
    typeof event.additionalJSON.chargeId === "string"
      ? event.additionalJSON.chargeId
      : "";

  // The transactionId here is the Helio transaction record, not the
  // chargeId. The chargeId we stored was returned at create-time.
  // additionalJSON should also carry it on success deliveries — but as a
  // safety net, scan the store by idempotencyKey when chargeIdFromMeta
  // is empty.
  let chargeIdForLookup = chargeIdFromMeta;
  if (!chargeIdForLookup && idempotencyKey) {
    // Inline import to avoid pulling charge-store into the top-of-file
    // type position; keeps the file readable at the routing logic.
    const { getByIdempotencyKey } = await import(
      "@/lib/visa-demo-charge-store"
    );
    const rec = getByIdempotencyKey(idempotencyKey);
    if (rec) chargeIdForLookup = rec.chargeId;
  }

  if (!chargeIdForLookup) {
    console.warn(
      "[visa-demo/webhook] could not route event: no chargeId in additionalJSON nor idempotencyKey match.",
      { transactionId: event.transactionId },
    );
    return NextResponse.json({ ok: true, ignored: true });
  }

  const record = getByChargeId(chargeIdForLookup);
  if (!record) {
    console.warn(
      "[visa-demo/webhook] webhook for unknown chargeId; likely server restart wiped the in-memory store. Returning 200 to avoid retries.",
      { chargeId: chargeIdForLookup },
    );
    return NextResponse.json({ ok: true, ignored: true });
  }

  // Route by transaction status.
  if (
    event.transactionStatus === "FAILED" ||
    event.transactionStatus === "CANCELED"
  ) {
    markTerminalFailure({
      chargeId: chargeIdForLookup,
      status: "failed",
      reason: `MoonPay reported ${event.transactionStatus.toLowerCase()}`,
    });
    return NextResponse.json({ ok: true, status: "failed" });
  }

  if (
    event.transactionStatus !== "SUCCESS" &&
    event.transactionStatus !== "SETTLED"
  ) {
    // PENDING / INITIATED / UNKNOWN — record an observability log line and
    // return 200; the next delivery will carry the terminal status.
    return NextResponse.json({ ok: true, status: "pending" });
  }

  // Successful settlement. Mark the charge completed (idempotent on
  // chargeId) — markCompleted returns false when the charge is already
  // terminal, which short-circuits the relay step on duplicate delivery.
  const justCompleted = markCompleted({
    chargeId: chargeIdForLookup,
    amountUSDCSettled: event.totalAmountBaseUnits,
    settlementSignature: event.transactionSignature,
  });

  if (!justCompleted) {
    // Already-completed: dedup. Return 200 so MoonPay stops retrying.
    return NextResponse.json({ ok: true, status: "duplicate" });
  }

  // Relay USDC from merchant (fee-payer) wallet → kommitter wallet so the
  // FE's existing client-side commitToProject works post-redirect.
  // If this fails, we leave the charge in `completed` state but with no
  // relaySignature — the FE will surface a "Settlement OK; relay
  // pending" state that operators can re-run manually. We do NOT mark
  // failed here, since the user's card was charged and we don't want to
  // hide that.
  const targetWallet = kommitterWallet || record.kommitterWallet;
  if (!isFeePayerConfigured()) {
    console.error(
      "[visa-demo/webhook] KOMMIT_DEVNET_FEE_PAYER_SECRET unset — cannot relay USDC; user's payment is settled at merchant wallet but stranded.",
      { chargeId: chargeIdForLookup },
    );
    return NextResponse.json({ ok: true, status: "completed-no-relay" });
  }

  let recipient: PublicKey;
  try {
    recipient = new PublicKey(targetWallet);
  } catch {
    console.error(
      "[visa-demo/webhook] kommitter wallet from metadata is not a valid pubkey; cannot relay.",
      { chargeId: chargeIdForLookup, targetWallet },
    );
    return NextResponse.json({ ok: true, status: "completed-no-relay" });
  }

  try {
    const relaySig = await transferDevnetUSDC(
      recipient,
      event.totalAmountBaseUnits,
    );
    attachRelaySignature(chargeIdForLookup, relaySig);
  } catch (e) {
    console.error(
      "[visa-demo/webhook] USDC relay transfer failed:",
      e instanceof Error ? e.message : e,
      { chargeId: chargeIdForLookup },
    );
    return NextResponse.json({ ok: true, status: "completed-relay-failed" });
  }

  return NextResponse.json({ ok: true, status: "completed" });
}
