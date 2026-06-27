# Heading380 — Content Foundation Plan (Phase 0.5)

**Author:** Lead Software Architect
**Date:** 2026-06-27
**Status:** BLUEPRINT ONLY — nothing implemented. No schema, no migration, no code, no flag changes.
**Predecessor:** `docs/ARCHITECTURE-AUDIT-2026-06-27.md` (read first).
**Successor:** Phase 1 implements from this document.

> Purpose: design the **permanent content foundation** so tens of thousands of
> questions across every future aviation product (DGCA, FAA, EASA, type ratings,
> interview, cabin crew, dispatch, AME, drone, …) can be imported later **without
> redesigning anything**. This phase is additive-by-design and changes nothing
> that ships today.

## Hard constraints (success criteria)
✔ No production code changed ✔ No schema changed ✔ No migrations ✔ No flag changes
✔ One comprehensive blueprint ✔ Every future aviation product fits ✔ Ready for large-scale import

---

## Table of contents
1. Step 1 — Full dependency audit (where syllabus lives today)
2. Step 2 — Permanent content hierarchy (8 levels)
3. Step 3 — Content registry (entities + common contract)
4. Step 4 — Syllabus research → hierarchy (per certification)
5. Step 5 — Import strategy
6. Step 6 — Learning Profile design
7. Step 7 — Content filtering engine
8. Step 8 — Admin CMS plan
9. ERD
10. Relationships
11. Supabase / API impact
12. Performance + index strategy
13. Migration strategy (phased)
14. Rollback strategy
15. Risk analysis
16. Future roadmap

---

## 1. Step 1 — Full dependency audit

Every place syllabus/track identity is read or written today. **Verified by grep, not assumed.**

### 1.1 The coupling primitives

| Primitive | File | Kind |
|---|---|---|
| `target_exam` (string token / label) | `profiles` column | DB |
| `career_objective` | `profiles` column (already persisted — selected in AuthContext.tsx:213) | DB |
| `TRAINING_PATHS`, `CAREER_OBJECTIVES`, `getPrimaryTrackFamily`, `resolveTargetExam`, `resolveCareerObjective` | `src/data/trainingPaths.ts` | static config |
| `TRACK_SUBJECTS`, `TYPE_RATING_SUBJECTS`, mission subject pools | `src/config/missionConfig.ts` | static config |
| `TRACK_NAV` (nav slots per family) | `src/config/navigationConfig.ts` | static config |
| dashboard section `tracks` gating | `src/config/dashboardConfig.ts` | static config |
| `staticQuestionBank` (~140 Q) | `src/data/staticQuestions.ts` | static content |
| `mockExams`, topic structure (515 lines) | `src/data/topics.ts` | static content |
| `staticExams` | `src/lib/content.ts:581` | static content |
| `A320SystemsView` (hardcoded type-rating view) | `src/views/A320SystemsView.tsx` | static UI |

### 1.2 `target_exam` — readers & writers

**Writers (3):**
- `AuthContext.tsx:226` — signup default `target_exam: 'DGCA CPL'` *(human label)*
- `AuthContext.tsx:698,735` — `updateProfile` maps `data.targetExam → target_exam` *(token form from onboarding)*
- `OnboardingFlow.tsx` — writes the resolved token via `resolveTargetExam(pathway, goal)`

**Readers (11 files):** `AuthContext` (normalises to `userData.targetExam`), `ProfileView`, `TodayView`, `ModulesView`, `InterviewPrepView`, `MissionCompleteView`, `useActiveMission`, `admin/UsersAnalytics`, `components/layout/AppShell`, and the three config resolvers (`dashboardConfig`, `missionConfig`, `navigationConfig`).

> **⚠ Latent inconsistency (do not fix in this phase — record it):** the signup
> default is the **label** `"DGCA CPL"`, but onboarding and `getPrimaryTrackFamily`
> expect the **token** `"dgca-cpl"` (`startsWith("dgca-")`). A user who never
> finishes onboarding has `family = null`. The new model must **normalise both
> forms** on read during migration.

### 1.3 Dependency graph (text)

