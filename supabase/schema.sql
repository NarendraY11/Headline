-- =====================================================================
-- HEADING — AVIATION EXAM PREPARATION DATABASE SCHEMA
-- Target Environment: Supabase / PostgreSQL (15+)
-- Row Level Security (RLS) is fully active and customized.
-- =====================================================================

-- Clean up existing triggers and specific functions on reload
drop trigger if exists on_auth_user_created on auth.users cascade;
drop function if exists public.handle_new_user() cascade;
drop function if exists public.is_admin() cascade;
drop function if exists public.protect_primary_admin() cascade;

-- Enable uuid-ossp extension for uuid generation routines
create extension if not exists "uuid-ossp";

-- =====================================================================
-- 1. ADMIN TABLE & STABLE HELPER FUNCTION
-- =====================================================================

create table if not exists public.admins (
  email text primary key check (email ~* '^[0-9a-zA-Z._%-]+@[0-9a-zA-Z._%-]+\.[a-zA-Z]{2,4}$'),
  added_at timestamptz default now() not null
);

-- RLS helper function
create or replace function public.is_admin() 
returns boolean
language sql security definer stable
set search_path = public
as $$
  select exists(
    select 1 
    from public.admins 
    where email = auth.jwt()->>'email'
  );
$$;

-- Protect the owner / primary administrator account from deletion
create or replace function public.protect_primary_admin()
returns trigger
language plpgsql
security definer
as $$
begin
  if old.email = 'narendray112050@gmail.com' then
    raise exception 'The primary owner account (%) cannot be removed from the administrative roster.', old.email;
  end if;
  return old;
end;
$$;

-- Apply protective trigger to admins table
drop trigger if exists before_admin_deleted on public.admins;
create trigger before_admin_deleted
  before delete on public.admins
  for each row execute procedure public.protect_primary_admin();


-- =====================================================================
-- 2. CONTENT TABLES (Subjects, Subcategories, Questions)
-- =====================================================================

create table if not exists public.subjects (
  id text primary key,
  title text not null,
  description text,
  exam_authority text, -- e.g., 'EASA', 'DGCA'
  sort_order int default 0 not null,
  status text default 'draft' not null check (status in ('draft', 'published', 'archived')),
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

create table if not exists public.subcategories (
  id text primary key,
  subject_id text not null references public.subjects(id) on delete cascade ,
  code text,                  -- e.g., 'ATA-21', '021.01'
  title text not null,
  description text,
  sort_order int default 0 not null,
  status text default 'draft' not null check (status in ('draft', 'published', 'archived')),
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- Note: Corrected the column name from 'references' to 'refs' to avoid illegal Postgres reserved keyword usage
create table if not exists public.questions (
  id text primary key,
  subcategory_id text references public.subcategories(id) on delete cascade,
  subject_id text references public.subjects(id) on delete cascade,
  ata text,                   -- ATA classification, flight instrument identifier etc.
  difficulty text not null check (difficulty in ('standard', 'complex', 'extreme')),
  prompt text not null,
  diagram_caption text,       -- Schema graphics or panel references
  choices jsonb not null,     -- Alternatives data: [{"id": "a", "label": "Text example"}]
  correct text not null check (correct in ('a', 'b', 'c', 'd')),
  explanation text not null,
  refs jsonb default '[]'::jsonb not null, -- Replaced 'references' with idempotent 'refs' column
  status text default 'draft' not null check (status in ('draft', 'published', 'archived')),
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);


-- =====================================================================
-- 3. USER DATA TABLES (Profiles, Attempts, Bookmarks)
-- =====================================================================

create table if not exists public.profiles (
  id uuid primary key references auth.users on delete cascade,
  email text,
  display_name text,
  target_exam text default 'General Study',
  next_exam text,
  plan text default 'free' not null check (plan in ('free', 'pro')),
  plan_started_at timestamptz default now() not null,
  settings jsonb default '{}'::jsonb not null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

create table if not exists public.attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade,
  topic_id text,                                       -- maps to front-end submodule id
  subject_id text,                                     -- category header log
  mode text,                                           -- 'practice', 'timed', 'editorial'
  score int not null,
  total int not null,
  percentage int not null,
  duration_sec int not null,
  wrong_question_ids jsonb default '[]'::jsonb not null,
  data jsonb default '{}'::jsonb not null,             -- detailed timestamps or logs
  created_at timestamptz default now() not null
);

create table if not exists public.bookmarks (
  user_id uuid not null references auth.users on delete cascade,
  question_id text not null,
  created_at timestamptz default now() not null,
  primary key (user_id, question_id)
);


-- =====================================================================
-- 4. ANALYTICS TABLE
-- =====================================================================

create table if not exists public.events (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users on delete set null, -- Nullable to allow anonymous telemetry
  event_type text not null,                              -- e.g. 'page_view', 'coach_consulted'
  subject_id text,
  subcategory_id text,
  question_id text,
  metadata jsonb default '{}'::jsonb not null,
  created_at timestamptz default now() not null
);


-- =====================================================================
-- 5. AUTOMATIC TRIGGER FOR PROFILES (Synced to Auth Signups)
-- =====================================================================

create or replace function public.handle_new_user()
returns trigger
security definer 
set search_path = public
as $$
begin
  insert into public.profiles (
    id, 
    email, 
    display_name, 
    target_exam, 
    plan, 
    plan_started_at, 
    settings, 
    created_at, 
    updated_at
  )
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'display_name', new.raw_user_meta_data->>'full_name', ''),
    coalesce(new.raw_user_meta_data->>'target_exam', 'General Study'),
    'free',
    now(),
    '{}'::jsonb,
    now(),
    now()
  )
  on conflict (id) do nothing;
  return new;
