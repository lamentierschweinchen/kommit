"use client";

/**
 * Visa-rails sandbox mode. Mirrors the demo-mode pattern but with a
 * different surface promise: when active, crypto vocabulary disappears
 * site-wide and the dashboard / commit / withdraw chrome reads in EUR.
 *
 * Activation paths:
 *   - localStorage: `kommit:visa = "1"` — set by /visa-demo on first
 *     submit; persists across navigation so dashboard / project pages
 *     keep the hidden-crypto chrome.
 *   - URL query: `?visa=1` — for the submission video, lets us deep-link
 *     directly into a Visa-flavored view without the form gate.
 *   - Build env: `NEXT_PUBLIC_VISA_DEMO_DEFAULT=1` — local-dev convenience
 *     so we don't have to set localStorage every session.
 *
 * Visa mode does NOT imply demo mode (the persona switcher). Both can
 * coexist (e.g., visa flow as a specific persona) but DemoControls
 * self-hides in visa mode so the floating "DEMO · Lukas" chrome doesn't
 * leak into the recording.
 */

import { useEffect, useState } from "react";

const ENV_VISA = process.env.NEXT_PUBLIC_VISA_DEMO_DEFAULT === "1";
const STORAGE_KEY = "kommit:visa";
const CARD_KEY = "kommit:visa:cardLast4";

export function isVisaMode(): boolean {
  if (ENV_VISA) return true;
  if (typeof window === "undefined") return false;
  try {
    if (window.localStorage.getItem(STORAGE_KEY) === "1") return true;
    const params = new URLSearchParams(window.location.search);
    if (params.get("visa") === "1") return true;
    return false;
  } catch {
    return false;
  }
}

export function useVisaMode(): boolean {
  const [active, setActive] = useState<boolean>(ENV_VISA);
  useEffect(() => {
    setActive(isVisaMode());
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY || e.key === null) setActive(isVisaMode());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);
  return active;
}

export function activateVisaMode(cardLast4?: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, "1");
    if (cardLast4) window.localStorage.setItem(CARD_KEY, cardLast4);
    window.dispatchEvent(new StorageEvent("storage", { key: STORAGE_KEY }));
  } catch {}
}

export function deactivateVisaMode() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
    window.localStorage.removeItem(CARD_KEY);
    window.dispatchEvent(new StorageEvent("storage", { key: STORAGE_KEY }));
  } catch {}
}

/** Last-4 of the card the visitor entered on /visa-demo. Used by withdraw
 *  modals + success toasts to maintain the "your card ending in 4242"
 *  continuity. */
export function getStoredCardLast4(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(CARD_KEY);
  } catch {
    return null;
  }
}

// ---- Display helpers -------------------------------------------------------

/**
 * Display rate used to convert USDC base-unit positions into EUR for the
 * Visa-flavored dashboard. Stub-friendly fixed approximation; real onramp
 * returns the live rate per call. Doesn't need to be precise — visa mode
 * is a presentation-only chrome over the same underlying math.
 */
export const USDC_TO_EUR = 0.92;

/** Format any USDC-denominated number as EUR for the visa surface. */
export function formatEUR(usdc: number): string {
  const eur = usdc * USDC_TO_EUR;
  if (eur >= 1000) {
    return `€${eur.toLocaleString("en-DE", { maximumFractionDigits: 0 })}`;
  }
  return `€${eur.toLocaleString("en-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Same as formatEUR, but for a value already in EUR (e.g. a balance the
 *  user just typed). */
export function formatEURDirect(eur: number): string {
  if (eur >= 1000) {
    return `€${eur.toLocaleString("en-DE", { maximumFractionDigits: 0 })}`;
  }
  return `€${eur.toLocaleString("en-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
