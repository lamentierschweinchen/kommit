-- Kommit off-chain stack — migration 0002 (QA C3 + C4 fixes, 2026-05-05).
--
-- Replaces the (tx_hash, event_name) idempotency key with per-event identity
-- (tx_hash, instruction_index, event_index). The old key dropped legitimate
-- events when a single transaction emitted the same Anchor event twice or
-- when two transactions in one slot updated the same project (slot guard
-- blocked the second).
--
-- Also adds `process_event(...)` — a single-transaction SQL function that
-- ATOMICALLY records the event AND applies its materialized-state effect,
-- so a failed materialize rolls back the events row. The webhook handler
-- calls process_event per parsed event; on any failure it returns HTTP 500
-- and Helius retries.
--
-- Apply via Supabase SQL editor or:
--   psql "$SUPABASE_DB_URL" -f migrations/supabase/0002_event_identity.sql

-- ---------------------------------------------------------------------------
-- 1) Drop the old (tx_hash, event_name) unique constraint and add per-event
--    identity columns. Existing rows are backfilled with 0/0 — those rows
--    were inserted under the old broken scheme; they are now retained but
--    deduplication going forward uses the new key.
-- ---------------------------------------------------------------------------

alter table events drop constraint if exists events_tx_hash_event_name_key;

alter table events
  add column if not exists instruction_index smallint not null default 0,
  add column if not exists event_index       smallint not null default 0;

-- Track which (slot, event_index) was the last applied write per materialized
-- row, so out-of-order replays can be ordered correctly.
alter table projects          add column if not exists last_event_index smallint not null default 0;
alter table commitments       add column if not exists last_event_index smallint not null default 0;
alter table lending_positions add column if not exists last_event_index smallint not null default 0;

alter table events drop constraint if exists events_unique_per_position;
alter table events
  add constraint events_unique_per_position
  unique (tx_hash, instruction_index, event_index);

-- ---------------------------------------------------------------------------
-- 2) Materialize helpers — small SQL fns called by process_event. Each is
--    individually slot+event-index ordered so out-of-order delivery doesn't
--    overwrite a newer write. The (slot, event_index) tuple is unique per
--    materialized-row mutation; ordering guarantees monotonic application.
-- ---------------------------------------------------------------------------

create or replace function _mat_upsert_project(
  p_pda text,
  p_recipient text,
  p_metadata_uri_hash bytea,
  p_block_time timestamptz,
  p_slot bigint,
  p_event_index smallint
) returns void language plpgsql as $$
begin
  insert into projects (
    pda, recipient_wallet, metadata_uri_hash, cumulative_principal,
    cumulative_yield_routed, created_at, last_seen_slot, last_event_index
  )
  values (
    p_pda, p_recipient, coalesce(p_metadata_uri_hash, '\x'::bytea), 0, 0,
    p_block_time, p_slot, p_event_index
  )
  on conflict (pda) do update set
    -- ProjectCreated is once-per-project; on conflict we no-op except to
    -- update metadata_uri_hash if the new value is non-zero AND ordering wins.
    metadata_uri_hash = case
      when (p_slot, p_event_index) > (projects.last_seen_slot, projects.last_event_index)
        and length(p_metadata_uri_hash) = 32
      then p_metadata_uri_hash
      else projects.metadata_uri_hash
    end,
    last_seen_slot   = greatest(projects.last_seen_slot, p_slot),
    last_event_index = case
      when p_slot > projects.last_seen_slot then p_event_index
      when p_slot = projects.last_seen_slot then greatest(projects.last_event_index, p_event_index)
      else projects.last_event_index
    end;
end
$$;

create or replace function _mat_apply_commit(
  p_user text,
  p_project text,
  p_amount text,
  p_block_time timestamptz,
  p_slot bigint,
  p_event_index smallint,
  p_commitment_pda text
) returns void language plpgsql as $$
begin
  -- additive: principal increment is order-insensitive across distinct events.
  insert into commitments (
    pda, user_wallet, project_pda, principal, deposit_ts,
    last_accrual_ts, last_seen_slot, last_event_index
  )
  values (
    p_commitment_pda, p_user, p_project, p_amount::bigint,
    p_block_time, p_block_time, p_slot, p_event_index
  )
  on conflict (pda) do update set
    principal       = commitments.principal + p_amount::bigint,
    deposit_ts      = least(commitments.deposit_ts, p_block_time),
    last_accrual_ts = greatest(commitments.last_accrual_ts, p_block_time),
    last_seen_slot   = greatest(commitments.last_seen_slot, p_slot),
    last_event_index = case
      when p_slot > commitments.last_seen_slot then p_event_index
      when p_slot = commitments.last_seen_slot then greatest(commitments.last_event_index, p_event_index)
      else commitments.last_event_index
    end;

  update projects
  set
    cumulative_principal = cumulative_principal + p_amount::bigint,
    last_seen_slot   = greatest(last_seen_slot, p_slot),
    last_event_index = case
      when p_slot > last_seen_slot then p_event_index
      when p_slot = last_seen_slot then greatest(last_event_index, p_event_index)
      else last_event_index
    end
  where pda = p_project;