exception
  when others then
    return new; -- Always let user signs complete even if user profile trigger fails to record telemetry
end;
$$ language plpgsql;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();


-- =====================================================================
-- 6. INDEXES FOR QUERY OPTIMIZATION AND SCALE
-- =====================================================================

create index if not exists idx_questions_subject on public.questions(subject_id);
create index if not exists idx_questions_subcategory on public.questions(subcategory_id);
create index if not exists idx_subcategories_subject on public.subcategories(subject_id);
create index if not exists idx_attempts_user on public.attempts(user_id);
create index if not exists idx_bookmarks_user on public.bookmarks(user_id);
create index if not exists idx_events_user on public.events(user_id);


-- =====================================================================
-- 7. ROW LEVEL SECURITY (RLS) & IDEMPOTENT POLICIES
-- =====================================================================

-- Enable RLS globally on all tables
alter table public.admins enable row level security;
alter table public.subjects enable row level security;
alter table public.subcategories enable row level security;
alter table public.questions enable row level security;
alter table public.profiles enable row level security;
alter table public.attempts enable row level security;
alter table public.bookmarks enable row level security;
alter table public.events enable row level security;

-- ---------------------------------------------------------------------
-- SUBJECTS POLICIES
-- ---------------------------------------------------------------------
drop policy if exists "Read published subjects" on public.subjects;
create policy "Read published subjects"
  on public.subjects for select
  using (status = 'published' or public.is_admin());

drop policy if exists "Write subjects restriction" on public.subjects;
create policy "Write subjects restriction"
  on public.subjects for all
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------
-- SUBCATEGORIES POLICIES
-- ---------------------------------------------------------------------
drop policy if exists "Read published subcategories" on public.subcategories;
create policy "Read published subcategories"
  on public.subcategories for select
  using (status = 'published' or public.is_admin());

drop policy if exists "Write subcategories restriction" on public.subcategories;
create policy "Write subcategories restriction"
  on public.subcategories for all
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------
-- QUESTIONS POLICIES
-- ---------------------------------------------------------------------
drop policy if exists "Read published questions" on public.questions;
create policy "Read published questions"
  on public.questions for select
  using (status = 'published' or public.is_admin());

drop policy if exists "Write questions restriction" on public.questions;
create policy "Write questions restriction"
  on public.questions for all
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------
-- PROFILES POLICIES
-- ---------------------------------------------------------------------
drop policy if exists "Users read own profile" on public.profiles;
create policy "Users read own profile"
  on public.profiles for select
  using (auth.uid() = id or public.is_admin());

drop policy if exists "Users insert own profile" on public.profiles;
create policy "Users insert own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

drop policy if exists "Users update own profile" on public.profiles;
create policy "Users update own profile"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- ---------------------------------------------------------------------
-- ATTEMPTS POLICIES
-- ---------------------------------------------------------------------
drop policy if exists "Users select own attempts" on public.attempts;
create policy "Users select own attempts"
  on public.attempts for select
  using (auth.uid() = user_id or public.is_admin());

drop policy if exists "Users create own attempts" on public.attempts;
create policy "Users create own attempts"
  on public.attempts for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users update/delete own attempts" on public.attempts;
create policy "Users update/delete own attempts"
  on public.attempts for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------
-- BOOKMARKS POLICIES
-- ---------------------------------------------------------------------
drop policy if exists "Users select own bookmarks" on public.bookmarks;
create policy "Users select own bookmarks"
  on public.bookmarks for select
  using (auth.uid() = user_id or public.is_admin());

drop policy if exists "Users write own bookmarks" on public.bookmarks;
create policy "Users write own bookmarks"
  on public.bookmarks for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------
-- EVENTS / TELEMETRY POLICIES
-- ---------------------------------------------------------------------
drop policy if exists "Permit event insert logic" on public.events;
create policy "Permit event insert logic"
  on public.events for insert
  with check (
    (auth.uid() is not null and auth.uid() = user_id) or
    (auth.uid() is null and user_id is null)
  );

drop policy if exists "Admins read metrics events" on public.events;
create policy "Admins read metrics events"
  on public.events for select
  using (public.is_admin());

-- ---------------------------------------------------------------------
-- ADMINS POLICIES
-- ---------------------------------------------------------------------
drop policy if exists "Admins view and self-manage admins roster" on public.admins;
create policy "Admins view and self-manage admins roster"
  on public.admins for all
  using (public.is_admin())
  with check (public.is_admin());

-- =====================================================================
-- END OF SCHEMA FILE
-- Run this file FIRST, then run seed-admin.sql.
-- =====================================================================
