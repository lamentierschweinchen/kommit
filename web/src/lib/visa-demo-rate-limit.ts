/**
 * Per-wallet rate limiter for the Visa-sandbox demo.
 *
 * Sandbox-scale traffic only (a single submission video walks through it).
 * In-memory map keyed by wallet — Vercel functions get reused enough to
 * make this useful for short-window dedup; if the function reboots the
 * limiter resets, but a 60-second window is fine in practice.
 *
 * Production / mainnet would use Redis (Upstash, Vercel KV, etc.) — out of
 * scope for the v0.5 demo.
 */

import "server-only";

type Bucket = {
  /** Wallet -> last-allowed timestamp (ms). */
  lastAt: number;
};

const buckets = new Map<string, Bucket>();

/** Returns true if the wallet is OK to call right now; false if rate-limited.
 *  Side-effect: on `true`, updates the bucket so the next call within the
 *  window is rejected. */
export function takeRateLimit(wallet: string, windowMs: number): boolean {
  const now = Date.now();
  const b = buckets.get(wallet);
  if (b && now - b.lastAt < windowMs) {
    return false;
  }
  buckets.set(wallet, { lastAt: now });
  return true;
}

/** Clear the bucket for a wallet — exposed for test cleanup. */
export function _resetRateLimit(wallet: string): void {
  buckets.delete(wallet);
}

/** Clear ALL buckets — exposed for test cleanup. */
export function _resetAllRateLimits(): void {
  buckets.clear();
}
