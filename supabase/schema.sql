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
  exam_authority text, -- e.g., 'EASA', 'DGCA', 'FAA', 'TYPE_RATING', 'AIRLINE'
  license text check (license in ('PPL', 'CPL', 'ATPL', 'IR', 'TYPE', 'RECRUITMENT', 'OTHER')),
  exam_id text, -- linked to exams table
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
  topic_tags text[] default '{}'::text[], -- Added for sub-topic tagging
  status text default 'draft' not null check (status in ('draft', 'published', 'archived')),
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

create table if not exists public.exams (
  id text primary key,
  authority text not null check (authority in ('DGCA', 'EASA', 'FAA', 'TYPE_RATING', 'AIRLINE')),
  license text not null check (license in ('PPL', 'CPL', 'ATPL', 'IR', 'TYPE', 'RECRUITMENT', 'OTHER')),
  title text not null,
  pass_mark int not null default 70,
  duration_min int not null default 60,
  neg_marking_percent numeric default 0, -- negative marking percent (e.g., 25.00 for -0.25)
  total_questions int not null default 50, -- renamed/added as total_questions
  question_count int not null default 50, -- keep for backward compatibility
  negative_marking boolean not null default false, -- keep for backward compatibility
  subject_ids jsonb not null default '[]'::jsonb,
  status text default 'draft' not null check (status in ('draft', 'published', 'archived')),
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

create table if not exists public.mock_papers (
  id text primary key,
  exam_id text not null references public.exams(id) on delete cascade,
  title text not null,
  duration_min int not null default 120,
  pass_mark int not null default 75,
  neg_marking_percent numeric default 0,
  total_questions int not null default 100,
  rules jsonb not null default '[]'::jsonb, -- Array of rules: { subject_id: string, subcategory_id?: string, weight: number }
  status text default 'draft' not null check (status in ('draft', 'published', 'archived')),
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

create table if not exists public.blog_posts (
  slug text primary key,
  title text not null,
  description text not null,
  date text not null,
  read_time text not null,
  category text not null,
  tags jsonb not null default '[]'::jsonb,
  content text not null,
  author text not null,
  author_role text not null,
  status text default 'published' not null check (status in ('draft', 'published', 'archived')),
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
  plan text default 'free' not null check (plan in ('free', 'trial', 'pro')),
  plan_started_at timestamptz,
  plan_expires_at timestamptz,
  settings jsonb default '{}'::jsonb not null,
  daily_goal int default 20 not null,
  streak_count int default 0 not null,
  last_activity_date text default ''::text not null,
  questions_answered_today int default 0 not null,
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
  created_at timestamptz default now() not null,
  -- Integrity: clients self-report these via RLS insert; clamp to sane ranges.
  constraint attempts_score_nonneg check (score >= 0),
  constraint attempts_total_nonneg check (total >= 0),
  constraint attempts_score_le_total check (score <= total),
  constraint attempts_pct_range check (percentage between 0 and 100),
  constraint attempts_duration_nonneg check (duration_sec >= 0)
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
alter table public.blog_posts enable row level security;

-- ---------------------------------------------------------------------
-- BLOG POSTS POLICIES
-- ---------------------------------------------------------------------
drop policy if exists "Read published blog posts" on public.blog_posts;
create policy "Read published blog posts"
  on public.blog_posts for select
  using (status = 'published' or public.is_admin());

drop policy if exists "Write blog posts restriction" on public.blog_posts;
create policy "Write blog posts restriction"
  on public.blog_posts for all
  using (public.is_admin())
  with check (public.is_admin());

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

-- Trigger to prevent users from modifying their billing status
create or replace function public.protect_billing_fields()
returns trigger as $$
begin
  -- Only enforce this check for non-service roles
  if auth.role() <> 'service_role' then
    NEW.plan = OLD.plan;
    NEW.plan_started_at = OLD.plan_started_at;
    NEW.plan_expires_at = OLD.plan_expires_at;
  end if;
  return NEW;
end;
$$ language plpgsql security definer;

drop trigger if exists enforce_billing_security on public.profiles;
create trigger enforce_billing_security
  before update on public.profiles
  for each row
  execute function public.protect_billing_fields();

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
-- 8. QUESTION PROGRESS & SPACED REPETITION SCHEDULING
-- =====================================================================

create table if not exists public.question_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  question_id text not null,
  topic_id text,
  correct boolean not null,
  seen_count int not null default 1,
  last_seen_at timestamptz not null default now(),
  next_review_at timestamptz not null default now(),
  ease double precision not null default 2.5,
  interval int not null default 0,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
  primary key (user_id, question_id),
  -- Integrity: self-reported via RLS insert; keep SR scheduler fields sane.
  constraint qprog_seen_nonneg check (seen_count >= 0),
  constraint qprog_interval_nonneg check (interval >= 0),
  constraint qprog_ease_pos check (ease > 0)
);

-- Enable RLS on question_progress
alter table public.question_progress enable row level security;

-- Indexes for performance at scale
create index if not exists idx_question_progress_user on public.question_progress(user_id);
create index if not exists idx_question_progress_due on public.question_progress(user_id, next_review_at);
create index if not exists idx_questions_status_subject on public.questions(status, subject_id);
create index if not exists idx_questions_status_subcategory on public.questions(status, subcategory_id);
create index if not exists idx_attempts_user_created on public.attempts(user_id, created_at);
create index if not exists idx_events_type_created on public.events(event_type, created_at);

-- RLS policies for question_progress
drop policy if exists "Users view own question progress" on public.question_progress;
create policy "Users view own question progress"
  on public.question_progress for select
  using (auth.uid() = user_id or public.is_admin());

drop policy if exists "Users insert own question progress" on public.question_progress;
create policy "Users insert own question progress"
  on public.question_progress for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users update own question progress" on public.question_progress;
create policy "Users update own question progress"
  on public.question_progress for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users delete own question progress" on public.question_progress;
create policy "Users delete own question progress"
  on public.question_progress for delete
  using (auth.uid() = user_id);

-- Daily Goal Reset Server-Side Procedure
create or replace function public.reset_daily_goals()
returns void
language plpgsql
security definer
as $$
begin
  update public.profiles
  set questions_answered_today = 0,
      settings = jsonb_set(coalesce(settings, '{}'::jsonb), '{questionsAnsweredToday}', '0'::jsonb, true)
  where questions_answered_today > 0;
end;
$$;

-- Enable cron extension and schedule the midnight reset robustly
do $$
begin
  -- Ensure pg_cron extension is loaded if possible
  perform pg_catalog.pg_extension_config_dump('pg_cron', '');
exception when others then
  -- Ignore, we'll try to use pg_cron extension if it's already there or load it
end;
$$;

create extension if not exists pg_cron;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule(
      'reset-daily-goals-midnight',
      '0 0 * * *',
      'select public.reset_daily_goals();'
    );
  end if;
exception when others then
  raise warning 'Could not schedule daily reset job via pg_cron: %', sqlerrm;
end;
$$;

-- =====================================================================
-- 9. NOTIFICATIONS & QUESTION REPORTS SCHEMAS
-- =====================================================================

-- Notifications table
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  message text not null,
  type text not null,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

-- Enable RLS on notifications
alter table public.notifications enable row level security;

-- Indexes for notifications
create index if not exists idx_notifications_user_read on public.notifications(user_id, read);

-- RLS policies for notifications
drop policy if exists "Users view own notifications" on public.notifications;
create policy "Users view own notifications"
  on public.notifications for select
  using (auth.uid() = user_id or public.is_admin());

drop policy if exists "Users update own notifications" on public.notifications;
create policy "Users update own notifications"
  on public.notifications for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "System insert notifications" on public.notifications;
create policy "System insert notifications"
  on public.notifications for insert
  with check (auth.uid() = user_id or auth.uid() is not null);


-- Question Reports table
create table if not exists public.question_reports (
  id uuid primary key default gen_random_uuid(),
  question_id text not null,
  user_id uuid references auth.users(id) on delete set null,
  category text not null,
  comment text not null,
  status text not null default 'open',
  created_at timestamptz not null default now()
);

-- Contact Messages table (public contact form sink; admin-only read)
create table if not exists public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  subject text not null default 'support',
  message text not null,
  status text not null default 'open',
  created_at timestamptz not null default now()
);

alter table public.contact_messages enable row level security;
create index if not exists idx_contact_messages_status on public.contact_messages(status, created_at);

drop policy if exists "contact_messages_insert" on public.contact_messages;
create policy "contact_messages_insert" on public.contact_messages for insert
  to anon, authenticated
  with check (
    char_length(name) between 1 and 200
    and char_length(email) between 3 and 320
    and char_length(subject) between 1 and 50
    and char_length(message) between 1 and 5000
  );

drop policy if exists "contact_messages_select" on public.contact_messages;
create policy "contact_messages_select" on public.contact_messages for select
  using ((select public.is_admin()));

drop policy if exists "contact_messages_update" on public.contact_messages;
create policy "contact_messages_update" on public.contact_messages for update
  using ((select public.is_admin())) with check ((select public.is_admin()));

drop policy if exists "contact_messages_delete" on public.contact_messages;
create policy "contact_messages_delete" on public.contact_messages for delete
  using ((select public.is_admin()));

-- Enable RLS on question_reports
alter table public.question_reports enable row level security;

-- Indexes for question_reports
create index if not exists idx_question_reports_question on public.question_reports(question_id);
create index if not exists idx_question_reports_status on public.question_reports(status);

-- RLS policies for question_reports
drop policy if exists "Anyone can submit reports" on public.question_reports;
create policy "Anyone can submit reports"
  on public.question_reports for insert
  with check (true);

drop policy if exists "Only admins view reports" on public.question_reports;
create policy "Only admins view reports"
  on public.question_reports for select
  using (public.is_admin());

drop policy if exists "Only admins manage reports" on public.question_reports;
create policy "Only admins manage reports"
  on public.question_reports for all
  using (public.is_admin());


-- =====================================================================
-- 10. GROWTH & MARKETING EXTRA SCHEMAS (Leads, Referrals)
-- =====================================================================

-- 1. Ensure columns exist on profiles table first
do $$
begin
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='profiles' and column_name='referral_code') then
    alter table public.profiles add column referral_code text unique default upper(substring(md5(random()::text) from 1 for 8));
  end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='profiles' and column_name='referred_by') then
    alter table public.profiles add column referred_by text;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='profiles' and column_name='newsletter_opt_in') then
    alter table public.profiles add column newsletter_opt_in boolean default false not null;
  end if;
