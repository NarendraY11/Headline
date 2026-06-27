# Heading380 — Architecture Audit & Future-State Design

**Author:** Lead Software Architect (audit)
**Date:** 2026-06-27
**Status:** PROPOSAL — for review. No code changed. Nothing implemented.

> Scope: a complete read of the live system (DB, RLS, API, React, every learning
> subsystem) measured against how the world's aviation training providers
> organise their curricula, then a target architecture, ERD, recommended schema,
> the workflows, scalability analysis, and a migration strategy.

---

## Table of contents

1. Current architecture
2. Current weaknesses
3. Future architecture
4. Entity relationship diagram
5. Recommended database
6. Admin workflow
7. Student workflow
8. Content workflow
9. Question workflow
10. Mission workflow
11. Roadmap workflow
12. Mastery workflow
13. Exam workflow
14. Scalability analysis
15. Migration strategy

Appendix A — External research (DGCA / type rating / providers / interview prep)
Appendix B — Mapping research → schema

---

## 1. Current architecture

### 1.1 Stack & shape

- **Frontend:** React 19 SPA (Vite). Entry `src/main.tsx` → `mountApp.tsx` → `App.tsx`. Views in `src/views/`, components in `src/components/` (`Atoms.tsx` is the atom layer, `ui/` the molecule layer). State via three contexts: `AuthContext`, `NotificationContext`, `LoadingContext`. Domain logic lives in `src/lib/*` and `src/hooks/*`. SEO via prerender (waits for `#root` children).
- **Backend:** **Dual API.** Local/dev `server.ts` (Express) AND production Vercel serverless functions in `api/`. Vercel Hobby caps at 12 functions, so endpoints are multiplexed through `api/system.ts` via `?fn=` (health, auth-event, study-materialize, study-metrics, study-mastery-check, study-adaptive-regen, push-subscribe, inngest, qstash-receiver). Standalone functions: `api/payment/*`, `api/admin/*`, `api/instructor/[action].ts`, `api/session/check.ts`, `api/weather.ts`, `api/start-trial.ts`, `api/sitemap.xml.ts`, `api/robots.txt.ts`. **Every route must be added to BOTH server.ts and api/ or it 404s in prod.**
- **Data plane:** Supabase (Postgres 15+). Client talks to Postgres directly through PostgREST under RLS for most reads/writes; privileged operations (payments, broadcast, trial grants, plan changes, study materialise/regen, push) go through `api/` using the **service-role** client which bypasses RLS.
- **Async:** Inngest + QStash (Upstash) for background jobs; `pg_cron` for daily-goal reset, security-alert sweep, and reminder scheduling.
- **Analytics:** PostHog (EU project), Microsoft Clarity, plus an internal append-only `events` table.

### 1.2 Content / taxonomy model (the heart of the product)

The relational taxonomy already exists in `supabase/schema.sql`:

```
subjects ──< subcategories ──< questions
   │                              ▲
   │ (subject_id / subcategory_id)│
exams (subject_ids jsonb[]) ──< mock_papers
```

- **`subjects`** (text PK slug): `title`, `exam_authority` (`EASA|DGCA|FAA|TYPE_RATING|AIRLINE`), `license` (`PPL|CPL|ATPL|IR|TYPE|RECRUITMENT|OTHER`), `exam_id`, `sort_order`, `status` (`draft|published|archived`). schema.sql:63
- **`subcategories`** (text PK): `subject_id` FK, `code` (e.g. `ATA-21`, `021.01`), `title`, `status`. schema.sql:76 — **the `code` column already anticipates ATA chapters and EASA learning-objective numbering.**
- **`questions`** (text PK): `subcategory_id` + `subject_id` FK, `ata`, `difficulty` (`standard|complex|extreme`), `prompt`, `choices` jsonb, `correct` (`a|b|c|d`), `explanation`, `refs` jsonb, `topic_tags` text[], `status`. schema.sql:89
- **`exams`** (text PK): `authority`, `license`, `pass_mark`, `duration_min`, `neg_marking_percent`, `total_questions`, **`subject_ids` jsonb array**, `status`. schema.sql:107
- **`mock_papers`** (text PK): `exam_id` FK, `rules` jsonb (weighted blueprint `{subject_id, subcategory_id?, weight}`), `status`. schema.sql:124

**Critical nuance — content is bifurcated between DB and static TypeScript.**
`src/lib/content.ts` is the loader. It *merges* DB rows with static fallbacks:
- `src/data/staticQuestions.ts` — ~140 hardcoded questions.
- `src/data/topics.ts` — hardcoded `mockExams` list (515 lines) and topic structure.
- `content.ts:581` `staticExams` — hardcoded exam catalogue.
- `fetchMergedSubjects`, `fetchPublishedQuestions`, `fetchQuizQuestionsForTopic` all fall back to static when DB is empty/offline.

So at runtime "the question bank" = (published DB questions) ∪ (static seed). A prior content audit recorded **78 DB questions / 0 mock papers**; static adds ~140. **Total live content is on the order of a few hundred questions** — see §2.

### 1.3 Career path / track model

Tracks are **static config** in `src/data/trainingPaths.ts`, not DB rows:
- `TRAINING_PATHS`: `dgca` (goals CPL/ATPL/RTR/PPL), `type_rating` (ATR72/A320/A330/B737/B777), `faa` + `easa` (coming_soon).
- `CAREER_OBJECTIVES`: `airline-recruitment` (layered on top — unlocks interview/aptitude/HR), with `flight-instructor`/`charter`/`corporate` stubbed as future.
- A pathway+goal resolves to a **string token** stored in `profiles.target_exam`, e.g. `"dgca-cpl"`, `"type-a320"`. `getPrimaryTrackFamily()` recovers the family by **string-prefix parsing** (`startsWith("dgca-")`).

