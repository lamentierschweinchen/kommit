"use client";

/**
 * Visa-sandbox client seam. Single env flag toggles stub vs live routes.
 *
 *   NEXT_PUBLIC_VISA_SANDBOX=live  → real routes from handoff 41
 *   else (default)                 → in-memory stub
 *
 * Callers import `visaDemo` and never branch — keeps the component code
 * symmetric across the two implementations. When engineer ships the real
 * /api/visa-demo/* routes, flip the env var on Vercel and the same UI
 * starts hitting the network.
 */

import { authedFetch } from "@/lib/api-client";
import { visaDemoStub } from "@/lib/visa-demo-stub";
import type {
  OfframpRequest,
  OfframpResponse,
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
  onramp: (req: OnrampRequest) => postJSON<OnrampResponse>("/api/visa-demo/onramp", req),
  offramp: (req: OfframpRequest) => postJSON<OfframpResponse>("/api/visa-demo/offramp", req),
};

export const visaDemo: VisaDemoClient = USE_REAL_ROUTES ? visaDemoLive : visaDemoStub;
