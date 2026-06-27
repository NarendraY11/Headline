# Phase 2 — Learning Profile + Enrollments + Active Learning Context

**Date:** 2026-06-27
**Status:** IMPLEMENTED (additive, flag-gated `learningContext` OFF, migration not yet applied to prod).
**Predecessors:** Phase 0.5 plan, Phase 1 implementation.
**Verification:** `tsc --noEmit` 0 errors · 172/172 unit tests pass · `vite build` OK.

> Phase 2 replaces the single-track `profiles.target_exam` string with a real
> learning model: one `learning_profiles` row per user + many `enrollments`
> (exactly one active, DB-enforced). The active context resolver falls back to
> `target_exam` so production is unchanged. No production page is switched —
> data only. Phase 1 is untouched.

---

## 1. Architecture

```
                       resolveActiveLearningContext(userId, legacy)
                                       │  read chain (best-effort, never throws)
        ┌──────────────────────────────┼──────────────────────────────┐
        ▼                               ▼                              ▼
  active enrollment            learning_profiles               legacy target_exam
  (enrollments.is_active)      preferred_certification_id      (profiles.target_exam)
        │                               │                              │
        └───────────────► buildActiveLearningContext() (PURE) ◄────────┘
                                       │
                          ActiveLearningContext { source, program, cert,
                            aircraft, family, careerObjective, subjectScope }
                                       │
                          useLearningContext()  ──► (future) Today, Modules,
                                                     Mission Engine, Mock, Search,
                                                     Analytics, import, admin preview
```

- **Pure core** `src/lib/learningContext.ts` — no supabase import; offline + test friendly; reuses the Phase 1 canonical resolver.
- **DB layer** `src/lib/learningContextDb.ts` — async read chain, onboarding dual-write, admin ops.
- **Hook** `src/hooks/useLearningContext.ts` — seeds with the synchronous legacy context so it is never null; resolves async. Data only.

---

## 2. ERD (Phase 2 delta)

```
auth.users
   │ 1                         1 │
   ▼                             ▼
learning_profiles            enrollments
 user_id PK                   id PK
 preferred_program_id  ──┐    user_id  ─────────────┐ (many per user)
 preferred_certification_id│  program_id       ──► programs.slug
 preferred_aircraft_id  ──┤   certification_id ──► certifications.slug  (NOT NULL)
 career_objective         │   aircraft_id      ──► aircraft.slug
 experience_level         │   status (active|paused|completed|archived)
 learning_preferences j   │   is_active  ── UNIQUE(user_id) WHERE is_active
 timezone, metadata       │   started_at / completed_at
                          └─► programs.slug      progress_snapshot jsonb, metadata jsonb
                              certifications.slug
                              aircraft.slug
profiles.target_exam / career_objective  ── compat mirror (UNCHANGED)
```
FKs reference the **registry by slug** (the Phase 1 canonical id), so onboarding
inserts the slug it already resolves and the pure resolver needs no join.

---

## 3. Learning Profile diagram

```
user picks Program + Certification + Aircraft + Career goal (onboarding)
                         │  (flag learningContext ON)
                         ▼
   syncLearningModel(userId, { targetExam, careerObjective })
     ├─ upsert learning_profiles (preferred_program/cert/aircraft, career, experience)
     ├─ deactivate any current active enrollment
     └─ upsert + activate enrollment(certification_id)
                         │  (always, both flag states)
                         ▼
   updateUserData writes profiles.target_exam + career_objective (compat mirror)
```

---

## 4. Enrollment lifecycle

```
            create (admin: inactive)         onboarding/sync: active
                    │                                 │
   ┌─────────┐ activate  ┌──────────┐ pause   ┌──────────┐ complete ┌────────────┐
   │ (none)  │──────────►│  active  │────────►│  paused  │─────────►│ completed  │
   └─────────┘           └────┬─────┘         └────┬─────┘          └────────────┘
                              │ activate another    │ activate
                              ▼ (deactivates this)  ▼
                         one-active rule enforced by uniq_active_enrollment_per_user
   archived = soft delete (status='archived', is_active=false)
```
- DB guarantees **≤ 1 active enrollment per user** (partial unique index).
- `enforce_enrollment_integrity` trigger: `user_id`/`created_at` immutable on update; `completed_at` auto-stamped/cleared by status.

---

## 5. Compatibility matrix

