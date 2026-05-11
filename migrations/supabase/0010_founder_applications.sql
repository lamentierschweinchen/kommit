-- Kommit off-chain stack — migration 0010 (Founder applications queue, 2026-05-11).
--
-- Backs handoff 73 item 7 — the /build form was a stub that swallowed
-- submissions into a 250ms timeout. This table is where those submissions
-- now land, so Lukas has an actual review queue when a founder applies.
--
-- Field set mirrors EXACTLY what /build's react-hook-form already captures
-- (see web/src/app/build/page.tsx zod schema). Server-side validation in
-- /api/founder-application re-runs the same zod schema before insert —
-- defensive belt + suspenders, never trust the client.
--
-- No `wallet` column: applicants don't have a Privy wallet at apply-time.
-- The wallet binding happens later, when an admin runs the onboarding
-- script (`scripts/onboard_founder.ts --application <id> --wallet <addr>`).
-- `email` is the bridge between application and onboarding.
--
-- Trust model (matches 0005_waitlist.sql + 0009_founders.sql):
--   - Writes: service_role only, via `/api/founder-application`. RLS
--     enabled, no anon/authenticated policy, GRANTs revoked.
--   - Reads: service_role only. Admin reviews via Supabase dashboard;
--     onboarding script reads by id.
--   - IP is HMAC-SHA-256 hashed before insert (same pattern as
--     waitlist_signups; reuses WAITLIST_IP_HASH_KEY env so we don't sprout
--     a second secret).
--
-- Idempotent: re-runnable. CREATE TABLE IF NOT EXISTS.
--
-- Apply via Supabase SQL editor or:
--   psql "$SUPABASE_DB_URL" -f migrations/supabase/0010_founder_applications.sql

create table if not exists founder_applications (
  id              bigserial primary key,
  project_name    text not null,
  project_pitch   text not null,
  sector          text not null,
  longer_pitch    text not null,
  founders_blurb  text not null,
  stage           text not null,
  extra_notes     text,
  email           text not null,
  status          text not null default 'new'
    check (status in ('new','reviewing','approved','rejected')),
  reviewed_by     text,
  reviewed_at     timestamptz,
  created_at      timestamptz not null default now(),
  ip_hash         text
);

create index if not exists founder_applications_status_created
  on founder_applications (status, created_at desc);
create index if not exists founder_applications_email_idx
  on founder_applications (email);

-- ---------------------------------------------------------------------------
-- RLS — anon/authenticated have NO access. The /api/founder-application
-- route + the onboarding script are the only writers; nobody outside the
-- service_role context reads.
-- ---------------------------------------------------------------------------

alter table founder_applications enable row level security;

revoke all on founder_applications from anon, authenticated;
revoke all on sequence founder_applications_id_seq from anon, authenticated;

grant all on founder_applications to service_role;
grant all on sequence founder_applications_id_seq to service_role;

comment on table founder_applications is
  'Founder application queue (handoff 73). One row per /build submission. status starts "new"; admin transitions to "reviewing" / "approved" / "rejected" via Supabase dashboard. Approval is recorded by scripts/onboard_founder.ts when --application <id> is passed. Service-role only; no anon/authenticated grants.';