end;
$$;

-- 2. Leads Table for Lead Magnets & Newsletter Signups
create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  email text not null unique check (email ~* '^[0-9a-zA-Z._%-]+@[0-9a-zA-Z._%-]+\.[a-zA-Z]{2,4}$'),
  consent boolean default false not null,
  resource text default 'newsletter' not null,
  created_at timestamptz default now() not null
);

-- RLS for leads
alter table public.leads enable row level security;

drop policy if exists "Anyone can submit lead" on public.leads;
create policy "Anyone can submit lead"
  on public.leads for insert
  with check (true);

drop policy if exists "Only admins view leads" on public.leads;
create policy "Only admins view leads"
  on public.leads for select
  using (public.is_admin());

drop policy if exists "Only admins manage leads" on public.leads;
create policy "Only admins manage leads"
  on public.leads for all
  using (public.is_admin());

-- 4. Referrals Table for Tracking Invited Signups
create table if not exists public.referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_id uuid not null references auth.users(id) on delete cascade,
  referred_id uuid not null references auth.users(id) on delete cascade unique,
  status text not null default 'pending' check (status in ('pending', 'completed', 'rewarded')),
  reward_granted boolean default false not null,
  created_at timestamptz default now() not null
);

-- RLS for referrals
alter table public.referrals enable row level security;

