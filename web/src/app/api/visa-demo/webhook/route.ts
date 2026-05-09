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
 * State machine on a verified successful settlement event (handoff 46
 * Codex M2 closure — see visa-demo-charge-store.ts header for diagram):
 *
 *     pending → markSettled
 *             → tryRelay (atomic CAS to relay_pending)
 *               ├─ relay tx ok    → markCompleted (terminal)
 *               └─ relay tx fail  → markRelayFailed (retryable)
 *
 *     relay_failed → tryRelay (retry on duplicate webhook delivery)
 *                  → … (same branches as above)
 *
 *     completed → return { status: "duplicate" }, no relay attempt
 *     relay_pending → return { status: "relay-in-progress" }
 *
 * Why we split `settled` from `completed`: before handoff 46, the
 * handler called `markCompleted` BEFORE the relay tx succeeded. A
 * fee-payer outage left charges marked complete with no relay signature,
 * the FE redirected the user to "kommit confirmed," and the USDC sat
 * stranded at the merchant wallet. Worse, duplicate webhooks of those
 * stuck charges short-circuited as "duplicate" and never retried the
 * relay. Now `markCompleted` only fires after the relay tx returns a
 * signature, and `relay_failed` is observable + retryable on the next
 * MoonPay duplicate delivery.
 *
 * On a failed/canceled MoonPay event: marks the charge with the
 * appropriate terminal status so the FE polling can surface the error
 * without orphaning the user on a "Confirming…" spinner.
 *
 * Hand-off 44 § B; hand-off 46 § B.
 */

import { NextResponse, type NextRequest } from "next/server";
import { PublicKey } from "@solana/web3.js";

import { readSecret } from "@/lib/server-env";
import {
  parseWebhookEvent,
  verifyWebhookSignature,
} from "@/lib/visa-demo-moonpay";
import {
  type ChargeRecord,
  getByChargeId,
  markCompleted,
  markRelayFailed,
  markSettled,
  markTerminalFailure,
  tryRelay,
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
  const chargeIdFromMeta =
    typeof event.additionalJSON.chargeId === "string"
      ? event.additionalJSON.chargeId
      : "";

  let chargeIdForLookup = chargeIdFromMeta;
  if (!chargeIdForLookup && idempotencyKey) {
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

  // ── Failure-side branch ──────────────────────────────────────────────
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
    // PENDING / INITIATED / UNKNOWN — log and 200; the next delivery
    // will carry the terminal status.
    return NextResponse.json({ ok: true, status: "pending" });
  }

  // ── Success-side branch (state machine) ──────────────────────────────

  // 1. Pending → settled. Records settlement amount + Solana signature.
  if (record.status === "pending") {
    markSettled({
      chargeId: chargeIdForLookup,
      amountUSDCSettled: event.totalAmountBaseUnits,
      settlementSignature: event.transactionSignature,
    });
  }

  // Re-read after the (possible) transition.
  const afterSettle = getByChargeId(chargeIdForLookup);
  if (!afterSettle) {
    return NextResponse.json({ ok: true, ignored: true });
  }

  // 2. Already terminal-completed → duplicate, no relay re-attempt.
  if (afterSettle.status === "completed") {
    return NextResponse.json({ ok: true, status: "duplicate" });
  }

  // 3. Already terminal-failed/expired (shouldn't happen on a SUCCESS
  //    delivery, but defensive — MoonPay shouldn't send SUCCESS after a
  //    prior FAILED/CANCELED for the same charge).
  if (
    afterSettle.status === "failed" ||
    afterSettle.status === "expired"
  ) {
    console.warn(
      "[visa-demo/webhook] SUCCESS event for already-terminal-failed charge; ignoring.",
      { chargeId: chargeIdForLookup, status: afterSettle.status },
    );
    return NextResponse.json({ ok: true, status: "duplicate" });
  }

  // 4. Currently mid-relay (another concurrent webhook already acquired
  //    the slot). Let the in-flight handler finish; respond 200.
  if (afterSettle.status === "relay_pending") {
    return NextResponse.json({ ok: true, status: "relay-in-progress" });
  }

  // 5. settled OR relay_failed → try to acquire the relay slot. The CAS
  //    is atomic by virtue of single-threaded JS: no await between read
  //    and write inside `tryRelay`.
  const acquired = tryRelay(chargeIdForLookup);
  if (!acquired) {
    // Concurrent loser — another handler grabbed the slot between our
    // read above and the CAS. Defer to it.
    return NextResponse.json({ ok: true, status: "relay-in-progress" });
  }

  // 6. We hold the relay slot. Run the merchant→kommitter USDC transfer.
  return await runRelay({
    chargeId: chargeIdForLookup,
    amountBaseUnits: event.totalAmountBaseUnits,
    record: afterSettle,
    kommitterWalletFromMeta: kommitterWallet,
  });
}

/**
 * Execute the merchant→kommitter USDC relay. Caller MUST have acquired
 * the relay slot via `tryRelay` before invoking this. Records terminal
 * state (`completed` on success, `relay_failed` on failure) before
 * returning.
 */
async function runRelay(args: {
  chargeId: string;
  amountBaseUnits: number;
  record: ChargeRecord;
  kommitterWalletFromMeta: string;
}): Promise<NextResponse> {
  const { chargeId, amountBaseUnits, record, kommitterWalletFromMeta } = args;

  if (!isFeePayerConfigured()) {
    const reason = "fee-payer not configured";
    console.error(
      "[visa-demo/webhook] KOMMIT_DEVNET_FEE_PAYER_SECRET unset — cannot relay USDC; charge is settled at merchant wallet but stranded until env is fixed and a duplicate webhook arrives.",
      { chargeId },
    );
    markRelayFailed({ chargeId, reason });
    return NextResponse.json({
      ok: true,
      status: "relay-failed-retryable",
      reason,
    });
  }

  const targetWallet = kommitterWalletFromMeta || record.kommitterWallet;
  let recipient: PublicKey;
  try {
    recipient = new PublicKey(targetWallet);
  } catch {
    // Malformed kommitter address — won't ever succeed. We still mark
    // relay_failed so a duplicate webhook revisits it (operator can fix
    // the metadata in-place by patching the record before retry); but
    // this is the closest thing we have to a non-retryable error and is
    // logged loudly.
    const reason = "kommitter wallet malformed";
    console.error(
      "[visa-demo/webhook] kommitter wallet from metadata is not a valid pubkey; cannot relay.",
      { chargeId, targetWallet },
    );
    markRelayFailed({ chargeId, reason });
    return NextResponse.json({
      ok: true,
      status: "relay-failed-retryable",
      reason,
    });
  }

  try {
    const relaySig = await transferDevnetUSDC(recipient, amountBaseUnits);
    markCompleted({ chargeId, relaySignature: relaySig });
    return NextResponse.json({
      ok: true,
      status: "completed",
      relaySignature: relaySig,
    });
  } catch (e) {
    const reason = e instanceof Error ? e.message : String(e);
    console.error(
      "[visa-demo/webhook] USDC relay transfer failed:",
      reason,
      { chargeId },
    );
    markRelayFailed({ chargeId, reason });
    return NextResponse.json({
      ok: true,
      status: "relay-failed-retryable",
      reason,
    });
  }
}