```
                         src/data/trainingPaths.ts
                         (TRAINING_PATHS, CAREER_OBJECTIVES,
                          getPrimaryTrackFamily, resolveTargetExam)
                                   ▲ imported by
        ┌──────────────────────────┼───────────────────────────┐
        │                          │                            │
 OnboardingFlow.tsx        config/missionConfig.ts      config/navigationConfig.ts
 (WRITES target_exam)      config/dashboardConfig.ts    (TRACK_NAV slots)
        │                  (TRACK_SUBJECTS,                     │
        ▼                   TYPE_RATING_SUBJECTS)               ▼
   profiles.target_exam ──────────► getPrimaryTrackFamily(token) ──► "dgca"|"type_rating"|"faa"|"easa"|null
   profiles.career_objective                 │
        ▲ read by                            ▼ drives
   AuthContext (→ userData.targetExam)   which subjects / nav / dashboard sections show
        │
        ├─► TodayView, ModulesView, ProfileView, InterviewPrepView,
        │   MissionCompleteView, useActiveMission, AppShell, admin/UsersAnalytics
        │
 src/lib/content.ts  ──(DB ∪ static fallback)──►  staticQuestions.ts, topics.ts, staticExams
        ▲ consumed by                                     ▲
   QuizView, MockExamsView, ExamCentreView,          offline/questionCache.ts
   TopicView, SearchOverlay, AnalyticsView,
   MasterySunburst, PaperSelector, TodayStops,
   home/InteractiveSampleQuestion

 A320SystemsView.tsx ──gated by flag a320Systems──► navigationConfig TRACK_NAV.type_rating[0]
        ▲ referenced by App.tsx, ProfileView, featureRegistry, previewRoutes, featureMedia
```

### 1.4 API / table touch-points
- **APIs reading content/track:** `api/instructor/[action].ts` (coach/explain/practice consume question context), `api/system.ts?fn=study-*` (materialise/metrics/mastery-check use subject ids), `api/_lib/studyPlan.ts` + `coach.ts`.
- **Tables holding syllabus identity:** `subjects`, `subcategories`, `questions`, `exams`, `mock_papers` (DB taxonomy); `profiles.target_exam` / `career_objective` (user identity); `study_missions.payload` / `study_plans.plan` (subject ids embedded in JSON).
- **No code modified in this phase.** This map is the input to Phase 1.

---

## 2. Step 2 — Permanent content hierarchy

Eight levels. Aircraft is **optional** (present only for type ratings / aircraft-specific products).

```
PROGRAM            DGCA · FAA · EASA · TYPE_RATING · AIRLINE · CABIN_CREW · DISPATCH · AME · DRONE
   ↓
CERTIFICATION      PPL · CPL · ATPL · ATP · RTR(A) · A320-TR · Cadet · CCA · FOO/Dispatch · AME-B1 · RPC
   ↓
AIRCRAFT (opt)     A320 · A330 · ATR72 · B737 · B777   (NULL for non-type products)
   ↓
SUBJECT            Air Navigation · Meteorology · Electrical(ATA24) · Aptitude · …  (SHARED LIBRARY)
   ↓
MODULE             chapter / ATA block / LO group   (= today's `subcategories`)
   ↓
TOPIC              fine-grained concept   (NEW level; today only `topic_tags` text[])
   ↓
QUESTION           the item   (today's `questions`)
   ↓
(REFERENCE / ATTACHMENT)   images, diagrams, PDFs, video, citations
```

**Design rules that make it future-proof:**
1. **Subjects are a shared library**, linked to certifications by a join (`certification_subjects`) with `position` + `weight` + `required`. DGCA Nav is one Subject row reused by CPL **and** ATPL → a question answered once counts toward both (carry-over is free).
2. **Aircraft is a dimension, not a hardcoded view.** A type-rating Certification carries `aircraft_id`; its Subjects are ATA-chapter rows. Adding B777 = data, not a new `*SystemsView`.
3. **Every level is a registry row** with the same contract (§3) → uniform CRUD, ordering, status, versioning everywhere.
4. **New products need zero schema work** — Cabin Crew / Dispatch / AME / Drone are just new Program + Certification + Subject rows.

Mapping to existing tables (so nothing is thrown away):
| New concept | Existing table | Action in Phase 1 |
|---|---|---|
| Program | — | NEW `programs` |
| Certification | — | NEW `certifications` (supersedes `courses` idea from audit; richer) |
| Aircraft | — | NEW `aircraft` |
| Subject | `subjects` | reuse + add FKs |
| Module | `subcategories` | reuse (logical alias "module"); `code` already holds ATA/LO |
| Topic | `questions.topic_tags` | NEW `topics` (promote tags → rows; tags stay for back-compat) |
| Question | `questions` | reuse + add governance cols |
| Reference/Attachment | `questions.refs` jsonb | NEW `content_assets` for binaries |