**There is no first-class Course / Enrollment entity.** A user has exactly one `target_exam` token; the relationship between a user and what they're studying is a string, not a row.

### 1.4 User & learning-state tables

| Table | Purpose | Source of truth? |
|---|---|---|
| `profiles` | identity, `target_exam`, `next_exam`, plan/trial billing (server-only via trigger), `daily_goal`, `streak_count`, `questions_answered_today`, onboarding/referral | **SoT** for identity + streak |
| `attempts` | one row per quiz **session** (score/total/percentage/duration, wrong_question_ids) | session log |
| `user_question_attempts` (UQA) | one row per **answered question** (is_correct, subject/subcategory/exam) | per-question log |
| `question_progress` | spaced-repetition scheduler per (user, question): `ease`, `interval`, `next_review_at`, SM-2 `quality`/`review_count` | **SoT** for review scheduling |
| `bookmarks` | saved questions | — |
| `mastery_snapshots` | per (user, subject) cached mastery 0–100 + 7-day window + baseline; **derived from UQA** | cache (not SoT) |
| `study_plans` | AI-authored structured JSON plan (one active per user), regen metadata | SoT for plan |
| `study_missions` | calendar rows (drill/review/viva/flashcard/mini_test/mock/read), `status`, `score`, `completed_attempt_id` | SoT for schedule |
| `xp_events` | append-only XP ledger (balance = SUM(amount)), idempotent per (user,type,source) | **SoT** for XP |
| `achievement_unlocks` | durable unlock state (PK user+achievement) | SoT |
| `notifications`, `push_subscriptions`, `push_delivery_log`, `reminder_candidates`, `notification_prefs` | comms / reminders | — |
| `payments`, `plan_changes`, `coupons` | billing ledger (service-role write only) | SoT |
| `events` | analytics telemetry (append-only) | — |
| `active_sessions` | single-device session slot | SoT |
| `weather_cache`, `ai_cache` | service-role caches | — |
| `admins`, `app_settings`, `leads`, `referrals`, `contact_messages`, `question_reports`, `blog_posts` | platform | — |

**Progress is deliberately derived, not duplicated** (a stated design principle): mastery and exam-readiness are computed from `user_question_attempts`; mission completion references real `attempts`.

### 1.5 The learning engine (how a question flows)

```
content (subjects→subcategories→questions, DB ∪ static)
      │
      ├─ ModulesView / TopicView  → QuizView ──► attempts + user_question_attempts + question_progress
      │
      ├─ Study Scheduler (M1, flag aiStudyScheduler OFF)
      │     AI writes study_plans.plan (JSON) → materialize → study_missions (calendar)
      │     mission → launchMission() maps type → route (drill→quiz, review→SR, mock→mock paper)
      │
      ├─ Mission Engine (Phase 6, flag missionEngine OFF)
      │     deterministic loop, reuses study_missions source='system',
      │     one active system mission at a time (unique index)
      │
      ├─ Spaced Repetition (spacedRepetition ON; sm2Algorithm OFF)
      │     question_progress drives next_review_at; Review missions pull due cards
      │
      ├─ Mastery (masterySnapshots OFF) : UQA → mastery_snapshots (cache)
      │
      ├─ Exam Readiness (examReadinessDashboard OFF) : masteredSubjectPct → readiness gauge/ETA
      │
      └─ XP + Achievements (xpSystem OFF) : answer/quiz/mission → xp_events ledger; streak on profiles
```

### 1.6 Feature flags

One JSONB row: `app_settings.flags` (~50 keys), read by `useFeatureFlags.tsx`, with parallel registries for admin UI (`featureRegistry.ts`), dashboard sections (`config/dashboardConfig.ts`), and missions (`config/missionConfig.ts`). Almost the entire advanced learning engine ships **dark** (OFF): `aiStudyScheduler`, `masterySnapshots`, `examReadinessDashboard`, `sm2Algorithm`, `adaptiveRegen`, `masteryAnalytics`, `missionScores`, `predictiveIntelligence`, `advancedTesting`, `missionEngine`, `xpSystem`, `pushNotifications`, `calendarSync`. Core (quiz, mock, topic practice, spaced rep, AI coach/explain, blog, analytics) is ON.

### 1.7 RLS posture (strong)

- `is_admin()` is `security definer stable`, reads `admins.email = auth.jwt()->>'email'`. **Must keep EXECUTE for anon/authenticated** — RLS policies call it.
- Pattern: content = `status='published' OR is_admin()`; user-owned = `auth.uid() = user_id OR is_admin()`; service-role caches = `auth.role()='service_role'`.
- Per-command policies with `(select auth.uid())` / `(select is_admin())` subqueries (initplan, evaluated once per statement).
- Billing columns protected by `protect_billing_fields()` trigger (only service-role / admin may mutate plan/trial).
- Ledgers (`xp_events`, `payments`) are append-only (no UPDATE/DELETE policy).
- Prior IDOR audit (2026-06-03) found own-only RLS clean.

---

## 2. Current weaknesses

Ranked by impact on the stated goal (scale Heading into a multi-course aviation academy).

### W1 — Content is the binding constraint, and it lives in two places (CRITICAL)
The platform's engineering is far ahead of its content. ~78 DB questions + ~140 static ≈ a few hundred questions, **0 published mock papers**, against a DGCA CPL/ATPL syllabus that needs *thousands* of questions across 5–9 subjects, plus five type ratings, plus interview prep. Worse, content is split between **DB tables** and **static TS files** (`staticQuestions.ts`, `topics.ts`, `staticExams`), so there is no single source of truth, no authoring funnel that fills the bank, and `seedTaxonomy()` exists but the static layer keeps masking the emptiness. **Nothing else in this document matters until the bank is filled, and it cannot be filled efficiently while the model is half-static.**

