# Phase 9 Pre-Implementation Audit

**Date:** 2026-06-28  
**Scope:** Every consumer that decides WHAT content a student studies

---

## Architecture Overview

All content selection flows through a single canonical resolver chain:

```
resolveActiveLearningContext()      ← async, reads enrollments/profiles/legacy
        ↓
resolveContentScope()               ← pure sync, Cert+Aircraft → Subject set
        ↓
enrichContentScope()                ← async, 10-min cache, adds DB modules/topics
        ↓
ContentScope { subjects[], eligibleSubjectIds, hasContent }
        ↓
All consumers gate on scope.eligibleSubjectIds
```

---

## Consumer Map

### 1. Mission Engine (`useActiveMission`)
- **File:** `src/hooks/useActiveMission.ts:116–118`
- **Flag:** `missionEngine` + `contentDeliveryEngine`
- **Input:** `ContentScope`, mastery snapshots, daily goal
- **Decision:** `deriveEngineMissionFromScope(scope)` → weakest eligible subject → drill mission
- **Output:** `EngineMissionDraft` (subjectId, questionCount, difficulty, launchRoute)

### 2. TodayView
- **File:** `src/views/TodayView.tsx`
- **Flags:** `missionEngine`, `aiStudyScheduler`, `learningHierarchy`, `xpSystem`, `examReadinessDashboard`, `adaptiveRegen`, `masteryAnalytics`, `predictiveIntelligence`
- **Input:** user auth, progress stats, mastery snapshots, exam readiness
- **Decision:** Tile rendering order; `RecommendedFocus` card picks next subject
- **Output:** Study tiles prioritized on screen

### 3. Continue Learning (`useContinueLearning`)
- **File:** `src/hooks/useContinueLearning.ts`
- **Input:** `subjects[]`, `masteryMap: Record<string, number>`, `useLearningProgress()`
- **Decision:** Sort active subjects by mastery ascending → first module with unanswered questions
- **Priority Logic:** weakest mastery first → first incomplete module → fallback to review
- **Output:** `{ subjectTitle, moduleId, moduleTitle, questionsRemaining, url }`
- **Gap:** Ignores SM-2 review due dates (known debt from Phase 8.1)

### 4. CourseView
- **File:** `src/views/CourseView.tsx`
- **Flag:** `contentDeliveryEngine`, `learningHierarchy`
- **Input:** `scope.eligibleSubjectIds`, `learningProgress.modules`
- **Decision:** Filters subjects to scope; shows completion stats
- **Output:** Hierarchy display (no active recommendation)

### 5. ModulesView
- **File:** `src/views/ModulesView.tsx`
- **Flag:** `contentDeliveryEngine`, `learningHierarchy`
- **Input:** `scope.eligibleSubjectIds`
- **Decision:** Filters module grid to scope
- **Output:** Module cards (no active recommendation)

### 6. QuizView / Quiz Launcher
- **File:** `src/views/QuizView.tsx`
- **Input:** `topicId` (URL param), `useContentScope()`
- **Decision:** `getEligibleTopicQuestions(scope, topicId)` — scope-filtered questions
- **Output:** Question set for active quiz session

### 7. Mock Exams / Adaptive Mock
- **File:** `src/views/MockExamsView.tsx`, `src/views/ExamCentreView.tsx`
- **Input:** `scope`, `useExamReadiness()`, `usePredictiveIntelligence()`
- **Decision:** `getEligibleExams(scope, exams)` — filters to eligible exam papers
- **Output:** Available mock exam grid

### 8. Review Queue (Spaced Repetition)
- **File:** `src/lib/spacedRepetition.ts` → `getDueQuestionIds(userId)`
- **Flag:** `spacedRepetition`
- **Input:** `user_question_attempts` (SM-2 state)
- **Decision:** Due questions by next_review_date
- **Gap:** NOT scope-aware — reviews any question the user has seen, even if out of current enrollment scope