---

## 3. Step 3 — Content registry

Every registry/lookup entity shares this **common contract**:

```
id          uuid or text-slug PK
slug        text unique (stable, URL/lookup safe)
title       text
status      text  ('draft' | 'published' | 'archived')   -- matches existing convention
sort_order  int   default 0
metadata    jsonb default '{}'                            -- forward-compatible extension point
created_at  timestamptz
updated_at  timestamptz
```

### 3.1 Structural registries
| Entity | Extra fields | Notes |
|---|---|---|
| `programs` | `authority`, `kind` | authority ∈ {DGCA,FAA,EASA,…}; kind ∈ {license,type_rating,recruitment,vocational,rating} |
| `certifications` | `program_id` FK, `aircraft_id` FK (nullable), `license`, `pass_mark`, `validity_months` | the enrollable credential |
| `aircraft` | `manufacturer`, `family`, `icao_type` | A320, ATR72… |
| `subjects` *(exists)* | + `default_authority` | shared library |
| `certification_subjects` *(join)* | `position`, `weight`, `required` | replaces `exams.subject_ids` parsing |
| `modules` *(= subcategories, exists)* | `code` (ATA/LO) | reuse |
| `topics` *(new)* | `module_id` FK | promotes `topic_tags` |
| `questions` *(exists)* | governance cols below | |

### 3.2 Lookup registries (taxonomy)
| Entity | Purpose |
|---|---|
| `question_difficulty` | standard/complex/extreme (today an enum) → table for extensibility |
| `question_tags` | free taxonomy; M:N via `question_tag_map` |
| `question_sources` | where a Q came from (manual, ai, import:CAE, DGCA-past-paper…) |
| `question_status` | draft/published/archived/in_review (today an enum) |
| `reference_material` | citations / textbooks / circulars; M:N to questions |
| `content_assets` | binaries (image/diagram/pdf/video) in Supabase Storage; M:N to questions/modules |
| `learning_objectives` | EASA LO / DGCA syllabus objective codes; M:N to modules/questions |
| `ata_chapters` | canonical ATA 05–80 list; referenced by `modules.code` / aircraft subjects |
| `regulatory_authorities` | DGCA/FAA/EASA/ICAO + jurisdiction metadata |

### 3.3 Question governance (added cols, nullable — no rewrite)
```
questions.created_by   text
questions.reviewed_by  text
questions.version      int default 1
questions.source_id    text references question_sources(slug)
questions.dedupe_hash  text   -- normalised(prompt) hash for duplicate detection
questions.topic_id     text references topics(id)   -- coexists with topic_tags
```
Plus `question_versions` (append-only history) for audit/rollback of edits.

---

## 4. Step 4 — Syllabus research → hierarchy

Architecture only — **no seed data**. Each certification expressed as Subjects → Modules → Topics → question categories → practical → mock structure. (DGCA / type-rating / interview detail and sources are in `ARCHITECTURE-AUDIT-2026-06-27.md` Appendix A; summarised + extended here.)

### 4.1 DGCA CPL / ATPL / PPL
- **Subjects:** Air Navigation · Aviation Meteorology · Air Regulations · Technical General · Technical Specific. **ATPL adds:** Aircraft Performance · Mass & Balance · Flight Planning · Human Performance.
- **Modules (examples):** Nav → {Lat/Long & time, Great/Rhumb lines, Wind triangle/DR, Charts, Radio nav VOR/DME/ADF, GNSS, Flight planning, Performance}. Met → {Atmosphere, Pressure/wind, Clouds & precip, Air masses/fronts, Thunderstorms/icing/turbulence, Climatology, Reports/forecasts}. Regs → {ICAO annexes, Indian CAR, Airspace/ATS, Licensing, Rules of the air}.
- **Question categories:** factual · calculation · chart-based · scenario (2026 DGCA shift to scenario/application).
- **Practical:** N/A (theory papers) — but link to flight-training logbook later.
- **Mock structure:** per-subject paper, **70%** pass, no negative marking, MCQ via Pariksha; full mock = blueprint over the subject's modules.
- **Carry-over:** PPL→CPL→ATPL share Nav/Met/Regs → shared Subjects.

