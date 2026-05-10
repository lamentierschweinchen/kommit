"use client";

/**
 * Demo-mode gate. Single source of truth for "should the persona switcher,
 * mock auth, and localStorage-backed engagement loop be active right now?"
 *
 * Two activation paths, OR'd together:
 *
 *   1. Build-time env: NEXT_PUBLIC_KOMMIT_DEMO=1 — for local dev, where the
 *      flag flips on for every browser tab without a /demo handshake.
 *
 *   2. Runtime localStorage: kommit:demo === "1" — set by the public /demo
 *      landing page on the production deploy. Lets external visitors enter
 *      demo mode by hitting kommit.now/demo without us toggling env vars on
 *      a deploy.
 *
 * Same-site coexistence: real Privy users on kommit.now never visit /demo
 * (no link from the production nav), so localStorage stays clean and the
 * regular auth flow runs unchanged. Demo visitors get the localStorage flag
 * and a different render branch in AuthProvider, api-client, queries.
 *
 * Server vs client: the env path inlines at build, so it works on both.
 * localStorage is client-only — server returns env-only result. That means
 * SSR for a demo visitor's first paint matches real-auth (anon/Privy) until
 * client mount swaps in the persona. Brief flash, no hydration mismatch.
 */

import { useEffect, useState } from "react";

const ENV_DEMO = process.env.NEXT_PUBLIC_KOMMIT_DEMO === "1";
const STORAGE_KEY = "kommit:demo";
const PERSONA_KEY = "kommit:demo:persona";
const FROZEN_KEY = "kommit:demo:frozen";

/**
 * Synchronous demo-mode check usable from any context. On the server, only
 * the build-time env flag counts; on the client, also reads localStorage.
 *
 * This is the primitive used by non-React code paths (api-client wrapper,
 * queries facade). React components should prefer `useDemoMode()` so the
 * flag re-renders when localStorage changes mid-session.
 */
export function isDemoMode(): boolean {
  if (ENV_DEMO) return true;
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

/**
 * React hook for demo mode with hydration-safe state. First render returns
 * the env-only value (matches SSR) so React doesn't warn about hydration
 * mismatch; localStorage activation kicks in on mount and any subsequent
 * `storage` event (cross-tab sync — switch persona in one tab, others
 * follow).
 */
export function useDemoMode(): boolean {
  const [active, setActive] = useState<boolean>(ENV_DEMO);
  useEffect(() => {
    setActive(isDemoMode());
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY || e.key === null) setActive(isDemoMode());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);
  return active;
}

/** Activate demo mode for this browser. Called by the /demo entry page. */
export function activateDemoMode(initialPersonaId?: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, "1");
    if (initialPersonaId) {
      window.localStorage.setItem(PERSONA_KEY, initialPersonaId);
    }
    // Manually fire a storage event for same-tab listeners — browsers only
    // emit `storage` to OTHER tabs by default.
    window.dispatchEvent(new StorageEvent("storage", { key: STORAGE_KEY }));
  } catch {}
}

/** Deactivate demo mode. Used by the "exit demo" affordance. */
export function deactivateDemoMode() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
    window.localStorage.removeItem(PERSONA_KEY);
    window.dispatchEvent(new StorageEvent("storage", { key: STORAGE_KEY }));
  } catch {}
}

/** Read the persona ID set at activation time, or null if none. */
export function getStoredPersonaId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(PERSONA_KEY);
  } catch {
    return null;
  }
}

/** Update the stored persona ID (called by DemoControls on switch). */
export function setStoredPersonaId(id: string | null) {
  if (typeof window === "undefined") return;
  try {
    if (id) window.localStorage.setItem(PERSONA_KEY, id);
    else window.localStorage.removeItem(PERSONA_KEY);
  } catch {}
}

// ---------------------------------------------------------------------------
// Frozen state — when on, demo-engagement mutators early-return without
// touching localStorage. Re-takes during a recording start from the same
// seeded state every time. Reads stay live so the dashboard renders.
// ---------------------------------------------------------------------------

export function isDemoFrozen(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(FROZEN_KEY) === "1";
  } catch {
    return false;
  }
}

export function useDemoFrozen(): boolean {
  const [active, setActive] = useState<boolean>(false);
  useEffect(() => {
    setActive(isDemoFrozen());
    const onStorage = (e: StorageEvent) => {
      if (e.key === FROZEN_KEY || e.key === null) setActive(isDemoFrozen());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);
  return active;
}

export function freezeDemoState() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(FROZEN_KEY, "1");
    window.dispatchEvent(new StorageEvent("storage", { key: FROZEN_KEY }));
  } catch {}
}

export function unfreezeDemoState() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(FROZEN_KEY);
    window.dispatchEvent(new StorageEvent("storage", { key: FROZEN_KEY }));
  } catch {}
}
