-- Kommit off-chain stack — migration 0006 (Waitlist ip_hash bytea→text, 2026-05-09).
--
-- Why: PostgREST + supabase-js can't auto-cast a JSON string to bytea on
-- parameterized inserts. The Lane A route was passing
-- `'\x' + hex(hmac(ip))` and PostgreSQL stored it as a 64-char text
-- string, not the intended 32 bytes; the implicit text → bytea
-- conversion only works in SQL literal contexts, not in PostgREST's
-- prepared-statement path. Net: every /api/waitlist insert was returning
-- `server-error`.
--
-- Fix: store the HMAC digest as a hex `text` instead of `bytea`. Same
-- HMAC-SHA-256 keyed by `WAITLIST_IP_HASH_KEY` (Codex Pass 1 L1 closure
-- preserved); the only difference is the on-disk encoding. Text wins by
-- ~32 bytes per row vs. bytea — meaningless at waitlist scale.
--
-- The route (web/src/app/api/waitlist/route.ts) ships the matching
-- change in the same PR: `digest("hex")` instead of `'\\x' + digest`.
--
-- Idempotent: re-runnable. The `using encode(ip_hash, 'hex')` clause
-- handles existing rows that may have been written as bytea (the manual
-- diagnostic insert from May 9 debugging is the only one that actually
-- landed; production traffic was 100% server-error).
--
-- Apply via Supabase SQL editor or:
--   psql "$SUPABASE_DB_URL" -f migrations/supabase/0006_waitlist_ip_hash_text.sql

alter table waitlist_signups
  alter column ip_hash type text
  using case
    when ip_hash is null then null
    else encode(ip_hash, 'hex')
  end;

comment on column waitlist_signups.ip_hash is
  'HMAC-SHA-256(ip, WAITLIST_IP_HASH_KEY) hex digest. Stored as text rather than bytea — PostgREST does not auto-cast text JSON values to bytea on parameterized inserts, which broke every /api/waitlist insert through Lane A''s initial ship. Hex text removes the encoding ambiguity. Codex Pass 1 L1 hardening (HMAC keyed by server secret) is preserved.';