### 4.2 RTR(A)
- **Subjects:** Part-1 Practical (transmission technique, phraseology) · Part-2 Oral (regs, radio principles). Authority **WPC**, not DGCA.
- **Mock:** simulated R/T scripts + oral viva bank.

### 4.3 FAA PPL / CPL / ATP
- **Subjects (knowledge test areas, FAA ACS):** Regulations (FAR/AIM) · Airspace · Weather · Aerodynamics/Principles of Flight · Aircraft systems · Performance & W&B · Navigation · Aeromedical/ADM · Procedures.
- **Mock:** FAA written = 60–125 MCQ depending on level; **70%** pass; ACS-code tagged → map ACS codes to `learning_objectives`.
- **Practical:** Oral + checkride (ACS) — model as competency checklist later.

### 4.4 EASA ATPL
- **Subjects (13, EASA 2020 LO framework):** 010 Air Law · 021 Airframe/Systems/Powerplant · 022 Instrumentation · 031 Mass & Balance · 032 Performance · 033 Flight Planning · 040 Human Performance · 050 Meteorology · 061 General Navigation · 062 Radio Navigation · 070 Operational Procedures · 081 Principles of Flight · 090 Communications.
- **Modules:** EASA **learning-objective codes** (e.g. 021.01) → `modules.code` + `learning_objectives`.
- **Question tiers (Padpilot/ECQB model):** *consolidation* (end-of-chapter) vs *feedback* (exam-bank) → `questions.metadata.tier` or `question_tags`.
- **Mock:** ECQB-style per-subject; **75%** pass.

### 4.5 Type ratings (A320 / A330 / ATR72 / B737 / B777)
- **Subjects = ATA chapters:** 05–12 general · 21 air-cond · 22 autoflight · 23 comms · **24 electrical** · 25 equipment · 27 flight controls · 28 fuel · 29 hydraulics · 30 ice/rain · 31 indicating · 32 gear · 34 nav · 36 pneumatic · **49 APU** · 70–80 powerplant · 51–57 structures · plus **Limitations, Performance, Memory items, SOPs, Abnormals/Emergency**.
- **Question categories:** systems-knowledge · limitations (memory) · performance calc · scenario/abnormal.
- **Practical:** CBT → APT/FTD → FFS (Class D) → skill test → base training.
- **Mock structure:** systems exam **~100 MCQ / 75%** (gate to sim) + performance exam. One model per `aircraft_id`.

### 4.6 Airline Technical Interview / Cadet
- **Subjects:** Aptitude (spatial, multitasking/dichotic, reaction-time, mental-maths — COMPASS/PILAPT/cut-e familiarisation) · Technical (PoF, systems, met, performance, air law, current affairs) · HR/Competency (STAR, PACE) · Sim-prep (handling/IF/CRM).
- **Question categories:** drill · scenario · behavioural (no single correct answer — `metadata.answer_kind`).
- **Mock:** staged mock assessment day; "readiness" = competency coverage, not pass mark.

### 4.7 Future vocational (architecture must already fit)
- **Cabin Crew (CCA):** Subjects = Safety & Emergency Procedures · First Aid · Aviation Security · Service · Dangerous Goods · CRM. Program `CABIN_CREW`.
- **Dispatch / FOO:** Subjects = Met · Nav · Mass&Balance · Performance · Air Law · Flight Planning · Comms. Program `DISPATCH`.
- **AME:** Subjects = Module 1–17 (EASA Part-66 style: Maths, Physics, Electrical, Electronics, Materials, Aerodynamics, Maintenance Practices, Human Factors, Legislation, Turbine/Piston, …). Program `AME`.
- **Drone / RPC:** Subjects = Air Law · Met · Nav · UAS systems · Safety/Risk · Battery/Payload. Program `DRONE`.
- **All four require ZERO schema change** — new `programs`/`certifications`/`subjects` rows only.

---

## 5. Step 5 — Import strategy

Goal: ingest tens of thousands of questions + media without touching existing admin until ready.

### 5.1 Staging pipeline (new tables, additive)
```
content_import_batches ( id, kind, source, status, created_by, counts jsonb, created_at )
content_import_rows    ( id, batch_id, raw jsonb, parsed jsonb, status, error, dedupe_hash )
```
Flow: **upload → parse → validate → dedup → preview → commit**. Commit writes `questions` (+ modules/topics) as `draft`; nothing is published automatically.

