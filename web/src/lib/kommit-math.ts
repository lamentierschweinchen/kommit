import { daysBetween, DEMO_TODAY_ISO } from "./date-utils";

/**
 * Kommits = USD × days held.
 * Single source of truth for the conviction-primitive math.
 */
export function kommitsFor(
  usdAmount: number,
  sinceISO: string,
  today: string = DEMO_TODAY_ISO,
): number {
  const days = daysBetween(sinceISO, today);
  return usdAmount * days;
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