end
$$;

create or replace function _mat_apply_withdraw(
  p_user text,
  p_project text,
  p_amount text,
  p_slot bigint,
  p_event_index smallint,
  p_commitment_pda text
) returns void language plpgsql as $$
begin
  update commitments
  set
    principal      = greatest(0, commitments.principal - p_amount::bigint),
    last_seen_slot   = greatest(last_seen_slot, p_slot),
    last_event_index = case
      when p_slot > last_seen_slot then p_event_index
      when p_slot = last_seen_slot then greatest(last_event_index, p_event_index)
      else last_event_index
    end,
    active_score = case when commitments.principal - p_amount::bigint <= 0 then 0 else active_score end
  where pda = p_commitment_pda;
end
$$;

create or replace function _mat_apply_points_accrued(
  p_user text,
  p_project text,
  p_lifetime_total text,
  p_block_time timestamptz,
  p_slot bigint,
  p_event_index smallint,
  p_commitment_pda text
) returns void language plpgsql as $$
begin
  update commitments
  set
    lifetime_score = greatest(commitments.lifetime_score, p_lifetime_total::numeric(40,0)),
    last_accrual_ts = greatest(last_accrual_ts, p_block_time),
    last_seen_slot   = greatest(last_seen_slot, p_slot),
    last_event_index = case
      when p_slot > last_seen_slot then p_event_index
      when p_slot = last_seen_slot then greatest(last_event_index, p_event_index)
      else last_event_index
    end
  where pda = p_commitment_pda;
end
$$;

create or replace function _mat_apply_supply_executed(
  p_project text,
  p_amount text,
  p_block_time timestamptz,
  p_slot bigint,
  p_event_index smallint,
  p_lending_pda text,
  p_adapter_id smallint
) returns void language plpgsql as $$
begin
  insert into lending_positions (
    pda, project_pda, adapter_id, vault_handle, supplied,
    last_seen_slot, last_event_index
  )
  values (
    p_lending_pda, p_project, p_adapter_id, '', p_amount::bigint, p_slot, p_event_index
  )
  on conflict (pda) do update set
    supplied         = lending_positions.supplied + p_amount::bigint,
    last_seen_slot   = greatest(lending_positions.last_seen_slot, p_slot),
    last_event_index = case
      when p_slot > lending_positions.last_seen_slot then p_event_index
      when p_slot = lending_positions.last_seen_slot then greatest(lending_positions.last_event_index, p_event_index)
      else lending_positions.last_event_index
    end;
end
$$;

create or replace function _mat_apply_yield_harvested(
  p_project text,
  p_amount text,
  p_block_time timestamptz,
  p_slot bigint,
  p_event_index smallint,
  p_lending_pda text
) returns void language plpgsql as $$
begin
  update projects
  set
    cumulative_yield_routed = cumulative_yield_routed + p_amount::bigint,
    last_seen_slot   = greatest(last_seen_slot, p_slot),
    last_event_index = case
      when p_slot > last_seen_slot then p_event_index
      when p_slot = last_seen_slot then greatest(last_event_index, p_event_index)
      else last_event_index
    end
  where pda = p_project;

  update lending_positions
  set
    last_harvest_ts  = p_block_time,
    last_seen_slot   = greatest(last_seen_slot, p_slot),
    last_event_index = case
      when p_slot > last_seen_slot then p_event_index
      when p_slot = last_seen_slot then greatest(last_event_index, p_event_index)
      else last_event_index
    end
  where pda = p_lending_pda;
end
$$;

