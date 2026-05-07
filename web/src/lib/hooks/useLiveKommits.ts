"use client";

import { useEffect, useState } from "react";
import { parseISODate } from "../date-utils";

/**
 * Live-ticking kommits count for a single position.
 *
 * Returns a fractional `usdAmount × daysHeld` value that updates every second
 * while the page is visible. Pauses on `document.visibilitychange` (hidden) so
 * the timer doesn't burn cycles in a backgrounded tab — and immediately
 * resyncs to wall-clock time when the tab is restored.
 *
 * The first render is SSR-safe: it returns the same value the server would
 * compute (DEMO-pinned `kommitsFor`-equivalent) until the client effect
 * starts ticking, so there's no hydration mismatch.
 */
export function useLiveKommits(usdAmount: number, sinceISO: string): number {
  const sinceMs = parseISODate(sinceISO).getTime();
  // Guard against negative durations (sinceISO in the future) — clamp to 0.
  const [now, setNow] = useState<number>(() => sinceMs);

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | undefined;
    const tick = () => setNow(Date.now());
    const start = () => {
      if (timer != null) return;
      tick();
      timer = setInterval(tick, 1000);
    };
    const stop = () => {
      if (timer != null) {
        clearInterval(timer);
        timer = undefined;
      }
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") start();
      else stop();
    };

    if (document.visibilityState === "visible") start();
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);

  const fractionalDays = Math.max(0, (now - sinceMs) / 86_400_000);
  return usdAmount * fractionalDays;
}

/**
 * Format a live-ticking kommits number for display. Comma thousands separator,
 * two decimal places so the user sees the count actually moving.
 */
export function formatLiveKommits(n: number): string {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
