/**
 * MoonPay Commerce (Helio post-acquisition) sandbox client for the
 * visa-demo. SERVER-ONLY.
 *
 * Replaces the prior `visa-demo-helio.ts` which was written against an
 * imagined API surface (`/v1/quote`, `/v1/onramp/execute`, `/v1/payout`).
 * None of those endpoints exist on real MoonPay Commerce. The real
 * endpoints we use are:
 *
 *   POST /v1/charge/api-key?apiKey=<KEY>          — create a one-time charge
 *   GET  /v1/charge/{chargeId}?apiKey=<KEY>       — get charge status
 *   POST /v1/webhook/paylink/transaction?apiKey=  — register a webhook
 *
 * Flow shape (handoff 44, β2 — server marks pending, FE finishes commit):
 *
 *   1. User on /visa-demo clicks "Kommit €50". Server calls createCharge
 *      against a pre-existing parent Pay Link (one-time setup; ID held in
 *      `HELIO_PAYMENT_REQUEST_ID`). Response yields `{chargeId, pageUrl}`.
 *   2. Server hands back `pageUrl` (the MoonPay-hosted checkout URL) plus
 *      the `chargeId`. Frontend redirects the user.
 *   3. User completes the card payment on MoonPay. MoonPay POSTs to our
 *      registered webhook URL with HMAC-SHA256 signature in `X-Signature`.
 *      Webhook handler verifies, marks chargeId as completed in the
 *      in-memory charge store, returns 200.
 *   4. MoonPay redirects the user back to `successRedirectUrl` (which we
 *      set at charge creation time, embedding our internal idempotency key
 *      so the FE success page can poll the right charge).
 *   5. Success page polls `/api/visa-demo/charge/{chargeId}` and, on
 *      `completed`, runs the existing client-side `commitToProject` flow.
 *      The kommitter's wallet now holds USDC because the webhook handler
 *      relayed it from the merchant wallet (configured as the Helio
 *      recipient — see HELIO_RECIPIENT_WALLET_ID env var).
 *
 * Auth note: the OpenAPI spec lists both an `apiKey` query parameter AND
 * a `bearer` Authorization header as required for the api-key endpoints.
 * Real-world usage seems to accept either — the docs intro names a single
 * key. To be robust against either contract, we send the same key in
 * BOTH places. If the spec's bearer requirement is enforced, we satisfy
 * it; if only the query is enforced, the redundant header is harmless.
 *
 * Webhook verification (handoff 44 § C): HMAC-SHA256 hex digest of the
 * raw request body, keyed with the per-webhook `sharedToken` returned at
 * registration time. Compared constant-time via `crypto.timingSafeEqual`.
 */

import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

import { readSecret } from "@/lib/server-env";

const HELIO_BASE_URL =
  readSecret("HELIO_BASE_URL") ?? "https://api.dev.hel.io";
const HELIO_API_KEY = readSecret("HELIO_API_KEY");

/** Parent Pay Link ID — set up once via dashboard or
 *  scripts/visa-demo-register-paylink.mjs. Each charge is created against
 *  this Pay Link; the Pay Link's recipient wallet is where USDC settles. */
const HELIO_PAYMENT_REQUEST_ID = readSecret("HELIO_PAYMENT_REQUEST_ID");

/** EUR → USDC reference rate used to compute the USDC amount for a charge.
 *  MoonPay returns the actually-settled USDC in the webhook payload; this
 *  is the *quote-time* estimate we surface to the user pre-redirect. */
const REFERENCE_FX_RATE = 1.087;

export type CreateChargeArgs = {
  /** EUR amount to charge. Caller-validated upstream (visa-demo-bounds). */
  amountEUR: number;
  /** Where MoonPay should redirect the user after a successful payment.
   *  Should embed our internal `idempotencyKey` so the success page can
   *  poll the right charge state. */
  successRedirectUrl: string;
  /** Where MoonPay should redirect on cancel. */
  cancelRedirectUrl: string;
  /** Idempotency key — also stuffed into `additionalJSON` so the webhook
   *  handler can route the completion event back to the right pending
   *  state. Server-generated dedup key from the route. */
  idempotencyKey: string;
  /** Caller's wallet — surfaces in webhook metadata for routing. */
  kommitterWallet: string;
  /** Project on-chain PDA — surfaces in webhook metadata. */
  projectPda: string;
  /** Project slug — for human-readable webhook logs. */
  projectSlug: string;
};

