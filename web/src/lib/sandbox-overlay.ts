"use client";

/**
 * Lane B sandbox overlay flag.
 *
 * Distinct from demo-mode (which flips the entire auth/queries layer to
 * the Lukas persona) and visa-mode (which swaps $ → €). Sandbox overlay
 * is the narrow signal that "this Privy-authenticated user has been
 * through the card-mock flow at /visa-demo, so simulateCommit positions
 * under THEIR wallet should be merged into dashboard reads alongside
 * any real on-chain commits."
 *
 * Why this exists: the visa-demo success page calls simulateCommit under
 * the user's Privy wallet (per Lane B handoff item 8). The dashboard
 * read path defaults to Anchor for real-Privy users — without this
 * overlay, the simulated commit is invisible and the judge ends the card
 * flow with a dashboard that doesn't show what they just funded.
 *
 * Trade-off: when the flag is set, `getCommitmentsForUser` merges any
 * localStorage positions keyed by the caller's wallet. If the user
 * happens to have a stale position from a different session, it'll
 * resurface. Acceptable for a sandbox surface; would not be acceptable
 * for production.
 */

import { useEffect, useState } from "react";

const STORAGE_KEY = "kommit:sandbox-overlay";

export function isSandboxOverlayActive(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function activateSandboxOverlay(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, "1");
    window.dispatchEvent(new StorageEvent("storage", { key: STORAGE_KEY }));
  } catch {}
}

export function deactivateSandboxOverlay(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
    window.dispatchEvent(new StorageEvent("storage", { key: STORAGE_KEY }));
  } catch {}
}

export function useSandboxOverlay(): boolean {
  const [active, setActive] = useState(false);
  useEffect(() => {
    setActive(isSandboxOverlayActive());
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY || e.key === null) setActive(isSandboxOverlayActive());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);
  return active;
}
