-- Kommit off-chain stack — migration 0008 (handoff 64 card-deposit support, 2026-05-10).
--
-- Extends `sandbox_airdrops` (migration 0007) so it can also store rows
-- written by the new /api/sandbox/card-deposit endpoint, without forcing a
-- second nearly-identical table.
--
-- Two columns added:
--
--   1. `kind` text — discriminator. "airdrop" (the original $10K demo-entry
--      grant from /api/sandbox/airdrop) vs. "card-deposit" (each card
--      top-up via /api/sandbox/card-deposit, capped at $1K per call).
--   2. `amount_usd` integer — recorded USD amount for card-deposit rows
--      (null for airdrop rows where the grant amount is fixed in code).
--
-- Primary-key shape changes from `(wallet)` to `(wallet, created_at)`:
--
--   - The original table used `wallet` as PK to enforce one-row-per-wallet
--     idempotency (insert-or-conflict). That's still the right shape for
--     "airdrop" rows — one $10K grant per wallet, ever.
--   - "card-deposit" rows must NOT be wallet-unique: the user explicitly
--     wants to deposit repeatedly (no lifetime cap, $1K per call). So
--     each card-deposit POST is a fresh row.
--   - The compound PK keeps both modes working: airdrop rows keep their
--     "one per wallet" guarantee via the partial unique index below;
--     card-deposit rows can stack freely.
--
-- Idempotency model after this migration:
--   - airdrop:      partial unique index on (wallet) WHERE kind='airdrop'
--                   keeps the H2-fix guarantee from migration 0007 — at most
--                   one airdrop row per wallet, atomic via INSERT ON CONFLICT.
--   - card-deposit: no per-wallet uniqueness. Idempotency is per-call
--                   (each POST is a discrete row). Burst protection lives
--                   in the in-memory rate limiter (60s/wallet) in the route.
--
-- Backfill: existing rows pre-date this migration and are all airdrops, so
-- we set kind='airdrop' for them. No data loss.
--
-- Apply via Supabase SQL editor or:
--   psql "$SUPABASE_DB_URL" -f migrations/supabase/0008_sandbox_airdrops_kind.sql

-- 1. Add the new columns.
alter table sandbox_airdrops
  add column if not exists kind text,
  add column if not exists amount_usd integer;

-- 2. Backfill existing rows. They all came in via /api/sandbox/airdrop
--    before this migration existed, so they're "airdrop" by definition.
update sandbox_airdrops set kind = 'airdrop' where kind is null;

-- 3. Pin the kind column down. NOT NULL + check constraint enforces the
--    discriminator at the database level — accidental "" or "Airdrop"
--    typos in code fail loudly instead of silently breaking later queries.
alter table sandbox_airdrops
  alter column kind set not null,
  alter column kind set default 'airdrop';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'sandbox_airdrops_kind_check'
  ) then
    alter table sandbox_airdrops
      add constraint sandbox_airdrops_kind_check
      check (kind in ('airdrop', 'card-deposit'));
  end if;
end $$;

-- 4. PK swap: drop the old (wallet) PK, replace with (wallet, created_at)
--    so card-deposit rows can stack.
do $$
begin
  if exists (
    select 1 from pg_constraint
    where conname = 'sandbox_airdrops_pkey' and contype = 'p'
  ) then
    alter table sandbox_airdrops drop constraint sandbox_airdrops_pkey;
  end if;
end $$;

alter table sandbox_airdrops
  add constraint sandbox_airdrops_pkey
  primary key (wallet, created_at);

-- 5. Partial unique index preserves the airdrop one-row-per-wallet guarantee
--    that migration 0007's PK gave us. The /api/sandbox/airdrop route still
--    relies on INSERT...ON CONFLICT (wallet) DO NOTHING for atomic acquisition.
create unique index if not exists sandbox_airdrops_airdrop_per_wallet
  on sandbox_airdrops (wallet)
  where kind = 'airdrop';

-- 6. Helper index for card-deposit reads (audits, "show me this wallet's
--    deposit history"). Cheap; the table is sandbox-scale.
create index if not exists sandbox_airdrops_card_deposit_lookup
  on sandbox_airdrops (wallet, created_at desc)
  where kind = 'card-deposit';

-- 7. Refresh table comment to document the kind discriminator.
comment on table sandbox_airdrops is
  'Lane B sandbox grants (Codex Pass 1 H2 closure + handoff 64 card-deposit). One row per grant. kind="airdrop" rows are the $10K demo-entry grant from /api/sandbox/airdrop — partial unique index enforces one per wallet, written via INSERT...ON CONFLICT for atomic acquisition. kind="card-deposit" rows are per-call deposits from /api/sandbox/card-deposit — no per-wallet uniqueness (the user can deposit repeatedly, capped $1K/call) — `amount_usd` records the per-call amount. Written exclusively by service_role; no anon/authenticated grants.';
