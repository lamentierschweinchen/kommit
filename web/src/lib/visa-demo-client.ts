"use client";

/**
 * Visa-sandbox client seam. Single env flag toggles stub vs live routes.
 *
 *   NEXT_PUBLIC_VISA_SANDBOX=live  → real /api/visa-demo/* routes
 *   else (default)                 → in-memory stub
 *
 * Callers import `visaDemo` and never branch — keeps the component code
 * symmetric across the two implementations.
 *
 * Handoff 44: the `offramp` method is gone — MoonPay Commerce has no
 * offramp endpoint, so withdraw stays on the existing on-chain Anchor
 * `WithdrawModal` flow with visa-mode chrome. The new `chargeStatus`
 * method is what the success page polls after a redirect.
 */

import { authedFetch } from "@/lib/api-client";
import { visaDemoStub } from "@/lib/visa-demo-stub";
import type {
  ChargeStatusResponse,
  OnrampRequest,
  OnrampResponse,
  PreFundResponse,
  VisaDemoClient,
} from "@/lib/visa-demo-types";

const USE_REAL_ROUTES = process.env.NEXT_PUBLIC_VISA_SANDBOX === "live";

async function postJSON<T>(url: string, body: unknown): Promise<T> {
  const res = await authedFetch(url, {
    method: "POST",
    body: JSON.stringify(body),
  });
  return (await res.json()) as T;
}

const visaDemoLive: VisaDemoClient = {
  preFund: () =>
    authedFetch("/api/visa-demo/pre-fund", { method: "POST" }).then(
      (r) => r.json() as Promise<PreFundResponse>,
    ),
  onramp: (req: OnrampRequest) =>
    postJSON<OnrampResponse>("/api/visa-demo/onramp", req),
  chargeStatus: (chargeId: string) =>
    authedFetch(`/api/visa-demo/charge/${encodeURIComponent(chargeId)}`).then(
      (r) => r.json() as Promise<ChargeStatusResponse>,
    ),
};

export const visaDemo: VisaDemoClient = USE_REAL_ROUTES
  ? visaDemoLive
  : visaDemoStub;