### W2 — No first-class Course / Enrollment (CRITICAL for multi-track)
A user's track is a **string token** (`profiles.target_exam = "dgca-cpl"`) parsed by `startsWith()`. Consequences:
- A student can study **one** thing at a time. Real pilots do CPL *then* a type rating *then* interview prep — concurrently and over years. The model can't express "enrolled in DGCA-CPL and A320 type rating."
- No enrollment state (started/active/completed/expired), no per-course progress, no per-course target date that survives a track switch.
- Career objectives are bolted on as a second token concept rather than as another enrollable course.
- Provider/airline cohorts (B2B) are impossible — there is no course to assign.

### W3 — No Course/Syllabus grouping above `subjects`
`subjects` carries `license` + `exam_authority` but there is no row that says "DGCA CPL is a program made of these subjects in this order." `exams.subject_ids` is a **JSONB array**, not a join table, so you cannot index it, FK it, or ask "which programs include Meteorology?" The hierarchy stops at Subject→Subcategory→Question; the level the whole product is organised around (the *course*) is implicit.

### W4 — Type ratings are config stubs, not content structures
`type_rating` goals exist and `subcategories.code` can hold ATA chapters, but no ATA-chapter syllabus is materialised, and `A320SystemsView.tsx` is a **hardcoded one-off** rather than data-driven type-rating content. Adding A330/B737/B777 today means new bespoke views, not new rows.

### W5 — Three overlapping attempt stores
`attempts` (session), `user_question_attempts` (per-question), and `question_progress` (scheduler) all record "user answered question." Mastery reads UQA; missions read `attempts`; SR reads `question_progress`. Divergence risk (a quiz that writes one but not another silently skews mastery or readiness). The derivation chain is correct in principle but fragile because the inputs aren't unified.

### W6 — Feature-flag & config sprawl
~50 flags in one JSONB row, mirrored across four registries (`useFeatureFlags`, `featureRegistry`, `dashboardConfig`, `missionConfig`). Memory already records repeated Vercel build breaks from a flag added to one registry but not another. Most of the learning engine is dark, so the *built* capability and the *shipped* capability have drifted far apart.

### W7 — Dual-API + 12-function ceiling
Every endpoint must be hand-mirrored in `server.ts` and `api/`, and new prod endpoints must fold into `api/system.ts?fn=` because Vercel Hobby allows 12 functions. This is a real scaling ceiling and an ongoing drift hazard.

### W8 — No multi-tenancy / instructor / ATO model
Admin is a single global owner roster (`admins`). The best providers (Padpilot, CAE, L3) sell to **ATOs** and run **cohorts** with instructors who see *their* students. Heading has no provider/cohort/instructor entities, so B2B (flight schools, airline cadet programs) is not expressible.

### W9 — Mock-exam content is static and thin
`mock_papers` + `rules` blueprint schema exists but is unused; the actual mock list is `topics.ts` static. DGCA/type-rating exams are the product's payoff event and they currently can't be assembled from the bank by blueprint.

### W10 — No content versioning / review workflow
Questions have `status` only. No version history, no author, no review/approval trail, no per-question quality signal beyond `question_reports`. At thousands of questions with multiple authors this becomes unmanageable.

---

## 3. Future architecture

**Thesis:** keep the strong spine (Supabase + RLS + derived progress + dark-launch discipline) and add the **two missing backbone concepts — Course and Enrollment — plus a unified content tree and a single answer log.** Everything the engine already does (missions, mastery, readiness, XP, SR) then hangs off a real curriculum instead of string tokens and static files.

### 3.1 Target domain model (concepts)

```
Provider (optional, B2B)                ← ATO / airline / "Heading" (default)
   └── Course  (a program: DGCA-CPL, DGCA-ATPL, TYPE-A320, AIRLINE-RECRUITMENT)
         ├── CourseSubject (ordered)     ← join: course ↔ subject (+ weight, required?)
         │     └── Subject
         │           └── Module (= subcategory, ATA/LO-coded)
         │                 └── Topic (optional finer grain via topic_tags → real rows)
         │                       └── Question
         ├── Exam (blueprint)            ← official paper spec for this course
         │     └── MockPaper (assembled by weighted rules from the bank)
         └── Enrollment  (user ↔ course, MANY, with state + target date)
               └── derives → Missions, Mastery, Readiness, XP, Streak
```

- **Course** becomes the unit users enrol in, admins build, and (later) providers license. DGCA-CPL, DGCA-ATPL, DGCA-PPL, RTR, TYPE-ATR72/A320/A330/B737/B777, AIRLINE-RECRUITMENT are all just Course rows — same machinery, different content.
- **Enrollment** replaces the `target_exam` string. A user can hold several (CPL + A320 + interview prep) each with its own status and target date. `profiles.target_exam` is kept as a denormalised "active enrollment" pointer for backward compatibility during migration.
- **Career objectives** (airline recruitment) are simply Courses with `kind = 'recruitment'` (no licensure exam, readiness measured against interview competencies instead of a pass mark).
- **Type ratings** are Courses whose Subjects are **ATA chapters** (`subcategories.code = 'ATA-24'` etc.), with a 100-Q/75% systems exam blueprint and a performance exam — exactly matching how TRTOs run them (Appendix A).

