-- =====================================================================
-- PHASE M1 — AI STUDY SCHEDULER FOUNDATION
-- study_plans (AI-authored structured plan JSON) + study_missions
-- (calendar rows = "what to launch"). Progress is DERIVED from the
-- existing attempts / question_progress tables — this migration adds
-- NO duplicate progress-tracking state.
--
-- Additive only. No existing table/column/policy is altered. Safe to
-- roll back by dropping the two tables + two functions (see bottom).
-- Feature ships dark: app_settings flag `aiStudyScheduler` = false.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. study_plans
-- ---------------------------------------------------------------------
create table if not exists public.study_plans (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  exam_id       text references public.exams(id) on delete set null,
  target_date   date,
  status        text not null default 'draft'
                  check (status in ('draft', 'active', 'archived', 'completed')),
  source        text not null default 'ai'
                  check (source in ('ai', 'manual', 'fallback')),
  model         text,
  plan          jsonb not null
                  check (jsonb_typeof(plan) = 'object'),
  generated_at  timestamptz not null default now(),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  -- Bound the AI payload size (defense vs. an oversized insert).
  constraint study_plans_size check (pg_column_size(plan) <= 131072)  -- 128 KB
);

-- Indexes
create index if not exists idx_study_plans_user        on public.study_plans(user_id);
create index if not exists idx_study_plans_user_status on public.study_plans(user_id, status);
create index if not exists idx_study_plans_exam        on public.study_plans(exam_id);
-- One ACTIVE plan per user, enforced as a DB invariant (partial unique).
-- Service-role MUST archive the prior active plan in the same transaction
-- as inserting a new active plan, or the insert fails here.
create unique index if not exists uniq_study_plans_active_per_user
  on public.study_plans(user_id) where status = 'active';

-- ---------------------------------------------------------------------
-- 2. study_missions
-- ---------------------------------------------------------------------
create table if not exists public.study_missions (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null references auth.users(id) on delete cascade,
  plan_id              uuid references public.study_plans(id) on delete set null,
  scheduled_date       date not null,
  type                 text not null
                         check (type in ('drill', 'review', 'viva', 'flashcard', 'mini_test', 'mock', 'read')),
  payload              jsonb not null
                         check (jsonb_typeof(payload) = 'object'),
  estimated_min        int not null default 0 check (estimated_min between 0 and 240),
  position             int not null default 0,
  status               text not null default 'pending'
                         check (status in ('pending', 'in_progress', 'completed', 'skipped')),
  source               text not null default 'plan'
                         check (source in ('plan', 'manual', 'system')),
  completed_attempt_id uuid references public.attempts(id) on delete set null,
  created_at           timestamptz not null default now(),
  completed_at         timestamptz,
  -- A completed mission must carry its completion timestamp.
  constraint missions_completed_ts
    check (status <> 'completed' or completed_at is not null)
);

-- Indexes
create index if not exists idx_missions_user_date_status
  on public.study_missions(user_id, scheduled_date, status);          -- TodayView hot path
create index if not exists idx_missions_user_status
  on public.study_missions(user_id, status);                          -- %complete counts
create index if not exists idx_missions_plan
  on public.study_missions(plan_id);                                  -- FK covering + re-materialize
create index if not exists idx_missions_attempt
  on public.study_missions(completed_attempt_id);                     -- FK covering

-- ---------------------------------------------------------------------
-- 3. ROW LEVEL SECURITY
-- Canonical pattern: scalar-subquery auth.uid()/is_admin(), per-command
-- policies. study_plans is AI-authored => NO client insert policy (the
-- service role bypasses RLS to write). study_missions is user-actionable.
-- ---------------------------------------------------------------------
alter table public.study_plans   enable row level security;
alter table public.study_missions enable row level security;

drop policy if exists "study_plans_select" on public.study_plans;
create policy "study_plans_select" on public.study_plans for select
  using ((select auth.uid()) = user_id or (select public.is_admin()));
-- (no insert policy: clients cannot author plans; service role bypasses RLS)
drop policy if exists "study_plans_update" on public.study_plans;
create policy "study_plans_update" on public.study_plans for update
  using ((select public.is_admin())) with check ((select public.is_admin()));
