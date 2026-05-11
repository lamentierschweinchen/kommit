/**
 * Persistent wallet-keyed idempotency lock for /api/sandbox/airdrop.
 *
 * Codex Pass 1 H2 closure. The previous in-memory rate limiter
 * (`sandbox-rate-limit.ts`) doesn't survive Vercel cold starts, so
 * parallel cold instances could each observe a wallet's pre-airdrop SOL
 * balance below threshold and all transfer 0.05 SOL — draining the
 * fee-payer at ~0.05 SOL per cold instance per wallet.
 *
 * This module wraps the `sandbox_airdrops` Supabase table (migration 0007)
 * with the lock primitive the route needs:
 *
 *   1. `tryAcquireAirdropLock(wallet)` — attempts to claim the airdrop for
 *      a wallet. Atomic: returns "acquired" exactly once across all
 *      concurrent callers; subsequent callers (and retries after first
 *      success) get "already-granted".
 *   2. `markAirdropFunded(wallet, kind)` — call after a successful SOL
 *      and/or token transfer to stamp the appropriate funded-at column.
 *      Idempotent — safe to call multiple times.
 *   3. `releaseAirdropLock(wallet)` — call on transfer failure to release
 *      the lock so a retry can re-acquire. Without this, transient RPC
 *      failures would lock a wallet out forever.
 *
 * Failure-mode reasoning: if the route crashes between acquire and
 * either funded-stamp or release, the row is "leaked" — the wallet is
 * permanently marked as already-granted but the funded-at columns stay
 * NULL. This is the safer-of-two-evils failure: one wallet loses access
 * to the demo airdrop (recoverable: operator runs `delete from
 * sandbox_airdrops where wallet = '…'` from Supabase studio) vs.
 * draining the fee-payer.
 *
 * Returns from the Supabase client are wrapped — callers see a small
 * tagged-union, not raw PostgREST shapes.
 */

import "server-only";

import { getSupabaseAdminClient } from "@/lib/supabase-admin";

const TABLE = "sandbox_airdrops";

export type AcquireResult =
  | { kind: "acquired" }
  | { kind: "already-granted" }
  | { kind: "error"; message: string };

/**
 * Attempt to claim the airdrop for `wallet`. Atomic across concurrent
 * callers: at most one returns "acquired"; the rest get "already-granted".
 *
 * Implementation: INSERT, relying on the partial unique index
 * `sandbox_airdrops_airdrop_per_wallet` (migration 0008,
 * `(wallet) WHERE kind='airdrop'`) to reject duplicates with a Postgres
 * unique-violation (SQLSTATE 23505). PostgREST surfaces the SQLSTATE
 * directly so we can branch on it without parsing the message string.
 *
 * Why a plain INSERT instead of upsert: the table's PK is now
 * `(wallet, created_at)` so card-deposit rows can stack (handoff 64,
 * migration 0008). PostgREST's `upsert(..., { onConflict: "wallet" })`
 * needs a single-column unique constraint on `wallet` — which no longer
 * exists, only the partial index does. The INSERT-and-catch-23505
 * pattern works against the partial index without needing PostgREST to
 * understand the WHERE clause.
 */
export async function tryAcquireAirdropLock(
  wallet: string,
): Promise<AcquireResult> {
  const supabase = getSupabaseAdminClient();
  const { error } = await supabase
    .from(TABLE)
    .insert({ wallet, kind: "airdrop" });
  if (!error) {
    return { kind: "acquired" };
  }
  // 23505 = unique_violation. The partial index `(wallet) WHERE
  // kind='airdrop'` rejected the insert because this wallet already has an
  // airdrop row — that's the "already-granted" signal.
  if (error.code === "23505") {
    return { kind: "already-granted" };
  }
  return { kind: "error", message: error.message };
}

export type FundedKind = "sol" | "token";

/** Stamp the funded-at column for the wallet's airdrop row. Idempotent:
 *  safe to call multiple times; the column gets the latest timestamp.
 *
 *  Scoped to `kind='airdrop'` post-migration-0008 — without the filter
 *  this would also stamp every card-deposit row for the same wallet,
 *  which would silently overwrite the per-call deposit timestamps. */
export async function markAirdropFunded(
  wallet: string,
  kind: FundedKind,
): Promise<void> {
  const supabase = getSupabaseAdminClient();
  const column = kind === "sol" ? "sol_funded_at" : "token_funded_at";
  const { error } = await supabase
    .from(TABLE)
    .update({ [column]: new Date().toISOString() })
    .eq("wallet", wallet)
    .eq("kind", "airdrop");
  if (error) {
    console.warn(
      `[sandbox-airdrop-store] markAirdropFunded(${wallet}, ${kind}) failed:`,
      error.message,
    );
  }
}

/** Release the lock so a future retry can re-acquire. Call from the route's
 *  catch block after a transfer failure. Idempotent — no row to delete is
 *  treated as success.
 *
 *  Scoped to `kind='airdrop'` so a release after a failed airdrop never
 *  accidentally wipes the wallet's card-deposit history rows added by
 *  /api/sandbox/card-deposit (handoff 64). */
export async function releaseAirdropLock(wallet: string): Promise<void> {
  const supabase = getSupabaseAdminClient();
  const { error } = await supabase
    .from(TABLE)
    .delete()
    .eq("wallet", wallet)
    .eq("kind", "airdrop");
  if (error) {
    console.warn(
      `[sandbox-airdrop-store] releaseAirdropLock(${wallet}) failed:`,
      error.message,
    );
  }
}

// ---------------------------------------------------------------------------
// Card-deposit recording (handoff 64).
//
// `card-deposit` rows live in the same `sandbox_airdrops` table per migration
// 0008. Unlike `airdrop`, they're NOT idempotent per wallet — the user
// explicitly wants to deposit repeatedly (no lifetime cap, $1K cap per call).
// So this is a straight INSERT, one row per successful card-deposit POST.
// Burst protection is handled separately by the in-memory rate limiter
// (60s/wallet) in the route.
// ---------------------------------------------------------------------------

export type CardDepositRecord = {
  wallet: string;
  amountUsd: number;
  signature: string;
};

/**
 * Insert a card-deposit row. Caller is `/api/sandbox/card-deposit` after
 * the SPL mint tx has confirmed. Ordering note: the audit story is "the
 * mint succeeded AND we recorded it" — a recorded row without an on-chain
 * mint would be a phantom deposit, so the route must call this AFTER the
 * `confirmTransaction` resolves.
 *
 * Failure to record is logged but not surfaced — the user already has
 * the funds on-chain (the mint tx is the source of truth). A missing row
 * affects audit/observability only, not user balance.
 */
export async function recordCardDeposit(
  rec: CardDepositRecord,
): Promise<void> {
  const supabase = getSupabaseAdminClient();
  const { error } = await supabase.from(TABLE).insert({
    wallet: rec.wallet,
    kind: "card-deposit",
    amount_usd: rec.amountUsd,
    // Stamp `token_funded_at` to the mint-confirmation moment — same column
    // the airdrop path uses, keeps "when did this wallet last receive
    // tokens" queries simple.
    token_funded_at: new Date().toISOString(),
    // Note: `signature` is intentionally not stored — the migration didn't
    // add a column for it, and we return it to the client which Solscans
    // it for proof. Adding a column would mean another migration; the
    // submission deadline is tight and the on-chain artifact is the
    // canonical record.
  });
  if (error) {
    console.warn(
      `[sandbox-airdrop-store] recordCardDeposit(${rec.wallet}, $${rec.amountUsd}, sig=${rec.signature.slice(0, 8)}…) failed:`,
      error.message,
    );
  }
}