### 3.2 What stays exactly as-is
RLS model and `is_admin()`; derived-progress principle; `question_progress` SM-2 scheduler; `study_plans`/`study_missions`; `xp_events`/`achievement_unlocks` ledgers; billing trigger; service-role cache tables; dark-launch flag discipline. **This is an additive evolution, not a rewrite.**

### 3.3 What changes
1. Add `courses`, `course_subjects`, `enrollments` (new backbone).
2. Promote `exams.subject_ids` JSONB → `exam_subjects` join table; link `exams.course_id`.
3. Collapse the static content (`staticQuestions.ts`, `topics.ts`, `staticExams`) into the DB as a **one-time seed**, then make `content.ts` DB-first with static used only as offline cache, never as a parallel catalogue.
4. Make Type Rating + Interview Prep **data-driven** (rows, not bespoke views); keep `A320SystemsView` only as a rich presentation layer over `subcategories` where it adds value.
5. Unify the answer path: one write of truth (`user_question_attempts`) on every answer; `attempts` becomes a pure session-summary view/rollup; `question_progress` continues as the scheduler. Add a DB function so a quiz submission writes all three atomically.
6. Add lightweight content governance: `created_by`, `reviewed_by`, `version` on `questions`.
7. (Phase 2, B2B) Add `providers`, `cohorts`, `cohort_members`, instructor role.

---

## 4. Entity relationship diagram

Existing tables in plain text; **proposed** marked `[NEW]`.

```
                         ┌─────────────┐
                         │  providers  │ [NEW, B2B phase]
                         │  id, name   │
                         └──────┬──────┘
                                │ 1
                                │ N
┌──────────────┐         ┌──────▼───────┐         ┌────────────────┐
│   profiles   │   N   N │   courses    │ 1     N │ course_subjects│ [NEW]
│ id (auth.uid)│◄───────►│   [NEW]      │◄───────►│  course_id FK  │
│ target_exam* │         │ id, kind,    │         │  subject_id FK │
│ streak_count │         │ authority,   │         │  position,wt   │
│ daily_goal   │         │ license,     │         └───────┬────────┘
└──────┬───────┘         │ status       │                 │ N
       │                 └──────┬───────┘                 │ 1
       │ 1                      │ 1                  ┌─────▼──────┐
       │ N                      │ N                 │  subjects  │
┌──────▼─────────┐      ┌───────▼────────┐          │ id, title, │
│  enrollments   │[NEW] │     exams      │ 1      N │ authority, │
│ user_id FK     │      │ id, course_id* │◄────┐    │ license,   │
│ course_id FK   │      │ pass_mark,     │     │    │ status     │
│ status,target  │      │ total_questions│     │    └─────┬──────┘
│ started_at     │      └───────┬────────┘     │          │ 1
└────────────────┘              │ 1            │          │ N
                                │ N            │    ┌─────▼────────┐
                         ┌──────▼──────┐  ┌────▼────┴───┐│subcategories│
                         │ mock_papers │  │exam_subjects││ id, code    │
                         │ rules jsonb │  │ [NEW] join  ││ (ATA/LO),   │
                         └─────────────┘  └─────────────┘│ subject_id  │
                                                         └─────┬───────┘
                                                               │ 1
                                                               │ N
                                                         ┌─────▼──────┐
                                                         │ questions  │
                                                         │ id,prompt, │
                                                         │ choices,   │
                                                         │ correct,   │
                                                         │ status,    │
                                                         │ created_by*│
                                                         └─────┬──────┘
                                                               │
        ┌──────────────────────────────────────┬──────────────┼───────────────┐
        │ N                                     │ N            │ N             │ N
┌───────▼────────────┐  ┌────────────────┐ ┌────▼──────────┐ ┌▼────────────┐ ┌▼──────────┐
│user_question_attempts│ │question_progress│ │  bookmarks   │ │question_   │ │  (answer  │
│ user,question,correct│ │ user,question, │ │ user,question │ │ reports    │ │  events)  │
│ (UNIFIED answer log) │ │ ease,interval, │ └──────────────┘ └─────────────┘ └───────────┘
└──────────┬───────────┘ │ next_review_at │
           │ aggregates  └────────────────┘
           ▼
┌────────────────────┐   ┌──────────────┐   ┌────────────┐   ┌──────────────────┐
│  mastery_snapshots │──►│ exam readiness│   │  attempts  │   │   study_plans    │
│ (cache, per subj)  │   │ (derived calc)│   │ (session   │ 1 │ plan jsonb,active│
└────────────────────┘   └──────────────┘   │  rollup)   │   └────────┬─────────┘
                                             └─────┬──────┘            │ N
┌──────────────┐   ┌──────────────────┐            │ ref        ┌──────▼─────────┐
│  xp_events   │   │achievement_unlocks│           └───────────►│ study_missions │
│ (ledger)     │   │ (durable)        │                         │ type,status,   │
└──────────────┘   └──────────────────┘                         │ score,         │
                                                                 │ completed_attempt│
[cohorts / cohort_members  — NEW, B2B phase, link providers↔enrollments]
* = denormalised/back-compat pointer
```

---

## 5. Recommended database

Additive. New tables; existing tables get nullable FK back-pointers so nothing breaks.

### 5.1 New backbone tables

