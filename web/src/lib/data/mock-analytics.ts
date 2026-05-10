/**
 * Mock cohort analytics for the founder dashboard.
 *
 * v0.5 doesn't run a real indexer that joins on-chain kommitters to
 * geo/IP/funnel data — that ships when the kommit-reader has events. For
 * the demo, the founder dashboard's "Your cohort" analytics panel
 * (geographic distribution, cohort-growth sparkline, average + median
 * kommit size) draws from this file.
 *
 * All numbers are derived deterministically from the project's `slug` and
 * `totalKommittedUSD` / `kommittersCount`. Same input → same output across
 * page refreshes, persona switches, and SSR/CSR boundaries — no
 * `Math.random` per paint (the demo would otherwise show different
 * percentages on every render and Lukas would lose the recording).
 *
 * Swap path when the real indexer ships: this whole module gets replaced
 * by a single `getCohortAnalytics(slug)` call against the reader SDK; the
 * `<CohortAnalyticsPanel>` consumer stays unchanged.
 */

import { DEMO_TODAY_ISO } from "@/lib/date-utils";

const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;

/** FNV-1a 32-bit hash on a string. Used to seed deterministic
 *  per-project randomness without pulling in a hashing dependency. */
function hashString(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = (h * 0x01000193) >>> 0;
  }
  return h;
}

/** Linear-congruential PRNG seeded from `hashString(seed)`. Returns a
 *  function that yields [0, 1) values; same seed → same sequence. */
