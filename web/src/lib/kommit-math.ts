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

// Single Intl.NumberFormat instance per shape — construction is hot-path-
// expensive enough that the per-render allocation showed up in the dashboard
// stat cards under React profiler. Reuse handles the 99% case; the compact
// branch below has its own format string requirements.
const USD_FMT = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

// Whole-dollar variant for amounts already known to be integer (e.g. demo
// balances seeded as round thousands). Drops the trailing ".00" so the
// "Available $10,000" line doesn't read as "$10,000.00" in the kommit modal
// header. Selected at call time when `Number.isInteger(n)` is true.
const USD_FMT_WHOLE = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

export function formatUSD(n: number, opts: { compact?: boolean } = {}): string {
  if (opts.compact) {
    if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M`;
    if (n >= 10_000) return `$${Math.round(n / 1000)}K`;
    if (n >= 1_000) return `$${(n / 1000).toFixed(1)}K`;
  }
  // Round to cents on the boundary so `$1409.385` formats as `$1,409.39`
  // instead of one renderer's "$1,409.38" vs another's "$1,409.39" depending
  // on internal rounding mode. Avoid mutating very-small fractions.
  return Number.isInteger(n) ? USD_FMT_WHOLE.format(n) : USD_FMT.format(n);
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