### 5.2 Supported formats
| Format | Mechanism |
|---|---|
| CSV / Excel (XLSX) | header-mapped → `content_import_rows.parsed`; column map saved per source |
| JSON | direct shape match |
| Images / diagrams | Supabase **Storage bucket** `content-media`; row references asset id |
| PDFs (past papers, fact sheets) | upload → text extract → AI-assisted question extraction → staging rows |
| Videos / attachments | Storage bucket; linked via `content_assets` |
| AI-generated | existing `api/instructor` coach pipeline → staged as `source='ai'`, flagged for review |

### 5.3 Validation & dedup
- Schema validation (required fields, 4 choices, valid `correct`, non-empty explanation).
- **Duplicate detection** via `dedupe_hash = sha(normalise(prompt))`; collisions surfaced in preview, never silently dropped.
- All imports land `draft`; publish is a separate, audited admin action.

### 5.4 Non-disruption
Import lives behind a new `contentImport` flag; existing `BulkImport.tsx` stays untouched until the new pipeline is proven, then becomes a thin caller.

---

## 6. Step 6 — Learning Profile design

Replace the single `target_exam` string with a structured profile — **design only, no migration here.**

### 6.1 Shape (1:1 with user; `profiles` kept as-is for back-compat)
```
learning_profiles (
  user_id            uuid PK references auth.users,
  primary_enrollment uuid references enrollments(id),  -- "current focus"
  career_goal        text,        -- airline / instructor / charter / corporate
  experience_level   text,        -- ab_initio / hour_building / type_rated / experienced
  current_license    text,        -- PPL / CPL / ATPL / none
  future_license     text,        -- target credential
  airline_target     text,        -- IndiGo / Air India / Emirates / …
  training_org       text,        -- ATO/cohort (links to providers later)
  country            text,
  language           text default 'en',
  timezone           text default 'Asia/Kolkata',
  exam_date          date,        -- denormalised from primary enrollment
  metadata           jsonb default '{}',
  updated_at         timestamptz
)
```
Course/aircraft/certification identity lives in **`enrollments`** (from the audit), one per credential the user pursues; `learning_profiles` holds the cross-cutting attributes. `profiles.target_exam` / `career_objective` become **denormalised mirrors** kept in sync by trigger — never removed.

### 6.2 Why split profile vs enrollment
A user has **one** learning profile but **many** enrollments (CPL + A320 + interview). Exam date, current focus, etc. are per-enrollment; language/country/airline-target are per-person.

---

## 7. Step 7 — Content filtering engine

Single source of "what is this user studying", consumed everywhere, replacing scattered `getPrimaryTrackFamily(target_exam)` string parsing.

### 7.1 The resolver
```
resolveContentScope(profile, activeEnrollment) → ContentScope {
  programId, certificationId, aircraftId | null,
  subjectIds: string[],          // from certification_subjects
  moduleIds, topicIds,
  authority, license,
  careerObjectiveIds,            // layered (recruitment etc.)
  flags                          // feature gating
}
```
Exposed as a hook `useLearningContext()` (wraps AuthContext + active enrollment). Every page asks the **scope object**, never a hardcoded `if (family === 'dgca')`.

### 7.2 Consumers (all read scope, none hardcode)
Onboarding · ModulesView · Mission Engine (`missionConfig`) · Question Bank (`content.ts`) · Daily Drill · Mock Exams · Review (SR) · Analytics · XP · Achievements · Search · Admin Preview · Navigation (`navigationConfig`) · Dashboard (`dashboardConfig`).

### 7.3 Migration of the existing resolvers
`missionConfig.TRACK_SUBJECTS` / `TYPE_RATING_SUBJECTS`, `navigationConfig.TRACK_NAV`, `dashboardConfig.tracks` become **fallbacks** read only when scope is unavailable (offline / pre-migration). Behaviour identical when the new path is OFF.

---

## 8. Step 8 — Admin CMS plan

A tree CMS over the 8-level hierarchy. New views; existing managers untouched until parity.

```
Program ▸ Certification ▸ Aircraft ▸ Subject ▸ Module ▸ Topic ▸ Question
  (each node: create / edit / reorder / status / duplicate / archive)
```

