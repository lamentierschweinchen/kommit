-- Kommit off-chain stack — migration 0004 (Founder updates + engagement, 2026-05-07).
--
-- Backs hand-off 34 § P1.4 (the retention loop). Three new tables, all read-
-- by-anon, write-only-by-service_role:
--
--   1. project_updates     — founder posts (title + body + flags). Author is
--                            the founder's recipient_wallet; verified server-
--                            side before insert.
--   2. update_reactions    — emoji reactions on a given update. Composite key
--                            is (update_id, user_wallet, emoji) so a user can
--                            apply the same emoji once per update; toggling
--                            it again is an idempotent no-op.
--   3. update_comments     — short comments on an update (1-2000 chars).
--                            P2.2 stretch from the dispatch; included here
--                            because the privilege model is identical.
--
-- Sybil defense: writes to update_reactions and update_comments are gated
-- in the API layer to "caller has a row in commitments where user_wallet=
-- caller AND project_pda=update.project_pda". RLS does NOT enforce this —
-- only service_role inserts, and the API code is the choke point. The RLS
-- policy here is a defense-in-depth REVOKE on anon/authenticated writes
-- so even if the service_role key ever leaked into a non-server context,
-- direct PostgREST writes would still fail.
--
-- Function privilege hardening from 0003 is preserved — this migration
-- creates ZERO new functions, so the lockdown surface is unchanged.
--
-- Idempotent: re-runnable. CREATE TABLE IF NOT EXISTS + DROP POLICY IF EXISTS
-- so re-applying against an already-migrated DB is a no-op except for
-- statements that touch values (none here).
--
-- Apply via Supabase SQL editor or:
--   psql "$SUPABASE_DB_URL" -f migrations/supabase/0004_founder_updates_engagement.sql

-- ---------------------------------------------------------------------------
-- 1) project_updates — founder posts
-- ---------------------------------------------------------------------------

create table if not exists project_updates (
  id              uuid        primary key default gen_random_uuid(),
  project_pda     text        not null references projects(pda) on delete cascade,
  author_wallet   text        not null,                -- founder's recipient_wallet at post time
  title           text        not null,
  body            text        not null,
  is_pivot        boolean     not null default false,
  is_graduation   boolean     not null default false,
  posted_at       timestamptz not null default now(),
  -- Soft-mod hook (placeholder; v1 wires the toggle). Kept on the parent
  -- update so a founder can hide a whole post without touching its replies.
  hidden          boolean     not null default false,
  constraint project_updates_title_len    check (length(title) between 1 and 200),
  constraint project_updates_body_len     check (length(body)  between 1 and 10000)
);

create index if not exists project_updates_project_idx
  on project_updates(project_pda, posted_at desc);

create index if not exists project_updates_author_idx
  on project_updates(author_wallet);

-- ---------------------------------------------------------------------------
-- 2) update_reactions — emoji reactions
-- ---------------------------------------------------------------------------

create table if not exists update_reactions (
  update_id       uuid        not null references project_updates(id) on delete cascade,
  user_wallet     text        not null,
  emoji           text        not null,                -- single grapheme; client + API validate length
  reacted_at      timestamptz not null default now(),
  primary key (update_id, user_wallet, emoji),
  -- Loose server-side cap on emoji length so PostgREST can't get filled with
  -- arbitrary text payloads. Real emoji shape validated in the API route.
  constraint update_reactions_emoji_len check (length(emoji) between 1 and 16)
);

create index if not exists update_reactions_update_idx
  on update_reactions(update_id);

create index if not exists update_reactions_user_idx
  on update_reactions(user_wallet);

-- ---------------------------------------------------------------------------
-- 3) update_comments — short comments (P2.2)
-- ---------------------------------------------------------------------------

create table if not exists update_comments (
  id              uuid        primary key default gen_random_uuid(),
  update_id       uuid        not null references project_updates(id) on delete cascade,
  author_wallet   text        not null,
  body            text        not null,
  posted_at       timestamptz not null default now(),
  hidden          boolean     not null default false,  -- founder soft-mod, v1 wires the toggle
  constraint update_comments_body_len check (length(body) between 1 and 2000)
);

create index if not exists update_comments_update_idx
  on update_comments(update_id, posted_at);

create index if not exists update_comments_author_idx
  on update_comments(author_wallet);

-- ---------------------------------------------------------------------------
-- 4) RLS — anon/authenticated read, service_role write only
-- ---------------------------------------------------------------------------

alter table project_updates  enable row level security;
alter table update_reactions enable row level security;
alter table update_comments  enable row level security;

-- Public read on visible posts/comments. (anon = unauthenticated PostgREST,
-- authenticated = signed-in PostgREST; both get the same read scope here
-- because v0.5 doesn't track per-user auth in the off-chain layer yet.)
drop policy if exists project_updates_anon_read  on project_updates;
drop policy if exists update_reactions_anon_read on update_reactions;
drop policy if exists update_comments_anon_read  on update_comments;

create policy project_updates_anon_read on project_updates
  for select to anon, authenticated
  using (not hidden);

create policy update_reactions_anon_read on update_reactions
  for select to anon, authenticated
  using (true);

create policy update_comments_anon_read on update_comments
  for select to anon, authenticated
  using (not hidden);

-- No insert/update/delete policy → anon and authenticated cannot write.
-- service_role bypasses RLS and is what the /api/* route handlers use via
-- the supabase-admin client. The API layer enforces the sybil/ownership
-- checks before each insert.

-- ---------------------------------------------------------------------------
-- 5) Defense-in-depth: revoke insert/update/delete table-level grants from
--    anon and authenticated. RLS already blocks them; this closes the
--    PostgREST surface even if RLS were ever flipped off in error.
-- ---------------------------------------------------------------------------

revoke insert, update, delete on project_updates  from anon, authenticated;
revoke insert, update, delete on update_reactions from anon, authenticated;
revoke insert, update, delete on update_comments  from anon, authenticated;

grant select on project_updates  to anon, authenticated;
grant select on update_reactions to anon, authenticated;
grant select on update_comments  to anon, authenticated;

grant all on project_updates  to service_role;
grant all on update_reactions to service_role;
grant all on update_comments  to service_role;

-- ---------------------------------------------------------------------------
-- 6) Comments documenting the trust model for future reviewers
-- ---------------------------------------------------------------------------

comment on table project_updates is
  'Founder-authored posts. Read by anon (visible only via not-hidden RLS); written exclusively by service_role from the /api/founder/updates route after Privy-session-verified author_wallet ownership check against projects.recipient_wallet.';

comment on table update_reactions is
  'Emoji reactions on project_updates. Composite key (update_id, user_wallet, emoji) makes the toggle idempotent. Written exclusively by service_role from /api/updates/[id]/reactions after sybil check: caller must have a commitments row for the parent project_pda.';

comment on table update_comments is
  'Short comments on project_updates (1-2000 chars). Same sybil-defense pattern as update_reactions. Hidden field is a placeholder for v1 founder-side soft moderation.';