drop policy if exists "Users view own referrals" on public.referrals;
create policy "Users view own referrals"
  on public.referrals for select
  using (auth.uid() = referrer_id or auth.uid() = referred_id or public.is_admin());

drop policy if exists "Users insert own referrals" on public.referrals;
create policy "Users insert own referrals"
  on public.referrals for insert
  with check (auth.uid() = referred_id);

drop policy if exists "Only admins manage referrals" on public.referrals;
create policy "Only admins manage referrals"
  on public.referrals for all
  using (public.is_admin());


-- =====================================================================
-- 12. WEATHER CACHE
-- =====================================================================

create table if not exists public.weather_cache (
  icao text primary key,
  data jsonb not null,
  updated_at timestamptz default now() not null
);

-- RLS for weather cache
alter table public.weather_cache enable row level security;

drop policy if exists "Anyone can view weather cache" on public.weather_cache;
create policy "Anyone can view weather cache"
  on public.weather_cache for select
  using (true);

drop policy if exists "Only service role can update weather cache" on public.weather_cache;
create policy "Only service role can update weather cache"
  on public.weather_cache for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

-- =====================================================================
-- 13. AI CACHE
-- =====================================================================

create table if not exists public.ai_cache (
  cache_key text primary key,
  data jsonb not null,
  updated_at timestamptz default now() not null
);