| Capability | Mechanism |
|---|---|
| Tree navigation | nested registry reads, lazy-loaded per level |
| Drag-and-drop ordering | persist `sort_order` (already on every registry) |
| Draft / Published / Archived | existing `status` convention + RLS `published OR is_admin()` |
| Versioning | `question_versions` append-only; revert = insert new version |
| Duplicate detection | `dedupe_hash` surfaced inline on author/import |
| Bulk uploads | Step 5 staging pipeline embedded |
| AI-assisted import | `api/instructor` → staged drafts → review queue |
| Review queue | filter `status='in_review'`; set `reviewed_by` on approve |

Existing `SubjectsManager` / `SubcategoriesManager` / `QuestionsManager` / `ExamsManager` / `BulkImport` keep working; the new CMS is additive and flag-gated (`contentCms`).

---

## 9. ERD

`[NEW]` = proposed; others exist today. Lookup tables abbreviated.

```
┌──────────┐ 1   N ┌────────────────┐ 1  N ┌──────────┐
│ programs │──────►│ certifications │─────►│ aircraft │ (aircraft_id nullable)
│ [NEW]    │       │ [NEW]          │      │ [NEW]    │
└──────────┘       └───┬───────┬────┘      └──────────┘
                       │1      │1
                       │N      │N
        ┌──────────────▼──┐  ┌─▼────────────┐
        │certification_   │  │  exams       │ (course/cert blueprint)
        │subjects [NEW]   │  │ + exam_      │
        │ pos, weight     │  │ subjects[NEW]│
        └──────┬──────────┘  └──────────────┘
               │N
               │1
        ┌──────▼─────┐ 1   N ┌───────────┐ 1  N ┌────────┐ 1  N ┌────────────┐
        │  subjects  │──────►│  modules  │─────►│ topics │─────►│ questions  │
        │  (library) │       │(=subcateg)│      │ [NEW]  │      │ +governance│
        └────────────┘       └───────────┘      └────────┘      └─────┬──────┘
                                                                      │ M:N
              ┌──────────────────────┬───────────────┬───────────────┼─────────────┐
              ▼                      ▼               ▼               ▼             ▼
      content_assets[NEW]   reference_material  question_tag_map  learning_     question_
      (img/pdf/video)            [NEW]              [NEW]         objectives[NEW] versions[NEW]

  USER SIDE
  ┌──────────┐ 1  1 ┌──────────────────┐ 1  N ┌─────────────┐ N  1 ┌────────────────┐
  │ profiles │─────►│ learning_profiles│─────►│ enrollments │─────►│ certifications │
  │ target_  │      │ [NEW]            │      │ [NEW, audit]│      └────────────────┘
  │ exam*    │      └──────────────────┘      └─────────────┘
  └──────────┘                                       │ derives
                                                     ▼
                          missions · mastery_snapshots · readiness · xp_events · streak

  IMPORT (staging)
  content_import_batches[NEW] ──1:N──► content_import_rows[NEW] ──commit──► questions(draft)
* denormalised mirror, never removed
```

---

## 10. Relationships
- `programs 1—N certifications 1—N (aircraft 0..1)`.
- `certifications N—M subjects` via `certification_subjects` (pos/weight/required) → carry-over + blueprint weighting.
- `subjects 1—N modules 1—N topics 1—N questions`.
- `questions N—M {tags, references, learning_objectives, assets}`; `1—N question_versions`.
- `user 1—1 learning_profiles 1—N enrollments N—1 certifications`.
- `enrollments` derive missions/mastery/readiness/XP (unchanged engines, now scoped).
- Lookup registries (`difficulty/status/source/ata_chapters/authorities`) referenced by slug.

---

## 11. Supabase / API impact
- **New tables only** (programs, certifications, aircraft, certification_subjects, topics, exam_subjects, learning_profiles, enrollments, import + lookup tables). All `create table if not exists`, idempotent — matches existing `schema.sql` reconciliation idiom.
- **RLS:** structural/lookup tables = `status='published' OR is_admin()` read, admin write. `learning_profiles`/`enrollments` = own-row + admin, mirroring existing user-owned policy shape with `(select auth.uid())` initplan subqueries. `content_import_*` = admin-only.
- **Storage:** new buckets `content-media` (public-read published assets) + `content-import` (admin-only).
- **API:** no new serverless function needed initially — content CRUD goes through PostgREST under RLS; import commit + AI extract fold into `api/system.ts?fn=content-import` (respects the **12-function Hobby cap**). `api/instructor` reused for AI generation. No change to `server.ts`/`api/` dual-maintenance beyond one multiplexed `fn`.
- **Existing APIs unaffected** — study/coach endpoints keep reading subject ids; scope resolver feeds them the same shape.

