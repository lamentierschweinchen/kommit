-- Kommit off-chain stack — migration 0005 (Coming-soon waitlist, 2026-05-09).
--
-- Backs the Lane A architecture rollout: `/` is now a coming-soon waitlist
-- (see app/web/src/app/page.tsx + app/web/src/components/landing/WaitlistForm.tsx);
-- the functional product moved to `/app`. This migration adds the storage for
-- the waitlist sign-ups + the lockdown to keep the table service-role-only.
--
-- Trust model:
--   - The /api/waitlist route owns inserts. It runs server-side with the
--     service-role key (see lib/supabase-admin.ts).
--   - anon and authenticated PostgREST clients have ZERO grants on this
--     table — the table is RLS-enabled with no select/insert policy and
--     all privileges revoked at the GRANT layer too. Belt + suspenders:
--     even a misconfigured RLS toggle wouldn't open the table to anon.
--   - IP is stored as a SHA-256 hash, not a raw address. The route hashes
--     before insert; the column type is `bytea` to make that explicit.
--
-- Idempotent: re-runnable. CREATE TABLE IF NOT EXISTS / DROP POLICY IF EXISTS.
--
-- Apply via Supabase SQL editor or:
--   psql "$SUPABASE_DB_URL" -f migrations/supabase/0005_waitlist.sql

create extension if not exists citext;

create table if not exists waitlist_signups (
  id           bigserial primary key,
  email        citext      not null,
  role         text        not null check (role in ('backer', 'builder')),
  created_at   timestamptz not null default now(),
  ip_hash      bytea
);

create unique index if not exists waitlist_signups_email_unique
  on waitlist_signups (email);

-- ---------------------------------------------------------------------------
-- RLS — anon/authenticated have NO access. Service-role bypasses RLS and is
-- the only path that can write. There is no public read on this table.
-- ---------------------------------------------------------------------------

alter table waitlist_signups enable row level security;

-- Defense-in-depth: revoke all grants from anon + authenticated. RLS already
-- blocks them, but this closes the PostgREST surface even if RLS were ever
-- accidentally disabled.
revoke all on waitlist_signups from anon, authenticated;
revoke all on sequence waitlist_signups_id_seq from anon, authenticated;

grant all on waitlist_signups to service_role;
grant all on sequence waitlist_signups_id_seq to service_role;

comment on table waitlist_signups is
  'Coming-soon waitlist captures (Lane A). Email + role (backer|builder) + sha256(ip) for soft rate-limit forensics. Written exclusively by service_role from /api/waitlist; no anon/authenticated grants.';
