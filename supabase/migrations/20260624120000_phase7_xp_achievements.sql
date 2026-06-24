-- Phase 7.1 — XP ledger + persistent achievements
-- Two append-only/idempotent tables. No table rewrites.
-- Applied to prod DB iwamrscqmedyklafiqvu via Supabase MCP on 2026-06-24.

-- ── xp_events: append-only XP ledger (balance = SUM(amount)) ──────────────────
create table if not exists xp_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in (
    'question_answered','quiz_completed','mission_completed','streak_bonus','achievement_unlock'
  )),
  amount int not null check (amount > 0),
  source_id text,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_xp_events_user on xp_events (user_id);
create index if not exists idx_xp_events_user_created on xp_events (user_id, created_at);

-- Idempotency: one award per (user, type, source). Lets awardXp swallow 23505.
create unique index if not exists uniq_xp_event_source
  on xp_events (user_id, type, source_id)
  where source_id is not null;

alter table xp_events enable row level security;

-- SELECT: own rows or admin
create policy xp_events_select on xp_events
  for select using (auth.uid() = user_id or public.is_admin());

-- INSERT: own rows only, positive amount, valid type. No UPDATE/DELETE policies
-- → ledger is append-only (mutations denied by default under RLS).
create policy xp_events_insert on xp_events
  for insert with check (
    auth.uid() = user_id
    and amount > 0
    and type in ('question_answered','quiz_completed','mission_completed','streak_bonus','achievement_unlock')
  );

-- ── achievement_unlocks: durable unlock state (idempotent via PK) ─────────────
create table if not exists achievement_unlocks (
  user_id uuid not null references auth.users(id) on delete cascade,
  achievement_id text not null,
  unlocked_at timestamptz not null default now(),
  primary key (user_id, achievement_id)
);

create index if not exists idx_achievement_unlocks_user on achievement_unlocks (user_id);

alter table achievement_unlocks enable row level security;

create policy achievement_unlocks_select on achievement_unlocks
  for select using (auth.uid() = user_id or public.is_admin());

create policy achievement_unlocks_insert on achievement_unlocks
  for insert with check (auth.uid() = user_id);
