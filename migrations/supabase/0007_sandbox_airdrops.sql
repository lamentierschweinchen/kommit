-- Kommit off-chain stack — migration 0007 (Lane B sandbox airdrop idempotency, 2026-05-09).
--
-- Backs Codex Pass 1 H2 closure on PR #20: the previous in-memory rate
-- limiter (`web/src/lib/visa-demo-rate-limit.ts`) doesn't survive Vercel
-- cold starts, so parallel cold instances could each observe a wallet's
-- pre-airdrop SOL balance below GAS_THRESHOLD_LAMPORTS (0.01 SOL) and all
-- transfer 0.05 SOL before any shared idempotency state existed. Worst-case
-- exposure with 100 colluding cold-start hits per wallet was ~5 SOL drain
-- per wallet from the visa-demo fee-payer.
--
-- This table is a wallet-keyed lock primitive used by /api/sandbox/airdrop:
--
--   1. Try INSERT INTO sandbox_airdrops (wallet) VALUES (?) ON CONFLICT
--      DO NOTHING RETURNING wallet — atomic acquisition.
--   2. If a row was returned, this caller "owns" the airdrop. Perform the
--      SOL + token transfers, then UPDATE the row's funded-at timestamps.
--   3. If no row was returned, an earlier call already inserted; this
--      caller returns idempotent success without spending fee-payer funds.
--
-- Failure recovery: if the owning caller's transfers throw, the route
-- DELETEs the row so a retry can re-acquire. Without this, a transient
-- RPC outage during the first attempt would lock the wallet out forever.
--
-- Trust model:
--   - The /api/sandbox/airdrop route owns reads + writes via the
--     service-role client (lib/supabase-admin.ts). RLS is enabled and
--     anon/authenticated have ZERO grants — same posture as
--     waitlist_signups (migration 0005).
--   - The wallet column stores the base58 Solana pubkey verbatim. Not a
--     secret (it's a public address) and the address is what the
--     idempotency key is keyed on, so we don't hash it.
--
-- Idempotent: re-runnable. CREATE TABLE IF NOT EXISTS / DROP POLICY IF
-- EXISTS pattern, matching migrations 0005-0006.
--
-- Apply via Supabase SQL editor or:
--   psql "$SUPABASE_DB_URL" -f migrations/supabase/0007_sandbox_airdrops.sql

create table if not exists sandbox_airdrops (
  wallet           text        primary key,
  sol_funded_at    timestamptz,
  token_funded_at  timestamptz,
  created_at       timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- RLS — anon/authenticated have NO access. Service-role bypasses RLS and is
-- the only path that can read/write. There is no public surface on this
-- table; PostgREST should not be able to enumerate sandbox airdrops.
-- ---------------------------------------------------------------------------

alter table sandbox_airdrops enable row level security;

revoke all on sandbox_airdrops from anon, authenticated;

grant all on sandbox_airdrops to service_role;

comment on table sandbox_airdrops is
  'Lane B sandbox airdrop idempotency lock (Codex Pass 1 H2 closure). One row per wallet that has been granted the SOL+token airdrop on /api/sandbox/airdrop. Inserted via INSERT...ON CONFLICT DO NOTHING; the conflict is the dedup signal. Deleted on transfer failure so retry can re-acquire. Written exclusively by service_role from /api/sandbox/airdrop; no anon/authenticated grants.';
