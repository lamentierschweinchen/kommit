#!/usr/bin/env node
/**
 * One-time setup: register a transaction webhook on the visa-demo Pay Link.
 *
 * Background: MoonPay Commerce delivers webhook notifications to a URL we
 * register against a specific Pay Link. The webhook is signed with a
 * shared token returned at registration time. This script creates the
 * registration and prints the `sharedToken` for `HELIO_WEBHOOK_SHARED_TOKEN`.
 *
 * Usage:
 *
 *   HELIO_API_KEY=<your-jwt> \
 *     HELIO_PAYMENT_REQUEST_ID=<paylink-id> \
 *     WEBHOOK_TARGET_URL=https://kommit.now/api/visa-demo/webhook \
 *     node app/scripts/visa-demo-register-webhook.mjs
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
const HELIO_API_KEY = process.env.HELIO_API_KEY?.trim();
const HELIO_PAYMENT_REQUEST_ID = process.env.HELIO_PAYMENT_REQUEST_ID?.trim();
const WEBHOOK_TARGET_URL = process.env.WEBHOOK_TARGET_URL?.trim();

if (!HELIO_API_KEY) {
  console.error("HELIO_API_KEY not set");
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
  HELIO_API_KEY,
)}`;

const body = {
  events: "CREATED",
  paylinkId: HELIO_PAYMENT_REQUEST_ID,
  targetUrl: WEBHOOK_TARGET_URL,
};

const res = await fetch(url, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${HELIO_API_KEY}`,
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
