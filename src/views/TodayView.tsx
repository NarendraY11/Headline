import {
    Award,
    BookOpen,
    Clock,
    Compass,
    Flame,
    TrendingUp
} from "lucide-react";
import { Reorder } from "motion/react";
import { lazy, Suspense, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "../components/Atoms";
import { useAuth } from "../contexts/AuthContext";
import { SubjectItem } from "../data/topics";
import { useFeature } from "../hooks/useFeatureFlags";
import { useLogbook } from "../hooks/useLogbook";
import { fetchMergedSubjects } from "../lib/content";
import { useUserProgress } from "../lib/progress";
import { getDueQuestionIds } from "../lib/spacedRepetition";

import { AnimatedCounter } from "./today/AnimatedCounter";
import { TodayLoader } from "./today/DashboardLoaders";
import { TodayStops } from "./today/TodayStops";
import { getPacingData } from "./today/utils";

const MasteryRadar = lazy(() => import("./today/MasteryRadar"));
const PacingChart = lazy(() => import("./today/PacingChart"));

const ChartFallback = () => <div className="w-full h-full min-h-[260px] bg-bg-2 animate-pulse rounded-md" />;
import { WeatherWidget } from "./today/WeatherWidget";
import { ResumeCard } from "./today/ResumeCard";
import { ReferralWidget } from "./today/ReferralWidget";
import { useNotifications } from "../contexts/NotificationContext";

export default function TodayView() {
  const { userData, user, loading, updateUserData } = useAuth();
  const { addNotification } = useNotifications();
  const weatherBriefingEnabled = useFeature("weatherBriefing");
  const { stats: progressStats } = useUserProgress();
  const [notificationStatus, setNotificationStatus] = useState<
    NotificationPermission | "unsupported"
  >("default");
  const { logbook, loading: logbookLoading } = useLogbook();
  const [subjectsList, setSubjectsList] = useState<SubjectItem[]>([]);
  const [loadingSubjects, setLoadingSubjects] = useState(true);
  const [dueCount, setDueCount] = useState<number>(0);

  // Daily study reminder: if the user hasn't logged any activity today, drop a
  // gentle nudge into their notifications (once per day).
  useEffect(() => {
    if (!user) return;
    const today = new Date().toISOString().slice(0, 10);
    const lastActive = userData?.lastActivityDate || "";
    const lastReminder = localStorage.getItem("heading_last_reminder_date") || "";
    if (lastActive !== today && lastReminder !== today) {
      addNotification(
        "Keep your streak alive ✈️",
        "You haven't logged any training today. A few questions keeps your streak and sharpness up.",
        "reminder"
      );
      localStorage.setItem("heading_last_reminder_date", today);
    }
  }, [user, userData?.lastActivityDate]);

  useEffect(() => {
    async function fetchDueCount() {
      try {
        const ids = await getDueQuestionIds(user?.id || null);
        setDueCount(ids.length);
      } catch (err) {
        console.error("Failed loading due count in TodayView:", err);
      }
    }
    fetchDueCount();
  }, [user?.id]);

  useEffect(() => {
    async function loadSubjects() {
      try {
        const merged = await fetchMergedSubjects();
        setSubjectsList(merged);
      } catch (err) {
        console.error("Failed loading subjects in TodayView:", err);
      } finally {
        setLoadingSubjects(false);
      }
    }
    loadSubjects();
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
    handleResize(); // Initial check
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const hasAttempts = logbook.length > 0;

  // Daily Drill progress notification
  useEffect(() => {
    if (
      !loading &&
      !logbookLoading &&
      hasAttempts &&
      !userData?.settings?.doNotDisturb
    ) {
      const now = new Date();
      const todayStr = now.toISOString().split("T")[0];
      const hasStudiedToday = Array.isArray(logbook)
        ? logbook.some((att: any) => att.dateISO?.startsWith(todayStr))
        : false;

      if (
        !hasStudiedToday &&
        now.getHours() >= 12 &&
        notificationStatus !== "granted"
      ) {
        if (
          "Notification" in window &&
          Notification.permission !== "denied" &&
          notificationStatus === "default"
        ) {
          Notification.requestPermission().then((permission) => {
            setNotificationStatus(permission);
            if (permission === "granted") {
              new Notification("Daily Drill Pending", {
                body: "Captain, you haven't logged any progress today. Complete your daily drill now!",
                icon: "/favicon.svg",
              });
            }
          });
        }
      }
    }
  }, [
    loading,
    logbookLoading,
    hasAttempts,
    notificationStatus,
    userData?.settings?.doNotDisturb,
    logbook,
  ]);

  const savedDate =
    userData?.nextExam ?? localStorage.getItem("heading_next_exam") ?? "";

  let daysDiff: number | null = null;
  if (savedDate) {
    const d = new Date(savedDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    d.setHours(0, 0, 0, 0);
    const diffTime = d.getTime() - today.getTime();
    daysDiff = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

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
      new Date()
        .toLocaleDateString("en-US", {
          weekday: "short",
          day: "numeric",
          month: "short",
        })
        .toUpperCase()
    );
  }, []);

  useEffect(() => {
    try {
      let found: typeof activeSession = null;
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith("heading_quiz_state_")) {
          const val = localStorage.getItem(key);
          if (val) {
            const data = JSON.parse(val);
            if (data && data.status !== "ended" && data.answers) {
              const topicId = key.replace("heading_quiz_state_", "");
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
  // Fallback to logbook for hoursStudied since user_question_attempts doesn't track duration yet
  const hoursStudied = Math.round(
    logbook.reduce((sum, att) => sum + (att.durationSec || 0), 0) / 3600,
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

  // Calculate Mastery for Radar Chart
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
      correct: score, // these aren't used separately mostly, but the radar uses 'score'
      total: 100,
    };
  });

  const subjectMasteries = subjectsList.map((sub) => {
    return (progressStats.subjectMastery[sub.id] || 0) / 100;
  });

  const passedCount = subjectMasteries.filter((m) => m >= 0.8).length;
  const isReadyForExam = subjectMasteries.length > 0 && passedCount === subjectMasteries.length;
  const readinessPercentage = progressStats.examReadiness;

  const pacingData = getPacingData(savedDate, logbook);

  const handleReorder = (newOrder: string[]) => {
    setTileOrder(newOrder);
    localStorage.setItem("heading_dashboard_tiles", JSON.stringify(newOrder));
    if (userData) {
      updateUserData({
        settings: { ...userData.settings, dashboardTiles: newOrder },
      });
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 70) return "text-mint";
    if (score >= 40) return "text-amber";
    return "text-signal";
  };

  // Calculate real progression of score trend (latest half of attempts average score - oldest half of attempts average score)
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
    scoreTrendStr = "No study data";
  }

  const renderTile = (tile: string) => {
    const tileBaseClasses =
      "bg-paper border border-rule rounded-xl p-3.5 sm:p-4 shadow-sm col-span-1 flex flex-col justify-between cursor-grab active:cursor-grabbing";
    switch (tile) {
      case "streak":
        const hasStreak = displayedStreak > 0;
        return (
          <Reorder.Item
            key="streak"
            value="streak"
            id="streak"
            className={tileBaseClasses}
          >
            <div className="flex items-center gap-1.5 mb-1 text-muted-2">
              <Flame size={14} className={hasStreak ? "text-signal" : "text-muted-2"} />
              <span className="font-mono text-[9px] uppercase tracking-widest text-ink-2">
                STREAK
              </span>
            </div>
            {hasStreak ? (
              <>
                <div className="font-serif text-[26px] text-ink leading-none mt-2">
                  <AnimatedCounter value={displayedStreak} />
                  <span className="font-sans text-xl font-normal lowercase text-muted tracking-normal">
                    d
                  </span>
                </div>
                <div className="flex justify-between items-center mt-4 pointer-events-none w-full">
                  {streakWeek.map((d, i) => (
                    <div
                      key={i}
                      className="flex flex-col items-center gap-1.5 text-[10px]"
                    >
                      <div
                        className={`w-3.5 h-3.5 sm:w-5 sm:h-5 rounded-full border flex items-center justify-center
                          ${d.isActive ? "bg-signal-soft border-signal/30 text-signal" : "bg-bg border-rule text-transparent"} 
                        `}
                      >
                        {d.isActive && (
                          <span className="w-1 h-1 sm:w-1.5 sm:h-1.5 bg-signal rounded-full"></span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="flex flex-col justify-center items-center py-2 text-center h-full min-h-[50px] animate-in fade-in duration-300">
                <span className="font-mono text-[9px] text-muted-2 uppercase tracking-wide font-semibold">No Active Streak</span>
                <span className="text-[10px] text-muted leading-tight mt-0.5">Start a session today!</span>
              </div>
            )}
          </Reorder.Item>
        );
      case "answered":
        const dailyGoal = userData?.dailyGoal ?? 15;
        const answeredToday = userData?.questionsAnsweredToday ?? parseInt(localStorage.getItem("heading_questions_answered_today") || "0");
        const remainingToGoal = Math.max(0, dailyGoal - answeredToday);

        return (
          <Reorder.Item
            key="answered"
            value="answered"
            id="answered"
            className={tileBaseClasses}
          >
            <div>
              <div className="flex items-center gap-1.5 mb-1 text-muted-2">
                <BookOpen size={14} />
                <span className="font-mono text-[9px] uppercase tracking-widest text-ink-2">
                  Q'S ANSWERED
                </span>
              </div>
              <div className="font-serif text-[26px] text-ink leading-none mt-2 flex items-baseline justify-between overflow-hidden">
                <div>
                  <AnimatedCounter value={answeredToday} />
                  <span className="font-sans text-xs text-muted-2 ml-1">
                    /{dailyGoal}
                  </span>
                </div>
                {answeredToday >= dailyGoal ? (
                  <span className="font-mono text-[9px] font-bold text-mint uppercase tracking-wider bg-mint/10 border border-mint/20 px-1.5 py-0.5 rounded">
                    Goal Met
                  </span>
                ) : (
                  <span className="font-mono text-[9px] text-amber uppercase tracking-wider">
                    {remainingToGoal} to go
                  </span>
                )}
              </div>
              
              {/* Progress Bar */}
              <div className="w-full bg-bg h-1.5 rounded-full mt-3 overflow-hidden border border-rule/50">
                <div 
                  className="bg-mint h-full transition-all duration-500 ease-out" 
                  style={{ width: `${Math.min(100, (answeredToday / dailyGoal) * 100)}%` }}
                />
              </div>
              <div className="mt-2 text-[9px] font-mono text-muted-2">
                Lifetime Total: {totalQuestions} answered
              </div>
            </div>
          </Reorder.Item>
        );
      case "score":
        return (
          <Reorder.Item
            key="score"
            value="score"
            id="score"
            className={tileBaseClasses}
          >
            <div>
              <div className="flex items-center gap-1.5 mb-1 text-muted-2">
                <Award size={14} />
                <span className="font-mono text-[9px] uppercase tracking-widest text-ink-2">
                  AVG SCORE
                </span>
              </div>
              <div
                className={`font-serif text-[26px] leading-none mt-2 ${getScoreColor(avgScore)}`}
              >
                <AnimatedCounter value={avgScore} />
                <span className="font-sans text-xl text-muted font-normal tracking-normal">
                  %
                </span>
              </div>
            </div>
          </Reorder.Item>
        );
      case "hours":
        return (
          <Reorder.Item
            key="hours"
            value="hours"
            id="hours"
            className={tileBaseClasses}
          >
            <div>
              <div className="flex items-center gap-1.5 mb-1 text-muted-2">
                <Clock size={14} />
                <span className="font-mono text-[9px] uppercase tracking-widest text-ink-2">
                  HOURS (WK)
                </span>
              </div>
              <div className="font-serif text-[26px] text-ink leading-none mt-2">
                {hasAttempts ? <AnimatedCounter value={hoursStudied} /> : 0}{" "}
                <span className="font-sans text-xl text-muted font-normal lowercase tracking-normal">
                  hrs
                </span>
              </div>
            </div>
          </Reorder.Item>
        );
      default:
        return null;
    }
  };

  return (
    <div className="relative min-h-screen pb-20">
      <div className="absolute inset-0 blueprint pointer-events-none opacity-40 z-0" />
      <div className="absolute inset-0 paper-grain pointer-events-none opacity-100 z-1" />

      <div className="relative z-10 px-4 pt-16 pb-8 max-w-[820px] mx-auto">
        <div className="relative mb-8 overflow-hidden">
          {/* Mobile header bit */}
          <div className="flex md:hidden items-center gap-2 mb-4">
            <span className="w-1.5 h-1.5 rounded-sm bg-signal transform rotate-45" />
            <span className="font-mono text-[10px] uppercase tracking-widest text-muted-2">
              BRIEFING ·{" "}
              {currentDateString}
            </span>
          </div>

          <Compass
            size={180}
            className="absolute -right-8 -top-8 text-rule opacity-20 pointer-events-none hidden md:block"
            strokeWidth={1}
          />
          <span className="font-mono text-[10px] tracking-[0.2em] uppercase text-signal hidden md:block mb-4">
            § 01 · BRIEFING · LIVE
          </span>
          <h1 className="text-[42px] leading-[1.05] md:h-display text-ink font-serif tracking-tight md:leading-tight mb-2">
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

        {/* Due For Review — secondary alert (kept lighter so the Readiness card
            below remains the single primary focus of the viewport) */}
        {dueCount > 0 && (
          <div className="motion-div" style={{ animation: "fadeIn 0.5s" }}>
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
          </div>
        )}

        {/* Readiness Card */}
        <div className="bg-ink rounded-[20px] p-5 md:p-8 w-full mb-8 relative overflow-hidden text-bg shadow-lg">
          <div className="absolute -right-6 -bottom-6 opacity-10 pointer-events-none">
            <Compass size={160} strokeWidth={1} />
          </div>

          <div className="flex justify-between items-start mb-2 relative z-10 w-full">
            <span className="font-mono text-[10px] tracking-widest uppercase opacity-80 text-bg">
              READINESS · LIVE
            </span>
          </div>
          <div className="font-serif text-[72px] leading-none tracking-tight mb-2 flex items-baseline relative z-10">
            {hasAttempts ? avgScore : "--"}
            <span className="text-[32px] opacity-70 ml-1">%</span>
          </div>
          <div className="font-mono text-[11px] text-bg/60 uppercase tracking-widest mb-6 relative z-10">
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
                  className={`font-mono text-[10px] tracking-widest uppercase ${daysDiff < 7 ? "text-signal" : daysDiff <= 30 ? "text-amber" : "opacity-80 text-bg"}`}
                >
                  EXAM IN {daysDiff}D
                </span>
              </>
            ) : daysDiff === null ? (
              <button
                onClick={() =>
                  window.dispatchEvent(new CustomEvent("open-next-check-modal"))
                }
                className="font-mono text-[10px] tracking-widest uppercase opacity-80 text-bg hover:opacity-100 transition-opacity flex items-center gap-1"
              >
                SET EXAM →
              </button>
            ) : null}
          </div>

          {/* Readiness Gauge */}
          <div className="mt-4 mb-6 relative z-10 border-t border-bg/15 pt-5">
            <div className="flex justify-between items-center text-[10px] uppercase tracking-wider font-mono text-bg/60 mb-2">
              <span>Exam Readiness Track</span>
              <span className="text-mint font-bold">{readinessPercentage}% ({passedCount}/{subjectsList.length} subjects &ge; 80%)</span>
            </div>
            <div className="w-full bg-bg/20 h-2.5 rounded-full relative overflow-hidden">
              <div 
                className="bg-mint h-full rounded-full transition-all duration-700 ease-out shadow-[0_0_8px_rgba(34,197,94,0.5)]" 
                style={{ width: `${readinessPercentage}%` }}
              />
            </div>
            <p className="text-[11px] font-mono text-bg/60 tracking-normal leading-normal mt-2">
              {isReadyForExam 
                ? (daysDiff !== null && daysDiff <= 7 
                  ? `✓ Optimal readiness achieved. Your exam is in ${daysDiff} days. You are well prepared — go rest, relax, and trust your training before you fly!` 
                  : "✓ Exceeds flight preparation standards. Fully certified and ready for scheduling.")
                : `Ready-for-exam threshold: 80% mastery across all subjects. Keep studying to clear ${subjectsList.length - passedCount} more subjects.`}
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
              className="w-full bg-bg text-ink hover:bg-paper h-[48px] rounded-[14px] flex items-center justify-center border-0 shadow-none font-medium text-base cursor-pointer"
            >
              {activeSession ? (
                `▶ Resume ${activeSession.topicId.toUpperCase().replace("-", " ")} · ${activeSession.answeredCount} Answered`
              ) : logbook.length > 0 ? (
                "▶ Start Daily Drill"
              ) : (
                "▶ Start First Module"
              )}
            </Button>
          </Link>
        </div>

        {/* TILES */}
        <div className="mb-10 w-full relative">
          <div className="absolute -top-6 right-0 font-mono text-[9px] text-muted-2 uppercase tracking-widest flex items-center gap-1.5 opacity-50">
            <span>DRAG TO REORDER</span>
          </div>
          <Reorder.Group
            axis="y"
            values={tileOrder}
            onReorder={handleReorder}
            className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 w-full list-none"
          >
            {tileOrder.map((tile) => renderTile(tile))}
          </Reorder.Group>
        </div>

        <ResumeCard />
        <ReferralWidget />

        {/* SECTION HEAD — gives the analytics blocks a real mid-level heading
            (kicker = mono label, title = serif) instead of only tiny in-card
            mono labels, so the page has scannable section separation. */}
        <div className="flex items-baseline justify-between gap-4 mb-4 mt-2">
          <div>
            <div className="font-mono text-[10px] text-signal tracking-[0.2em] uppercase mb-1.5">
              § 02 · TELEMETRY
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
              <div className="font-mono text-[9px] text-muted-2 tracking-widest uppercase flex items-center gap-1.5">
                <TrendingUp size={14} className="text-ink" />
                <span>MASTERY HEATMAP (RADAR)</span>
              </div>
              <span className="font-mono text-[9px] text-muted-2 uppercase tracking-widest flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 bg-mint rounded-full inline-block" />
                Telemetry Active
              </span>
            </div>
            <div className="flex-1 w-full pt-[30px] md:pt-[50px] pb-4 px-2 md:px-4 bg-bg-2/30" role="img" aria-label="Radar chart showing aviation topic mastery percentage telemetry">
              <div style={{ width: "100%", minHeight: 320, height: "100%" }}>
                {logbook.length > 0 ? (
                  <Suspense fallback={<ChartFallback />}>
                    <MasteryRadar data={masteries} isMobile={isMobile} />
                  </Suspense>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full min-h-[320px] text-center p-6 border border-dashed border-rule rounded-xl bg-white/40">
                    <span className="font-mono text-[9px] text-muted-2 uppercase tracking-widest mb-1.5 font-bold"> telemetry outline </span>
                    <p className="font-serif text-lg text-ink">Complete your first session to see analytics</p>
                    <p className="font-sans text-[11px] text-muted-2 max-w-sm mt-1">Navigate to modules or exams to build radar coverage stats.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* STUDY PACING BLUEPRINT (RECHARTS) */}
        <div className="bg-paper border border-rule rounded-2xl p-6 shadow-sm mb-10 w-full relative overflow-hidden min-h-[300px]">
          <div className="p-4 flex flex-col md:flex-row md:items-center justify-between border-b border-rule/50 z-10 bg-paper/80 backdrop-blur-md absolute top-0 left-0 right-0">
            <div className="font-mono text-[9px] text-muted-2 tracking-widest uppercase flex items-center gap-1.5 mb-2 md:mb-0">
              <Clock size={14} className="text-navy" />
              <span>STUDY PACING BLUEPRINT · HOURS VS TARGET EXAM</span>
            </div>
            <div className="flex items-center gap-4">
              {savedDate ? (
                <span className="font-mono text-[9px] text-muted-2 uppercase tracking-widest">
                  Exam Clear: {new Date(savedDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                </span>
              ) : (
                <button
                  onClick={() => window.dispatchEvent(new CustomEvent("open-next-check-modal"))}
                  className="font-mono text-[9px] text-signal uppercase tracking-widest bg-signal-soft border border-signal-soft/30 px-2.5 py-0.5 rounded-full hover:opacity-80 transition"
                >
                  Configure Target Exam Date →
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
                    <span className="text-mint tracking-wider flex items-center gap-1">
                      <span className="w-1.5 h-1.5 bg-mint rounded-full inline-block animate-pulse" /> On Track / Optimal
                    </span>
                  ) : (
                    <span className="text-amber tracking-wider flex items-center gap-1">
                      <span className="w-1.5 h-1.5 bg-amber rounded-full inline-block" /> Increase Study Depth
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
                <div className="flex flex-col items-center justify-center h-full min-h-[220px] text-center p-6 rounded-xl border border-dashed border-rule bg-white/40">
                  <span className="font-mono text-[9px] text-muted-2 uppercase tracking-widest mb-1.5 font-bold"> timeline blank </span>
                  <p className="font-serif text-base text-ink">Complete your first session to see analytics</p>
                  <p className="font-sans text-[11px] text-muted-2 max-w-sm mt-1">A target timeline against actual study hours will populate here.</p>
                </div>
              )}
            </div>
          </div>
        </div>

        <TodayStops />
      </div>
    </div>
  );
}
