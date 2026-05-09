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
 *
 * Persistence: charges are written to sessionStorage so they survive the
 * hard `window.location.assign()` redirect from /visa-demo to
 * /visa-demo/success. A pure module-scoped Map would be empty after the
 * navigation re-evaluates the stub module, causing chargeStatus to
 * 404 the chargeId we just minted. SessionStorage is per-origin and
 * lives until the tab closes — exactly the lifetime we need.
 */

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

// Synthetic chargeId → record. Persisted in sessionStorage so the record
// survives the hard `window.location.assign()` redirect from /visa-demo
// to /visa-demo/success. Without persistence, the stub's onramp populates
// a module-scoped Map; the navigation re-evaluates the module and
// chargeStatus then 404s the chargeId we just minted.
type StubCharge = {
  projectSlug: string;
  projectPda: string;
  amountUSDCBase: number;
  idempotencyKey: string;
  kommitterWallet: string;
};

const STUB_CHARGES_KEY = "kommit:visa:stubCharges";

function loadStubCharges(): Record<string, StubCharge> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.sessionStorage.getItem(STUB_CHARGES_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function saveStubCharges(map: Record<string, StubCharge>): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(STUB_CHARGES_KEY, JSON.stringify(map));
  } catch {
    // sessionStorage may be disabled — fall through, chargeStatus will 404.
  }
}

function getStubCharge(chargeId: string): StubCharge | undefined {
  return loadStubCharges()[chargeId];
}

function setStubCharge(chargeId: string, entry: StubCharge): void {
  const map = loadStubCharges();
  map[chargeId] = entry;
  saveStubCharges(map);
}

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

  // Stash the would-be charge state so chargeStatus can resolve it
  // *after* the hard `window.location.assign(hostedUrl)` redirect. The
  // navigation re-evaluates this module, so a module-scoped Map would be
  // empty by the time chargeStatus runs — sessionStorage is the right
  // lifetime here.
  setStubCharge(chargeId, {
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
  const entry = getStubCharge(chargeId);
  if (!entry) {
    return { ok: false, error: "not-found" };
  }
  // The simulateCommit write lives on the success page (sole writer for
  // both stub and live modes) — the stub previously double-wrote against
  // a different wallet key, leaving the dashboard empty. The success
  // page pins the demo persona explicitly and uses USERS["lukas"].wallet
  // so the dashboard reads the position back consistently.
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
