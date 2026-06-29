# Phase 9.6 — Production Readiness & Hidden Feature Audit (2026-06-29)

Read-only audit. No code modified. Resume point before Phase 10.

## HEADLINE FINDING
Premise "features hidden behind OFF flags" is FALSE in production.
Code defaults in `useFeatureFlags.tsx` = OFF, but live `app_settings.flags` row
OVERRIDES them — ~50 of 60 flags are ON in prod, including every Phase 1–9 feature.

Real gating is NOT flags. Three actual hidden mechanisms:
1. No nav link (flag ON, route exists) — `/course`, `/learning-context` (URL-only)
2. Empty backing tables (flag ON, nav present) — mock_papers=0, topics=0, registry hierarchy=0
3. Infra not deployed (flag ON) — `mission-reminders` edge fn, push (0 subs), reminder cron disabled

Only 7 flags actually OFF in prod: adaptiveRegen, missionScores, advancedTesting,
sm2QualityTiming, announcementBanner, coachContextEnrichment, maintenanceMode.

## PROD FLAG VALUES (live app_settings.flags, 2026-06-29)
ON: blog, qotd, adsense, aiCoach, xpSystem, aiExplain, analytics, freeTrial, mockExams,
proGating, aiPractice, contentCms, flashcards, a320Systems, aiDiagnosis, leaderboard,
offlineMode, pwaEnhanced, signupsOpen, themeToggle, calendarSync, examSeoPages,
sm2Algorithm, vivaPractice, contentImport, cookieConsent, masteryCharts, missionEngine,
notifications, searchEnabled, topicPractice, cockpitLayouts, contentRegistry,
learningContext, offlineMissions, pricingCheckout, referralProgram, weatherBriefing,
adaptiveLearning, aiStudyScheduler, bookmarksEnabled, examReadinessEta, masteryAnalytics,
masterySnapshots, pwaInstallPrompt, spacedRepetition, learningHierarchy, pushNotifications,
contentDeliveryEngine, examReadinessDashboard, predictiveIntelligence
OFF: adaptiveRegen, missionScores, advancedTesting, maintenanceMode, sm2QualityTiming,
announcementBanner, coachContextEnrichment

## 1. HIDDEN FEATURES (flag ON, unreachable)
- /course (CourseView) — NO nav link, URL-only; topics/module_topics/subject_modules=0 rows → renders empty
- /learning-context (LearningContextView) — NO nav link, URL-only; enrollments=2 rows, works
- Adaptive UI — inside /course only
- /missions/history, /mission/complete — in-flow links only
- StudySchedulerView.tsx — ORPHAN, never imported (delete)
- /admin/content-quality — has nav but NO flag gate (siblings gate on contentCms) → inconsistent

## 2. HIDDEN ROUTES (URL-only)
/course, /learning-context = the only two genuine user-facing nav gaps.
Non-existent: /admin/analytics (closest = /admin/users UsersAnalytics).

## 3. FEATURE FLAGS
72 flags in useFeatureFlags.tsx, all 72 in featureRegistry.ts (perfect sync), featureControlSections complete.
DEAD flags (ON in prod, no consumer code, no effect): topicPractice, qotd, spacedRepetition,
pricingCheckout, freeTrial, proGating, vivaPractice, offlineMode, coachContextEnrichment,
pwaEnhanced, offlineMissions → implement gate or remove.
DB-only legacy flags not in registry: blog, adsense, flashcards, examSeoPages, cockpitLayouts,
notifications, announcementText → reconcile.