-- RLS for AI cache
alter table public.ai_cache enable row level security;

drop policy if exists "Only service role can update or read AI cache" on public.ai_cache;
create policy "Only service role can update or read AI cache"
  on public.ai_cache for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

-- =====================================================================
-- 14. APP SETTINGS (Feature Flags)
-- =====================================================================

create table if not exists public.app_settings (
  id int primary key default 1 check (id = 1),
  flags jsonb not null default '{}'::jsonb,
  updated_at timestamptz default now(),
  updated_by text
);

alter table public.app_settings enable row level security;

drop policy if exists "Anyone can read app_settings" on public.app_settings;
create policy "Anyone can read app_settings"
  on public.app_settings for select
  using (true);

drop policy if exists "Only admins can update app_settings" on public.app_settings;
create policy "Only admins can update app_settings"
  on public.app_settings for all
  using (public.is_admin());

-- Seed the initial row if it doesn't exist
insert into public.app_settings (id, flags)
values (
  1, 
  '{
    "aiExplain": true,
    "aiCoach": true,
    "aiDiagnosis": true,
    "aiPractice": true,
    "weatherBriefing": true,
    "mockExams": true,
    "topicPractice": true,
    "qotd": true,
    "spacedRepetition": true,
    "flashcards": true,
    "cockpitLayouts": true,
    "analytics": true,
    "masteryCharts": true,
    "blog": true,
    "examSeoPages": true,
    "a320Systems": true,
    "adsense": true,
    "pricingCheckout": true,
    "freeTrial": true,
    "proGating": true,
    "maintenanceMode": false,
    "cookieConsent": true,
    "announcementBanner": true,
    "announcementText": "Welcome to our platform!",
    "signupsOpen": true,
    "themeToggle": true
  }'::jsonb
)
on conflict (id) do nothing;

-- =====================================================================
-- END OF SCHEMA FILE
-- Run this file FIRST, then run seed-admin.sql.
-- =====================================================================

-- =====================================================================
-- 11. ACTIVE SESSIONS (Single Device Login)
-- =====================================================================

create table if not exists public.active_sessions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  session_id text not null,
  device_info text,
  last_seen timestamptz default now() not null
);

create index if not exists idx_active_sessions_user_id on public.active_sessions(user_id);

-- RLS for active_sessions
alter table public.active_sessions enable row level security;

drop policy if exists "Users can view own active session" on public.active_sessions;
create policy "Users can view own active session"
  on public.active_sessions for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert/update own active session" on public.active_sessions;
create policy "Users can insert/update own active session"
  on public.active_sessions for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- =====================================================================
-- 15. SCHEMA RECONCILIATION (drift catch-up)
-- Idempotent block that brings an existing database up to the live
-- shape. `create table if not exists` above never alters pre-existing
-- tables, so these explicit ALTERs/policies are required for parity.
-- =====================================================================

-- 15.1 profiles: trial / onboarding lifecycle columns ----------------
alter table public.profiles
  add column if not exists next_exam text,
  add column if not exists trial_started_at timestamptz,
  add column if not exists trial_ends_at timestamptz,
  add column if not exists trial_used boolean not null default false,
  add column if not exists onboarding_completed boolean default false,
  add column if not exists plan_status text default 'none'
    check (plan_status in ('active', 'expired', 'none'));

