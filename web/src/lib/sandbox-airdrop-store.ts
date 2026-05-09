/**
 * Persistent wallet-keyed idempotency lock for /api/sandbox/airdrop.
 *
 * Codex Pass 1 H2 closure. The previous in-memory rate limiter
 * (`visa-demo-rate-limit.ts`) doesn't survive Vercel cold starts, so
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
 * Implementation: INSERT...ON CONFLICT DO NOTHING. PostgREST returns the
 * inserted row(s) on success and an empty array on conflict. We rely on
 * the `wallet` primary key to enforce uniqueness.
 */
export async function tryAcquireAirdropLock(
  wallet: string,
): Promise<AcquireResult> {
  const supabase = getSupabaseAdminClient();
  // `upsert` with `ignoreDuplicates: true` maps to ON CONFLICT DO NOTHING.
  // Selecting after the upsert returns the inserted row if a conflict did
  // NOT happen, or an empty result if the wallet was already there.
  const { data, error } = await supabase
    .from(TABLE)
    .upsert({ wallet }, { onConflict: "wallet", ignoreDuplicates: true })
    .select("wallet");
  if (error) {
    return { kind: "error", message: error.message };
  }
  // `data` is the array of rows actually inserted. Empty = conflict.
  if (Array.isArray(data) && data.length > 0) {
    return { kind: "acquired" };
  }
  return { kind: "already-granted" };
}

export type FundedKind = "sol" | "token";

/** Stamp the funded-at column for the wallet. Idempotent: safe to call
 *  multiple times; the column gets the latest timestamp. */
export async function markAirdropFunded(
  wallet: string,
  kind: FundedKind,
): Promise<void> {
  const supabase = getSupabaseAdminClient();
  const column = kind === "sol" ? "sol_funded_at" : "token_funded_at";
  const { error } = await supabase
    .from(TABLE)
    .update({ [column]: new Date().toISOString() })
    .eq("wallet", wallet);
  if (error) {
    console.warn(
      `[sandbox-airdrop-store] markAirdropFunded(${wallet}, ${kind}) failed:`,
      error.message,
    );
  }
}

/** Release the lock so a future retry can re-acquire. Call from the route's
 *  catch block after a transfer failure. Idempotent — no row to delete is
 *  treated as success. */
export async function releaseAirdropLock(wallet: string): Promise<void> {
  const supabase = getSupabaseAdminClient();
  const { error } = await supabase.from(TABLE).delete().eq("wallet", wallet);
  if (error) {
    console.warn(
      `[sandbox-airdrop-store] releaseAirdropLock(${wallet}) failed:`,
      error.message,
    );
  }
}