```sql
-- A program a user enrols in. DGCA-CPL, TYPE-A320, AIRLINE-RECRUITMENT …
create table public.courses (
  id            text primary key,                 -- 'dgca-cpl', 'type-a320'
  title         text not null,
  kind          text not null check (kind in
                  ('license','type_rating','recruitment','rating','other')),
  authority     text check (authority in ('DGCA','EASA','FAA','TYPE_RATING','AIRLINE')),
  license       text check (license in ('PPL','CPL','ATPL','IR','TYPE','RECRUITMENT','OTHER')),
  provider_id   uuid references public.providers(id) on delete set null,  -- null = Heading default
  summary       text,
  sort_order    int  not null default 0,
  status        text not null default 'draft' check (status in ('draft','published','archived')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Ordered membership of subjects in a course (replaces exams.subject_ids parsing).
create table public.course_subjects (
  course_id   text not null references public.courses(id)  on delete cascade,
  subject_id  text not null references public.subjects(id) on delete cascade,
  position    int  not null default 0,
  weight      numeric not null default 1,   -- blueprint weighting for mocks/readiness
  required    boolean not null default true,
  primary key (course_id, subject_id)
);
create index idx_course_subjects_subject on public.course_subjects(subject_id);

-- User ↔ Course, MANY. Replaces the profiles.target_exam string as the real edge.
create table public.enrollments (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  course_id   text not null references public.courses(id) on delete cascade,
  status      text not null default 'active'
                check (status in ('active','paused','completed','expired')),
  target_date date,
  is_primary  boolean not null default false,  -- mirrors profiles.target_exam
  started_at  timestamptz not null default now(),
  completed_at timestamptz,
  unique (user_id, course_id)
);
create index idx_enrollments_user on public.enrollments(user_id);
create unique index uniq_primary_enrollment on public.enrollments(user_id) where is_primary;

-- Normalise exams.subject_ids jsonb → join (keep jsonb during migration, then drop).
create table public.exam_subjects (
  exam_id    text not null references public.exams(id) on delete cascade,
  subject_id text not null references public.subjects(id) on delete cascade,
  weight     numeric not null default 1,
  primary key (exam_id, subject_id)
);
```

### 5.2 Existing-table additions (all `add column if not exists`, nullable)

```sql
alter table public.exams      add column if not exists course_id text references public.courses(id) on delete set null;
alter table public.subjects   add column if not exists default_course_id text; -- hint for authoring
alter table public.questions  add column if not exists created_by text,
                              add column if not exists reviewed_by text,
                              add column if not exists version int not null default 1;
-- study_plans / study_missions already exist; add course scoping so a plan targets one enrollment
alter table public.study_plans add column if not exists enrollment_id uuid references public.enrollments(id) on delete cascade;
```

### 5.3 RLS for new tables (mirror existing patterns)

```sql
-- courses / course_subjects / exam_subjects: public read published, admin write
alter table public.courses enable row level security;
create policy courses_select on public.courses for select
  using (status = 'published' or (select public.is_admin()));
create policy courses_write on public.courses for all
  using ((select public.is_admin())) with check ((select public.is_admin()));
-- (same shape for course_subjects, exam_subjects)

-- enrollments: user owns own rows; admin reads all
alter table public.enrollments enable row level security;
create policy enrollments_select on public.enrollments for select
  using ((select auth.uid()) = user_id or (select public.is_admin()));
create policy enrollments_insert on public.enrollments for insert
  with check ((select auth.uid()) = user_id);
create policy enrollments_update on public.enrollments for update
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
```

### 5.4 B2B phase (later, gated)
`providers`, `cohorts (provider_id, course_id)`, `cohort_members (cohort_id, user_id, role in ('student','instructor'))`, plus an `is_instructor_of(user)` helper and policies letting instructors read their cohort's `mastery_snapshots` / `attempts`.

### 5.5 Indexing & integrity notes
- Keep the existing covering indexes; add `idx_enrollments_user`, `idx_course_subjects_subject`, `idx_exam_subjects_subject`.
- Enforce "one primary enrollment per user" with the partial unique index above (matches the existing `uniq_study_plans_active_per_user` idiom).
- A `submit_quiz(...)` `security definer` RPC should write `user_question_attempts` (N rows) + upsert `question_progress` + insert one `attempts` summary in a single transaction, so the three stores can never diverge (fixes W5).

---

## 6. Admin workflow

**Today:** `src/views/admin/*` — `SubjectsManager`, `SubcategoriesManager`, `QuestionsManager`, `ExamsManager`, `BulkImport`, `BlogManager`, `NotificationsManager`, `BillingManager`, `PricingManager`, `FeatureControl`, `RolesManager`, `UsersAnalytics`, `FunnelAnalytics`, `SiteContentManager`, `AiSettingsManager`, plus Feature-Preview tooling. Auth via `AdminGuard` + `is_admin()`. Broadcast fan-out via `api/admin/broadcast.ts` (service-role) + `broadcast_notification()`.

**Future (add a Course layer on top):**
```
1. Create Course (kind, authority, license)            → courses
2. Attach Subjects in order, set weights               → course_subjects
3. Author/import Subjects→Modules(ATA/LO)→Questions    → subjects/subcategories/questions
4. Define Exam blueprint + assemble Mock Papers         → exams/exam_subjects/mock_papers.rules
5. Publish (draft→published) cascades visibility        → status flags + RLS
6. Review queue: questions where status='draft' or reported → reviewed_by/version
7. (B2B) Assign Course to a Cohort, invite students     → cohorts/cohort_members
```
The existing managers stay; they gain a Course selector and a "Build syllabus" view that is just CRUD over `course_subjects`.

## 7. Student workflow

**Today:** `OnboardingFlow.tsx` collects pathway+goal → writes `profiles.target_exam` token + `onboarding_completed`; `TodayView`/`HomeView` dashboards (sections gated by `dashboardConfig`); `ModulesView`→`TopicView`→`QuizView`; `MockExamsView`, `QotdView`, `BookmarksView`, `InterviewPrepView`, `A320SystemsView`, `StudySchedulerView`, `MissionHistoryView`, `ProfileView`, `AnalyticsView`.