create or replace function _mat_apply_metadata_updated(
  p_project text,
  p_new_hash bytea,
  p_slot bigint,
  p_event_index smallint
) returns void language plpgsql as $$
begin
  update projects
  set
    metadata_uri_hash = p_new_hash,
    metadata          = null,            -- forces lazy re-fetch from IPFS
    last_seen_slot    = greatest(last_seen_slot, p_slot),
    last_event_index  = case
      when p_slot > last_seen_slot then p_event_index
      when p_slot = last_seen_slot then greatest(last_event_index, p_event_index)
      else last_event_index
    end
  where pda = p_project
    and (p_slot, p_event_index) > (last_seen_slot, last_event_index);
end
$$;

-- ---------------------------------------------------------------------------
-- 3) process_event — single-transaction insert + materialize. Webhook calls
--    this per parsed event. Failure rolls back the whole pair (event row +
--    materialized write) so Helius retry triggers another full attempt.
-- ---------------------------------------------------------------------------

create or replace function process_event(
  p_tx_hash text,
  p_instruction_index smallint,
  p_event_index smallint,
  p_event_name text,
  p_payload jsonb,
  p_slot bigint,
  p_block_time timestamptz,
  p_commitment_pda text default null,    -- precomputed by handler (PDA derive)
  p_lending_pda text default null,       -- precomputed by handler (PDA derive)
  p_adapter_id smallint default 0
) returns boolean language plpgsql as $$
declare
  inserted_id bigint;
begin
  -- 1. Try to record the event. unique violation = duplicate; return false
  --    (caller logs but does NOT 500 — duplicates are normal Helius retries).
  insert into events (tx_hash, slot, block_time, event_name, payload,
                      instruction_index, event_index)
  values (p_tx_hash, p_slot, p_block_time, p_event_name, p_payload,
          p_instruction_index, p_event_index)
  on conflict (tx_hash, instruction_index, event_index) do nothing
  returning id into inserted_id;

  if inserted_id is null then
    return false;
  end if;

  -- 2. Materialize. Any exception inside this branch will roll back the
  --    events row too because plpgsql functions run in a single tx by default.
  if p_event_name = 'ProjectCreated' then
    perform _mat_upsert_project(
      (p_payload->>'project'),
      (p_payload->>'recipientWallet'),
      decode(coalesce(p_payload->>'metadataUriHashHex', ''), 'hex'),
      p_block_time, p_slot, p_event_index
    );
  elsif p_event_name = 'Committed' then
    perform _mat_apply_commit(
      (p_payload->>'user'),
      (p_payload->>'project'),
      (p_payload->>'amount'),
      p_block_time, p_slot, p_event_index, p_commitment_pda
    );
  elsif p_event_name = 'Withdrawn' then
    perform _mat_apply_withdraw(
      (p_payload->>'user'),
      (p_payload->>'project'),
      (p_payload->>'amount'),
      p_slot, p_event_index, p_commitment_pda
    );
  elsif p_event_name = 'PointsAccrued' then
    perform _mat_apply_points_accrued(
      (p_payload->>'user'),
      (p_payload->>'project'),
      (p_payload->>'lifetimeTotal'),
      p_block_time, p_slot, p_event_index, p_commitment_pda
    );
  elsif p_event_name = 'SupplyExecuted' then
    perform _mat_apply_supply_executed(
      (p_payload->>'project'),
      (p_payload->>'amount'),
      p_block_time, p_slot, p_event_index, p_lending_pda, p_adapter_id
    );
  elsif p_event_name = 'YieldHarvested' then
    perform _mat_apply_yield_harvested(
      (p_payload->>'project'),
      (p_payload->>'amount'),
      p_block_time, p_slot, p_event_index, p_lending_pda
    );
  elsif p_event_name = 'ProjectMetadataUpdated' then
    perform _mat_apply_metadata_updated(
      (p_payload->>'project'),
      decode(p_payload->>'newHashHex', 'hex'),
      p_slot, p_event_index
    );
  else
    -- Unknown event names are recorded but not materialized. Future events
    -- pre-deployed to handler can land here without breaking ingestion.
    null;
  end if;

  return true;
end
$$;

-- ---------------------------------------------------------------------------
-- 4) Drop the slot-guarded RPCs from 0001 — they're superseded by the
--    materialized helpers above which are invoked through process_event. The
--    handler used to call these from TS; with C4 in place it calls process_event.
-- ---------------------------------------------------------------------------

drop function if exists bump_project_cumulative_principal(text, text, bigint);
drop function if exists bump_project_cumulative_yield(text, text, bigint);
