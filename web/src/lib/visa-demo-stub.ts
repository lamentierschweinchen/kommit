"use client";

/**
 * In-memory stub for the Visa-sandbox API contract (handoff 44). Mirrors
 * each route's latency + response shape so the frontend ships against it
 * before the real MoonPay-Commerce wiring is reachable in dev. When the
 * real routes ship, flip `NEXT_PUBLIC_VISA_SANDBOX=live` and
 * visa-demo-client.ts swaps the stub for `fetch()` calls — no caller-side
 * change needed.
 *
 * The stub fakes the redirect+webhook flow: `onramp` returns a synthetic
 * hostedUrl that points back to our own `/visa-demo/success` page with a
 * `mock=1` flag, plus a synthetic chargeId. The success page detects the
 * mock flag and runs the existing local-storage simulation
 * (`@/lib/demo-engagement.simulateCommit`) without round-tripping the
 * chain. `chargeStatus` returns `completed` immediately so the polling
 * loop on the success page resolves in dev.
 */

import {
  simulateCommit,
} from "@/lib/demo-engagement";
import type {
  ChargeStatusResponse,
  OnrampRequest,
  OnrampResponse,
  PreFundResponse,
  VisaDemoClient,
} from "@/lib/visa-demo-types";

const STUB_FX_RATE = 1.087; // EUR → USDC (€1 ≈ $1.087 USDC)
const STUB_LATENCY_MS = 800;

const VISA_DEMO_WALLET_KEY = "kommit:visa:wallet";

/**
 * Stable pseudo-wallet for the visa flow. Generated once per browser, used
 * as the keying field for the demo-engagement positions store.
 */
export function getVisaDemoWallet(): string {
  if (typeof window === "undefined")
    return "VisaDemo000000000000000000000000000000000000";
  try {
    const cached = window.localStorage.getItem(VISA_DEMO_WALLET_KEY);
    if (cached) return cached;
    const synthetic = "VisaDemo000000000000000000000000000000000000"; // 44 chars
    window.localStorage.setItem(VISA_DEMO_WALLET_KEY, synthetic);
    return synthetic;
  } catch {
    return "VisaDemo000000000000000000000000000000000000";
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// In-memory map of synthetic chargeId → {projectSlug, amountUSDC,
// idempotencyKey, kommitterWallet}. Written by `onramp` and read by
// `chargeStatus` to fake the webhook completion path.
const stubCharges = new Map<
  string,
  {
    projectSlug: string;
    projectPda: string;
    amountUSDCBase: number;
    idempotencyKey: string;
    kommitterWallet: string;
  }
>();

// ---- Stub routes -----------------------------------------------------------

async function preFund(): Promise<PreFundResponse> {
  await delay(400);
  return { ok: true, lamports: 10_000_000 };
}

async function onramp(req: OnrampRequest): Promise<OnrampResponse> {
  await delay(STUB_LATENCY_MS);

  const fxRate = STUB_FX_RATE;
  const amountUSDC = req.amountEUR * fxRate;
  const amountUSDCBase = Math.round(amountUSDC * 1_000_000);
  const chargeId = `stub-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  // Stash the would-be charge state so chargeStatus can resolve it.
  stubCharges.set(chargeId, {
    projectSlug: req.projectSlug,
    projectPda: req.projectPda,
    amountUSDCBase,
    idempotencyKey: req.idempotencyKey,
    kommitterWallet: getVisaDemoWallet(),
  });

  // The "hosted URL" is just our own success page with a mock flag, so
  // the dev experience round-trips through the same route the FE will
  // use in prod — but without leaving our origin.
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const hostedUrl = `${origin}/visa-demo/success?ik=${encodeURIComponent(
    req.idempotencyKey,
  )}&chargeId=${encodeURIComponent(chargeId)}&mock=1`;

  return {
    ok: true,
    chargeId,
    hostedUrl,
    amountUSDC: amountUSDCBase,
    fxRate,
    idempotencyKey: req.idempotencyKey,
  };
}

async function chargeStatus(
  chargeId: string,
): Promise<ChargeStatusResponse> {
  await delay(300);
  const entry = stubCharges.get(chargeId);
  if (!entry) {
    return { ok: false, error: "not-found" };
  }
  // First read: simulate the localStorage position so the dashboard
  // renders the new commit. Idempotent on chargeId — once we've fired
  // the simulation, leave the entry in place so subsequent polls return
  // the same "completed" payload.
  if (!entry.kommitterWallet.startsWith("simulated:")) {
    simulateCommit({
      wallet: getVisaDemoWallet(),
      projectSlug: entry.projectSlug,
      principalUSD: entry.amountUSDCBase / 1_000_000,
    });
    entry.kommitterWallet = `simulated:${entry.kommitterWallet}`;
  }
  return {
    ok: true,
    chargeId,
    status: "completed",
    amountUSDCSettled: entry.amountUSDCBase,
    settlementSignature: `stub-settle-${chargeId.slice(0, 8)}`,
    relaySignature: `stub-relay-${chargeId.slice(0, 8)}`,
    projectPda: entry.projectPda,
    projectSlug: entry.projectSlug,
    idempotencyKey: entry.idempotencyKey,
  };
}

export const visaDemoStub: VisaDemoClient = {
  preFund,
  onramp,
  chargeStatus,
};
