/**
 * Demo "today" — pinned to keep dashboard math reproducible across sessions.
 * Matches design.md graduation-demo lock.
 */
export const DEMO_TODAY_ISO = "2026-04-28";

export function demoToday(): Date {
  return new Date(`${DEMO_TODAY_ISO}T00:00:00Z`);
}

export function parseISODate(iso: string): Date {
  return new Date(`${iso}T00:00:00Z`);
}

export function daysBetween(fromISO: string, toISO: string = DEMO_TODAY_ISO): number {
  const ms = parseISODate(toISO).getTime() - parseISODate(fromISO).getTime();
  return Math.max(0, Math.floor(ms / 86_400_000));
}

const MONTHS_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

export function shortDate(iso: string): string {
  const d = parseISODate(iso);
  const m = MONTHS_SHORT[d.getUTCMonth()];
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${m} ${day}`;
}

export function longDate(iso: string): string {
  const d = parseISODate(iso);
  const m = MONTHS_SHORT[d.getUTCMonth()];
  const day = d.getUTCDate();
  const year = d.getUTCFullYear();
  return `${m} ${day}, ${year}`;
}

export function relativeTime(fromISO: string, today: string = DEMO_TODAY_ISO): string {
  const days = daysBetween(fromISO, today);
  if (days === 0) return "today";
  if (days === 1) return "1d ago";
  if (days < 7) return `${days}d ago`;
  if (days < 30) {
    const weeks = Math.floor(days / 7);
    return weeks === 1 ? "1w ago" : `${weeks}w ago`;
  }
  if (days < 365) {
    const months = Math.floor(days / 30);
    return months === 1 ? "1mo ago" : `${months}mo ago`;
  }
  return shortDate(fromISO);
}