| Surface | Flag OFF (prod today) | Flag ON | Notes |
|---|---|---|---|
| `profiles.target_exam` | written as before | written as before + mirrored | never removed |
| `profiles.career_objective` | written as before | same | never removed |
| Onboarding persistence | target_exam only | target_exam **+** learning_profile + active enrollment | dual-write best-effort, non-blocking |
| `resolveActiveLearningContext` | returns `legacy` context | returns `enrollment`/`profile`/`legacy` | never throws |
| `useLearningContext()` | legacy context | active-enrollment context | data only; no page switched |
| `/learning-context` | gated notice | read-only context page | no nav link |
| `/admin/registry/enrollments` | gated notice (needs `contentRegistry`) | CRUD ops | no nav link |
| Existing pages (Today/Modules/Mission/Analytics) | unchanged | unchanged | not switched in Phase 2 |
| Phase 1 resolver / registry | unchanged | unchanged | not modified |

---

## 6. Migration order
1. Phase 1 migrations (registry + seed) — prerequisite (provides programs/certifications/aircraft slugs the enrollment FKs reference).
2. `20260627130000_phase2_learning_profiles_enrollments.sql` — learning_profiles, enrollments, one-active index, triggers, RLS, `learningContext` flag = false.

Both additive + idempotent. **Not yet applied to the live DB**; safe to apply
anytime. Onboarding dual-write is no-op until the flag is ON, so applying the
migration alone changes nothing user-facing.

---

## 7. Rollback
1. Flag `learningContext = false` (default) → dual-write + hidden pages inert.
2. Revert the commit (new files self-contained; the only edit to an existing
   file is the flag-gated `syncLearningModel` call in `OnboardingFlow` + the flag
   entries).
3. DB: `drop table enrollments, learning_profiles cascade; drop function
   enforce_enrollment_integrity();` (ROLLBACK block in the migration). `profiles`
   untouched → lossless.

---

## 8. Tests (`tests/unit/learningContext.test.ts`, 11)
single enrollment · type-rating aircraft resolution · multiple enrollments (active
picked) · active-flag switching · learning-profile fallback · legacy target_exam
fallback (label form) · enrollment-precedence-over-profile-and-legacy · no-context
'none' · `targetExamForEnrollment` compat mirror · `pickActiveEnrollment` edge
cases. All pure (no DB). Total suite: 172 pass.

---

## 9. Known limitations
- `subjectScope` is still the static Phase 1 map; registry-backed `course_subjects`
  reads land in Phase 3.
- No production page consumes `useLearningContext()` yet (deliberate — data only).
- Admin enrollment create inserts **inactive** (admin activates explicitly) to
  respect the one-active rule; no bulk tools.
- Onboarding UI unchanged; only persistence extended (flag-gated).
- Playwright not executed this session — the only runtime change is the
  flag-gated dual-write (OFF in prod) and two unlinked gated pages; pure-logic
  fallback is unit-covered. Recommended pre-merge manual gate: onboarding · today ·
  modules · mission engine · settings · profile on desktop + 393×852, expecting no
  diff with the flag OFF.

---

## 10. Future Phase 3 integration
- Switch `buildActiveLearningContext.subjectScope` to read `course_subjects` for the
  active certification.
- Begin consuming `useLearningContext()` in Today/Modules/Mission Engine behind a
  rollout flag (start replacing `getPrimaryTrackFamily(target_exam)` call sites).
- Add enrollment switching UI to `/learning-context` (user-facing) and surface it in
  settings nav.
- Seed static content into the DB and link it via the registry relations.

---

## 11. Files (this phase)

**New**
- `supabase/migrations/20260627130000_phase2_learning_profiles_enrollments.sql`
- `src/lib/learningContext.ts` (pure builder + fallback chain)
- `src/lib/learningContextDb.ts` (async resolver + sync + admin ops)
- `src/hooks/useLearningContext.ts`
- `src/views/LearningContextView.tsx` (hidden settings page)
- `src/views/admin/EnrollmentsAdmin.tsx` (hidden admin ops)
- `tests/unit/learningContext.test.ts` (11 tests)

**Edited (additive)**
- `src/views/OnboardingFlow.tsx` — flag-gated `syncLearningModel` after target_exam write
- `src/hooks/useFeatureFlags.tsx` — `learningContext: false` + FlagKeys
- `src/views/admin/featureRegistry.ts` — registry entry
- `src/App.tsx` — 2 lazy imports + 2 routes (`/learning-context`, `/admin/registry/enrollments`)

**Untouched on purpose:** `profiles` schema, `target_exam`/`career_objective`,
Phase 1 files, the three nav/mission/dashboard configs, all existing pages.

---

## Success criteria
✅ Learning Profiles added ✅ Enrollments added ✅ Multiple enrollments supported
✅ One active enrollment enforced (DB unique index) ✅ Backward compatibility preserved
✅ Onboarding persists new model (flag-gated) ✅ No production UI changes
✅ Feature flag OFF (`learningContext`)

**Phase 2 complete. Phase 3 NOT started — awaiting approval.**
