# Phase 1 — Content Registry + Canonical Content IDs (Implementation)

**Date:** 2026-06-27
**Status:** IMPLEMENTED (additive, flag-gated OFF, migrations not yet applied to prod).
**Predecessors:** `ARCHITECTURE-AUDIT-2026-06-27.md`, `CONTENT-FOUNDATION-PLAN.md`.
**Verification:** `tsc --noEmit` 0 errors · 161/161 unit tests pass · `vite build` OK.

> Phase 1 replaces scattered string parsing of track/exam tokens with a single
> canonical resolver, fixes the label-vs-token null-family bug permanently, and
> lays the registry tables — without changing any shipped behaviour. No question
> migration, no content upload. Everything reversible.

---

## 1. Architecture

Two layers added, both additive:

1. **Resolver layer (pure, always on):** `src/lib/contentRegistry.ts` — the one
   place that normalizes any historical string (`"DGCA CPL"`, `"dgca-cpl"`,
   `"A320"`, `"Boeing 737"`) into a canonical id. `getPrimaryTrackFamily` (the
   existing choke point used by `navigationConfig`, `missionConfig`,
   `dashboardConfig`) now delegates here, so every consumer is canonical with no
   per-file edits. Pure + synchronous; no DB, works offline + in tests.
2. **Registry layer (DB, flag-gated):** new Postgres tables + a hidden admin CRUD
   page behind the `contentRegistry` flag (OFF). Metadata-only seed (programs,
   certifications, aircraft, draft subjects). No questions.

Nothing reads the DB registry on the hot path. The resolver uses static maps
mirrored from the registry, so production runs identically whether the flag /
migrations are present or not.

---

## 2. ERD (Phase 1 delta)

```
programs ──< program_certifications >── certifications ──< certification_aircraft >── aircraft
                                              │
                                              └──< course_subjects >── subjects (existing)
                                                                          │
exams (existing) ──< exam_subjects >── subjects                           └──< subject_modules >── subcategories (existing)
                                                                                                        │
topics (new) ──< module_topics >── subcategories                                                        │
   │                                                                                                    │
   └──< topic_questions >── questions (existing) ───────────────────────────────────────────────────────┘
```
New tables: `programs`, `certifications`, `aircraft`, `topics` (registry) +
`program_certifications`, `certification_aircraft`, `course_subjects`,
`subject_modules`, `module_topics`, `topic_questions`, `exam_subjects` (relations).
Existing tables and their JSON arrays (`exams.subject_ids`, `questions.topic_tags`)
are **untouched**.

---

## 3. Migration summary

| File | Contents |
|---|---|
| `supabase/migrations/20260627120000_phase1_content_registry.sql` | 4 registry + 7 relation tables, indexes, `touch_registry_updated_at` trigger, RLS (published-read/admin-write for registries; public-read/admin-write for relations). Idempotent `create … if not exists`. Manual ROLLBACK block at end. |
| `supabase/migrations/20260627120100_phase1_registry_seed.sql` | Registers `contentRegistry` flag = false (only if absent). Seeds programs (DGCA/FAA/EASA/Type Rating/Airline Recruitment), certifications (PPL/CPL/ATPL/RTR, FAA PPL/CPL/ATP, EASA ATPL, 7 type ratings, recruitment), aircraft (A320/A330/A350/ATR72/B737NG/B737MAX/B777/B787), their links, and a **draft** subject skeleton + `course_subjects` (DGCA carry-over CPL⊂ATPL). All `ON CONFLICT DO NOTHING`. No questions, no topics content. |

**Not yet applied to the live DB** — additive and safe to apply anytime; subjects
seed is `draft` so it never surfaces to the public read path.

---

## 4. Indexes
`idx_programs_status`, `idx_certifications_status`, `idx_aircraft_status`,
`idx_topics_status` (status+sort_order), plus FK-covering:
`idx_progcert_cert`, `idx_certac_aircraft`, `idx_course_subjects_subject`,
`idx_subject_modules_module`, `idx_module_topics_topic`,
`idx_topic_questions_question`, `idx_exam_subjects_subject`.

---

## 5. Registry diagram (canonical id system)

```
historical string ─► normalizeKey() ─► CERT_SET / CERT_ALIASES ─► CanonicalId | null
  "DGCA CPL"              dgca-cpl            (exact)                 "dgca-cpl"
  "A320"                  a320               (alias)                 "type-a320"
  "Boeing 737"            boeing-737         (alias)                 "type-b737"
  "General Study"         general-study      (miss)                  null
                                   │
        ┌──────────────────────────┼─────────────────────────────┐
        ▼                          ▼                              ▼
   familyOf()              aircraftOf()                 resolveLearningScope()
   → TrackFamily           → aircraft id                → {program,cert,aircraft,
                                                           family,career,subjects}
```

---

## 6. Adapter diagram (backward compatibility)

```
LEGACY (unchanged, still works)              NEW canonical layer
─────────────────────────────               ───────────────────
profiles.target_exam  "DGCA CPL" ─┐
profiles.career_objective         ├─► getPrimaryTrackFamily() ──► familyOf() ──► resolveContentId()
trainingPaths.resolveTargetExam   ┘        (now label-safe)             (single source of truth)
                                                  │
navigationConfig / missionConfig /  ◄─────────────┘  (consume the same delegated resolver)
dashboardConfig / Today / Modules /
Mission Engine / Analytics
```
The string column `target_exam` is **not** changed or migrated. Old writers/readers
keep working; the resolver simply interprets their strings canonically. A future
phase populates `enrollments` and demotes `target_exam` to a mirror.

