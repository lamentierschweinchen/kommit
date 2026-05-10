#!/usr/bin/env node
/**
 * One-time setup: register a transaction webhook on the visa-demo Pay Link.
 *
 * Background: MoonPay Commerce delivers webhook notifications to a URL we
 * register against a specific Pay Link. The webhook is signed with a
 * shared token returned at registration time. This script creates the
 * registration and prints the `sharedToken` for `HELIO_WEBHOOK_SHARED_TOKEN`.
 *
 * MoonPay Commerce auth model is two-key: the public API key (the dotted
 * JWT visible in the dashboard's "Public API Key" field) goes in the
 * `?apiKey=` query parameter as the merchant identifier, and the secret
 * API key (the `+`-separated value in the "Secret API Key" field) goes in
 * the `Authorization: Bearer …` header as the actual credential. Both are
 * required for /v1/webhook/* endpoints.
 *
 * Usage:
 *
 *   HELIO_PUBLIC_API_KEY=<dotted-jwt> \
 *     HELIO_SECRET_API_KEY=<plus-separated-secret> \
 *     HELIO_PAYMENT_REQUEST_ID=<paylink-id> \
 *     WEBHOOK_TARGET_URL=https://kommit.now/api/visa-demo/webhook \
 *     node app/scripts/visa-demo-register-webhook.mjs
 *
 * Backward compat: legacy HELIO_API_KEY is still accepted as a fallback for
 * HELIO_PUBLIC_API_KEY (the prior single-key shape that worked for
 * /v1/paylink/create/api-key).
 *
 * The target URL must be reachable from the public internet. For local
 * dev, expose your dev server via ngrok / Cloudflare Tunnel and pass that
 * URL. For staging / prod, use the Vercel deploy URL.
 *
 * Output: the `sharedToken` to paste into `HELIO_WEBHOOK_SHARED_TOKEN`.
 *
 * Hand-off 44 § F.
 */

const HELIO_BASE_URL =
  process.env.HELIO_BASE_URL?.trim() || "https://api.dev.hel.io";
const HELIO_PUBLIC_API_KEY =
  process.env.HELIO_PUBLIC_API_KEY?.trim() ||
  process.env.HELIO_API_KEY?.trim();
const HELIO_SECRET_API_KEY = process.env.HELIO_SECRET_API_KEY?.trim();
const HELIO_PAYMENT_REQUEST_ID = process.env.HELIO_PAYMENT_REQUEST_ID?.trim();
const WEBHOOK_TARGET_URL = process.env.WEBHOOK_TARGET_URL?.trim();

if (!HELIO_PUBLIC_API_KEY) {
  console.error(
    "HELIO_PUBLIC_API_KEY (or legacy HELIO_API_KEY) not set — the dotted JWT from the dashboard's 'Public API Key' field",
  );
  process.exit(1);
}
if (!HELIO_SECRET_API_KEY) {
  console.error(
    "HELIO_SECRET_API_KEY not set — the '+'-separated value from the dashboard's 'Secret API Key' field",
  );
  process.exit(1);
}
if (!HELIO_PAYMENT_REQUEST_ID) {
  console.error(
    "HELIO_PAYMENT_REQUEST_ID not set (run register-paylink.mjs first)",
  );
  process.exit(1);
}
if (!WEBHOOK_TARGET_URL) {
  console.error(
    "WEBHOOK_TARGET_URL not set (e.g. https://kommit.now/api/visa-demo/webhook)",
  );
  process.exit(1);
}

const url = `${HELIO_BASE_URL}/v1/webhook/paylink/transaction?apiKey=${encodeURIComponent(
  HELIO_PUBLIC_API_KEY,
)}`;

const body = {
  events: "CREATED",
  paylinkId: HELIO_PAYMENT_REQUEST_ID,
  targetUrl: WEBHOOK_TARGET_URL,
};

const res = await fetch(url, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${HELIO_SECRET_API_KEY}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify(body),
});

if (!res.ok) {
  const text = await res.text();
  console.error(`webhook register failed (${res.status}):`, text);
  process.exit(1);
}

const json = await res.json();
console.log("Webhook registered.");
console.log(JSON.stringify(json, null, 2));
console.log("");
if (json.sharedToken) {
  console.log(`HELIO_WEBHOOK_SHARED_TOKEN=${json.sharedToken}`);
  console.log("");
  console.log(
    "Paste the value above into your .env.local and Vercel preview/production env (Sensitive). Lost tokens cannot be retrieved — re-run this script to issue a new one.",
  );
}