### 9. Bookmarks
- **File:** `src/views/BookmarksView.tsx`
- **Input:** `scope.eligibleSubjectIds`
- **Decision:** `getBookmarkedQuestionsWithScopeInfo()` — separates in-scope vs out-of-scope bookmarks
- **Output:** Filtered bookmark list + practice session

### 10. Mistake Analysis
- **File:** `src/hooks/useMistakeAnalysis.ts`
- **Flag:** `advancedTesting`
- **Input:** `scope.eligibleSubjectIds`, wrong answers from `user_question_attempts`
- **Decision:** Filters mistakes to scope; groups by subject/topic
- **Output:** Mistake patterns in ExamCentreView

### 11. AI Study Plan / Study Planner
- **File:** `src/lib/missionService.ts:88` → `regeneratePlan()`
- **Flag:** `aiStudyScheduler`, `coachContextEnrichment`
- **Input:** mastery scores, streak, mission rate, exam date
- **Decision:** POST `/api/instructor/coach` → JSON plan → `materializePlan()` → `study_missions` rows
- **Output:** Scheduled missions for next N days

### 12. Adaptive Regen (`useAdaptiveRegen`)
- **File:** `src/hooks/useAdaptiveRegen.ts`
- **Flag:** `adaptiveRegen`
- **Input:** mastery snapshots, last regen timestamp (localStorage), cooldown
- **Decision:** `shouldRegen` = mastery drift detected + cooldown passed
- **Output:** Triggers `regeneratePlan()` + shows `AdaptiveRegenBanner`

### 13. Predictive Intelligence (`usePredictiveIntelligence`)
- **File:** `src/hooks/usePredictiveIntelligence.ts`
- **Flag:** `predictiveIntelligence`
- **Input:** `subjectsCount`, mastery snapshots, exam readiness
- **Decision:** Computes pass probability, at-risk subjects, success forecast
- **Output:** `PassProbabilityCard`, `AtRiskSubjectsCard`, `SuccessForecastCard`

---

## Gaps / Architecture Issues

1. **Review Queue not scope-aware** — `getDueQuestionIds()` reviews all seen questions regardless of enrollment. Low priority: SM-2 is additive, out-of-scope reviews don't harm the student.

2. **Continue Learning ignores SM-2 due dates** — sorts only by mastery, not by review urgency. Known debt from Phase 8.1. Phase 9 adaptive engine should subsume this.

3. **No unified priority signal** — each consumer picks its own heuristic (weakest mastery, due count, readiness band). Phase 9 `adaptiveLearningEngine` provides a single ranked recommendation.

4. **`learningHierarchy` has no gate on `contentDeliveryEngine`** — if CDE is OFF, hierarchy UI shows but progress is unscoped. Known debt from Phase 8.1.

5. **AI coach endpoint not scope-checked** — `/api/instructor/coach` generates plans based on target_exam (legacy), not ContentScope. Risk: regenerated plan may include subjects outside current enrollment.

---

## No Architectural Blockers Found

All consumers read from `ContentScope` or mastery data. Phase 9 adaptive engine can sit **above** the scope layer and produce recommendations that are already scope-filtered. Safe to proceed.

---

## Phase 9 Data Available Without New DB Calls

| Signal | Source | Already in Hooks |
|--------|--------|-----------------|
| Eligible subjects | `ContentScope.subjects[]` | `useContentScope()` |
| Module progress | `LearningProgress.modules` | `useLearningProgress()` |
| Subject mastery % | `mastery_snapshots` | `useMasterySnapshots()` |
| Exam readiness band | derived from mastery | `useExamReadiness()` |
| Review due count | `getDueQuestionIds()` | TodayView state |
| Mission state | `useActiveMission()` | TodayView |
| XP + rank + streak | `useXp()` | TodayView |
| Study hours | logbook | `useLogbook()` |
| Mastery trend | 8-week history | `useMasteryHistory()` |

All inputs are already fetched in TodayView. `useAdaptiveLearning()` will be a pure derived computation — no additional DB calls.
