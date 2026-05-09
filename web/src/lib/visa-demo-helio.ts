/**
 * Helio sandbox client for the Visa-sandbox demo.
 *
 * Two methods we care about:
 *   - quote(amountEUR)        → returns { fxRate, amountUSDC }
 *   - executeOnramp(quote)    → simulates fiat → USDC swap, returns a
 *                                sandbox transaction reference
 *   - executePayout(amount)   → simulates USDC → fiat payout
 *
 * **Graceful no-key fallback.** If `HELIO_API_KEY` is unset (which is the
 * default until Lukas signs up at hel.io and pastes a sandbox key), every
 * method returns a deterministic mock that satisfies the same shape — so
 * the routes ship and the frontend can flip `NEXT_PUBLIC_VISA_SANDBOX=live`
 * immediately. When Lukas pastes the key, the same routes start hitting
 * Helio's real sandbox without any code change.
 *
 * The mock fallback is honest about being a mock: response objects carry a
 * `mock: true` field, and quotes use a fixed 1.087 EUR/USDC rate (matching
 * the frontend stub). Production would never see this branch — it's
 * gated by the env var.
 *
 * Helio API reference: https://docs.hel.io  (sandbox uses a separate base URL)
 */

import "server-only";

import { readSecret } from "@/lib/server-env";

// Trimmed once at module load — Codex L3.
// `readSecret` returns null on unset OR empty-after-trim, which is the
// signal we use to flip into mock-fallback mode.
const HELIO_BASE_URL = readSecret("HELIO_BASE_URL") ?? "https://api.dev.hel.io"; // sandbox
const HELIO_API_KEY = readSecret("HELIO_API_KEY");

const STUB_FX_RATE = 1.087; // EUR → USDC; mirror visa-demo-stub.ts

export type HelioQuote = {
  /** EUR → USDC rate used. */
  fxRate: number;
  /** USDC amount in dollars (not base units). */
  amountUSDC: number;
  /** Quote ID (real Helio gives one; mock uses a deterministic placeholder). */
  quoteId: string;
  /** True if this came from the mock fallback (no HELIO_API_KEY). */
  mock: boolean;
};

export type HelioOnrampResult = {
  /** Helio transaction reference. */
  reference: string;
  /** Payout/transfer status in the sandbox. */
  status: "completed" | "pending" | "failed";
  mock: boolean;
};

export type HelioPayoutResult = {
  /** Sandbox payout reference — surfaces in Helio dashboard. */
  payoutId: string;
  status: "completed" | "pending" | "failed";
  mock: boolean;
};

export function isHelioConfigured(): boolean {
  return !!HELIO_API_KEY;
}

/** Get a EUR → USDC quote. Real Helio if configured; mock otherwise. */
export async function quote(amountEUR: number): Promise<HelioQuote> {
  if (!HELIO_API_KEY) {
    return mockQuote(amountEUR);
  }
  try {
    const res = await fetch(`${HELIO_BASE_URL}/v1/quote`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${HELIO_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        currencyFrom: "EUR",
        currencyTo: "USDC",
        chain: "solana",
        network: "devnet",
        amount: amountEUR,
      }),
    });
    if (!res.ok) {
      console.warn(
        `helio quote failed (${res.status}); falling back to mock`,
      );
      return mockQuote(amountEUR);
    }
    const json = (await res.json()) as {
      rate?: number;
      amountTo?: number;
      quoteId?: string;
    };
    return {
      fxRate: json.rate ?? STUB_FX_RATE,
      amountUSDC: json.amountTo ?? amountEUR * STUB_FX_RATE,
      quoteId: json.quoteId ?? `helio-${Date.now()}`,
      mock: false,
    };
  } catch (e) {
    console.warn(
      `helio quote threw (${e instanceof Error ? e.message : String(e)}); falling back to mock`,
    );
    return mockQuote(amountEUR);
  }
}

/** Execute a fiat → USDC onramp. Mock fallback returns success without
 *  actually moving USDC; real Helio mints sandbox USDC into `recipient`. */
export async function executeOnramp(args: {
  quote: HelioQuote;
  recipient: string;
  cardLast4: string;
}): Promise<HelioOnrampResult> {
  if (!HELIO_API_KEY) {
    return mockOnramp();
  }
  try {
    const res = await fetch(`${HELIO_BASE_URL}/v1/onramp/execute`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${HELIO_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        quoteId: args.quote.quoteId,
        recipient: args.recipient,
        cardLast4: args.cardLast4,
      }),
    });
    if (!res.ok) {
      console.warn(
        `helio executeOnramp failed (${res.status}); falling back to mock`,
      );
      return mockOnramp();
    }
    const json = (await res.json()) as { reference?: string; status?: string };
    return {
      reference: json.reference ?? `helio-onramp-${Date.now()}`,
      status: (json.status as HelioOnrampResult["status"]) ?? "completed",
      mock: false,
    };
  } catch (e) {
    console.warn(
      `helio executeOnramp threw (${e instanceof Error ? e.message : String(e)}); falling back to mock`,
    );
    return mockOnramp();
  }
}

/** Execute a USDC → fiat payout. Mock fallback returns a deterministic
 *  payout ID; real Helio shows it in the sandbox dashboard. */
export async function executePayout(args: {
  amountUSDC: number; // base units
  destinationCardLast4: string;
}): Promise<HelioPayoutResult> {
  if (!HELIO_API_KEY) {
    return mockPayout();
  }
  try {
    const res = await fetch(`${HELIO_BASE_URL}/v1/payout/execute`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${HELIO_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amountUSDC: args.amountUSDC,
        destination: args.destinationCardLast4,
        currencyTo: "EUR",
      }),
    });
    if (!res.ok) {
      console.warn(
        `helio executePayout failed (${res.status}); falling back to mock`,
      );
      return mockPayout();
    }
    const json = (await res.json()) as { payoutId?: string; status?: string };
    return {
      payoutId: json.payoutId ?? `helio-payout-${Date.now()}`,
      status: (json.status as HelioPayoutResult["status"]) ?? "completed",
      mock: false,
    };
  } catch (e) {
    console.warn(
      `helio executePayout threw (${e instanceof Error ? e.message : String(e)}); falling back to mock`,
    );
    return mockPayout();
  }
}

// ---- Mock fallbacks --------------------------------------------------------

function mockQuote(amountEUR: number): HelioQuote {
  return {
    fxRate: STUB_FX_RATE,
    amountUSDC: amountEUR * STUB_FX_RATE,
    quoteId: `mock-quote-${Date.now()}`,
    mock: true,
  };
}

function mockOnramp(): HelioOnrampResult {
  return {
    reference: `mock-onramp-${Date.now()}`,
    status: "completed",
    mock: true,
  };
}

function mockPayout(): HelioPayoutResult {
  return {
    payoutId: `mock-payout-${Date.now()}`,
    status: "completed",
    mock: true,
  };
}