-- 15.2 subjects: license + exam_id (used throughout content.ts) ------
alter table public.subjects
  add column if not exists license text,
  add column if not exists exam_id text;

do $$
begin
  if not exists (
    select 1 from information_schema.constraint_column_usage
    where table_schema = 'public' and table_name = 'subjects'
      and constraint_name = 'subjects_license_check'
  ) then
    alter table public.subjects
      add constraint subjects_license_check
      check (license is null or license in ('PPL','CPL','ATPL','IR','TYPE','RECRUITMENT','OTHER'));
  end if;
end $$;

-- 15.3 questions: topic_tags (QuestionsManager) ----------------------
alter table public.questions
  add column if not exists topic_tags text[] not null default '{}'::text[];

-- 15.4 exams & mock_papers: RLS + read/write policies ----------------
alter table public.exams enable row level security;
alter table public.mock_papers enable row level security;

drop policy if exists "Read published exams" on public.exams;
create policy "Read published exams"
  on public.exams for select
  using (status = 'published' or public.is_admin());

drop policy if exists "Write exams restriction" on public.exams;
create policy "Write exams restriction"
  on public.exams for all
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "Read published mock_papers" on public.mock_papers;
create policy "Read published mock_papers"
  on public.mock_papers for select
  using (status = 'published' or public.is_admin());

drop policy if exists "Write mock_papers restriction" on public.mock_papers;
create policy "Write mock_papers restriction"
  on public.mock_papers for all
  using (public.is_admin())
  with check (public.is_admin());

-- 15.5 user_question_attempts (per-question answer log) --------------
create table if not exists public.user_question_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  question_id text not null,
  subcategory_id text not null,
  subject_id text not null,
  exam_id text,
  is_correct boolean not null,
  answered_at timestamptz default now()
);

alter table public.user_question_attempts enable row level security;
create index if not exists idx_uqa_user on public.user_question_attempts(user_id);

drop policy if exists "Users can only read their own attempts" on public.user_question_attempts;
create policy "Users can only read their own attempts"
  on public.user_question_attempts for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert their own attempts" on public.user_question_attempts;
create policy "Users can insert their own attempts"
  on public.user_question_attempts for insert
  with check (auth.uid() = user_id);

-- 15.6 plan_changes (admin billing audit log) -----------------------
create table if not exists public.plan_changes (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users(id) on delete set null,
  changed_by_email text,
  old_plan text,
  new_plan text,
  expires_at timestamptz,
  note text,
  created_at timestamptz default now() not null
);

alter table public.plan_changes enable row level security;

drop policy if exists "Admins read plan_changes" on public.plan_changes;
create policy "Admins read plan_changes"
  on public.plan_changes for select
  using (public.is_admin());

drop policy if exists "Admins manage plan_changes" on public.plan_changes;
create policy "Admins manage plan_changes"
  on public.plan_changes for all
  using (public.is_admin())
  with check (public.is_admin());

-- 15.7 Harden SECURITY DEFINER functions ----------------------------
-- Pin search_path and revoke client-side EXECUTE (these run only via
-- triggers, RLS and pg_cron — never via PostgREST RPC).
alter function public.reset_daily_goals() set search_path = public;
alter function public.protect_primary_admin() set search_path = public;
alter function public.protect_billing_fields() set search_path = public;

-- NOTE: is_admin() is intentionally NOT revoked: it is called inside RLS
-- policies and must remain EXECUTE-able by anon/authenticated, otherwise
-- every policy referencing it fails. The advisor flag for is_admin is a
-- by-design false positive.
revoke execute on function public.handle_new_user() from anon, authenticated, public;
revoke execute on function public.protect_billing_fields() from anon, authenticated, public;
revoke execute on function public.protect_primary_admin() from anon, authenticated, public;
revoke execute on function public.reset_daily_goals() from anon, authenticated, public;

-- 15.8 Covering indexes for foreign keys ----------------------------
create index if not exists idx_mock_papers_exam on public.mock_papers(exam_id);
create index if not exists idx_plan_changes_user on public.plan_changes(user_id);
create index if not exists idx_question_reports_user on public.question_reports(user_id);
create index if not exists idx_referrals_referrer on public.referrals(referrer_id);

