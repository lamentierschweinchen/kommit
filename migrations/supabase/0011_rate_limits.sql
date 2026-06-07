-- Kommit off-chain stack — migration 0011 (Durable API rate limits, 2026-06-08).
--
-- Adds a small service-role-only counter table plus RPC for write-path
-- throttling. The public API routes call this through the Supabase admin
-- client, matching the privileged-function posture locked down in migration
-- 0003: anon/authenticated have no table grants and no EXECUTE privilege.
--
-- Initial consumers:
--   - /api/founder-application: 3/email/24h and 10/IP/24h
--   - /api/updates/[id]/comments: 10/wallet/10m
--   - /api/updates/[id]/reactions: 30/wallet/10m
--
-- Idempotent: CREATE TABLE IF NOT EXISTS; CREATE OR REPLACE FUNCTION.
--
-- Apply via Supabase SQL editor or:
--   psql "$SUPABASE_DB_URL" -f migrations/supabase/0011_rate_limits.sql

create table if not exists public.rate_limits (
  identifier     text        not null,
  window_start   timestamptz not null,
  window_seconds integer     not null check (window_seconds > 0),
  request_count  integer     not null default 0 check (request_count >= 0),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  primary key (identifier, window_start)
);

create index if not exists rate_limits_window_start_idx
  on public.rate_limits (window_start);

alter table public.rate_limits enable row level security;

revoke all on public.rate_limits from public, anon, authenticated;
grant select, insert, update, delete on public.rate_limits to service_role;

create or replace function public.take_rate_limit(
  p_identifier text,
  p_limit integer,
  p_window_seconds integer
)
returns table (
  allowed boolean,
  current_count integer,
  reset_at timestamptz
)
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_now timestamptz := now();
  v_window_start timestamptz;
  v_count integer;
begin
  if p_identifier is null or length(trim(p_identifier)) = 0 then
    raise exception 'p_identifier is required' using errcode = '22023';
  end if;

  if p_limit is null or p_limit <= 0 then
    raise exception 'p_limit must be positive' using errcode = '22023';
  end if;

  if p_window_seconds is null or p_window_seconds <= 0 then
    raise exception 'p_window_seconds must be positive' using errcode = '22023';
  end if;

  v_window_start :=
    to_timestamp(
      floor(extract(epoch from v_now) / p_window_seconds) * p_window_seconds
    );

  with upserted as (
    insert into public.rate_limits (
      identifier,
      window_start,
      window_seconds,
      request_count,
      created_at,
      updated_at
    )
    values (
      trim(p_identifier),
      v_window_start,
      p_window_seconds,
      1,
      v_now,
      v_now
    )
    on conflict (identifier, window_start)
    do update set
      request_count = public.rate_limits.request_count + 1,
      window_seconds = excluded.window_seconds,
      updated_at = excluded.updated_at
    returning public.rate_limits.request_count
  )
  select upserted.request_count into v_count
  from upserted;

  allowed := v_count <= p_limit;
  current_count := v_count;
  reset_at := v_window_start + make_interval(secs => p_window_seconds);

  return next;
end;
$$;

revoke execute on function public.take_rate_limit(text, integer, integer)
  from public, anon, authenticated;
grant execute on function public.take_rate_limit(text, integer, integer)
  to service_role;

comment on table public.rate_limits is
  'Service-role-only API rate-limit counters. Identifiers are scoped by endpoint and caller dimension; founder email/IP identifiers are HMAC digests, not raw PII.';

comment on function public.take_rate_limit(text, integer, integer) is
  'Atomically increments one fixed-window rate-limit bucket and returns whether the request is still allowed. EXECUTE grant locked to service_role; called only via the Supabase admin client.';
