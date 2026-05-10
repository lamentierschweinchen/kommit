"use client";

import { useEffect, useState } from "react";
import { parseISODate } from "../date-utils";

const MS_PER_HOUR = 3_600_000;

/**
 * Live-ticking kommits count for a single position.
 *
 * Returns a fractional `usdAmount × hoursHeld` value that updates every second
 * while the page is visible. Pauses on `document.visibilitychange` (hidden) so
 * the timer doesn't burn cycles in a backgrounded tab — and immediately
 * resyncs to wall-clock time when the tab is restored.
 *
 * Hour-granularity unit (matches `kommitsFor` in `kommit-math.ts`): one
 * kommit accrues per dollar-hour committed. A $100 position visibly ticks
 * up by ~$100/3600 ≈ 0.0278 kommits per second.
 *
 * The optional `sinceMsOverride` is the millisecond-precision commit
 * timestamp — used by fresh demo / on-chain commits so the count starts at
 * exactly $0 × 0h = 0 instead of inflating by however many hours of "today"
 * have elapsed since the date string's midnight UTC. Falls back to
 * `parseISODate(sinceISO)` (midnight UTC of the date) when the position has
 * only date-level provenance (seeded portfolio rows).
 */
export function useLiveKommits(
  usdAmount: number,
  sinceISO: string,
  sinceMsOverride?: number,
): number {
  const sinceMs = sinceMsOverride ?? parseISODate(sinceISO).getTime();
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

  const fractionalHours = Math.max(0, (now - sinceMs) / MS_PER_HOUR);
  return usdAmount * fractionalHours;
}

/**
 * Format a live-ticking kommits number for display. Tiered so that small
 * positions visibly tick per second (the design intent of the math feel)
 * while large aggregates don't overflow stat cards or surface noise digits.
 *
 *   < 1,000:  "421.78"   — 2 decimals, ticks visibly
 *   < 1M:     "421,378"  — no decimals, comma
 *   ≥ 1M:    "3.88M"    — compact suffix
 */
export function formatLiveKommits(n: number): string {
  if (n >= 1_000_000) {
    const m = n / 1_000_000;
    return `${m.toFixed(m < 10 ? 2 : 1)}M`;
  }
  if (n < 1_000) {
    return n.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }
  return Math.floor(n).toLocaleString("en-US");
}

/**
 * Live-ticking SUM across many positions (dashboard top stat). One timer for
 * the whole list — calling `useLiveKommits` in a `.map` would either violate
 * rules-of-hooks (variable-length list) or burn N timers.
 */
export function useLiveKommitsTotal(
  positions: Array<{ kommittedUSD: number; sinceISO: string; sinceMs?: number }>,
): number {
  const [now, setNow] = useState<number>(() => Date.now());
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

  let sum = 0;
  for (const p of positions) {
    const sinceMs = p.sinceMs ?? parseISODate(p.sinceISO).getTime();
    const hours = Math.max(0, (now - sinceMs) / MS_PER_HOUR);
    sum += p.kommittedUSD * hours;
  }
  return sum;
}
