/**
 * In-memory idempotency dedup for the visa-demo onramp / offramp routes
 * (Codex H1).
 *
 * Keyed by `${wallet}:${idempotencyKey}` → cached operation result + a
 * shallow timestamp for TTL eviction. Same memory-pruning shape as
 * `visa-demo-rate-limit.ts` (Codex M4 risk-accept applies here similarly:
 * sandbox-scale demo, cold-start reset is bounded, Redis migration scoped
 * to v1).
 *
 * Behavior:
 *   - First call with a key + wallet stores the result.
 *   - Repeat call with SAME key + SAME wallet returns the cached result,
 *     skipping Helio + memo (the whole point of idempotency).
 *   - Repeat call with SAME key + DIFFERENT wallet → conflict (caller is
 *     trying to replay someone else's operation under a different
 *     identity). Surfaced as 409 by the route.
 *   - Cached entry expires after IDEMPOTENCY_TTL_MS (10 min).
 *
 * Pruning is opportunistic — every store call sweeps expired entries.
 * Sandbox traffic is small enough that this stays well under any memory
 * limit; production-grade would migrate to Redis/KV with native TTL.
 */

import "server-only";

const IDEMPOTENCY_TTL_MS = 10 * 60 * 1000; // 10 min

type Entry<T> = {
  /** Wallet that originated this idempotency key — second-factor for replay. */
  wallet: string;
  /** Cached operation result (the route's full success-shape JSON body). */
  result: T;
  /** When this entry was stored — TTL eviction key. */
  storedAt: number;
};

// One module-level map. JSON-shaped result is fine because we just hand it
// back via NextResponse.json(). Type erased to `unknown` here — the route
// adds the type guarantee at the boundary.
const store = new Map<string, Entry<unknown>>();

function compositeKey(wallet: string, idempotencyKey: string): string {
  return `${wallet}:${idempotencyKey}`;
}

function pruneExpired(now: number): void {
  for (const [k, v] of store) {
    if (now - v.storedAt > IDEMPOTENCY_TTL_MS) {
      store.delete(k);
    }
  }
}

export type LookupResult<T> =
  /** No prior entry — caller proceeds with the operation. */
  | { kind: "miss" }
  /** Same wallet + same key as a prior call — return the cached result. */
  | { kind: "hit"; result: T }
  /** Same key but different wallet — caller is replaying someone else's
   *  operation under their own identity. Route returns 409. */
  | { kind: "conflict" };

/** Check if a (wallet, idempotencyKey) pair has been seen.
 *  Returns the cached result on hit; never side-effects. */
export function lookup<T>(
  wallet: string,
  idempotencyKey: string,
): LookupResult<T> {
  const now = Date.now();
  pruneExpired(now);
  const k = compositeKey(wallet, idempotencyKey);
  const existing = store.get(k);
  if (!existing) {
    // Maybe the same key was used by a DIFFERENT wallet — scan briefly to
    // surface the conflict. O(n) is fine at sandbox scale (<<1k entries
    // before TTL eviction).
    for (const [otherK, otherV] of store) {
      // Same idempotencyKey suffix, different wallet prefix.
      if (otherK.endsWith(`:${idempotencyKey}`) && otherV.wallet !== wallet) {
        return { kind: "conflict" };
      }
    }
    return { kind: "miss" };
  }
  return { kind: "hit", result: existing.result as T };
}

/** Store a (wallet, idempotencyKey) → result mapping. Caller invokes this
 *  AFTER the underlying operation succeeds. */
export function store_<T>(
  wallet: string,
  idempotencyKey: string,
  result: T,
): void {
  const now = Date.now();
  pruneExpired(now);
  store.set(compositeKey(wallet, idempotencyKey), {
    wallet,
    result,
    storedAt: now,
  });
}

// `store` is a reserved-feeling name; export under a tidier alias too.
export { store_ as cache };

/** Test-only: reset the dedup store between assertions. */
export function _resetIdempotencyStore(): void {
  store.clear();
}