export type MoonPayCharge = {
  /** Helio's charge ID (mongo ObjectId-ish). Used for status polls. */
  chargeId: string;
  /** Hosted checkout URL — frontend redirects here. Format:
   *  https://app.hel.io/charge/<token-uuid>. */
  hostedUrl: string;
  /** EUR amount sent in the request (caller-supplied). */
  amountEUR: number;
  /** Reference USDC amount in base units (6 decimals) at the quote-time
   *  rate. Final settled amount comes through on the webhook. */
  amountUSDC: number;
  /** Reference EUR → USDC rate used. Display-only — webhook is truth. */
  fxRate: number;
};

/** True iff both HELIO_API_KEY and HELIO_PAYMENT_REQUEST_ID are set. Pre-fund
 *  doesn't depend on Helio, but charge creation needs both — without them
 *  the route fails closed (Codex M2 closure: no silent mock fallback). */
export function isMoonPayConfigured(): boolean {
  return !!HELIO_API_KEY && !!HELIO_PAYMENT_REQUEST_ID;
}

/** Compute the reference USDC base units a given EUR amount maps to at the
 *  quote-time fixed rate. Display-only. */
export function referenceUsdcBaseUnits(amountEUR: number): number {
  return Math.round(amountEUR * REFERENCE_FX_RATE * 1_000_000);
}

/**
 * Create a one-time charge against the configured parent Pay Link.
 * Returns the charge ID + hosted checkout URL the FE should redirect to.
 *
 * Throws on misconfiguration or non-2xx response — caller maps to a
 * 502 / 503 error body. We deliberately do NOT fall back to a mock
 * charge: handoff 44 § A reverses the M2 risk-accept; with real APIs
 * available, fail-closed is the right behavior.
 */
