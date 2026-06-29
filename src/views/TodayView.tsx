import {
    Bell,
    CalendarRange,
    Clock,
    Compass,
    Flame,
    Play,
    TrendingUp,
    X,
} from "lucide-react";
import { motion } from "motion/react";
import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "../components/Atoms";
import { useAuth } from "../contexts/AuthContext";
import { SubjectItem } from "../data/topics";
import { useFeature } from "../hooks/useFeatureFlags";
import { useLogbook } from "../hooks/useLogbook";
import { fetchMergedSubjects } from "../lib/content";
import { QUIZ_STATE_PREFIX } from "../lib/storageKeys";
import { PageBackground } from "../components/PageBackground";
import { useUserProgress } from "../lib/progress";
import { getScopedDueQuestionIds } from "../lib/spacedRepetition";
import { useContentScope } from "../hooks/useContentScope";
import { useLearningProgress } from "../hooks/useLearningProgress";

import { StreakTile } from "./today/tiles/StreakTile";
import { AnsweredTile } from "./today/tiles/AnsweredTile";
import { ScoreTile } from "./today/tiles/ScoreTile";
import { HoursTile } from "./today/tiles/HoursTile";
import { XpTile } from "./today/tiles/XpTile";
import { CertificationTile } from "./today/tiles/CertificationTile";
import { ContinueModuleTile } from "./today/tiles/ContinueModuleTile";
import { TodayLoader } from "./today/DashboardLoaders";
import { CareerObjectiveMissions } from "./today/CareerObjectiveMissions";
import { ActiveMissionCard } from "./today/ActiveMissionCard";
import { useActiveMission } from "../hooks/useActiveMission";
import { useResolvedExamDate, daysUntilExam } from "../hooks/useResolvedExamDate";
import { TodayMissions } from "./today/TodayMissions";
import { RecentXpActivity } from "./today/RecentXpActivity";
import { TodayAchievements } from "./today/TodayAchievements";
import { useXp } from "../hooks/useXp";
import { TodayStops } from "./today/TodayStops";
import { getPacingData } from "./today/utils";
import { ExamReadinessGauge } from "./today/ExamReadinessGauge";
import { SubjectRanking } from "./today/SubjectRanking";
import { RecommendedFocus } from "./today/RecommendedFocus";
import { AdaptiveRegenBanner } from "./today/AdaptiveRegenBanner";
import { PwaInstallBanner } from "../components/pwa/PwaInstallBanner";
import { MasteryHeatmap } from "./today/MasteryHeatmap";
import { useExamReadiness } from "../hooks/useExamReadiness";
import { computeETA } from "../lib/examReadiness";
import { useMasterySnapshots } from "../hooks/useMasterySnapshots";
import { useAdaptiveRegen } from "../hooks/useAdaptiveRegen";
import { useMasteryHistory } from "../hooks/useMasteryHistory";
import { isPaidActive } from "../lib/plan";
import { trackPlanRebalanced } from "../lib/studyAnalytics";

const MasteryRadar = lazy(() => import("./today/MasteryRadar"));
const PacingChart = lazy(() => import("./today/PacingChart"));
const MasteryTrendGraph = lazy(() => import("./today/MasteryTrendGraph"));

const ChartFallback = () => <div className="w-full h-full min-h-[260px] bg-bg-2 animate-pulse rounded-md" />;
import { WeatherWidget } from "./today/WeatherWidget";
import { ResumeCard } from "./today/ResumeCard";
import { ContinueLearningCard } from "./today/ContinueLearningCard";
import { ReferralWidget } from "./today/ReferralWidget";
import { FlightAlerts } from "./today/FlightAlerts";
import { usePredictiveIntelligence } from "../hooks/usePredictiveIntelligence";
import { useForecastEngine } from "../hooks/useForecastEngine";
import { PassProbabilityCard } from "./today/PassProbabilityCard";
import { AtRiskSubjectsCard } from "./today/AtRiskSubjectsCard";
import { SuccessForecastCard } from "./today/SuccessForecastCard";
import { RecommendedActionsCard } from "./today/RecommendedActionsCard";
import { ForecastDashboard } from "./today/ForecastDashboard";
import { AdaptiveLearningCard } from "./today/AdaptiveLearningCard";
import { useAdaptiveLearning } from "../hooks/useAdaptiveLearning";

