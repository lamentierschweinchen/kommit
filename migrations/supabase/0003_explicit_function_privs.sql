-- Kommit off-chain stack — migration 0003 (Codex Layer-9 M3, 2026-05-07).
--
-- Locks down EXECUTE privileges on `process_event(...)` and the seven
-- `_mat_*` materialize helpers introduced in 0002.
--
-- Layer-9 finding M3: Postgres functions are EXECUTE-able by PUBLIC by
-- default. Even though `process_event` runs as SECURITY INVOKER and any
-- anon-role write would still hit Supabase RLS / table-grant walls, the
-- default PUBLIC EXECUTE grant means any anon PostgREST caller can still
-- invoke /rpc/process_event with arbitrary payloads — burning cycles,
-- exposing error-message surface, and creating a footgun if RLS is ever
-- misconfigured on a downstream materialized table.
--
-- This migration:
--   1. Declares SECURITY INVOKER explicitly on every function defined in
--      0002 (Postgres default is already invoker — making it explicit
--      removes reviewer ambiguity).
--   2. Revokes EXECUTE from PUBLIC, anon, authenticated.
--   3. Grants EXECUTE only to service_role — the role the webhook handler
--      uses via the Supabase admin client (service_role JWT).
--
-- After this migration:
--   - The webhook handler at app/web/src/app/api/webhook/helius/route.ts
--     (or its Pass 2/3 equivalent) keeps working unchanged: it calls
--     process_event() through a Supabase admin client whose JWT carries
--     role=service_role, so the new EXECUTE grant covers it.
--   - Anon / authenticated PostgREST requests to /rpc/process_event
--     receive a privilege error from PostgREST before any function body
--     runs.
--   - The same lock-down covers the inner `_mat_*` helpers so a future
--     refactor that calls them directly from a different security context
--     fails closed instead of silently writing.
--
-- Idempotent: alter function / revoke / grant / comment are all safe to
-- re-apply against an already-locked-down database.
--
-- Apply via Supabase SQL editor or:
--   psql "$SUPABASE_DB_URL" -f migrations/supabase/0003_explicit_function_privs.sql

-- ---------------------------------------------------------------------------
-- 1) Declare SECURITY INVOKER explicitly. Default is already invoker; this
--    documents the contract for future reviewers and prevents an accidental
--    create-or-replace from a prior context flipping the function to definer.
-- ---------------------------------------------------------------------------

alter function public._mat_upsert_project(text, text, bytea, timestamptz, bigint, smallint)             security invoker;
alter function public._mat_apply_commit(text, text, text, timestamptz, bigint, smallint, text)          security invoker;
alter function public._mat_apply_withdraw(text, text, text, bigint, smallint, text)                     security invoker;
alter function public._mat_apply_points_accrued(text, text, text, timestamptz, bigint, smallint, text)  security invoker;
alter function public._mat_apply_supply_executed(text, text, timestamptz, bigint, smallint, text, smallint) security invoker;
alter function public._mat_apply_yield_harvested(text, text, timestamptz, bigint, smallint, text)       security invoker;
alter function public._mat_apply_metadata_updated(text, bytea, bigint, smallint)                        security invoker;
alter function public.process_event(text, smallint, smallint, text, jsonb, bigint, timestamptz, text, text, smallint) security invoker;

-- ---------------------------------------------------------------------------
-- 2) Revoke EXECUTE from PUBLIC + Supabase's anon and authenticated roles.
--    Functions retain EXECUTE only for the roles explicitly granted in (3).
-- ---------------------------------------------------------------------------

revoke execute on function public._mat_upsert_project(text, text, bytea, timestamptz, bigint, smallint)             from public, anon, authenticated;
revoke execute on function public._mat_apply_commit(text, text, text, timestamptz, bigint, smallint, text)          from public, anon, authenticated;
revoke execute on function public._mat_apply_withdraw(text, text, text, bigint, smallint, text)                     from public, anon, authenticated;
revoke execute on function public._mat_apply_points_accrued(text, text, text, timestamptz, bigint, smallint, text)  from public, anon, authenticated;
revoke execute on function public._mat_apply_supply_executed(text, text, timestamptz, bigint, smallint, text, smallint) from public, anon, authenticated;
revoke execute on function public._mat_apply_yield_harvested(text, text, timestamptz, bigint, smallint, text)       from public, anon, authenticated;
revoke execute on function public._mat_apply_metadata_updated(text, bytea, bigint, smallint)                        from public, anon, authenticated;
revoke execute on function public.process_event(text, smallint, smallint, text, jsonb, bigint, timestamptz, text, text, smallint) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3) Grant EXECUTE to service_role — the only role that should call these.
--    The webhook handler runs server-side with the SUPABASE_SERVICE_ROLE_KEY,
--    which mints JWTs with role=service_role on every PostgREST request.
-- ---------------------------------------------------------------------------

grant execute on function public._mat_upsert_project(text, text, bytea, timestamptz, bigint, smallint)             to service_role;
grant execute on function public._mat_apply_commit(text, text, text, timestamptz, bigint, smallint, text)          to service_role;
grant execute on function public._mat_apply_withdraw(text, text, text, bigint, smallint, text)                     to service_role;
grant execute on function public._mat_apply_points_accrued(text, text, text, timestamptz, bigint, smallint, text)  to service_role;
grant execute on function public._mat_apply_supply_executed(text, text, timestamptz, bigint, smallint, text, smallint) to service_role;
grant execute on function public._mat_apply_yield_harvested(text, text, timestamptz, bigint, smallint, text)       to service_role;
grant execute on function public._mat_apply_metadata_updated(text, bytea, bigint, smallint)                        to service_role;
grant execute on function public.process_event(text, smallint, smallint, text, jsonb, bigint, timestamptz, text, text, smallint) to service_role;

-- ---------------------------------------------------------------------------
-- 4) Document the privilege contract on the public-facing function so a
--    reviewer reading `\df+ process_event` in psql sees it inline.
-- ---------------------------------------------------------------------------

comment on function public.process_event(text, smallint, smallint, text, jsonb, bigint, timestamptz, text, text, smallint) is
  'service_role-only RPC. Called by the webhook handler at app/web/src/app/api/webhook/helius/route.ts (Pass 2/3) via the Supabase admin client. Records one event under (tx_hash, instruction_index, event_index) identity and dispatches the matching _mat_* helper inside one transaction. EXECUTE grant locked to service_role per Codex Layer-9 M3 / migration 0003.';