## 12. Performance + index strategy
- Tree reads are shallow + lazy → cheap. Index every FK: `certifications(program_id)`, `certification_subjects(subject_id)`, `modules(subject_id)` *(exists)*, `topics(module_id)`, `questions(topic_id)`, `questions(subcategory_id,status)` *(exists)*, `enrollments(user_id)`, `exam_subjects(subject_id)`.
- **Question bank at scale (10k–100k rows):** keep `idx_questions_status_subject`/`_subcategory`; add `idx_questions_status_topic`. Partition `questions` only beyond ~1M rows (not needed soon).
- `dedupe_hash` unique-ish index (non-unique, for lookup) to make duplicate scan O(log n).
- Mastery/readiness keep the `mastery_snapshots` cache; the unified `submit_quiz()` RPC (from audit) refreshes on write.
- Import staging isolated from live tables → bulk inserts don't lock the read path; commit in batches.

## 13. Migration strategy (phases — implemented in Phase 1+, NOT now)
- **P0 (this doc):** blueprint. ✅
- **P1:** create registries + structural tables (dark, empty). Backfill 1 program/cert per existing `TRAINING_PATHS` goal; `certification_subjects` from `missionConfig.TRACK_SUBJECTS` + `exams.subject_ids`.
- **P2:** seed static content (`staticQuestions`/`topics`/`staticExams`) into DB as `draft`; `content.ts` becomes DB-first, static = offline cache.
- **P3:** import pipeline + new CMS behind flags; begin large-scale DGCA-CPL import.
- **P4:** `learning_profiles` + `enrollments` populated from `target_exam`/`career_objective` (mirrors kept in sync); scope resolver live behind `coursesModel` flag.
- **P5:** type ratings + interview prep as data; retire `A320SystemsView` hardcoding to a presentation layer.
- **P6:** normalise `exams.subject_ids → exam_subjects`; demote `target_exam` to pure mirror.
- Each phase additive, idempotent, flag-gated, shippable alone.

## 14. Rollback strategy
- Every phase ships behind a feature flag (`contentCms`, `contentImport`, `coursesModel`). Flag OFF → old path (static config + `target_exam` token) serves unchanged.
- No table dropped, no column removed, no data migrated destructively until its replacement is proven in prod (mirrors the existing dark-launch discipline).
- New tables empty/ignored when flags OFF → zero runtime effect. Drop-and-recreate of a new empty table is safe.
- `question_versions` enables per-question content rollback independent of schema.

## 15. Risk analysis
| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| `target_exam` label-vs-token inconsistency leaks into new model | High | Med | Normalise both forms in scope resolver; covered in §1.2 |
| Static↔DB double source during P2 | Med | Med | DB-first read; static demoted to cache only; counts asserted post-seed |
| 12-fn Vercel cap blocks import endpoint | Med | Med | Multiplex via `api/system.ts?fn=content-import`; no new fn |
| Flag-registry drift (4 registries) breaks build | High | Low | Add new flags to ALL registries; CI check (existing known footgun) |
| Bulk import locks/duplicates | Med | Med | Staging tables + dedupe_hash + batched commit |
| RLS gap on new tables | Low | High | Copy proven `published OR is_admin()` / own-row patterns; re-run IDOR audit on new user-owned tables |
| Scope creep into a rewrite | Med | High | Strictly additive; existing managers/views untouched until parity |

## 16. Future roadmap
1. **Phase 1** — structural backbone (programs→questions registries) + backfill from existing config.
2. **Phase 2** — static→DB seed; DB-first content loader.
3. **Phase 3** — import pipeline + tree CMS; fill DGCA CPL bank.
4. **Phase 4** — learning profile + enrollments + scope resolver.
5. **Phase 5** — type ratings + interview + vocational (cabin crew/dispatch/AME/drone) as data.
6. **Phase 6** — normalise exams; retire token/static read paths.
7. **Phase 7 (B2B)** — providers/cohorts/instructor RLS for ATO & airline sales.

---

**End of blueprint. No production code, schema, migration, or feature flag was changed. Phase 1 implements from this document — pending approval.**