-- =====================================================================
-- 16. RLS PERFORMANCE CANONICALIZATION
-- Supersedes the policies defined in sections 7-15. Two goals:
--  (1) wrap auth.uid()/auth.role()/is_admin() in scalar subqueries so
--      Postgres evaluates them once per statement (initplan), not per row.
--  (2) replace broad `for all` policies with explicit per-command
--      policies so no two permissive policies overlap for the same
--      role+command. Access semantics are unchanged.
-- =====================================================================

-- ---------- CONTENT TABLES: public read published, admin write -------
drop policy if exists "Write subjects restriction" on public.subjects;
drop policy if exists "Read published subjects" on public.subjects;
drop policy if exists "public read published subjects" on public.subjects;
create policy "subjects_select" on public.subjects for select
  using (status = 'published' or (select public.is_admin()));
create policy "subjects_insert" on public.subjects for insert
  with check ((select public.is_admin()));
create policy "subjects_update" on public.subjects for update
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "subjects_delete" on public.subjects for delete
  using ((select public.is_admin()));

drop policy if exists "Write subcategories restriction" on public.subcategories;
drop policy if exists "Read published subcategories" on public.subcategories;
drop policy if exists "public read published subcategories" on public.subcategories;
create policy "subcategories_select" on public.subcategories for select
  using (status = 'published' or (select public.is_admin()));
create policy "subcategories_insert" on public.subcategories for insert
  with check ((select public.is_admin()));
create policy "subcategories_update" on public.subcategories for update
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "subcategories_delete" on public.subcategories for delete
  using ((select public.is_admin()));

drop policy if exists "Write questions restriction" on public.questions;
drop policy if exists "Read published questions" on public.questions;
drop policy if exists "public read published questions" on public.questions;
create policy "questions_select" on public.questions for select
  using (status = 'published' or (select public.is_admin()));
create policy "questions_insert" on public.questions for insert
  with check ((select public.is_admin()));
create policy "questions_update" on public.questions for update
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "questions_delete" on public.questions for delete
  using ((select public.is_admin()));

drop policy if exists "Write exams restriction" on public.exams;
drop policy if exists "Read published exams" on public.exams;
create policy "exams_select" on public.exams for select
  using (status = 'published' or (select public.is_admin()));
create policy "exams_insert" on public.exams for insert
  with check ((select public.is_admin()));
create policy "exams_update" on public.exams for update
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "exams_delete" on public.exams for delete
  using ((select public.is_admin()));

drop policy if exists "Write mock_papers restriction" on public.mock_papers;
drop policy if exists "Read published mock_papers" on public.mock_papers;
create policy "mock_papers_select" on public.mock_papers for select
  using (status = 'published' or (select public.is_admin()));
create policy "mock_papers_insert" on public.mock_papers for insert
  with check ((select public.is_admin()));
create policy "mock_papers_update" on public.mock_papers for update
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "mock_papers_delete" on public.mock_papers for delete
  using ((select public.is_admin()));

drop policy if exists "Write blog posts restriction" on public.blog_posts;
drop policy if exists "Read published blog posts" on public.blog_posts;
create policy "blog_posts_select" on public.blog_posts for select
  using (status = 'published' or (select public.is_admin()));
create policy "blog_posts_insert" on public.blog_posts for insert
  with check ((select public.is_admin()));
create policy "blog_posts_update" on public.blog_posts for update
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "blog_posts_delete" on public.blog_posts for delete
  using ((select public.is_admin()));

-- ---------- USER-OWNED TABLES ---------------------------------------
drop policy if exists "Users read own profile" on public.profiles;
drop policy if exists "Users insert own profile" on public.profiles;
drop policy if exists "Users update own profile" on public.profiles;
create policy "profiles_select" on public.profiles for select
  using ((select auth.uid()) = id or (select public.is_admin()));
create policy "profiles_insert" on public.profiles for insert
  with check ((select auth.uid()) = id);
create policy "profiles_update" on public.profiles for update
  using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