**Future:**
```
1. Onboard → pick one or more Courses        → enrollments (is_primary=true on the first)
2. Dashboard shows per-enrollment progress     → readiness per enrollment
3. Study = missions/modules scoped to the active enrollment's course_subjects
4. Switch/add course any time                  → new enrollment, no data loss
5. Career objective (airline recruitment)      → just another enrollment (kind='recruitment')
```
Net change for the student: they can run CPL + A320 + interview prep at once, each with its own readiness gauge — instead of one `target_exam`.

## 8. Content workflow

**Today:** dual-sourced (DB ∪ static), `seedTaxonomy()` exists, `BulkImport` for questions, but static files mask an empty bank.

**Future (single funnel):**
```
Author/Import  → questions(status='draft', created_by)
Review         → reviewed_by set, status='published', version++
Organise       → subcategory(code=ATA/LO) under subject under course_subjects
Assemble exam  → exam_subjects weights → mock_papers.rules blueprint
Publish course → courses.status='published'
```
**Static files become a one-time seed migration, then retire from the read path.** `content.ts` is refactored DB-first; static is offline cache only. This is the unblock for W1.

## 9. Question workflow

**Authoring → live:**
```
draft(created_by) → peer/admin review(reviewed_by) → published(version) → served via RLS
                                   ▲                                      │
                          question_reports ─────────── feedback loop ─────┘
```
**Answer path (unified, fixes W5):** `QuizView` submits → `submit_quiz()` RPC writes `user_question_attempts` + upserts `question_progress` (SM-2/SM-lite by flag) + inserts `attempts` summary, atomically. Mastery, readiness, XP all read from that single truth.

## 10. Mission workflow

Two engines already exist and stay; they get **course-scoped**:
- **Study Scheduler (M1):** AI writes `study_plans.plan` JSON (now linked to an `enrollment_id`) → `study-materialize` (`api/system.ts?fn=study-materialize`) → `study_missions` calendar rows → `launchMission()` maps `type`→route. Adaptive regen via `study-adaptive-regen` watching `mastery_snapshots`. Flag `aiStudyScheduler` OFF.
- **Mission Engine (Phase 6):** deterministic daily loop, reuses `study_missions source='system'`, one active system mission (unique partial index). Flag `missionEngine` OFF.
Mission types (`drill|review|viva|flashcard|mini_test|mock|read`) draw questions from the **enrollment's** `course_subjects`, so the same engine serves DGCA *and* type-rating *and* interview prep with no new code.

## 11. Roadmap workflow

How a user's multi-year journey is expressed once Courses exist:
```
PPL ─► CPL ─► (ATPL theory) ─► Type Rating (A320…) ─► Airline Recruitment
 │       │           │                  │                      │
 └───────┴───── enrollments (status/target_date) ─────────────┘
   active=current focus · completed=archived · is_primary=dashboard headline
```
The roadmap is a query over `enrollments` ordered by intended sequence — not a string token. DGCA subject carry-over (PPL→CPL→ATPL share Nav/Met/Regs) is modelled by **reusing the same `subjects` across multiple `course_subjects`**, so a question answered for CPL Met already counts toward ATPL Met mastery.

## 12. Mastery workflow

**Today:** `mastery_snapshots` (per user+subject) is a cache derived from `user_question_attempts`: lifetime `mastery` 0–100, 7-day window (`correct_7d`/`total_7d`), `baseline_mastery` re-based on each plan regen. Hooks `useMasterySnapshots`, `useMasteryHistory`; views `MasterySunburst`, `MasteryRadar`, heatmap. Flags `masterySnapshots`/`masteryAnalytics` OFF.

**Future:** unchanged math, but mastery rolls up **Subject → CourseSubject(weight) → Course**, giving a true per-course mastery %. Because subjects are shared across courses, mastery is computed once and surfaced per enrollment via `course_subjects.weight`.

## 13. Exam workflow

**Today:** `exams` + `mock_papers.rules` blueprint schema exist but mock content is static (`topics.ts`); `MockExamsView`/`ExamCentreView` render it; `QuizView` runs timed mode; `attempts` logs the session.

**Future:**
```
Course ─► Exam (blueprint: pass_mark, total_questions, neg_marking)
            └─► exam_subjects (weights) ─► MockPaper.rules ─► assembler pulls from bank
                                                              → timed QuizView → attempts
                                                              → readiness updates
```
Readiness = weighted mastery across the course's `exam_subjects`, gated at the official pass mark (DGCA 70% theory; type-rating systems exam 75%/100Q — Appendix A). ETA via `examReadinessEta` (OFF). This finally makes mock papers *assembled from the live bank by blueprint* instead of hardcoded.

---

## 14. Scalability analysis

| Dimension | Today | Ceiling / risk | Recommendation |
|---|---|---|---|
| **Content volume** | few hundred Qs, 0 mocks | can't support even one full DGCA course | Unblock W1: DB-first + authoring funnel + bulk import; target thousands/course |
| **Courses/tracks** | 1 token per user, static config | can't express multi-course or B2B | Courses + Enrollments (W2/W3) |
| **DB rows** | small | Postgres fine to tens of millions of UQA rows with current indexes | partition `user_question_attempts`/`events` by month only when >50M rows |
| **Reads** | PostgREST under RLS, initplan subqueries | `is_admin()` per-statement, good | add `course_id` indexes; consider materialised readiness view if dashboards slow |
| **Serverless** | 12-fn Hobby cap, `?fn=` multiplex | hard ceiling; cold starts | move to Vercel Fluid Compute / Pro, or consolidate to one framework backend; retire the server.ts/api dual-maintenance |
| **Realtime** | single-device `active_sessions`, notification fan-out client-side | broadcast fan-out cost at 100k users | server-side fan-out via `broadcast_notification()` (exists) + queue (Inngest/QStash already present) |
| **Flags/config** | 1 JSONB row, 4 registries | drift, build breaks | single registry as source; generate the others; CI check |
| **Mastery/readiness** | derived on read | recompute cost as Qs grow | keep `mastery_snapshots` cache; refresh on submit via the unified RPC |
| **Multi-tenancy** | none | blocks ATO/airline sales | providers/cohorts/instructor RLS (phase 2) |