---

## 7. Backward-compatibility matrix

| Surface | Before | After | Behaviour change |
|---|---|---|---|
| `getPrimaryTrackFamily("dgca-cpl")` | `"dgca"` | `"dgca"` | none |
| `getPrimaryTrackFamily("DGCA CPL")` | **`null` (bug)** | `"dgca"` | **fixed** (improvement) |
| `getPrimaryTrackFamily("airline-recruitment")` | `null` | `null` | none (contract preserved) |
| navigationConfig / missionConfig / dashboardConfig | token-only | label+token | strictly more correct |
| `target_exam` column reads/writes | string | string | none |
| `career_objective` | string | string | none |
| trainingPaths config + onboarding | works | works | none |
| Public content read (subjects/questions) | published-only | published-only | none (seed is draft) |
| Admin nav | unchanged | unchanged | none (registry pages unlinked) |
| `/admin/registry/*` | 404 | flag-gated page (OFF ⇒ notice) | none in prod (flag OFF) |

---

## 8. Performance impact
- Resolver is O(1) map lookups, pure, no I/O — zero hot-path cost; replaces ad-hoc
  `startsWith` chains.
- DB registry reads (`fetchRegistry`) are **cached once per entity per session**
  (`contentRegistryDb.ts`); admin-only, off the student hot path → no N+1.
- New tables are empty in prod until used; indexes are cheap; build output
  unchanged in size (resolver is a few KB, lazy admin page is its own chunk).
- `vite build` succeeds; no bundle regressions.

---

## 9. Rollback procedure
1. **Flag:** set `app_settings.flags.contentRegistry = false` (already default) →
   admin pages inert.
2. **Code:** revert the commit. `getPrimaryTrackFamily` returns to token-only
   (re-introduces the label bug, but no crash); resolver/admin files are new and
   self-contained.
3. **DB:** run the ROLLBACK block at the foot of
   `20260627120000_phase1_content_registry.sql` (drops the 11 new tables + the
   trigger function). Existing tables/data are never touched, so rollback is total
   and lossless. The seed migration only inserted new rows / a flag key — harmless
   if left.

---

## 10. Known limitations
- `resolveLearningScope().subjectScope` uses a **static** subject map for now;
  Phase 2 sources it from `course_subjects`.
- Registry tables are seeded with **metadata only** — no modules/topics/questions
  and no link from existing live `subjects` content to the new `course_subjects`
  beyond the seeded DGCA skeleton.
- `target_exam` is still the live source of a user's track (mirrored, not yet
  replaced by `enrollments`).
- The admin RegistryManager is intentionally minimal (CRUD + archive); no
  drag-ordering UI yet (uses the `sort_order` field directly).
- Playwright regression was **not executed in this session** (the only runtime
  behaviour change is the label-bug fix, covered by a unit regression test, and
  the registry is flag-gated OFF / unlinked). Recommended as a pre-merge manual
  gate: onboarding · /today · /modules · mission engine · /analytics · /admin on
  desktop + 393×852, expecting no diff.

---

## 11. Future Phase 2 integration
- Populate `course_subjects` / `subject_modules` / `module_topics` from real
  content; switch `resolveLearningScope.subjectScope` to registry-backed reads.
- Seed static content (`staticQuestions`/`topics`/`staticExams`) into DB as draft;
  make `content.ts` DB-first.
- Introduce `learning_profiles` + `enrollments`; have onboarding write enrollments
  and mirror `target_exam`.
- Expand the admin CMS (tree view, drag-order, import pipeline) behind
  `contentCms` / `contentImport` flags.

---

## 12. Files changed (this phase)

**New**
- `supabase/migrations/20260627120000_phase1_content_registry.sql`
- `supabase/migrations/20260627120100_phase1_registry_seed.sql`
- `src/lib/contentRegistry.ts` (pure resolver)
- `src/lib/contentRegistryDb.ts` (cached DB reads)
- `src/views/admin/RegistryManager.tsx` (hidden, flag-gated CRUD)
- `tests/unit/contentRegistry.test.ts` (16 tests; incl. label-bug regression)

**Edited (additive)**
- `src/data/trainingPaths.ts` — `getPrimaryTrackFamily` delegates to `familyOf`
- `src/hooks/useFeatureFlags.tsx` — `contentRegistry: false` + FlagKeys
- `src/views/admin/featureRegistry.ts` — registry entry for the flag
- `src/App.tsx` — lazy import + 2 flag-gated admin routes

**Untouched on purpose:** all existing tables, `target_exam`/`career_objective`,
the three config files (`navigationConfig`/`missionConfig`/`dashboardConfig` — they
already route through `getPrimaryTrackFamily`), static content files.

---

## Success criteria
✅ Registry tables exist (migration) ✅ Canonical IDs replace scattered strings
✅ Label/token bug eliminated (+ regression test) ✅ Backward compatibility preserved
✅ No UI regressions (161 tests, build OK) ✅ No question migration ✅ No content upload
✅ Feature flagged (`contentRegistry` OFF)

**Phase 1 complete. Phase 2 NOT started — awaiting approval.**