export async function createCharge(
  args: CreateChargeArgs,
): Promise<MoonPayCharge> {
  if (!HELIO_API_KEY || !HELIO_PAYMENT_REQUEST_ID) {
    throw new Error(
      "MoonPay Commerce not configured: HELIO_API_KEY and HELIO_PAYMENT_REQUEST_ID must both be set",
    );
  }

  const additionalJSON = JSON.stringify({
    idempotencyKey: args.idempotencyKey,
    kommitterWallet: args.kommitterWallet,
    projectPda: args.projectPda,
    projectSlug: args.projectSlug,
  });

  // Spec: `requestAmount` is a string in base units of the pricing currency.
  // Our parent Pay Link is priced in EUR (a fiat currency on Helio with 2
  // decimals — base units = cents). Callers pass integer EUR (visa-demo-
  // bounds enforces integer + finite + bounded), so multiply by 100 and
  // stringify.
  const requestAmount = String(args.amountEUR * 100);

  const url = `${HELIO_BASE_URL}/v1/charge/api-key?apiKey=${encodeURIComponent(
    HELIO_API_KEY,
  )}`;

  const body = {
    paymentRequestId: HELIO_PAYMENT_REQUEST_ID,
    requestAmount,
    successRedirectUrl: args.successRedirectUrl,
    cancelRedirectUrl: args.cancelRedirectUrl,
    prepareRequestBody: {
      customerDetails: {
        additionalJSON,
      },
    },
  };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      // Belt-and-suspenders auth: query param above + bearer header here.
      Authorization: `Bearer ${HELIO_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `MoonPay createCharge failed (${res.status}): ${text.slice(0, 200)}`,
    );
  }

  // Real response shape per OpenAPI:
  //   { id: string, pageUrl: string }
  const json = (await res.json()) as { id?: string; pageUrl?: string };
  if (!json.id || !json.pageUrl) {
    throw new Error(
      `MoonPay createCharge returned malformed response: ${JSON.stringify(
        json,
      ).slice(0, 200)}`,
    );
  }

  return {
    chargeId: json.id,
    hostedUrl: json.pageUrl,
    amountEUR: args.amountEUR,
    amountUSDC: referenceUsdcBaseUnits(args.amountEUR),
    fxRate: REFERENCE_FX_RATE,
  };
}

/** Webhook event we care about. MoonPay also emits CREATED for subscription
 *  flows etc; this type narrows to the Pay Link transaction shape with the
 *  fields we actually read. Unknown shapes return null from
 *  `parseWebhookEvent` — handler treats those as no-ops. */
export type WebhookTransactionEvent = {
  /** Raw event name from the webhook ("CREATED" for now). */
  eventName: string;
  /** Helio transaction ID. */
  transactionId: string;
  /** Pay Link ID this transaction was made against. */
  paylinkId: string;
  /** On-chain transaction signature (Solana). Empty string until SUCCESS. */
  transactionSignature: string;
  /** Status of the transaction. SUCCESS = paid + settled on-chain. */
  transactionStatus:
    | "INITIATED"
    | "PENDING"
    | "SUCCESS"
    | "FAILED"
    | "CANCELED"
    | "SETTLED"
    | "UNKNOWN";
  /** Total USDC base units actually settled. */
  totalAmountBaseUnits: number;
  /** additionalJSON we attached at charge creation. Empty object on miss. */
  additionalJSON: Record<string, string>;
};

/** Parse the raw JSON webhook body into our typed event shape, or return
 *  null if the body is malformed or for an unsupported event type. */
export function parseWebhookEvent(
  rawBody: string,
): WebhookTransactionEvent | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;
  const root = parsed as Record<string, unknown>;
  const event = typeof root.event === "string" ? root.event : null;
  if (!event) return null;

  const txObject = root.transactionObject;
  if (!txObject || typeof txObject !== "object") return null;
  const tx = txObject as Record<string, unknown>;

  const meta = tx.meta;
  if (!meta || typeof meta !== "object") return null;
  const m = meta as Record<string, unknown>;

  // additionalJSON arrives as a JSON-encoded string inside customerDetails.
  let additionalJSON: Record<string, string> = {};
  const customerDetails = m.customerDetails;
  if (customerDetails && typeof customerDetails === "object") {
    const raw = (customerDetails as Record<string, unknown>).additionalJSON;
    if (typeof raw === "string" && raw.length > 0) {
      try {
        const decoded = JSON.parse(raw);
        if (decoded && typeof decoded === "object") {
          // Stringify everything for safety — webhook content is untrusted.
          additionalJSON = Object.fromEntries(
            Object.entries(decoded as Record<string, unknown>).map(([k, v]) => [
              k,
              String(v),
            ]),
          );
        }
      } catch {
        // additionalJSON unparsable — leave empty, handler can skip routing.
      }
    }
  }

  const transactionId =
    typeof tx.id === "string" ? tx.id : "";
  const paylinkId =
    typeof tx.paylinkId === "string" ? tx.paylinkId : "";
  const transactionSignature =
    typeof m.transactionSignature === "string" ? m.transactionSignature : "";
  const totalAmountStr =
    typeof m.totalAmount === "string" ? m.totalAmount : "0";
  const totalAmountBaseUnits = Number.parseInt(totalAmountStr, 10) || 0;
  const status =
    typeof m.transactionStatus === "string" ? m.transactionStatus : "UNKNOWN";

  const transactionStatus: WebhookTransactionEvent["transactionStatus"] =
    status === "INITIATED" ||
    status === "PENDING" ||
    status === "SUCCESS" ||
    status === "FAILED" ||
    status === "CANCELED" ||
    status === "SETTLED"
      ? status
      : "UNKNOWN";

  return {
    eventName: event,
    transactionId,
    paylinkId,
    transactionSignature,
    transactionStatus,
    totalAmountBaseUnits,
    additionalJSON,
  };
}

/**
 * Verify a webhook signature using HMAC-SHA256 hex digest of the raw body,
 * keyed with the per-webhook `sharedToken`. Constant-time compare via
 * `timingSafeEqual` to defeat timing oracles.
 *
 * Returns false on any error (malformed header, length mismatch, etc.) —
 * the caller maps that to a 401 without leaking which check failed.
 *
 * The header may arrive as `<hex>` or `sha256=<hex>` depending on the
 * MoonPay deployment; we strip a leading `sha256=` if present.
 */
export function verifyWebhookSignature(
  rawBody: string,
  signatureHeader: string | null | undefined,
  sharedToken: string,
): boolean {
  if (!signatureHeader || !sharedToken) return false;

  const provided = signatureHeader.startsWith("sha256=")
    ? signatureHeader.slice("sha256=".length)
    : signatureHeader;

  // Hex characters only — reject anything else outright.
  if (!/^[0-9a-fA-F]+$/.test(provided)) return false;

  const expectedHex = createHmac("sha256", sharedToken)
    .update(rawBody, "utf8")
    .digest("hex");

  if (provided.length !== expectedHex.length) return false;

  try {
    return timingSafeEqual(
      Buffer.from(provided, "hex"),
      Buffer.from(expectedHex, "hex"),
    );
  } catch {
    return false;
  }
}