drop policy if exists "Users select own attempts" on public.attempts;
drop policy if exists "Users create own attempts" on public.attempts;
drop policy if exists "Users update/delete own attempts" on public.attempts;
create policy "attempts_select" on public.attempts for select
  using ((select auth.uid()) = user_id or (select public.is_admin()));
create policy "attempts_insert" on public.attempts for insert
  with check ((select auth.uid()) = user_id);
create policy "attempts_update" on public.attempts for update
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "attempts_delete" on public.attempts for delete
  using ((select auth.uid()) = user_id);

drop policy if exists "Users select own bookmarks" on public.bookmarks;
drop policy if exists "Users write own bookmarks" on public.bookmarks;
create policy "bookmarks_select" on public.bookmarks for select
  using ((select auth.uid()) = user_id or (select public.is_admin()));
create policy "bookmarks_insert" on public.bookmarks for insert
  with check ((select auth.uid()) = user_id);
create policy "bookmarks_delete" on public.bookmarks for delete
  using ((select auth.uid()) = user_id);

drop policy if exists "Users view own question progress" on public.question_progress;
drop policy if exists "Users insert own question progress" on public.question_progress;
drop policy if exists "Users update own question progress" on public.question_progress;
drop policy if exists "Users delete own question progress" on public.question_progress;
create policy "question_progress_select" on public.question_progress for select
  using ((select auth.uid()) = user_id or (select public.is_admin()));
create policy "question_progress_insert" on public.question_progress for insert
  with check ((select auth.uid()) = user_id);
create policy "question_progress_update" on public.question_progress for update
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "question_progress_delete" on public.question_progress for delete
  using ((select auth.uid()) = user_id);

drop policy if exists "Users view own notifications" on public.notifications;
drop policy if exists "Users update own notifications" on public.notifications;
drop policy if exists "System insert notifications" on public.notifications;
create policy "notifications_select" on public.notifications for select
  using ((select auth.uid()) = user_id or (select public.is_admin()));
create policy "notifications_insert" on public.notifications for insert
  with check ((select auth.uid()) = user_id or (select public.is_admin()));
create policy "notifications_update" on public.notifications for update
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists "Permit event insert logic" on public.events;
drop policy if exists "Admins read metrics events" on public.events;
create policy "events_insert" on public.events for insert
  with check (
    ((select auth.uid()) is not null and (select auth.uid()) = user_id)
    or ((select auth.uid()) is null and user_id is null)
  );
create policy "events_select" on public.events for select
  using ((select public.is_admin()));

drop policy if exists "Users can view own active session" on public.active_sessions;
drop policy if exists "Users can insert/update own active session" on public.active_sessions;
create policy "active_sessions_select" on public.active_sessions for select
  using ((select auth.uid()) = user_id);
create policy "active_sessions_insert" on public.active_sessions for insert
  with check ((select auth.uid()) = user_id);
create policy "active_sessions_update" on public.active_sessions for update
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "active_sessions_delete" on public.active_sessions for delete
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can only read their own attempts" on public.user_question_attempts;
drop policy if exists "Users can insert their own attempts" on public.user_question_attempts;
create policy "uqa_select" on public.user_question_attempts for select
  using ((select auth.uid()) = user_id);
create policy "uqa_insert" on public.user_question_attempts for insert
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users view own referrals" on public.referrals;
drop policy if exists "Users insert own referrals" on public.referrals;
drop policy if exists "Only admins manage referrals" on public.referrals;
create policy "referrals_select" on public.referrals for select
  using ((select auth.uid()) = referrer_id or (select auth.uid()) = referred_id or (select public.is_admin()));
create policy "referrals_insert" on public.referrals for insert
  with check ((select auth.uid()) = referred_id);
create policy "referrals_update" on public.referrals for update
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "referrals_delete" on public.referrals for delete
  using ((select public.is_admin()));

-- ---------- ADMIN / PUBLIC-SUBMIT TABLES ----------------------------
drop policy if exists "Admins view and self-manage admins roster" on public.admins;
create policy "admins_all" on public.admins for all
  using ((select public.is_admin())) with check ((select public.is_admin()));

drop policy if exists "Anyone can read app_settings" on public.app_settings;
drop policy if exists "Only admins can update app_settings" on public.app_settings;
create policy "app_settings_select" on public.app_settings for select
  using (true);
