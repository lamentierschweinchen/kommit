-- Kommit off-chain stack — migration 0009 (Real-Privy founder identity, 2026-05-11).
--
-- Backs handoff 73 — the "real founder onboarding" path. RealAuthProvider was
-- previously synthesizing a User shape from a Privy wallet alone; there was no
-- way to attach a founder identity to that wallet, no profile fields, and no
-- way to wire `ownsProject` so the founder dashboard auth gate would open.
--
-- This migration adds the `founders` table — wallet-keyed identity + profile
-- for real-Privy founders. The `/api/me` route reads it on sign-in and
-- enriches the in-memory User. The admin onboarding script
-- (`scripts/onboard_founder.ts`) writes a row when promoting an application
-- to a listed project.
--
-- Schema notes:
--
--   - `wallet` is primary key. The Privy embedded Solana wallet address is
--     the canonical identity — emails change, persona ids are convenience.
--   - `user_id` is OPTIONAL. When set, parity with the `USERS` dict
--     (lowercase, slug-shape) so `/profile/<user_id>` resolves the same
--     way `/profile/<wallet>` does. Unique via partial index.
--   - `project_slug` is TEXT (no FK to projects(pda)). Front-end project
--     identity is the human slug ("bright-labs"), not the on-chain PDA.
--     The two are linked indirectly via `Project.recipientWallet` →
--     `findProjectPda(recipient)` when needed; the relationship is
--     definitional, not relational. NOT enforcing the FK keeps the founder
--     row writable BEFORE the indexer has caught the create_project tx.
--   - `interests` and `links` as jsonb — variable-length arrays, faster to
--     write the whole array than split into a child table for v0.5.
--     `links` = [{ label, url }]; renderer hides empties.
--   - `avatar_seed` integer 1..70 mirrors `avatarSeedFromAddress(addr)` in
--     AuthProvider.tsx — the script sets it deterministically so the
--     founder's pravatar matches across the app.
--
-- Trust model (matches 0005_waitlist.sql):
--   - Writes: service_role only, via `/api/me/profile` + the onboarding script.
--     RLS enabled, no anon/authenticated policy, GRANTs revoked.
--   - Reads: service_role only — the `/api/me` route fetches by wallet,
--     the `/profile/[slug]` server component looks up by user_id OR wallet.
--     No anon select keeps the table sealed even if RLS is misconfigured.
--
-- Idempotent: re-runnable. CREATE TABLE IF NOT EXISTS / DROP POLICY IF EXISTS.
--
-- Apply via Supabase SQL editor or:
--   psql "$SUPABASE_DB_URL" -f migrations/supabase/0009_founders.sql

create extension if not exists citext;

create table if not exists founders (
  wallet            text primary key,
  user_id           text,
  email             citext,
  display_name      text not null,
  role              text not null default 'founder' check (role in ('founder','admin')),
  project_slug      text,
  country           text,
  interests         jsonb not null default '[]'::jsonb,
  bio               text,
  links             jsonb not null default '[]'::jsonb,
  avatar_seed       integer,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create unique index if not exists founders_user_id_unique
  on founders (user_id) where user_id is not null;
create index if not exists founders_project_slug_idx
  on founders (project_slug) where project_slug is not null;
create index if not exists founders_email_idx
  on founders (email) where email is not null;

-- updated_at autobump — same pattern other tables use when they need this.
-- Belt-and-suspenders to writer code: even a direct SQL update bumps the ts.
create or replace function founders_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists founders_set_updated_at on founders;
create trigger founders_set_updated_at
  before update on founders
  for each row execute function founders_set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS — anon/authenticated have NO access. Service-role bypasses RLS and is
-- the only path that can read or write. The /api/me + /api/me/profile routes
-- run server-side with the service-role client.
-- ---------------------------------------------------------------------------

alter table founders enable row level security;

revoke all on founders from anon, authenticated;
grant all on founders to service_role;

comment on table founders is
  'Real-Privy founder identity + profile (handoff 73). Wallet-keyed; one row per founder. Written by the admin onboarding script (scripts/onboard_founder.ts) and the /api/me/profile route (founder edits own row). Read by /api/me on sign-in to enrich the auth User shape. Service-role only on both axes; no anon/authenticated grants.';
