/**
 * Real-Privy withdrawn-state overlay.
 *
 * When a real-Privy kommitter withdraws their full position, the Anchor
 * program closes the Commitment account on-chain (refunds rent, frees the
 * PDA). `getCommitmentsForUser` reads on-chain accounts via `commitment.all`
 * → the withdrawn position disappears entirely from the dashboard, and the
 * lifetime kommits stat regresses.
 *
 * The manifesto promise is "soulbound, yours forever" — kommits don't
 * disappear when capital does. To preserve that view in v0.5 without a
 * dedicated indexer-side projection, the client writes a localStorage
 * snapshot of (frozenKommits, withdrawnAtMs, sinceMs) at withdraw time.
 * `queries.ts` reads on-chain commitments AND merges any overlay rows
 * for projects with no on-chain position (i.e. they've been closed).
 *
 * Storage shape: `kommit:withdrawn-overlay` → `{ [wallet]: { [slug]: Snapshot } }`.
 * Snapshot fields:
 *  - sinceISO       — original commit date (display)
 *  - sinceMs        — original commit timestamp (math)
 *  - frozenKommits  — kommit count at the moment of withdrawal
 *  - withdrawnAtMs  — when the withdraw closed the account
 *
 * If the user re-kommits the same project later, the on-chain account
 * reopens — queries.ts notices an on-chain row exists and ignores the
 * overlay (the new position starts fresh per Anchor program semantics).
 * Overlay row is cleared from localStorage on the re-kommit to keep the
 * store from growing unbounded.
 */

const STORAGE_KEY = "kommit:withdrawn-overlay";

export type WithdrawnSnapshot = {
  sinceISO: string;
  sinceMs: number;
  frozenKommits: number;
  withdrawnAtMs: number;
};

type Store = Record<string, Record<string, WithdrawnSnapshot>>;

function readStore(): Store {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return typeof parsed === "object" && parsed !== null ? (parsed as Store) : {};
  } catch {
    return {};
  }
}

function writeStore(s: Store): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    /* non-fatal */
  }
}

/** Record a snapshot at withdraw time so the row + frozen kommit count
 *  survive the on-chain account close. Idempotent — re-writing the same
 *  (wallet, slug) updates the snapshot to the latest values. */
export function recordWithdrawn(
  wallet: string,
  slug: string,
  snapshot: WithdrawnSnapshot,
): void {
  if (!wallet || !slug) return;
  const store = readStore();
  if (!store[wallet]) store[wallet] = {};
  store[wallet][slug] = snapshot;
  writeStore(store);
}

/** Clear a withdrawn-state record. Called when the user re-kommits the
 *  same project — the new on-chain position is the truth from that
 *  point forward; the overlay is stale. */
export function clearWithdrawn(wallet: string, slug: string): void {
  if (!wallet || !slug) return;
  const store = readStore();
  if (!store[wallet]) return;
  if (slug in store[wallet]) {
    delete store[wallet][slug];
    writeStore(store);
  }
}

/** All withdrawn-state snapshots for a wallet. Used by queries.ts to
 *  merge into the on-chain commitment list. */
export function getWithdrawnOverlay(
  wallet: string,
): Array<WithdrawnSnapshot & { projectSlug: string }> {
  if (!wallet) return [];
  const store = readStore();
  const byWallet = store[wallet] ?? {};
  return Object.entries(byWallet).map(([projectSlug, s]) => ({
    projectSlug,
    ...s,
  }));
}

/** Single-project lookup. Used by the per-project commitment read so
 *  `/projects/[slug]` can render the withdrawn-state position card. */
export function getWithdrawnForProject(
  wallet: string,
  slug: string,
): WithdrawnSnapshot | null {
  if (!wallet || !slug) return null;
  const store = readStore();
  return store[wallet]?.[slug] ?? null;
}

/** Compute frozen kommits for a position about to be fully withdrawn.
 *  Cap accrual at graduation if applicable. One kommit per dollar-hour. */
export function computeFrozenKommits(args: {
  committedUSD: number;
  sinceMs: number;
  graduatedAtISO?: string;
}): number {
  const { committedUSD, sinceMs, graduatedAtISO } = args;
  const HOUR_MS = 3_600_000;
  const now = Date.now();
  const gradMs = graduatedAtISO
    ? new Date(`${graduatedAtISO}T00:00:00Z`).getTime()
    : null;
  const capMs = gradMs != null ? Math.min(now, gradMs) : now;
  const hours = Math.max(0, (capMs - sinceMs) / HOUR_MS);
  return Math.round(committedUSD * hours * 100) / 100;
}