create policy "app_settings_insert" on public.app_settings for insert
  with check ((select public.is_admin()));
create policy "app_settings_update" on public.app_settings for update
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "app_settings_delete" on public.app_settings for delete
  using ((select public.is_admin()));

drop policy if exists "Anyone can submit lead" on public.leads;
drop policy if exists "Only admins view leads" on public.leads;
drop policy if exists "Only admins manage leads" on public.leads;
create policy "leads_insert" on public.leads for insert
  to anon, authenticated
  with check (
    char_length(email) between 3 and 320
    and char_length(coalesce(resource, '')) <= 100
  );
create policy "leads_select" on public.leads for select
  using ((select public.is_admin()));
create policy "leads_update" on public.leads for update
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "leads_delete" on public.leads for delete
  using ((select public.is_admin()));

drop policy if exists "Anyone can submit reports" on public.question_reports;
drop policy if exists "Only admins view reports" on public.question_reports;
drop policy if exists "Only admins manage reports" on public.question_reports;
create policy "question_reports_insert" on public.question_reports for insert
  to anon, authenticated
  with check (
    char_length(question_id) between 1 and 200
    and char_length(category) between 1 and 100
    and char_length(comment) between 1 and 2000
  );
create policy "question_reports_select" on public.question_reports for select
  using ((select public.is_admin()));
create policy "question_reports_update" on public.question_reports for update
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "question_reports_delete" on public.question_reports for delete
  using ((select public.is_admin()));

drop policy if exists "Admins read plan_changes" on public.plan_changes;
drop policy if exists "Admins manage plan_changes" on public.plan_changes;
create policy "plan_changes_select" on public.plan_changes for select
  using ((select public.is_admin()));
create policy "plan_changes_insert" on public.plan_changes for insert
  with check ((select public.is_admin()));
create policy "plan_changes_update" on public.plan_changes for update
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "plan_changes_delete" on public.plan_changes for delete
  using ((select public.is_admin()));

-- ---------- SERVICE-ROLE CACHE TABLES -------------------------------
drop policy if exists "Anyone can view weather cache" on public.weather_cache;
drop policy if exists "Only service role can update weather cache" on public.weather_cache;
create policy "weather_cache_select" on public.weather_cache for select
  using (true);
create policy "weather_cache_insert" on public.weather_cache for insert
  with check ((select auth.role()) = 'service_role');
create policy "weather_cache_update" on public.weather_cache for update
  using ((select auth.role()) = 'service_role') with check ((select auth.role()) = 'service_role');
create policy "weather_cache_delete" on public.weather_cache for delete
  using ((select auth.role()) = 'service_role');

drop policy if exists "Only service role can update or read AI cache" on public.ai_cache;
create policy "ai_cache_all" on public.ai_cache for all
  using ((select auth.role()) = 'service_role') with check ((select auth.role()) = 'service_role');

-- =====================================================================
-- 17. ADMIN BILLING MANAGEMENT
-- Admins can change any user's subscription from the admin panel.
-- =====================================================================

-- Admins may update any profile (plan overrides). profiles_update only
-- covers a user's own row.
drop policy if exists "profiles_admin_update" on public.profiles;
create policy "profiles_admin_update" on public.profiles for update
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- Billing-protection trigger must exempt admins (and service_role) so the
-- admin panel can change plan/expiry. Regular users stay blocked.
create or replace function public.protect_billing_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() <> 'service_role' and not public.is_admin() then
    NEW.plan = OLD.plan;
    NEW.plan_started_at = OLD.plan_started_at;
    NEW.plan_expires_at = OLD.plan_expires_at;
    -- Trial lifecycle: only the service role (start-trial / payment flows)
    -- may mutate these. Without pinning, a user could reset trial_used to
    -- false and re-grant themselves unlimited trials, or flip plan_status.
    NEW.plan_status = OLD.plan_status;
    NEW.trial_used = OLD.trial_used;
    NEW.trial_started_at = OLD.trial_started_at;
    NEW.trial_ends_at = OLD.trial_ends_at;
  end if;
  return NEW;
end;
$$;