function seededRandom(seed: string): () => number {
  let state = hashString(seed) || 1;
  return () => {
    // Numerical Recipes constants — chosen for a long period in a 32-bit
    // state; cryptographically weak (deliberately — this is display jitter,
    // not security).
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

// ---------------------------------------------------------------------------
// Geographic distribution
// ---------------------------------------------------------------------------

export type GeoRegion = {
  /** Two-letter ISO country code, plus a label suitable for inline text. */
  code: string;
  flag: string;
  label: string;
  percent: number;
};

/**
 * Build a top-5 geographic distribution + an "Other" bucket. The mix is
 * deterministically picked from a fixed pool of regions; weights are
 * shuffled per project so different founders see different breakdowns
 * even though the data shape is identical.
 *
 * Bucket weights sum to ~100. Display uses Math.round which can land at
 * 99 or 101 — we re-normalize the largest bucket to absorb the rounding
 * error so the strip always reads "100%" when summed.
 */
const GEO_POOL: Array<Omit<GeoRegion, "percent">> = [
  { code: "US", flag: "🇺🇸", label: "United States" },
  { code: "DE", flag: "🇩🇪", label: "Germany" },
  { code: "SG", flag: "🇸🇬", label: "Singapore" },
  { code: "GB", flag: "🇬🇧", label: "United Kingdom" },
  { code: "FR", flag: "🇫🇷", label: "France" },
  { code: "CA", flag: "🇨🇦", label: "Canada" },
  { code: "JP", flag: "🇯🇵", label: "Japan" },
  { code: "NL", flag: "🇳🇱", label: "Netherlands" },
  { code: "AU", flag: "🇦🇺", label: "Australia" },
  { code: "BR", flag: "🇧🇷", label: "Brazil" },
];

export function getGeographicDistribution(projectSlug: string): GeoRegion[] {
  const rnd = seededRandom(`geo:${projectSlug}`);
  // Pick a leader (US-leaning) + 4 other regions deterministically.
  const shuffled = [...GEO_POOL].sort((a, b) => {
    const ra = (hashString(`${projectSlug}:${a.code}`) >>> 0) / 0x100000000;
    const rb = (hashString(`${projectSlug}:${b.code}`) >>> 0) / 0x100000000;
    return ra - rb;
  });
  const picked = shuffled.slice(0, 5);

  // Weights: leader gets 28-44%, others scale down. Final bucket is
  // "Other" — auto-derived so the strip sums to 100.
  const leaderPct = 28 + Math.floor(rnd() * 17); // 28-44
  let remaining = 100 - leaderPct;
  const weights: number[] = [leaderPct];
  for (let i = 1; i < 5; i++) {
    // Each subsequent region takes a roughly-shrinking share of the
    // remainder; last bucket gets whatever's left so totals stay sane.
    const share =
      i === 4
        ? Math.max(4, Math.floor(remaining * 0.7))
        : Math.max(4, Math.floor(remaining * (0.4 + rnd() * 0.2)));
    weights.push(share);
    remaining -= share;
  }
  // Tail bucket: "Other".
  const other = Math.max(0, remaining);

  const out: GeoRegion[] = picked.map((r, i) => ({
    ...r,
    percent: weights[i],
  }));

  // Sort by percent descending so the bar chart reads as a proper
  // hierarchy (largest first). The "Other" bucket stays pinned at the
  // bottom regardless of size — a known UX convention for breakdowns.
  out.sort((a, b) => b.percent - a.percent);
  out.push({ code: "XX", flag: "🌐", label: "Other", percent: other });

  // Repair: any rounding error gets absorbed into the leader so the bar
  // chart reads exactly 100%.
  const sum = out.reduce((acc, r) => acc + r.percent, 0);
  if (sum !== 100 && out.length > 0) {
    out[0].percent += 100 - sum;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Cohort growth sparkline (last 30 days)
// ---------------------------------------------------------------------------

export type SparklinePoint = {
  /** Day offset from `DEMO_TODAY_ISO`. -29 = oldest, 0 = today. */
  day: number;
  /** Cumulative kommitter count on that day. Monotonically non-decreasing. */
  kommitters: number;
};

/**
 * 30-day cumulative kommitter growth. Builds an S-shape: slow start, hockey
 * stick mid-month, plateau at present. Final point matches the project's
 * current `kommittersCount` exactly so the analytics tile and the headline
 * stat agree.
 */
export function getCohortGrowth(
  projectSlug: string,
  kommittersCount: number,
): SparklinePoint[] {
  if (kommittersCount === 0) return [];
  const rnd = seededRandom(`growth:${projectSlug}`);
  const days = 30;
  const points: SparklinePoint[] = [];
  // Logistic-ish curve: 1 / (1 + exp(-k*(x - mid))). We render it discretely.
  const mid = 12 + Math.floor(rnd() * 8); // inflection between days 12-19
  const steepness = 0.3 + rnd() * 0.15;
  // Starting baseline: 10-25% of final.
  const startFraction = 0.1 + rnd() * 0.15;
  const startK = Math.floor(kommittersCount * startFraction);
  for (let i = 0; i < days; i++) {
    const x = i; // 0..29
    const logistic = 1 / (1 + Math.exp(-steepness * (x - mid)));
    // Lerp from startK to kommittersCount based on logistic.
    const value = Math.round(startK + (kommittersCount - startK) * logistic);
    points.push({ day: i - (days - 1), kommitters: value });
  }
  // Force the last point to match exactly so headline + sparkline align.
  points[points.length - 1].kommitters = kommittersCount;
  // Repair monotonicity: each day must be ≥ the prior (people don't
  // disappear from the cohort, withdraw event is a separate axis).
  for (let i = 1; i < points.length; i++) {
    if (points[i].kommitters < points[i - 1].kommitters) {
      points[i].kommitters = points[i - 1].kommitters;
    }
  }
  return points;
}

// ---------------------------------------------------------------------------
// Average + median kommit size
// ---------------------------------------------------------------------------

export type KommitSizeStats = {
  averageUSD: number;
  medianUSD: number;
  /** Min/max bookends — surface as "range: $X – $Y" if needed. */
  minUSD: number;
  maxUSD: number;
};

/**
 * Derive an average + median kommit size. Average is exact (total / count);
 * median is mocked from a per-project deterministic shape because the
 * enumerated `project.kommitters[]` is a subset of the full cohort. The
 * median is bounded by the average for sanity — a heavy-tail cohort has
 * median < average, which is what most early-stage projects look like.
 */
export function getKommitSizeStats(
  projectSlug: string,
  totalUSD: number,
  kommittersCount: number,
): KommitSizeStats {
  if (kommittersCount === 0) {
    return { averageUSD: 0, medianUSD: 0, minUSD: 0, maxUSD: 0 };
  }
  const average = totalUSD / kommittersCount;
  const rnd = seededRandom(`size:${projectSlug}`);
  // Median is 45-75% of the average — heavy-tail cohort convention.
  const medianFraction = 0.45 + rnd() * 0.3;
  const median = Math.round(average * medianFraction);
  // Min: $25-$75. Max: ~6-10× the average (the whale).
  const minUSD = 25 + Math.floor(rnd() * 50);
  const maxMultiplier = 6 + rnd() * 4;
  const maxUSD = Math.round(average * maxMultiplier);
  return {
    averageUSD: Math.round(average),
    medianUSD: median,
    minUSD,
    maxUSD,
  };
}

// ---------------------------------------------------------------------------
// Retention through pivots
// ---------------------------------------------------------------------------

export type RetentionStat = {
  /** Retention percent (0-100). `null` when the project hasn't pivoted yet. */
  percent: number | null;
  /** Short caption explaining the number, e.g. "since Apr 4 pivot" or
   *  "no pivots yet". */
  caption: string;
};

/**
 * Derive a retention-through-pivots stat. For projects that haven't
 * pivoted, returns `percent: null` with a "no pivots yet" caption so the
 * stat tile can render an honest "—" instead of fake conviction.
 *
 * For pivoted projects, picks a deterministic value in the 76-94% band —
 * cohorts that pivot DO see attrition; this is high-but-not-perfect so
 * the demo doesn't undersell or oversell.
 */
export function getRetentionThroughPivots(
  projectSlug: string,
  pivotAtISO: string | null,
): RetentionStat {
  if (!pivotAtISO) {
    return { percent: null, caption: "no pivots yet" };
  }
  const rnd = seededRandom(`retention:${projectSlug}`);
  const percent = 76 + Math.floor(rnd() * 19); // 76-94
  return {
    percent,
    caption: `since ${shortPivotDate(pivotAtISO)} pivot`,
  };
}

function shortPivotDate(iso: string): string {
  // Defensive — never throw if a future caller passes a non-ISO string.
  if (!iso || iso.length < 10) return iso || "—";
  const [, mm, dd] = iso.slice(0, 10).split("-");
  const months = [
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
  const m = months[parseInt(mm, 10) - 1] ?? mm;
  return `${m} ${parseInt(dd, 10)}`;
}

// ---------------------------------------------------------------------------
// Live-ticking total-kommits helper
// ---------------------------------------------------------------------------

/**
 * Synthesize a single "virtual position" whose sinceMs is back-dated so
 * that the live-kommits formula (USD × hours) lands on the project's
 * static `totalKommitsGenerated` at the moment the founder dashboard
 * mounts. From there, `useLiveKommitsTotal` ticks the number upward at a
 * rate of `totalKommittedUSD` kommits/hour — the correct rate for the
 * cohort total.
 *
 * Without this, calling `useLiveKommitsTotal` on the enumerated
 * `project.kommitters[]` subset under-reports the headline (e.g. 20 of
 * 142 kommitters listed → 1/7 of the real cohort total).
 */
export function buildLiveCohortPositions(
  totalKommittedUSD: number,
  totalKommitsGenerated: number,
): Array<{ kommittedUSD: number; sinceISO: string; sinceMs: number }> {
  if (totalKommittedUSD <= 0) return [];
  const now = Date.now();
  const hoursToStatic = totalKommitsGenerated / totalKommittedUSD;
  const sinceMs = now - hoursToStatic * HOUR_MS;
  return [
    {
      kommittedUSD: totalKommittedUSD,
      sinceISO: new Date(sinceMs).toISOString().slice(0, 10),
      sinceMs,
    },
  ];
}

// Expose constants used by the chart consumer.
export const SPARKLINE_DAYS = 30;
export { DEMO_TODAY_ISO };

// Silence unused-warning for the day constant — it's exported for callers
// who want raw ms-per-day for axis math.
export const SPARKLINE_DAY_MS = DAY_MS;
