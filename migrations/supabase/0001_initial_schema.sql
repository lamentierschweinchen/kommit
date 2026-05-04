-- Kommit off-chain stack — initial Supabase schema (migration 0001).
--
-- Owner: the indexer at app/web/src/app/api/webhook/helius/route.ts.
-- Source of truth: the Solana program (events emitted from
-- programs/kommit/src/events.rs). Materialized state is rebuildable from
-- the events table; on a corrupt or partial sync, drop projects /
-- commitments / lending_positions and re-replay events.
--
-- v1 scope: private beta with 5–15 projects + a few hundred commits at most.
-- Indexes are sized for that scale; not optimized for millions of rows.
--
-- Apply via Supabase SQL editor or `psql $SUPABASE_DB_URL -f 0001_initial_schema.sql`.

-- ---------------------------------------------------------------------------
-- Source events (append-only). Idempotent on (tx_hash, event_name).
-- ---------------------------------------------------------------------------

create table if not exists events (
  id           bigserial primary key,
  tx_hash      text not null,
  slot         bigint not null,
  block_time   timestamptz not null,
  event_name   text not null,           -- 'Committed' | 'Withdrawn' | etc.
  payload      jsonb not null,           -- full event data, base58-encoded pubkeys
  inserted_at  timestamptz default now(),
  unique (tx_hash, event_name)
);

create index if not exists events_event_name_idx on events(event_name);
create index if not exists events_slot_idx on events(slot);
create index if not exists events_block_time_idx on events(block_time desc);

-- ---------------------------------------------------------------------------
-- Materialized state — kept in sync by the webhook handler.
-- ---------------------------------------------------------------------------

create table if not exists projects (
  pda                       text primary key,
  recipient_wallet          text not null,
  metadata_uri_hash         bytea not null,
  metadata                  jsonb,                       -- pinned IPFS content; lazily fetched
  cumulative_principal      bigint not null default 0,
  cumulative_yield_routed   bigint not null default 0,
  created_at                timestamptz not null,
  last_seen_slot            bigint not null
);

create index if not exists projects_recipient_idx on projects(recipient_wallet);

create table if not exists commitments (
  pda               text primary key,
  user_wallet       text not null,
  project_pda       text not null references projects(pda) on delete cascade,
  principal         bigint not null,
  deposit_ts        timestamptz not null,
  active_score      numeric(40, 0) not null default 0,   -- u128
  lifetime_score    numeric(40, 0) not null default 0,   -- u128
  last_accrual_ts   timestamptz not null,
  last_seen_slot    bigint not null
);

create index if not exists commitments_user_idx on commitments(user_wallet);
create index if not exists commitments_project_idx on commitments(project_pda);

create table if not exists lending_positions (
  pda                text primary key,
  project_pda        text not null references projects(pda) on delete cascade,
  adapter_id         smallint not null,                  -- 0 = Kamino
  vault_handle       text not null,
  supplied           bigint not null default 0,
  last_harvest_ts    timestamptz,
  last_seen_slot     bigint not null
);

create index if not exists lending_positions_project_idx on lending_positions(project_pda);

-- ---------------------------------------------------------------------------
-- Materialized views for dashboards.
-- ---------------------------------------------------------------------------

create or replace view user_dashboard as
select
  c.user_wallet,
  c.project_pda,
  p.recipient_wallet,
  p.metadata,
  c.principal,
  c.deposit_ts,
  c.active_score,
  c.lifetime_score,
  -- Estimated share of cumulative yield routed, attributed by current
  -- principal share. Rough — real yield share is computed off-chain by
  -- weighting capital × time across all committers. For private beta
  -- dashboard this approximation is adequate.
  case
    when p.cumulative_principal > 0 then
      (p.cumulative_yield_routed * c.principal / p.cumulative_principal)::bigint
    else 0
  end as estimated_yield_share
from commitments c
join projects p on p.pda = c.project_pda;

create or replace view project_dashboard as
select
  p.pda,
  p.recipient_wallet,
  p.metadata,
  p.cumulative_principal,
  p.cumulative_yield_routed,
  count(c.pda) as supporter_count,
  coalesce(sum(c.principal), 0) as active_principal_total,
  coalesce(sum(c.lifetime_score), 0) as cumulative_lifetime_score
from projects p
left join commitments c on c.project_pda = p.pda
group by p.pda, p.recipient_wallet, p.metadata, p.cumulative_principal, p.cumulative_yield_routed;

-- ---------------------------------------------------------------------------
-- RLS — public-read for the v1 private beta. Tighten later if needed.
-- ---------------------------------------------------------------------------

alter table projects enable row level security;
drop policy if exists "public read projects" on projects;
create policy "public read projects" on projects for select using (true);

alter table commitments enable row level security;
drop policy if exists "public read commitments" on commitments;
create policy "public read commitments" on commitments for select using (true);

alter table lending_positions enable row level security;
drop policy if exists "public read lending_positions" on lending_positions;
create policy "public read lending_positions" on lending_positions for select using (true);

alter table events enable row level security;
drop policy if exists "public read events" on events;
create policy "public read events" on events for select using (true);

-- The webhook handler uses the Supabase service-role key, which bypasses RLS.
-- Browser clients use the anon key, which respects RLS — they get reads only.

-- ---------------------------------------------------------------------------
-- Atomic increment helpers used by the webhook handler. Slot-guarded so
-- replayed events don't double-count.
-- ---------------------------------------------------------------------------

create or replace function bump_project_cumulative_principal(
  p_pda text,
  p_amount text,           -- numeric-as-text to handle u64 safely
  p_slot bigint
) returns void language plpgsql as $$
begin
  update projects
  set
    cumulative_principal = cumulative_principal + p_amount::bigint,
    last_seen_slot = p_slot
  where pda = p_pda
    and last_seen_slot < p_slot;
end
$$;

create or replace function bump_project_cumulative_yield(
  p_pda text,
  p_amount text,
  p_slot bigint
) returns void language plpgsql as $$
begin
  update projects
  set
    cumulative_yield_routed = cumulative_yield_routed + p_amount::bigint,
    last_seen_slot = p_slot
  where pda = p_pda
    and last_seen_slot < p_slot;
end
$$;
