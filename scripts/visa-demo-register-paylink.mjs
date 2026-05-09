#!/usr/bin/env node
/**
 * One-time setup: create the parent Pay Link our visa-demo charges hang off.
 *
 * Background: MoonPay Commerce's `POST /v1/charge/api-key` requires a
 * `paymentRequestId` — the ID of an existing Pay Link. We create one
 * dynamic, card-payable Pay Link priced in EUR with USDC settlement on
 * Solana devnet, and stash its ID as `HELIO_PAYMENT_REQUEST_ID` for the
 * runtime onramp route to use.
 *
 * Usage:
 *
 *   HELIO_API_KEY=<your-jwt> \
 *     HELIO_RECIPIENT_WALLET_ID=<helio-wallet-id> \
 *     HELIO_USDC_CURRENCY_ID=<helio-usdc-currency-id> \
 *     HELIO_EUR_CURRENCY_ID=<helio-eur-currency-id> \
 *     node app/scripts/visa-demo-register-paylink.mjs
 *
 * The `walletId` and `currencyId` values come from MoonPay Commerce's
 * dashboard (Settings → Wallets and the `/v1/currency/all` endpoint, or
 * dashboard → Currencies). Lukas creates the merchant wallet pointing at
 * the fee-payer pubkey he set in `KOMMIT_DEVNET_FEE_PAYER_SECRET`, then
 * runs this script. Output: the Pay Link ID to paste into
 * `HELIO_PAYMENT_REQUEST_ID` in Vercel + .env.local.
 *
 * The Pay Link is configured with:
 *   - dynamic + canChangePrice: per-charge amount is set at charge create time
 *   - canPayWithCard: enables MoonPay-Ramps card path on the hosted page
 *   - shouldRedirectOnSuccess: success-redirect override on the charge fires
 *   - showDetailsForCharge: surfaces the charge name/description on hosted
 */

const HELIO_BASE_URL =
  process.env.HELIO_BASE_URL?.trim() || "https://api.dev.hel.io";
const HELIO_API_KEY = process.env.HELIO_API_KEY?.trim();
const HELIO_RECIPIENT_WALLET_ID = process.env.HELIO_RECIPIENT_WALLET_ID?.trim();
const HELIO_USDC_CURRENCY_ID = process.env.HELIO_USDC_CURRENCY_ID?.trim();
const HELIO_EUR_CURRENCY_ID = process.env.HELIO_EUR_CURRENCY_ID?.trim();
const SOLANA_BLOCKCHAIN_ENGINE_ID = "63b6b1200cfb4b3f6131f2b4"; // per OpenAPI

if (!HELIO_API_KEY) {
  console.error("HELIO_API_KEY not set");
  process.exit(1);
}
if (!HELIO_RECIPIENT_WALLET_ID) {
  console.error(
    "HELIO_RECIPIENT_WALLET_ID not set (create the merchant wallet in the Helio dashboard first)",
  );
  process.exit(1);
}
if (!HELIO_USDC_CURRENCY_ID) {
  console.error(
    "HELIO_USDC_CURRENCY_ID not set (look it up via GET /v1/currency/all or dashboard)",
  );
  process.exit(1);
}
if (!HELIO_EUR_CURRENCY_ID) {
  console.error("HELIO_EUR_CURRENCY_ID not set");
  process.exit(1);
}

const url = `${HELIO_BASE_URL}/v1/paylink/create/api-key?apiKey=${encodeURIComponent(
  HELIO_API_KEY,
)}`;

// Default redirect target. Override with `BASE_URL=https://kommit.now`
// when registering against production. The per-charge `successRedirectUrl`
// override is the authoritative URL — this is just the pay-link-level
// fallback in case the per-charge override doesn't kick in.
const BASE_URL =
  (process.env.BASE_URL || "http://localhost:3000").replace(/\/$/, "");

const body = {
  template: "OTHER",
  name: "Kommit (visa-demo)",
  description:
    "Card-funded kommit on Solana. Sandbox preview — devnet USDC, no real funds.",
  // EUR is the pricing currency; per-charge amount is set at create time
  // because we set `dynamic: true` below.
  pricingCurrency: HELIO_EUR_CURRENCY_ID,
  // Default price (overridden per charge). 100 cents = €1.
  price: "100",
  dynamic: true,
  features: {
    canChangePrice: true,
    canPayWithCard: true,
    shouldRedirectOnSuccess: true,
    showDetailsForCharge: true,
  },
  recipients: [
    {
      currencyId: HELIO_USDC_CURRENCY_ID,
      walletId: HELIO_RECIPIENT_WALLET_ID,
      sourceBlockchainEngine: SOLANA_BLOCKCHAIN_ENGINE_ID,
    },
  ],
  redirectUrl: `${BASE_URL}/visa-demo/success`,
  redirectTimeout: 0,
  creationSource: "PUBLIC_API",
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
  console.error(`paylink create failed (${res.status}):`, text);
  process.exit(1);
}

const json = await res.json();
console.log("Pay Link created.");
console.log(JSON.stringify(json, null, 2));
console.log("");
const id = json.id || json.paylinkId;
if (id) {
  console.log(`HELIO_PAYMENT_REQUEST_ID=${id}`);
  console.log("");
  console.log(
    "Paste the value above into your .env.local and Vercel preview/production env (Sensitive).",
  );
}
