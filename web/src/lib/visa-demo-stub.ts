"use client";

/**
 * In-memory stub for the Visa-sandbox API contract (handoff 41). Mirrors
 * each route's latency + response shape so the frontend ships against it
 * before engineer's real routes land. When the real routes ship, flip
 * `NEXT_PUBLIC_VISA_SANDBOX=live` in env and visa-demo-client.ts swaps
 * the stub for `fetch()` calls — no caller-side change needed.
 *
 * State persists in the same demo-engagement localStorage namespace (so
 * the visa flow's positions show up on the same dashboard the persona
 * preview already wired). Visa-flavored callers thread a stable
 * pseudo-wallet (`VISA_DEMO_WALLET_KEY`) so positions don't collide with
 * persona-mode personas.
 */

import {
  simulateCommit,
  simulateWithdraw,
} from "@/lib/demo-engagement";
import type {
  OfframpRequest,
  OfframpResponse,
  OnrampRequest,
  OnrampResponse,
  PreFundResponse,
  VisaDemoClient,
} from "@/lib/visa-demo-types";

const STUB_FX_RATE = 1.087; // EUR → USDC (i.e. €1 buys ~$1.087 USDC)
const STUB_LATENCY_MS = 1800; // realistic-feeling card processing time

const VISA_DEMO_WALLET_KEY = "kommit:visa:wallet";

/**
 * Stable pseudo-wallet for the visa flow. Generated once per browser, used
 * as the keying field for the demo-engagement positions store so the
 * dashboard renders visa-flow commits without colliding with persona-mode
 * positions for Lukas / Maya / etc.
 *
 * Real Solana addresses are 44-char base58; we use a recognizable
 * `VisaDemo0...0` constant so anyone inspecting localStorage knows where
 * the data came from. This is never sent on-chain — stub mode doesn't
 * touch the chain.
 */
export function getVisaDemoWallet(): string {
  if (typeof window === "undefined") return "VisaDemo000000000000000000000000000000000000";
  try {
    const cached = window.localStorage.getItem(VISA_DEMO_WALLET_KEY);
    if (cached) return cached;
    const synthetic = "VisaDemo000000000000000000000000000000000000"; // exactly 44 chars
    window.localStorage.setItem(VISA_DEMO_WALLET_KEY, synthetic);
    return synthetic;
  } catch {
    return "VisaDemo000000000000000000000000000000000000";
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function lastFour(cardNumber: string): string {
  const digits = cardNumber.replace(/\D/g, "");
  return digits.slice(-4) || "0000";
}

function fakeTxHash(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 14);
  return `${prefix}${rand}stub${rand.slice(0, 4)}`;
}

// ---- Stub routes -----------------------------------------------------------

async function preFund(): Promise<PreFundResponse> {
  await delay(600); // Pre-fund is faster than card processing
  return { ok: true, lamports: 10_000_000 };
}

async function onramp(req: OnrampRequest): Promise<OnrampResponse> {
  await delay(STUB_LATENCY_MS);

  // Reject obviously-not-a-card inputs so the error path is exercised in
  // dev. Sandbox cards: 4242... and 4111... are accepted; everything else
  // is "card-rejected".
  const number = req.card.number.replace(/\D/g, "");
  if (number.length < 12) {
    return { ok: false, error: "card-rejected" };
  }

  const fxRate = req.fxRate ?? STUB_FX_RATE;
  const amountUSDC = req.amountEUR * fxRate; // dollar amount, not base units yet
  const amountUSDCBase = Math.round(amountUSDC * 1_000_000);

  // Persist the position so /dashboard renders it after the redirect.
  simulateCommit({
    wallet: getVisaDemoWallet(),
    projectSlug: req.projectSlug,
    principalUSD: amountUSDC,
  });

  return {
    ok: true,
    amountUSDC: amountUSDCBase,
    fxRate,
    commitTxHash: fakeTxHash("5x9"),
    cardLast4: lastFour(req.card.number),
  };
}

async function offramp(req: OfframpRequest): Promise<OfframpResponse> {
  await delay(STUB_LATENCY_MS);

  // Convert base units back to dollar amount, then to EUR.
  const amountUSDC = req.amountUSDC / 1_000_000;
  const amountEUR = amountUSDC / STUB_FX_RATE;

  simulateWithdraw({
    wallet: getVisaDemoWallet(),
    projectSlug: req.projectSlug,
    amountUSD: amountUSDC,
  });

  return {
    ok: true,
    amountEUR,
    withdrawTxHash: fakeTxHash("9p3"),
    payoutId: `stub-payout-${Date.now()}`,
  };
}

export const visaDemoStub: VisaDemoClient = {
  preFund,
  onramp,
  offramp,
};