drop policy if exists "study_plans_delete" on public.study_plans;
create policy "study_plans_delete" on public.study_plans for delete
  using ((select auth.uid()) = user_id or (select public.is_admin()));

drop policy if exists "study_missions_select" on public.study_missions;
create policy "study_missions_select" on public.study_missions for select
  using ((select auth.uid()) = user_id or (select public.is_admin()));
drop policy if exists "study_missions_insert" on public.study_missions;
create policy "study_missions_insert" on public.study_missions for insert
  with check ((select auth.uid()) = user_id);
drop policy if exists "study_missions_update" on public.study_missions;
create policy "study_missions_update" on public.study_missions for update
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists "study_missions_delete" on public.study_missions;
create policy "study_missions_delete" on public.study_missions for delete
  using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------
-- 4. TRIGGERS
-- ---------------------------------------------------------------------

-- 4a. updated_at touch on study_plans
create or replace function public.touch_study_plan_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_study_plans_touch on public.study_plans;
create trigger trg_study_plans_touch
  before update on public.study_plans
  for each row execute function public.touch_study_plan_updated_at();

-- 4b. study_missions integrity (the security-critical trigger).
--  * pins identity fields immutable on UPDATE (no re-homing rows),
--  * verifies plan_id (if set) belongs to the same user,
--  * verifies completed_attempt_id (if set) is the user's OWN attempt
--    (anti-forgery of proof-of-work),
--  * maintains completed_at automatically.
create or replace function public.enforce_mission_integrity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if TG_OP = 'UPDATE' then
    new.user_id    := old.user_id;
    new.plan_id    := old.plan_id;     -- plan link frozen post-insert
    new.source     := old.source;
    new.created_at := old.created_at;
  end if;

  if new.plan_id is not null and not exists (
       select 1 from public.study_plans p
        where p.id = new.plan_id and p.user_id = new.user_id) then
    raise exception 'study_missions.plan_id % does not belong to user %', new.plan_id, new.user_id;
  end if;

  if new.completed_attempt_id is not null and not exists (
       select 1 from public.attempts a
        where a.id = new.completed_attempt_id and a.user_id = new.user_id) then
    raise exception 'study_missions.completed_attempt_id % not owned by user %', new.completed_attempt_id, new.user_id;
  end if;

  if new.status = 'completed' and new.completed_at is null then
    new.completed_at := now();
  elsif new.status <> 'completed' then
    new.completed_at := null;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_missions_integrity on public.study_missions;
create trigger trg_missions_integrity
  before insert or update on public.study_missions
  for each row execute function public.enforce_mission_integrity();

-- Harden SECURITY DEFINER functions: pin search_path and revoke client-side
-- EXECUTE (they run only via triggers, never via PostgREST RPC). Mirrors the
-- existing protect_billing_fields / handle_new_user posture.
alter function public.touch_study_plan_updated_at() set search_path = public;
alter function public.enforce_mission_integrity()   set search_path = public;
revoke execute on function public.touch_study_plan_updated_at() from anon, authenticated, public;
revoke execute on function public.enforce_mission_integrity()   from anon, authenticated, public;

-- ---------------------------------------------------------------------
-- 5. FEATURE FLAG — ship dark.
-- isFeatureEnabled() fails OPEN (treats a missing key as true), so the
-- flag MUST be present and false for the feature to be OFF by default.
-- Only set when absent: never clobber an explicit operator toggle.
-- ---------------------------------------------------------------------
update public.app_settings
set flags = jsonb_set(coalesce(flags, '{}'::jsonb), '{aiStudyScheduler}', 'false'::jsonb, true)
where id = 1 and not (coalesce(flags, '{}'::jsonb) ? 'aiStudyScheduler');

-- =====================================================================
-- ROLLBACK (run manually to fully revert Phase M1):
--   drop trigger if exists trg_missions_integrity on public.study_missions;
--   drop trigger if exists trg_study_plans_touch on public.study_plans;
--   drop table   if exists public.study_missions;   -- child first (FK -> study_plans)
--   drop table   if exists public.study_plans;
--   drop function if exists public.enforce_mission_integrity();
--   drop function if exists public.touch_study_plan_updated_at();
-- The app_settings flag may be left in place (false) or removed.
-- =====================================================================
