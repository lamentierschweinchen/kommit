export type Commitment = {
  projectSlug: string;
  kommittedUSD: number;
  sinceISO: string;
  /**
   * Millisecond-precision deposit timestamp. Optional: seeded portfolio rows
   * carry only `sinceISO` (date string, midnight UTC). Fresh commits — both
   * on-chain (`depositTs * 1000`) and demo (`Date.now()`) — set this so the
   * live-kommits hook ticks up from the actual commit moment, not from
   * midnight-of-day (which would otherwise inflate fresh positions by up to
   * 24 hours of accrual the user never earned).
   */
  sinceMs?: number;
  /** True when the project pivoted while user was kommitted. The dashboard row keeps showing the inline tag. */
  pivotedAtISO?: string;
};

/**
 * Lukas's portfolio — drives /dashboard.
 * Math: kommits = USD × hours, computed live from sinceISO to demo-today (2026-04-28).
 * One kommit per dollar-hour committed.
 */
export const LUKAS_COMMITMENTS: Commitment[] = [
  { projectSlug: "caldera", kommittedUSD: 200, sinceISO: "2026-03-12" },
  { projectSlug: "lighthouse-labs", kommittedUSD: 300, sinceISO: "2026-04-02" },
  { projectSlug: "aurora", kommittedUSD: 500, sinceISO: "2026-02-28" },
  { projectSlug: "quire-chess", kommittedUSD: 100, sinceISO: "2026-04-08", pivotedAtISO: "2026-04-04" },
  { projectSlug: "frame-studio", kommittedUSD: 200, sinceISO: "2026-01-22" },
  { projectSlug: "beacon-sci", kommittedUSD: 100, sinceISO: "2026-02-14", pivotedAtISO: "2026-02-14" },
];