**Headline:** the database and RLS scale to the next two orders of magnitude of *users* with minor indexing. The platform does **not** scale in *content breadth* or *business model* until Courses/Enrollments and the unified content funnel exist. Scale the model, then scale the content, then users follow.

---

## 15. Migration strategy

Sequenced, additive, each phase shippable behind a flag and reversible. No destructive change until the new path is proven.

**Phase 0 — Freeze & seed (no schema change).**
Inventory the static content; write a one-time seed that loads `staticQuestions.ts` / `topics.ts` / `staticExams` into `questions`/`exams`/`mock_papers` as `draft`. Verify counts. This makes the DB the superset and reveals the true bank size.

**Phase 1 — Backbone tables (dark).**
Add `courses`, `course_subjects`, `enrollments`, `exam_subjects` + RLS (§5). No reads switch yet. Backfill: one `courses` row per existing `TRAINING_PATHS` goal; populate `course_subjects` from `trainingPaths.DGCA_CORE` + `exams.subject_ids`; create an `enrollments` row per user from their `profiles.target_exam` (`is_primary=true`). Keep `target_exam` in sync via trigger.

**Phase 2 — Read switch behind `coursesModel` flag.**
Onboarding writes `enrollments` (and mirrors `target_exam`). Dashboards/readiness read per-enrollment when flag ON, fall back to token when OFF. Ship to internal users first.

**Phase 3 — Content funnel.**
Refactor `content.ts` DB-first; static demoted to offline cache. Admin gains Course/syllabus builder. Begin filling the bank (DGCA CPL first — highest demand). Turn on `mockExams` assembly from `mock_papers.rules` + `exam_subjects`.

**Phase 4 — Unify the answer log.**
Introduce `submit_quiz()` RPC; route `QuizView` through it; reconcile historical `attempts`↔UQA. Then mastery/readiness/XP read one truth. Enable `masterySnapshots`/`examReadinessDashboard` for cohorts.

**Phase 5 — Type ratings + interview prep as data.**
Author ATA-chapter subjects for A320 (pilot), then ATR72/A330/B737/B777; make `A320SystemsView` a presentation layer over rows. Model airline-recruitment as `kind='recruitment'` course with competency-based readiness (no pass-mark exam).

**Phase 6 — Retire the token & static catalogue.**
Once `enrollments` is the sole read path and the bank is DB-only, drop static catalogues from the read path and demote `profiles.target_exam` to a pure denormalised pointer. Normalise `exams.subject_ids` → `exam_subjects` and drop the JSONB column.

**Phase 7 — B2B (optional).**
Add `providers`/`cohorts`/`cohort_members` + instructor RLS; sell Course access to ATOs/airlines.

**Rollback:** every phase keeps the old path live behind a flag; nothing is dropped until its replacement is proven in production. Schema changes are `add column/table if not exists` (idempotent, matches the existing `schema.sql` reconciliation idiom).

---

## Appendix A — External research

### A.1 DGCA syllabus (administered online via the **Pariksha** portal; MCQ; **70%** pass; no negative marking; first pass valid 5 years)
- **CPL — 5 theory papers + RTR(A):** Air Navigation, Aviation Meteorology, Air Regulations, Technical General, Technical Specific. RTR(A) is run by **WPC**, not DGCA.
- **ATPL:** CPL foundation **plus** Aircraft Performance, Mass & Balance, Flight Planning, Human Performance (breadth + calculation depth).
- **PPL:** same subject families, reduced depth.
- **2026 changes:** moved fully online MCQ; questions no longer repeated; **scenario-based** technical + chart-based nav (FMS/RNAV/GPS/VOR-DME/ILS); proposed dropping the Class-12 PCM eligibility bar.
- **Carry-over:** Nav/Met/Regs recur PPL→CPL→ATPL — model as shared `subjects` reused across `course_subjects` (so mastery counts once).

