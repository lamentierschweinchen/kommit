import { daysBetween, DEMO_TODAY_ISO } from "./date-utils";

/**
 * Kommits = USD × hours held.
 * Single source of truth for the conviction-primitive math.
 *
 * One kommit accrues per dollar-hour committed. A backer who parks $100
 * for 100 hours earns 10,000 kommits; a backer who parks $1,000 for a year
 * earns ~8,760,000. Hour-level granularity so the count visibly ticks for
 * a kommitter watching their dashboard, and so the absolute numbers feel
 * earned rather than nominal.
 */
const HOURS_PER_DAY = 24;

export function kommitsFor(
  usdAmount: number,
  sinceISO: string,
  today: string = DEMO_TODAY_ISO,
): number {
  const hours = daysBetween(sinceISO, today) * HOURS_PER_DAY;
  return usdAmount * hours;
}

export function formatUSD(n: number, opts: { compact?: boolean } = {}): string {
  if (opts.compact) {
    if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M`;
    if (n >= 10_000) return `$${Math.round(n / 1000)}K`;
    if (n >= 1_000) return `$${(n / 1000).toFixed(1)}K`;
  }
  return `$${n.toLocaleString("en-US")}`;
}

export function formatNumber(n: number): string {
  return n.toLocaleString("en-US");
}

export function formatKommits(n: number): string {
  if (n >= 1_000_000) {
    const m = n / 1_000_000;
    return `${m.toFixed(m < 10 ? 2 : 1)}M`;
  }
  return formatNumber(n);
}
