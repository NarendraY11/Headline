# Phase 9 — Adaptive Learning Engine: Implementation

**Date:** 2026-06-28  
**Flag:** `adaptiveLearning` (OFF by default, admin-only)  
**Status:** Shipped on main, flag OFF

---

## Architecture

```
DB / Hooks (existing, no new queries)
  │
  ├─ useContentScope()       → ContentScope
  ├─ useLearningProgress()   → LearningProgress (RPC)
  ├─ useMasterySnapshots()   → MasterySnapshot[] → masteryMap
  ├─ useXp()                 → xpBalance, xpRank
  ├─ useUserProgress()       → progressStats (streak, accuracy)
  └─ getDueQuestionIds()     → reviewDueCount
       │
       ▼
  useAdaptiveLearning(params)   [src/hooks/useAdaptiveLearning.ts]
  └─ computeAdaptiveOutput(input)   [src/lib/adaptiveLearningEngine.ts — PURE]
         │
         ├─ scoreCandidates()      → ranked modules by priority
         ├─ computeReadiness()     → ReadinessScore 0–100
         ├─ computeStudyHealth()   → StudyHealth Green/Yellow/Red
         └─ computeExamReadiness() → ExamReadiness Ready/Needs Review/At Risk
              │
              ▼
         AdaptiveOutput
              │
         ┌───┴─────────────────────────────┐
         ▼                                 ▼
  AdaptiveLearningCard               ReadinessPanel
  (TodayView — flag ON)              (CourseView — flag ON)
```

---

## Recommendation Flow

1. Input assembled in `useAdaptiveLearning` from existing hooks
2. `computeAdaptiveOutput(input)` called synchronously (pure function, no I/O)
3. `scoreCandidates()` iterates scope subjects × scope modules, assigns priority score
4. Top-scoring candidate becomes `recommendation`
5. Downstream: `computeReadiness()`, `computeStudyHealth()`, `computeExamReadiness()` computed from same input

---

## Priority Model

Priority ladder (first match wins for a given module):

| Priority | Trigger | Weight |
|----------|---------|--------|
| 1 | Review Due | 100 + reviewDueCount |
| 2 | Weak Module | 80 + (40 - mastery) |
| 3 | Mission Required | 70 + questionsRemaining |
| 4 | Exam Proximity | 60 + (7 - daysLeft) |
| 5 | Continue Learning | 50 + (80 - mastery) |
| 6 | New Content | 40 + (10 - subject.priority) |
| 7 | Reinforce | 30 + (80 - mastery) |
| 8 | Random Practice | 10 |

### Weight Table

```ts
export const PRIORITY_WEIGHTS = {
  reviewDue: 100,
  weakModule: 80,
  missionRequired: 70,
  examProximity: 60,
  continueLearning: 50,
  newContent: 40,
  reinforce: 30,
  randomPractice: 10,
};
```

### Thresholds

| Constant | Value | Meaning |
|----------|-------|---------|
| `WEAK_THRESHOLD` | 40% | Below = weak module |
| `REINFORCE_THRESHOLD` | 80% | Below = reinforce |
| `URGENT_DAYS` | 7 | Days to exam = priority boost |
| `MIN_QUESTIONS_FOR_MASTERY` | 3 | Minimum attempts before mastery is meaningful |

---

## Scoring

### Readiness Score (0–100)

Weighted sum of 7 factors + weak area penalty:

| Factor | Weight | Source |
|--------|--------|--------|
| Coverage | 20% | answered / (modules × 50) |
| Mastery | 25% | avg masteryMap across scope subjects |
| Review Health | 15% | 100 - min(100, reviewDue × 5) |
| Mission Completion | 10% | 100 - questionsRemaining |
| Consistency | 10% | min(100, streak × 4) — 25-day streak = 100% |
| Accuracy | 15% | avg correct/answered across modules |
| Recent Activity | 5% | 100 if streak>0, 50 if xp>0, 0 otherwise |
| Weak Area Penalty | — | -5 per subject below WEAK_THRESHOLD |