Sources: [Airship DGCA syllabus 2026](https://www.airshipaviation.com/blog/dgca-exam-syllabus/), [Airship exam pattern 2026](https://www.airshipaviation.com/blog/dgca-exam-pattern-2026-key-changes-for-ppl-cpl-atpl/), [FMS Aviation](https://www.fmsaviationacademy.com/dgca-exam-syllabus-and-subjects/), [Golden Epaulettes](https://goldenepaulettes.com/dgca-exam-syllabus-2025), [DGCA Pariksha study-material list](https://pariksha.dgca.gov.in/PDFViewer.jsp?pdf=C9FAE7D86796081D3AA68DC41AF53315).

### A.2 Type rating (ATR72 / A320 / A330 / B737 / B777)
- **Structure:** pre-course CBT familiarisation → instructor-led technical ground school **organised by ATA chapter** → ~4 interim system tests → **final systems exam (~100 MCQ, 75% pass) + a performance exam** (gate to sim) → APT/FTD procedure trainer → Full-Flight Sim (Class D) + skill test → base training.
- **ATA chapters seen in published A320 syllabi:** 05–12 (general), **24** electrical, **49** APU, **71/72** powerplant, **51/53/54/55/57** structures, **56** windows, **25** equipment/furnishings, **31** indicating/recording — plus limitations, memory items, SOPs, performance.
- **Modelling:** each type rating = a `course (kind='type_rating')`; its `subjects` = ATA chapters (`subcategories.code='ATA-24'`); systems exam = `exam` blueprint (100Q/75%); the same applies to all five aircraft — **one model, five content sets.**

Sources: [Airbus A32x (CFM56) TCS syllabus PDF](https://www.agt.aero/wp-content/uploads/2020/10/TCS-A32C-R.3.pdf), [BAA Training A320](https://baatraining.com/type-ratings/airbus-a320/), [CPAT A320 CBT](https://www.cpat.com/courses/airbus-320/), [Golden Epaulettes A320 syllabus](https://goldenepaulettes.com/a320-type-rating-exam-syllabus), [PilotGeorge L3 cadet blog](https://www.pilotgeorge.co.uk/blog/post/a320-type-rating-aircraft-systems-l3-cts/).

### A.3 How providers organise courses — **Padpilot** as the reference model
Padpilot (used by 140 ATOs) = **interactive digital textbooks** (eReader/Apple Books, embedded 3D/animations, reading-time tracking) → **Moodle-based LMS** delivering **two-tier tests** (end-of-chapter *consolidation* questions + ECQB *feedback* questions; final exams use feedback questions only) with progress/reading-time reporting → **AI study assistant** ("Briefing Room") for 24/7 explanations → **editable classroom presentations** for instructors. Philosophy: teach the *why*, not rote question-bank memorisation; content tracks the **ECQB** central question bank. Sold to **ATOs**, not consumers.

**Read-across for Heading:** the spine to copy is **ebook/lesson → trackable question bank (two tiers: practice vs exam-feedback) → progress reporting → AI assistant → instructor presentations**, all **ATO/cohort-scoped**. Heading already has the AI assistant (coach/explain) and the question bank; it lacks the *course/lesson* container, the two-tier question taxonomy, and the ATO/cohort scoping. CAE / L3 / Skyborne / OAA / Lufthansa EFA / IndiGo-Air India-Emirates-Qatar cadet programs follow the same CBT-modules → progress-tests → final-exam → sim funnel; type-rating TRTOs (CAE, BAA) follow the ATA-chapter funnel in A.2.

Sources: [Padpilot](https://padpilot.com/), [Padpilot ATPL(A) overview](https://www.scribd.com/document/843573270/Padpilot-ATPL-A-Overview-NB-Feb2025), [AFM Aero on Padpilot platform](https://www.afm.aero/leading-pilot-training-ground-school-solution-provider-padpilot-launches-multi-device-content-platform), [Padpilot FAQ](https://padpilot.com/faq/).

### A.4 Airline selection / interview prep (the "Airline Recruitment" objective)
Eliminatory funnel: **Aptitude/Psychometric** (COMPASS, PILAPT, cut-e, Talent Q — spatial, multitasking/dichotic listening, reaction time, mental maths, personality) → **Technical interview** (principles of flight, systems, met, performance, air law, current affairs) → **HR / Competency-Based Interview** (STAR method; PACE safety model) → **Sim check** (handling, IF, non-normals, CRM — tests *trainability*) → **Medical (Class 1) + background** → Conditional Job Offer. Aptitude tests assess *trainability*, not knowledge, and largely **can't be crammed** — familiarisation only.

**Modelling:** `course (kind='recruitment')` with subjects = {Aptitude drills, Technical interview, HR/CBI, Sim-prep}; "readiness" is competency coverage, not a 70% pass mark; drills reuse the existing quiz engine; this is exactly the `airline-recruitment` career objective already stubbed in `trainingPaths.ts`, now first-class.

Sources: [Airship cadet selection process](https://www.airshipaviation.com/blog/cadet-pilot-program-selection-process-aptitude-gd-interview/), [Pilotest COMPASS prep](https://www.pilotest.com/en/selections/compass-pilot-aptitude-tests-preparation), [PILAPT prep](https://pilotassessments.com/pilapt-pilot-aptitude-test-assessment-preparation/), [ClearATPL interview guide](https://clearatpl.com/blog/blog4-how-to-prepare-airline-interview), [Psychometric Success](https://psychometric-success.com/aptitude-tests/test-types/pilot-aptitude-tests).

---

## Appendix B — Research → schema mapping

| Real-world concept | Heading entity (future) |
|---|---|
| DGCA CPL / ATPL / PPL program | `courses` row, `kind='license'`, `authority='DGCA'` |
| RTR(A) (WPC) | `courses` row, `kind='rating'` |
| A320/ATR72/A330/B737/B777 type rating | `courses` row, `kind='type_rating'` |
| Airline recruitment pathway | `courses` row, `kind='recruitment'` |
| DGCA subject (Nav/Met/Regs/Tech) | `subjects` (shared across CPL/ATPL via `course_subjects`) |
| ATA chapter (24 electrical, 49 APU…) | `subcategories.code='ATA-24'` |
| EASA learning objective (021.01) | `subcategories.code='021.01'` |
| Consolidation vs ECQB feedback Q (Padpilot) | `questions.topic_tags` / a `tier` column (practice vs exam) |
| Official paper (100Q/75%, DGCA 70%) | `exams` blueprint + `exam_subjects` weights |
| Assembled mock | `mock_papers.rules` pulling from the bank |
| Aptitude/CBI competency | `subjects` under the recruitment course |
| ATO / airline cohort | `providers` + `cohorts` (phase 7) |

---

**End of document. No code has been written or changed. Awaiting approval before any implementation.**