## 4. SUPABASE
56 public tables, all RLS-on. Empty (0 rows): mock_papers (P0 content gap), topics,
module_topics, subject_modules, topic_questions, exam_subjects, question_groups,
group_questions, topic_groups, study_plans, push_subscriptions, push_delivery_log, referrals.
RPCs: 11 used in code, 7 cron/trigger-only (legit). get_reminder_candidates +
run_mission_reminders exist but not scheduled + target undeployed edge fn (dormant).
cleanup_stale_push_subscriptions = never called.
rate_limits: RLS-on + 0 policies → access via SECURITY DEFINER rl_hit() only (intended).
Storage: ZERO buckets exist (none used).
Edge fns: send-push deployed v5 ACTIVE but never invoked (0 subs);
mission-reminders in repo (supabase/functions/mission-reminders/index.ts) NOT deployed.
Cron (6 active): reset_daily_goals, run_security_sweep(5m), run_ops_sweep(5m),
run_daily_digest(3am), purge_old_logs(monthly), alert_state cleanup(weekly). No reminder cron.

## 5. MIGRATION DRIFT (significant)
Repo supabase/migrations/ = 39 files. Live applied = 85 migrations. Different naming schemes,
do NOT line up. Live = MCP apply_migration auto-timestamps + snake_case. Repo = hand-authored.
Same logical change under different version IDs (content matches, versions don't).
- ~50 live migrations have NO repo file (reconcile_schema_drift, audit_p0/p1/p2_*, pentest_*,
  auth_backfill, backfill_question_subject_ids, atomic_payment_grant_enrollment_study_plan, etc)
- Repo-only NEVER applied: 20260629120000_capture_rl_hit_broadcast_drift.sql — objects already
  live via 20260607093325_shared_rate_limiter + 20260607093528_broadcast_notification_fn. REDUNDANT.
  (Memory note "rl_hit/broadcast in no migration" is now STALE — they ARE versioned in live.)
- `supabase db push` from repo would fail (39 unknown versions → duplicate-object errors).
RECOMMENDATION: baseline/squash — dump live schema as single baseline, archive 39 files,
delete capture-drift. Do NOT db push before reconciling.

## 6. LOOSE SQL
schema.sql, migration.sql, migration-rls-ownership-hardening.sql, migration-admin-notifications.sql,
seed-admin.sql, supabase-analytics-rpc.sql — all already applied to live; documentation only.
No pending SQL except redundant capture-drift migration.

## 7. NAVIGATION GAPS
Only 2: /course, /learning-context need nav links. Admin nav complete (post #120).
Search palette covers modules+mock exams only (could extend, optional).

## 8. ADMIN WORKFLOW
Import→CMS→Quality→Publish→Student. All admin legs connected.
BREAK at student delivery: /course hierarchy tables empty + no nav link. publish→student leg broken.

## 9-10. ACTION CHECKLIST
SAFE/ALREADY ON: Registry, CMS, Import, Mission, XP, Predictive/Mastery/Readiness, PWA, Analytics, Admin.
MINOR FIXES: add nav for /course + /learning-context; flag-gate /admin/content-quality;
  delete StudySchedulerView.tsx; remove/implement 11 dead flags.
BROWSER VERIFY (deferred, needs explicit GO — flips live flag state): /course render w/ content,
  scheduler plan generation, adaptive flow e2e. NOT done yet (didn't flip flags / drive browser).
DB/INFRA WORK: seed hierarchy tables → unblock /course; author mock_papers (P0);
  deploy mission-reminders edge fn + VAPID + enable reminder cron OR flip pushNotifications OFF.
KEEP OFF: advancedTesting, maintenanceMode, sm2QualityTiming, adaptiveRegen, missionScores.
REMOVE/REFACTOR: capture-drift migration; migration squash/baseline; coachContextEnrichment flag.

## TOP 3 RISKS (not flags)
1. Migration drift — repo≠live, no clean push path. Squash before Phase 10.
2. pushNotifications ON but infra absent — flag lies about capability.
3. Content starvation — /course + mock exams enabled but empty; publish→student broken.

## NOT DONE (next session candidates)
- Browser verification of hidden features (needs GO)
- Migration squash/baseline (needs GO)
- Nav link additions, flag-gate fix, orphan delete (code changes, need GO)
- Seed hierarchy + author mock papers (content + DB work)

Live project ref: iwamrscqmedyklafiqvu. Domain: www.heading380.in.