### Study Health (Green/Yellow/Red)

| Status | Conditions |
|--------|-----------|
| Red | >10 reviews overdue OR exam ≤7 days with avg mastery <70% OR >2 weak subjects |
| Yellow | 1+ reviews pending OR streak=0 OR 1–2 weak subjects |
| Green | No red/yellow conditions AND streak ≥7 |

### Exam Readiness (Ready / Needs Review / At Risk)

| Status | Condition |
|--------|-----------|
| Ready | avg mastery ≥80% AND remainingSubjects=0 |
| Needs Review | avg mastery ≥50% OR remainingSubjects ≤30% of total |
| At Risk | otherwise, or projected completion after exam date |

---

## Fallback Chain

1. `adaptiveLearning` flag OFF → `useAdaptiveLearning` returns `EMPTY_OUTPUT`; TodayView falls back to `ContinueLearningCard`
2. `scope.hasContent = false` → `computeAdaptiveOutput` returns empty recommendation with `reason: "randomPractice"` and score 0
3. No mastery data → coverage/mastery factors = 0; health = yellow (inactive); readiness = at-risk
4. No enrollment → scope = EMPTY_SCOPE → all outputs degrade to 0/unknown safely

---

## Performance

- **Zero new DB calls** — all data from existing hooks (useLearningProgress RPC, useMasterySnapshots, useUserProgress)
- Engine is a pure sync function; no async in hot path
- `useLearningProgress` already memoized by user ID
- `useMasterySnapshots` already cached
- `useAdaptiveLearning` output wrapped in `useMemo` — only recomputes when inputs change

---

## Files Changed

| File | Change |
|------|--------|
| `src/hooks/useFeatureFlags.tsx` | + `adaptiveLearning` flag key + default |
| `src/views/admin/featureRegistry.ts` | + `adaptiveLearning` feature definition (Learning Features) |
| `src/lib/adaptiveLearningEngine.ts` | NEW — pure engine (Steps 2–6) |
| `src/hooks/useAdaptiveLearning.ts` | NEW — React hook (Step 7) |
| `src/views/today/AdaptiveLearningCard.tsx` | NEW — Today display component (Step 8) |
| `src/views/course/ReadinessPanel.tsx` | NEW — Course readiness panel (Step 9) |
| `src/views/TodayView.tsx` | + import + hook call + conditional render (Step 8) |
| `src/views/CourseView.tsx` | + import + hook call + ReadinessPanel render (Step 9) |
| `src/lib/adaptiveLearningEngine.test.ts` | NEW — 64 unit tests (Step 13) |
| `docs/PHASE9-AUDIT.md` | NEW — pre-implementation audit (Step 0) |
| `docs/PHASE9-IMPLEMENTATION.md` | NEW — this file (Step 14) |

---

## Rollback

1. Set `adaptiveLearning: false` in `app_settings.flags` (already the default)
2. All existing behavior is unchanged when flag is OFF
3. No DB migrations required — pure client-side engine

---

## Known Limitations / Future Hooks

1. **Mission not wired** — `useActiveMission()` not called at TodayView level; `mission: null` passed to adaptive hook → mission state not factored into recommendation. Future: hoist `useActiveMission` to TodayView or pass via prop.

2. **Topics not resolved** — `recommendation.nextTopicId` always null; topics need `EnrichedContentScope.topics[]` to resolve. Future: use `enrichedScope.topics` once seeded.

3. **SM-2 due dates not integrated** — `reviewDueCount` is a count, not a subject-level signal; weak-subject priority from reviews is blended. Future: pass due question IDs per subject for finer-grained prioritization.

4. **Module answered map** — `moduleAnsweredMap` built from `learningProgress.modules` (same as `answered` field). Redundant — simplify by reading directly from `learningProgress.modules`.

5. **Exam date source** — uses `userData.nextExam` string (legacy field). Future: source from enrollment's target exam date once ContentRegistry is live.

6. **`studyVelocity` estimation** — simple heuristic (completed modules / weeks of streak). Future: compute from `xp_events` timestamps for true velocity.