export default function TodayView() {
  const { userData, user, loading } = useAuth();
  const weatherBriefingEnabled = useFeature("weatherBriefing");
  const aiStudySchedulerEnabled = useFeature("aiStudyScheduler");
  const missionEngineEnabled = useFeature("missionEngine");
  const learningHierarchyEnabled = useFeature("learningHierarchy");
  const xpSystemEnabled = useFeature("xpSystem");
  const adaptiveLearningEnabled = useFeature("adaptiveLearning");
  // Phase 7.2: XP read substrate hoisted here (hooks rule — cannot live inside
  // the renderTile switch). Internally gated on xpSystem + userId.
  const { balance: xpBalance, events: xpEvents, rank: xpRank, loading: xpLoading } = useXp(50);
  const examReadinessDashboardEnabled = useFeature("examReadinessDashboard");
  const adaptiveRegenEnabled = useFeature("adaptiveRegen");
  const masteryAnalyticsEnabled = useFeature("masteryAnalytics");
  const examReadinessEtaEnabled = useFeature("examReadinessEta");
  const predictiveIntelligenceEnabled = useFeature("predictiveIntelligence");
  const { stats: progressStats } = useUserProgress();
  // Phase 9.2/9.3: single source of truth for learning context + mastery snapshots.
  // scope always resolved (enabled=true) so hoistedScope carries subjects from
  // enrollment/profile even when contentDeliveryEngine flag is OFF.
  // CDE flag controls content display filtering, not context resolution.
  const { scope: hoistedScope } = useContentScope(true);
  const { snapshots: masterySnapshots } = useMasterySnapshots();
  const [subjectsCount, setSubjectsCount] = useState(0);
  // Pass hoisted snapshots — skips internal useMasterySnapshots fetch.
  const examReadiness = useExamReadiness(subjectsCount, masterySnapshots);
  const adaptiveRegen = useAdaptiveRegen();
  // useMasteryHistory called unconditionally; internally gates on flag + userId
  const masteryHistory = useMasteryHistory(8);
  const [notificationStatus, setNotificationStatus] = useState<
    NotificationPermission | "unsupported"
  >("default");
  const [showNotifBanner, setShowNotifBanner] = useState(false);
  const { logbook, loading: logbookLoading } = useLogbook();
  const [subjectsList, setSubjectsList] = useState<SubjectItem[]>([]);
  const [loadingSubjects, setLoadingSubjects] = useState(true);
  const [dueCount, setDueCount] = useState<number>(0);
  // M11: build title map from subjectsList state (empty on first render, fine)
  const subjectTitleMap = useMemo(() => {
    const m: Record<string, string> = {};
    for (const sub of subjectsList) m[sub.id] = sub.title;
    return m;
  }, [subjectsList]);
  // M11: predictive intelligence — pass hoisted snapshots to skip internal fetch.
  const predictive = usePredictiveIntelligence(subjectsCount, subjectTitleMap, masterySnapshots);
  // M11B: forecast engine — pass hoisted snapshots to skip internal fetch.
  const forecastEngine = useForecastEngine(subjectsCount, subjectTitleMap, masterySnapshots);

  // Phase 9.3 T1: full mission result hoisted — ActiveMissionCard receives it as props.
  const {
    mission: hoistedMission,
    completedToday: hoistedCompletedToday,
    loading: missionLoading,
    error: missionError,
    busy: missionBusy,
    generate: missionGenerate,
    resume: missionResume,
    abandon: missionAbandon,
  } = useActiveMission(hoistedScope);

  // Phase 9.3 T2: hoist learning progress — pass to useAdaptiveLearning to skip internal RPC.
  const { progress: hoistedLearningProgress } = useLearningProgress();

  // Phase 9.1 T3: exam date via learning context — pass hoisted scope.
  const resolvedExamDate = useResolvedExamDate(hoistedScope);

  // Phase 9: adaptive learning engine — pass hoisted scope + snapshots + progress.
  const adaptive = useAdaptiveLearning({
    mission: hoistedMission,
    reviewDueCount: dueCount,
    currentXp: xpBalance,
    currentRank: xpRank?.rank?.name ?? "",
    currentStreak: progressStats.streakCount,
    examDate: resolvedExamDate,
    todayMinutesAvailable: userData?.dailyGoal ?? 30,
    scope: hoistedScope,
    snapshots: masterySnapshots,
    learningProgress: hoistedLearningProgress,
  });

  // Phase 8.2A: daily reminder replaced by useEngineReminders via FlightAlerts.
  // The old logic used stale lastActivityDate and fired a generic toast.
  // FlightAlerts uses engine-mission signals only and shows an inline strip.

  useEffect(() => {
    async function fetchDueCount() {
      try {
        // Phase 9.2: reuse hoistedScope (already resolved) instead of calling
        // resolveActiveLearningContext again — eliminates 1 duplicate DB round-trip.
        const uid = user?.id ?? null;
        const ids = await getScopedDueQuestionIds(uid, hoistedScope.eligibleSubjectIds);
        setDueCount(ids.length);
      } catch (err) {
        console.error("Failed loading due count in TodayView:", err);
      }
    }
    fetchDueCount();
  // hoistedScope.eligibleSubjectIds is a Set — stable identity after scope loads
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, hoistedScope.hasContent]);

  useEffect(() => {
    let active = true;
    async function loadSubjects() {
      try {
        const merged = await fetchMergedSubjects();
        if (active) {
          setSubjectsList(merged);
          setSubjectsCount(merged.length);
        }
      } catch (err) {
        console.error("Failed loading subjects in TodayView:", err);
      } finally {
        if (active) setLoadingSubjects(false);
      }
    }
    loadSubjects();
    return () => { active = false; };
  }, []);

  // User configurable tiles
  const [tileOrder, setTileOrder] = useState<string[]>(() => {
    if (userData?.settings?.dashboardTiles) {
      return userData.settings.dashboardTiles;
    }
    try {
      const saved = localStorage.getItem("heading_dashboard_tiles");
      if (saved) return JSON.parse(saved);
    } catch {}
    return ["streak", "answered", "score", "hours"];
  });

  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    if (!("Notification" in window)) {
      setNotificationStatus("unsupported");
    } else {
      setNotificationStatus(Notification.permission);
    }
  }, []);

  useEffect(() => {
    if (userData?.settings?.dashboardTiles) {
      setTileOrder(userData.settings.dashboardTiles);
    }
  }, [userData?.settings?.dashboardTiles]);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const hasAttempts = logbook.length > 0;

  // Show in-app banner first; only call requestPermission() when user taps Enable
  useEffect(() => {
    if (loading || logbookLoading || !hasAttempts || userData?.settings?.doNotDisturb) return;
    const now = new Date();
    const todayStr = now.toISOString().split("T")[0];
    const hasStudiedToday = Array.isArray(logbook)
      ? logbook.some((att: any) => att.dateISO?.startsWith(todayStr))
      : false;
    const dismissed = localStorage.getItem("heading_notif_banner_dismissed") === todayStr;
    if (!hasStudiedToday && now.getHours() >= 12 && notificationStatus === "default" && !dismissed) {
      setShowNotifBanner(true);
    }
  }, [loading, logbookLoading, hasAttempts, notificationStatus, userData?.settings?.doNotDisturb, logbook]);

  const savedDate =
    userData?.nextExam ?? localStorage.getItem("heading_next_exam") ?? "";

  const { daysDiff } = daysUntilExam(savedDate || null);

  const hour = new Date().getHours();
  let greeting = "Good morning";
  let isLate = false;
  if (hour >= 6 && hour < 12) {
    greeting = "Good morning";
  } else if (hour >= 12 && hour < 17) {
    greeting = "Good afternoon";
  } else if (hour >= 17 && hour < 21) {
    greeting = "Good evening";
  } else {
    greeting = "Still flying";
    isLate = true;
  }

  const displayName = user?.displayName || "Captain";

  const [activeSession, setActiveSession] = useState<{
    topicId: string;
    currentIndex: number;
    answeredCount: number;
    status: string;
  } | null>(null);

  const [currentDateString, setCurrentDateString] = useState("");

  useEffect(() => {
    setCurrentDateString(
      new Date().toLocaleDateString("en-US", {
        weekday: "short",
        day: "numeric",
        month: "short",
      })
    );
  }, []);

  useEffect(() => {
    try {
      let found: typeof activeSession = null;
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(QUIZ_STATE_PREFIX)) {
          const val = localStorage.getItem(key);
          if (val) {
            const data = JSON.parse(val);
            if (data && data.status !== "ended" && data.answers) {
              const topicId = key.replace(QUIZ_STATE_PREFIX, "");
              const answered = Object.keys(data.answers).length;
              found = {
                topicId,
                currentIndex: data.currentIndex || 0,
                answeredCount: answered,
                status: data.status
              };
              break;
            }
          }
        }
      }
      setActiveSession(found);
    } catch (e) {
      console.error("Error loading active quiz session:", e);
    }
  }, []);

  if (loading || logbookLoading || loadingSubjects) {
    return <TodayLoader />;
  }

  const totalQuestions = progressStats.totalQuestionsAnswered;
  const avgScore = progressStats.averageScore || 0;
  const hoursStudied = Math.round(
    logbook.reduce((sum, att) => sum + (att.durationSec || 0), 0) / 3600,
  );

  // Weekly hours: last 7 days only
  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - 6);
  weekStart.setHours(0, 0, 0, 0);
  const hoursThisWeek = Math.round(
    logbook
      .filter(att => att.dateISO && new Date(att.dateISO) >= weekStart)
      .reduce((sum, att) => sum + (att.durationSec || 0), 0) / 3600
  );

  const displayedStreak = progressStats.streakCount;

  const uniqueDates = [
    ...new Set(
      logbook.map((att) => att.dateISO?.split("T")[0]).filter(Boolean),
    ),
  ];

  const streakWeek = Array.from({ length: 7 }).map((_, i) => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - (6 - i));
    const dStr = d.toISOString().split("T")[0];
    return {
      dayStr: d.toLocaleDateString("en-US", { weekday: "narrow" }),
      isActive: uniqueDates.includes(dStr),
      isToday: i === 6,
    };
  });

  const masteries = subjectsList.map((sub: any) => {
    const score = progressStats.subjectMastery[sub.id] || 0;
    const mappings: Record<string, string> = {
      "Air Regulation": "Air Reg.",
      Meteorology: "Meteo.",
      "Principles of Flight": "Principles",
      "Aircraft General": "Aircraft",
      "Airbus A320 Systems": "Airbus",
      "Air Navigation": "Air Nav.",
    };
    const title = sub.title;
    const label = mappings[title] || sub.shortName || title;

    return {
      subject: label,
      fullTitle: sub.title,
      score: score,
      correct: score,
      total: 100,
    };
  });

  const subjectMasteries = subjectsList.map((sub) => {
    return (progressStats.subjectMastery[sub.id] || 0) / 100;
  });

  const passedCount = subjectMasteries.filter((m) => m >= 0.8).length;
  const isReadyForExam = subjectMasteries.length > 0 && passedCount === subjectMasteries.length;
  const readinessPercentage = progressStats.masteredSubjectPct;

  const pacingData = getPacingData(savedDate, logbook);

  // Subject id → display title for M8B components (same map built at top via useMemo)

  const isPro = isPaidActive(userData);

  // M9D: velocity + ETA (only when examReadinessEta flag ON)
  const etaWeeks = examReadinessEtaEnabled
    ? computeETA(examReadiness.score, masteryHistory.velocityPerWeek)
    : null;
  const velocityForGauge = examReadinessEtaEnabled
    ? masteryHistory.velocityPerWeek
    : undefined;


  const handleEnableNotifications = async () => {
    if ("Notification" in window) {
      const permission = await Notification.requestPermission();
      setNotificationStatus(permission);
      if (permission === "granted") {
        new Notification("Reminders enabled", {
          body: "You'll get a nudge when your daily drill is pending.",
          icon: "/favicon.svg",
        });
      }
    }
    setShowNotifBanner(false);
  };

  const handleDismissNotifBanner = () => {
    const today = new Date().toISOString().split("T")[0];
    localStorage.setItem("heading_notif_banner_dismissed", today);
    setShowNotifBanner(false);
  };

  let scoreTrendSign = "";
  let scoreTrendStr = "";
  if (logbook.length >= 2) {
    const chronological = [...logbook].sort(
      (a, b) => new Date(a.dateISO || "").getTime() - new Date(b.dateISO || "").getTime()
    );
    const mid = Math.floor(chronological.length / 2);
    const firstHalf = chronological.slice(0, mid);
    const secondHalf = chronological.slice(mid);

    const firstAvg = firstHalf.reduce((sum, a) => sum + (a.percentage || 0), 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((sum, a) => sum + (a.percentage || 0), 0) / secondHalf.length;

    const diff = Math.round(secondAvg - firstAvg);
    if (diff > 0) {
      scoreTrendSign = "↑";
      scoreTrendStr = `+${diff}%`;
    } else if (diff < 0) {
      scoreTrendSign = "↓";
      scoreTrendStr = `${diff}%`;
    } else {
      scoreTrendSign = "→";
      scoreTrendStr = "0%";
    }
  } else if (logbook.length === 1) {
    scoreTrendSign = "↑";
    scoreTrendStr = `+${Math.round(logbook[0].percentage || 0)}%`;
  } else {
    scoreTrendSign = "—";
    scoreTrendStr = "No data";
  }

  // Phase 7.2: XP earned in the last 7 days (from the hoisted ledger events).
  const xpWeekCutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const xpThisWeek = xpEvents
    .filter((e) => new Date(e.created_at).getTime() >= xpWeekCutoff)
    .reduce((sum, e) => sum + (e.amount ?? 0), 0);

  const renderTile = (tile: string) => {
    const dailyGoal = userData?.dailyGoal ?? 15;
    const answeredToday = userData?.questionsAnsweredToday ?? parseInt(localStorage.getItem("heading_questions_answered_today") || "0");
    switch (tile) {
      case "streak": return <StreakTile streak={displayedStreak} streakWeek={streakWeek} />;
      case "answered": return <AnsweredTile dailyGoal={dailyGoal} answeredToday={answeredToday} totalQuestions={totalQuestions} />;
      case "score": return <ScoreTile avgScore={avgScore} scoreTrendStr={scoreTrendStr} scoreTrendSign={scoreTrendSign} />;
      case "hours": return <HoursTile hasAttempts={hasAttempts} hoursThisWeek={hoursThisWeek} hoursStudied={hoursStudied} />;
      case "xp": return <XpTile xpBalance={xpBalance} xpLoading={xpLoading} xpRank={xpRank} xpThisWeek={xpThisWeek} />;
      case "certification": return <CertificationTile readinessPercentage={readinessPercentage} passedCount={passedCount} subjectCount={subjectsList.length} />;
      case "continue-module": return <ContinueModuleTile subjectMastery={progressStats.subjectMastery} subjectsList={subjectsList} />;
      default: return null;
    }
  };

  return (
    <div className="relative min-h-screen pb-20">
      <PageBackground />

      <div className="relative z-10 px-4 pt-16 pb-8 max-w-[820px] mx-auto">
        {/* Phase 8.1: mb reduced on mobile (mb-4 md:mb-8) so mission CTA sits
            higher. Greeting font also compressed on mobile for the same reason. */}
        <div className="relative mb-4 md:mb-8 overflow-hidden">
          {/* Mobile header */}
          <div className="flex md:hidden items-center gap-2 mb-2">
            <span className="w-1.5 h-1.5 rounded-sm bg-signal transform rotate-45" />
            <span className="font-mono text-[10px] uppercase tracking-widest text-muted-2">
              BRIEFING · {currentDateString}
            </span>
          </div>

          <Compass
            size={180}
            className="absolute -right-8 -top-8 text-rule opacity-20 pointer-events-none hidden md:block"
            strokeWidth={1}
          />
          <span className="font-mono text-[10px] tracking-[0.2em] uppercase text-signal hidden md:block mb-4">
            § BRIEFING · LIVE
          </span>
          <h1 className="text-[28px] md:text-[42px] leading-[1.1] md:leading-[1.05] md:h-display text-ink font-serif tracking-tight mb-2">
            {isLate ? (
              <>
                Still flying,
                <br className="md:hidden" />{" "}
                <span className="md:hidden"> </span>
                <span className="italic text-navy">{displayName}?</span>
              </>
            ) : (
              <>
                {greeting},<br className="md:hidden" />{" "}
                <span className="md:hidden"> </span>
                <span className="italic text-navy">{displayName}.</span>
              </>
            )}
          </h1>
        </div>

        {dueCount > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
          >
            <div className="bg-signal-soft/60 border border-signal/15 rounded-[12px] px-3.5 py-2.5 mb-4 flex items-center justify-between gap-3 relative overflow-hidden">
              <div className="flex items-center gap-2.5 min-w-0">
                <Flame size={15} className="text-signal shrink-0" />
                <p className="font-mono text-[11px] text-ink-2 tracking-normal uppercase truncate">
                  {dueCount} {dueCount === 1 ? "question" : "questions"} due for spaced review
                </p>
              </div>
              <Link
                to="/quiz/review"
                className="shrink-0 font-mono text-[11px] font-bold tracking-wider uppercase text-signal hover:opacity-70 transition-opacity flex items-center gap-1"
              >
                Start →
              </Link>
            </div>
          </motion.div>
        )}

        {/* Phase 8.1: suppress notif opt-in when missionEngine ON — it's a
            non-critical banner that pushes the primary mission CTA below fold. */}
        {showNotifBanner && !missionEngineEnabled && (
          <div role="status" aria-live="polite" className="bg-bg-2 border border-rule rounded-xl px-3.5 py-2.5 mb-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <Bell size={14} className="text-navy shrink-0" />
              <p className="font-sans text-xs text-ink-2">Enable daily drill reminders</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={handleEnableNotifications}
                className="font-mono text-[10px] font-bold tracking-wide uppercase text-navy hover:opacity-70 transition-opacity min-h-[44px] flex items-center px-2"
              >
                Enable
              </button>
              <button
                onClick={handleDismissNotifBanner}
                className="text-muted-2 hover:text-ink transition-colors p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center"
                aria-label="Dismiss notification banner"
              >
                <X size={13} />
              </button>
            </div>
          </div>
        )}

        <PwaInstallBanner />

        {/* Phase 8.2A — Flight Alerts: single highest-priority engine reminder.
            Renders above the mission card so urgency signals are seen first.
            State-driven: appears whenever condition is true, not time-gated.
            Returns null when no alert is active or user trained today. */}
        {missionEngineEnabled && (
          <FlightAlerts
            xpRank={xpRank}
            xpSystemEnabled={xpSystemEnabled}
            dueCount={dueCount}
            nextExam={userData?.nextExam}
            mission={hoistedMission}
            completedToday={hoistedCompletedToday}
            missionLoading={missionLoading}
          />
        )}

        {/* Phase 6 — Mission Engine: mission is the core unit, shown FIRST.
            Phase 8.1 — Pass XP rank context so ActiveMissionCard can show
            XP preview + rank proximity without a duplicate useXp call. */}
        {missionEngineEnabled && (
          <div className="space-y-3 mb-8">
            <ActiveMissionCard
              targetExam={userData?.targetExam}
              mastery={progressStats.subjectMastery}
              dailyGoal={userData?.dailyGoal}
              readinessScore={examReadiness.score}
              careerObjective={userData?.careerObjective}
              xpSystemEnabled={xpSystemEnabled}
              xpRankProgress={xpRank}
              mission={hoistedMission}
              completedToday={hoistedCompletedToday}
              missionLoading={missionLoading}
              missionError={missionError}
              missionBusy={missionBusy}
              onGenerate={missionGenerate}
              onResume={missionResume}
              onAbandon={missionAbandon}
            />
            <CareerObjectiveMissions careerObjective={userData?.careerObjective} />
          </div>
        )}

        {/* Phase 7.2: retention surfaces near the mission loop. Each self-gates
            (RecentXpActivity → xpSystem; TodayAchievements → has-unlocks). */}
        <div className="space-y-3 mb-8">
          <TodayAchievements />
          <RecentXpActivity />
        </div>

        {/* Readiness Card */}
        <div className="bg-ink rounded-[20px] p-5 md:p-8 w-full mb-8 relative overflow-hidden text-bg shadow-lg">
          <div className="absolute -right-6 -bottom-6 opacity-10 pointer-events-none">
            <Compass size={160} strokeWidth={1} />
          </div>

          <div className="flex justify-between items-start mb-2 relative z-10 w-full">
            <span className="font-mono text-[10px] tracking-wide uppercase opacity-80 text-bg">
              READINESS · LIVE
            </span>
          </div>
          <div className="font-serif text-[72px] leading-none tracking-tight mb-2 flex items-baseline relative z-10">
            {hasAttempts ? avgScore : "--"}
            <span className="text-[32px] opacity-70 ml-1">%</span>
          </div>
          <div className="font-mono text-[11px] text-bg/60 uppercase tracking-wide mb-6 relative z-10">
            {hasAttempts
              ? `OVERALL READINESS · BASED ON ${logbook.length} SESSIONS`
              : "COMPLETE YOUR FIRST SESSION TO TRACK PROGRESS"}
          </div>
          <div className="flex items-center gap-3 mb-6 relative z-10">
            {daysDiff !== null && daysDiff >= 0 ? (
              <>
                {hasAttempts && (
                  <div className={`text-bg font-mono text-[9px] px-2 py-1 rounded-full font-bold shadow-sm ${scoreTrendSign === "↑" ? "bg-mint" : scoreTrendSign === "↓" ? "bg-signal" : "bg-neutral-500"}`}>
                    {scoreTrendSign} {scoreTrendStr}
                  </div>
                )}
                <span
                  className={`font-mono text-[10px] tracking-wide uppercase ${daysDiff < 7 ? "text-signal" : daysDiff <= 30 ? "text-amber" : "opacity-80 text-bg"}`}
                >
                  EXAM IN {daysDiff}D
                </span>
              </>
            ) : daysDiff === null ? (
              <button
                onClick={() =>
                  window.dispatchEvent(new CustomEvent("open-next-check-modal"))
                }
                className="font-mono text-[10px] tracking-wide uppercase opacity-80 text-bg hover:opacity-100 transition-opacity flex items-center gap-1 min-h-[44px] px-2"
              >
                SET EXAM →
              </button>
            ) : null}
          </div>

          {/* Readiness Gauge */}
          <div className="mt-4 mb-6 relative z-10 border-t border-bg/15 pt-5">
            <div className="flex justify-between items-center text-[10px] uppercase tracking-wide font-mono text-bg/60 mb-2">
              <span>Exam Readiness Track</span>
              <span className="text-mint font-bold">{readinessPercentage}% ({passedCount}/{subjectsList.length} subjects ≥ 80%)</span>
            </div>
            <div
              className="w-full bg-bg/20 h-2.5 rounded-full relative overflow-hidden"
              role="progressbar"
              aria-valuenow={readinessPercentage}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`Exam readiness: ${readinessPercentage}%`}
            >
              <div
                className="bg-mint h-full rounded-full transition-all duration-700 ease-out shadow-[0_0_8px_rgba(34,197,94,0.5)]"
                style={{ width: `${readinessPercentage}%` }}
              />
            </div>
            <p className="text-[11px] font-mono text-bg/60 tracking-normal leading-normal mt-2">
              {isReadyForExam
                ? (daysDiff !== null && daysDiff <= 7
                  ? `✓ Optimal readiness achieved. Exam in ${daysDiff} days. Trust your training.`
                  : "✓ Exceeds flight preparation standards. Ready for scheduling.")
                : `Ready-for-exam threshold: 80% mastery across all subjects. ${subjectsList.length - passedCount} more to clear.`}
            </p>
          </div>

          <Link
            to={
              activeSession
                ? `/quiz/${activeSession.topicId}`
                : logbook.length > 0
                  ? `/quiz/review`
                  : `/modules`
            }
            className="block w-full relative z-10"
          >
            <Button
              variant="primary"
              className="w-full bg-bg text-ink hover:bg-paper h-[48px] rounded-[14px] flex items-center justify-center gap-2 border-0 shadow-none font-medium text-base cursor-pointer"
            >
              <Play size={14} aria-hidden="true" />
              {activeSession ? (
                `Resume ${activeSession.topicId.toUpperCase().replaceAll("-", " ")} · ${activeSession.answeredCount} Answered`
              ) : logbook.length > 0 ? (
                "Start Daily Drill"
              ) : (
                "Start First Module"
              )}
            </Button>
          </Link>
        </div>

        {/* § MISSION — Secondary actions (stops, scheduler).
            Phase 8.1 Fork 4: aiStudyScheduler block suppressed when missionEngine
            is ON — they answer the same "what to study" question; missionEngine wins.
            This also removes the broken "Materialization failed" error from Today. */}
        <div className="space-y-3 mb-8">
          {aiStudySchedulerEnabled && !missionEngineEnabled && (
            <TodayMissions subjectMastery={progressStats.subjectMastery} />
          )}
          <TodayStops
            subjectsList={subjectsList}
            subjectMastery={progressStats.subjectMastery}
            dueCount={dueCount}
            hasAttempts={hasAttempts}
          />
          {/* Career objective secondary missions — shown only when careerObjective set.
              When missionEngine is ON it renders up top (with the Active Mission); skip here. */}
          {!missionEngineEnabled && (
            <CareerObjectiveMissions careerObjective={userData?.careerObjective} />
          )}
        </div>

        {/* TILES — Phase 7.2: append the XP tile when xpSystem is ON; strip it
            (even from a saved tile order) when OFF, so OFF state is unchanged. */}
        <div className="mb-10 w-full relative">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 w-full">
            {[
              ...tileOrder,
              ...(xpSystemEnabled && !tileOrder.includes("xp") ? ["xp"] : []),
              ...(learningHierarchyEnabled ? ["certification", "continue-module"] : []),
            ]
              .filter((tile) => tile !== "xp" || xpSystemEnabled)
              .map((tile) => <div key={tile}>{renderTile(tile)}</div>)}
          </div>
        </div>

        {/* Only show ResumeCard when no session is already in the hero CTA */}
        {!activeSession && <ResumeCard />}

        {/* Phase 9: Adaptive Learning — replaces static Continue Learning when flag ON.
            Phase 8.1: Continue Learning — shown when learningHierarchy ON and adaptive OFF. */}
        {adaptiveLearningEnabled && !activeSession ? (
          <div className="mb-4">
            <AdaptiveLearningCard output={adaptive} loading={adaptive.loading} />
          </div>
        ) : learningHierarchyEnabled && !activeSession ? (
          <div className="mb-4">
            <ContinueLearningCard
              subjects={subjectsList}
              masteryMap={progressStats.subjectMastery}
              progress={hoistedLearningProgress}
            />
          </div>
        ) : null}
        <ReferralWidget />

        <div className="flex items-baseline justify-between gap-4 mb-4 mt-2">
          <div>
            <div className="font-mono text-[10px] text-signal tracking-[0.2em] uppercase mb-1.5">
              § TELEMETRY
            </div>
            <h2 className="font-serif text-[28px] text-ink leading-none tracking-tight">
              Your analytics
            </h2>
          </div>
        </div>

        {/* WEATHER & MASTERY HEATMAP ROW */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4 mb-6 w-full">
          {weatherBriefingEnabled && <WeatherWidget />}

          <div className={`bg-paper border border-rule rounded-2xl md:rounded-lg shadow-sm col-span-1 ${weatherBriefingEnabled ? 'md:col-span-2' : 'md:col-span-3'} flex flex-col justify-between overflow-hidden relative min-h-[220px]`}>
            <div className="p-4 flex items-center justify-between border-b border-rule/50 z-10 bg-paper/80 backdrop-blur-md absolute top-0 left-0 right-0">
              <div className="font-mono text-[9px] text-muted-2 tracking-wide uppercase flex items-center gap-1.5">
                <TrendingUp size={14} className="text-ink" />
                <span>MASTERY HEATMAP</span>
              </div>
              <span className="font-mono text-[9px] text-muted-2 uppercase tracking-wide flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 bg-mint rounded-full inline-block" />
                Live
              </span>
            </div>
            <div className="flex-1 w-full pt-[30px] md:pt-[50px] pb-4 px-2 md:px-4 bg-bg-2/30" role="img" aria-label="Radar chart showing aviation topic mastery percentage">
              <div style={{ width: "100%", minHeight: 320, height: "100%" }}>
                {logbook.length > 0 ? (
                  <Suspense fallback={<ChartFallback />}>
                    <MasteryRadar data={masteries} isMobile={isMobile} />
                  </Suspense>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full min-h-[320px] text-center p-6 border border-dashed border-rule rounded-xl bg-paper/40">
                    <span className="font-mono text-[9px] text-muted-2 uppercase tracking-wide mb-1.5 font-bold">No data yet</span>
                    <p className="font-serif text-lg text-ink">Complete your first session to see analytics</p>
                    <p className="font-sans text-[11px] text-muted-2 max-w-sm mt-1">Navigate to modules or exams to build radar coverage.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* STUDY PACING BLUEPRINT */}
        <div className="bg-paper border border-rule rounded-2xl p-6 shadow-sm mb-10 w-full relative overflow-hidden min-h-[300px]">
          <div className="p-4 flex flex-col md:flex-row md:items-center justify-between border-b border-rule/50 z-10 bg-paper/80 backdrop-blur-md absolute top-0 left-0 right-0">
            <div className="font-mono text-[9px] text-muted-2 tracking-wide uppercase flex items-center gap-1.5 mb-2 md:mb-0">
              <Clock size={14} className="text-navy" />
              <span>STUDY PACING · HOURS VS EXAM TARGET</span>
            </div>
            <div className="flex items-center gap-4">
              {savedDate ? (
                <span className="font-mono text-[9px] text-muted-2 uppercase tracking-wide">
                  Exam: {new Date(savedDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                </span>
              ) : (
                <button
                  onClick={() => window.dispatchEvent(new CustomEvent("open-next-check-modal"))}
                  className="font-mono text-[9px] text-signal uppercase tracking-wide bg-signal-soft border border-signal-soft/30 px-2.5 py-2 rounded-full hover:opacity-80 transition min-h-[44px] flex items-center"
                >
                  Set Target Exam Date →
                </button>
              )}
            </div>
          </div>

          <div className="pt-16 pb-2">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 mb-8 px-2">
              <div className="border-b sm:border-b-0 sm:border-r border-rule/30 pb-4 sm:pb-0 sm:pr-4">
                <div className="font-mono text-[9px] text-muted-2 uppercase tracking-wide">Actual Study Depth</div>
                <div className="font-serif text-2xl text-ink mt-1 flex items-baseline gap-1">
                  {hoursStudied} <span className="font-sans text-xs text-muted font-normal lowercase">hrs</span>
                </div>
              </div>
              <div className="border-b sm:border-b-0 sm:border-r border-rule/30 pb-4 sm:pb-0 sm:pr-4">
                <div className="font-mono text-[9px] text-muted-2 uppercase tracking-wide">Target Pace Rate</div>
                <div className="font-serif text-2xl text-ink mt-1 flex items-baseline gap-1">
                  {pacingData[pacingData.length - 1]?.target || 50} <span className="font-sans text-xs text-muted font-normal lowercase">hrs</span>
                </div>
              </div>
              <div>
                <div className="font-mono text-[9px] text-muted-2 uppercase tracking-wide">Pacing Status</div>
                <div className="font-sans text-xs font-semibold mt-2.5 flex items-center gap-1.5 leading-none font-mono uppercase">
                  {hoursStudied >= (pacingData[pacingData.length - 2]?.target || 0) ? (
                    <span className="text-mint tracking-wide flex items-center gap-1">
                      <span className="w-1.5 h-1.5 bg-mint rounded-full inline-block animate-pulse" /> On Track
                    </span>
                  ) : (
                    <span className="text-amber tracking-wide flex items-center gap-1">
                      <span className="w-1.5 h-1.5 bg-amber rounded-full inline-block" /> Increase Depth
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div style={{ width: "100%", height: 260 }} role="img" aria-label="Study pacing timeline chart comparing weekly logged hours against target exam pace">
              {logbook.length > 0 ? (
                <Suspense fallback={<ChartFallback />}>
                  <PacingChart data={pacingData} />
                </Suspense>
              ) : (
                <div className="flex flex-col items-center justify-center h-full min-h-[220px] text-center p-6 rounded-xl border border-dashed border-rule bg-paper/40">
                  <span className="font-mono text-[9px] text-muted-2 uppercase tracking-wide mb-1.5 font-bold">No sessions yet</span>
                  <p className="font-serif text-base text-ink">Complete your first session to see analytics</p>
                  <p className="font-sans text-[11px] text-muted-2 max-w-sm mt-1">A timeline against actual study hours will populate here.</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* M8D: Adaptive Regen Banner — flag-gated, shows when drift/recovery/staleness detected */}
        {adaptiveRegenEnabled && adaptiveRegen.checkResult && !adaptiveRegen.dismissed && (
          <AdaptiveRegenBanner
            checkResult={adaptiveRegen.checkResult}
            regenning={adaptiveRegen.regenning}
            onDismiss={adaptiveRegen.dismiss}
            onAccept={async () => {
              const result = await adaptiveRegen.triggerRegen("manual");
              if (result.ok && adaptiveRegen.checkResult) {
                trackPlanRebalanced({
                  planId: adaptiveRegen.checkResult.planId,
                  trigger: adaptiveRegen.checkResult.reason ?? "manual",
                  subjectsImproved: adaptiveRegen.checkResult.subjects
                    .filter(s => s.delta >= 5).map(s => s.subjectId),
                  subjectsRegressed: adaptiveRegen.checkResult.subjects
                    .filter(s => s.delta <= -5).map(s => s.subjectId),
                  oldWeakCount: adaptiveRegen.checkResult.subjects
                    .filter(s => s.classification === "CRITICAL" || s.classification === "WEAK").length,
                  newWeakCount: 0,
                  daysSinceLastRegen: adaptiveRegen.checkResult.lastRegenAt
                    ? Math.round((Date.now() - new Date(adaptiveRegen.checkResult.lastRegenAt).getTime()) / 864e5)
                    : 0,
                  regenCount: adaptiveRegen.checkResult.regenCount + 1,
                });
              }
            }}
          />
        )}

        {/* M8B: Exam Readiness Dashboard — flag-gated */}
        {examReadinessDashboardEnabled && (
          <div className="space-y-3 mb-8">
            <ExamReadinessGauge
              score={examReadiness.score}
              band={examReadiness.band}
              components={examReadiness.components}
              loading={examReadiness.loading}
              velocityPerWeek={velocityForGauge}
              etaWeeks={etaWeeks}
            />
            {masterySnapshots.length > 0 && (
              <>
                <SubjectRanking
                  snapshots={masterySnapshots}
                  subjectTitles={subjectTitleMap}
                />
                <RecommendedFocus
                  snapshots={masterySnapshots}
                  subjectTitles={subjectTitleMap}
                />
              </>
            )}
          </div>
        )}

        {/* M8E: Mastery Analytics — pro-only, flag-gated, lazy-loaded */}
        {masteryAnalyticsEnabled && isPro && (
          <div className="space-y-3 mb-8">
            <MasteryHeatmap
              weeks={masteryHistory.weeks}
              subjects={masteryHistory.subjects}
              subjectTitles={subjectTitleMap}
              loading={masteryHistory.loading}
            />
            <Suspense fallback={<div className="h-[260px] bg-bg-2 animate-pulse rounded-2xl" />}>
              <MasteryTrendGraph
                weeks={masteryHistory.weeks}
                snapshots={masterySnapshots}
                subjectTitles={subjectTitleMap}
                loading={masteryHistory.loading}
              />
            </Suspense>
          </div>
        )}

        {/* M11: Predictive Intelligence — flag-gated */}
        {predictiveIntelligenceEnabled && (
          <div className="space-y-3 mb-8">
            <div className="font-mono text-[10px] text-signal tracking-[0.2em] uppercase mb-3">
              § PREDICTIVE INTELLIGENCE
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {(predictive.loading || predictive.result) && (
                <PassProbabilityCard
                  result={predictive.result?.passProbability ?? { probability: 0, label: "0%", band: "at_risk", trendMultiplier: 1 }}
                  loading={predictive.loading}
                />
              )}
              {(predictive.loading || predictive.result) && (
                <SuccessForecastCard
                  forecast={predictive.result?.successForecast ?? { etaWeeks: null, etaLabel: "Insufficient data", confidence: "low", velocityPerWeek: 0, alreadyReady: false }}
                  currentScore={examReadiness.score}
                  loading={predictive.loading}
                />
              )}
            </div>
            {(predictive.loading || predictive.result) && (
              <AtRiskSubjectsCard
                subjectRisks={predictive.result?.subjectRisks ?? []}
                subjectTitles={subjectTitleMap}
                loading={predictive.loading}
              />
            )}
            {(predictive.loading || predictive.result) && (
              <RecommendedActionsCard
                actions={predictive.result?.recommendations ?? []}
                loading={predictive.loading}
              />
            )}

            {/* M11B: Forecast Dashboard */}
            <div className="font-mono text-[10px] text-signal tracking-[0.2em] uppercase mt-6 mb-3">
              § FORECAST DASHBOARD
            </div>
            <ForecastDashboard
              forecast={forecastEngine.result}
              predictive={predictive.result}
              subjectTitles={subjectTitleMap}
              currentScore={examReadiness.score}
              loading={forecastEngine.loading}
            />
          </div>
        )}

        {/* AI Study Scheduler entry card — shown only when flag ON */}
        {aiStudySchedulerEnabled && (
          <div className="mt-6 bg-navy/5 dark:bg-navy/20 border border-navy/20 dark:border-navy/40 rounded-2xl overflow-hidden">
            {/* Header row */}
            <div className="flex items-center gap-3 px-5 pt-4 pb-3 border-b border-navy/10 dark:border-navy/20">
              <div className="flex-shrink-0 w-9 h-9 rounded-xl bg-navy/10 dark:bg-navy/30 border border-navy/20 flex items-center justify-center">
                <CalendarRange size={16} className="text-navy dark:text-paper/70" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-mono text-[9px] uppercase tracking-widest text-muted-2">AI Study Scheduler</p>
                <p className="font-serif text-[15px] text-ink leading-snug">Today's Missions</p>
              </div>
            </div>
            {/* CTA row */}
            <div className="flex items-center gap-2 px-5 py-3">
              <Link
                to="/schedule"
                className="flex-1 h-[44px] rounded-xl bg-navy text-paper font-sans text-[12px] font-semibold flex items-center justify-center gap-1.5 hover:opacity-90 transition-opacity"
              >
                <Play size={12} aria-hidden="true" />
                View Schedule
              </Link>
              <Link
                to="/schedule"
                className="flex-1 h-[44px] rounded-xl border border-navy/30 text-navy dark:text-paper/70 font-sans text-[12px] font-medium flex items-center justify-center gap-1.5 hover:border-navy/50 transition-colors"
              >
                <CalendarRange size={12} aria-hidden="true" />
                View Schedule
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
