// AI Study Scheduler — Flight Schedule calendar (Phase M6 + Phase 1 + Phase 2)
//
// Phase 2 layout: 70/30 split on desktop.
//   Left:  Calendar (Monthly / Weekly / Agenda)
//   Right: MissionControlHero + ExamCountdown + QuickActions + [DayPanel] + CalendarSync + Reminders
//
// Mobile/tablet: stacked — hero strip above calendar, bottom sheet for day panel.

import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  CalendarRange,
  List,
  Loader2,
  RotateCcw,
} from "lucide-react";
import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { useFeature } from "../../hooks/useFeatureFlags";
import { useScheduleRange } from "../../hooks/useStudyMissions";
import { launchMission } from "../../lib/launchMission";
import { trackCalendarOpened } from "../../lib/studyAnalytics";
import { ExamCountdown } from "../../components/ExamCountdown";
import { useStudyReminders } from "../../hooks/useStudyReminders";
import { CalendarSyncPanel } from "./CalendarSyncPanel";
import { ReminderSettings } from "./ReminderSettings";
import { AgendaView } from "./components/AgendaView";
import { DayPanel } from "./components/DayPanel";
import { MissionControlHero } from "./components/MissionControlHero";
import { MonthlyView } from "./components/MonthlyView";
import { PlannerEmptyState } from "./components/PlannerEmptyState";
import { QuickActionsBar } from "./components/QuickActionsBar";
import { WeeklyView } from "./components/WeeklyView";
import {
  groupByDate,
  isoDate,
  MONTH_NAMES,
  monthRange,
  todayISO,
  weekDays,
  weekRange,
} from "./components/calendarHelpers";
import type { StudyMissionRow } from "../../types/studyScheduler";

type CalendarView = "monthly" | "weekly" | "agenda";

export default function StudyCalendarView() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const schedulerEnabled = useFeature("aiStudyScheduler");
  const calendarSyncEnabled = useFeature("calendarSync");

  useStudyReminders();

  const [tracked, setTracked] = useState(false);
  useEffect(() => {
    if (schedulerEnabled && !tracked) { trackCalendarOpened(); setTracked(true); }
  }, [schedulerEnabled, tracked]);

  const [view, setView] = useState<CalendarView>("monthly");
  const [selectedDate, setSelectedDate] = useState<string | null>(todayISO());
  const [showDayPanel, setShowDayPanel] = useState(false);
  const [launchingId, setLaunchingId] = useState<string | null>(null);

  // Midnight tick
  const [currentDateStr, setCurrentDateStr] = useState(() => todayISO());
  useEffect(() => {
    const now = new Date();
    const msUntilMidnight =
      new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime() - now.getTime();
    const timer = setTimeout(() => setCurrentDateStr(todayISO()), msUntilMidnight + 100);
    return () => clearTimeout(timer);
  }, [currentDateStr]);

  const [year, setYear] = useState(() => new Date().getFullYear());
  const [month, setMonth] = useState(() => new Date().getMonth());
  const [weekAnchor, setWeekAnchor] = useState(() => new Date());

  const fetchRange = useMemo(() => {
    if (view === "monthly") return monthRange(year, month);
    if (view === "weekly") return weekRange(weekAnchor);
    const end90 = new Date(); end90.setDate(end90.getDate() + 89);
    return { start: currentDateStr, end: isoDate(end90) };
  }, [view, year, month, weekAnchor, currentDateStr]);

  const { missions, loading, error } = useScheduleRange(fetchRange.start, fetchRange.end);
  const byDate = useMemo(() => groupByDate(missions), [missions]);
  const selectedMissions = useMemo(
    () => (selectedDate ? byDate.get(selectedDate) ?? [] : []),
    [selectedDate, byDate],
  );

  const handleSelectDate = useCallback((iso: string) => {
    setSelectedDate(iso);
    setShowDayPanel(true);
  }, []);

  const handleStartMission = useCallback(async (m: StudyMissionRow) => {
    if (launchingId) return;
    setLaunchingId(m.id);
    try { await launchMission(m, navigate, user?.id ?? null); }
    finally { setLaunchingId(null); }
  }, [launchingId, navigate, user?.id]);

  const prevMonth = () => { if (month === 0) { setYear((y) => y - 1); setMonth(11); } else setMonth((m) => m - 1); };
  const nextMonth = () => { if (month === 11) { setYear((y) => y + 1); setMonth(0); } else setMonth((m) => m + 1); };
  const prevWeek = () => { const d = new Date(weekAnchor); d.setDate(d.getDate() - 7); setWeekAnchor(d); };
  const nextWeek = () => { const d = new Date(weekAnchor); d.setDate(d.getDate() + 7); setWeekAnchor(d); };
  const goToday = () => {
    const now = new Date();
    setYear(now.getFullYear()); setMonth(now.getMonth()); setWeekAnchor(new Date());
    setSelectedDate(todayISO()); setShowDayPanel(true);
  };

  const navLabel = useMemo(() => {
    if (view === "monthly") return `${MONTH_NAMES[month]} ${year}`;
    if (view === "weekly") {
      const days = weekDays(weekAnchor);
      const first = days[0]; const last = days[6];
      if (first.getMonth() === last.getMonth())
        return `${first.getDate()}–${last.getDate()} ${MONTH_NAMES[first.getMonth()]} ${first.getFullYear()}`;
      return `${first.getDate()} ${MONTH_NAMES[first.getMonth()]} – ${last.getDate()} ${MONTH_NAMES[last.getMonth()]}`;
    }
    return "Upcoming";
  }, [view, year, month, weekAnchor]);

  const handlePrev = view === "monthly" ? prevMonth : prevWeek;
  const handleNext = view === "monthly" ? nextMonth : nextWeek;

  if (!schedulerEnabled) return <Navigate to="/today" replace />;

  const VIEW_ICONS: Record<CalendarView, ReactNode> = {
    monthly: <CalendarDays size={13} />,
    weekly:  <CalendarRange size={13} />,
    agenda:  <List size={13} />,
  };

  const isEmpty = !loading && missions.length === 0;

  // ── Right rail content (desktop) ──────────────────────────────────────────
  const rightRailDefault = (
    <div className="space-y-4">
      <MissionControlHero
        launchingId={launchingId}
        onLaunch={setLaunchingId}
      />
      <ExamCountdown />
      <QuickActionsBar />
      {calendarSyncEnabled && (
        <>
          <CalendarSyncPanel missions={missions} planTitle="Heading Study Plan" />
          <ReminderSettings />
        </>
      )}
    </div>
  );

  const rightRailDayPanel = selectedDate && (
    <div className="space-y-4">
      <div className="bg-paper border border-rule rounded-2xl overflow-hidden">
        <DayPanel
          dateISO={selectedDate}
          missions={selectedMissions}
          onClose={() => setShowDayPanel(false)}
          onStartMission={handleStartMission}
          launchingId={launchingId}
        />
      </div>
      <QuickActionsBar />
      {calendarSyncEnabled && (
        <>
          <CalendarSyncPanel missions={missions} planTitle="Heading Study Plan" />
          <ReminderSettings />
        </>
      )}
    </div>
  );

  return (
    <div className="relative min-h-screen pb-24">
      <div className="absolute inset-0 blueprint pointer-events-none opacity-40 z-0" />
      <div className="absolute inset-0 paper-grain pointer-events-none opacity-100 z-1" />

      <div className="relative z-10 max-w-[1280px] mx-auto px-4 pt-8 pb-6">

        {/* ── Page header ── */}
        <div className="mb-5">
          <div className="flex items-end justify-between gap-3 flex-wrap">
            <div>
              <span className="block font-mono text-[10px] tracking-[0.2em] uppercase text-signal mb-1.5">
                § PLANNER · STUDY CALENDAR
              </span>
              <h1 className="font-serif text-[32px] md:text-[40px] text-ink leading-tight tracking-tight">
                Planner
              </h1>
              <p className="font-sans text-sm text-muted-2 mt-1">
                Your study missions, visualised on a calendar.
              </p>
            </div>
            <div
              className="flex items-center gap-1 bg-bg-2 border border-rule rounded-xl p-1"
              role="group"
              aria-label="Calendar view"
            >
              {(["monthly", "weekly", "agenda"] as CalendarView[]).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setView(v)}
                  aria-pressed={view === v}
                  className={`flex items-center gap-1.5 h-8 px-3 rounded-lg font-mono text-[10px] uppercase tracking-wide transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky/60 focus-visible:ring-offset-1 focus-visible:ring-offset-bg-2 ${
                    view === v ? "bg-paper shadow-sm text-ink border border-rule" : "text-muted-2 hover:text-ink"
                  }`}
                >
                  {VIEW_ICONS[v]}
                  <span className="hidden sm:inline">{v}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── Mobile hero strip (hidden on lg+) ── */}
        <div className="lg:hidden mb-4 space-y-3">
          <MissionControlHero launchingId={launchingId} onLaunch={setLaunchingId} />
          <ExamCountdown />
          {/* Quick actions horizontal scroll on mobile */}
          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
            {[
              { label: "Questions", to: "/modules" },
              { label: "Practice",  to: "/practice" },
              { label: "Review",    to: "/review" },
              { label: "Progress",  to: "/analytics" },
              { label: "Today",     to: "/today" },
            ].map((a) => (
              <a
                key={a.to}
                href={a.to}
                className="flex-shrink-0 h-8 px-3 rounded-lg border border-rule text-ink font-sans text-[11px] flex items-center hover:bg-bg-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky/60 focus-visible:ring-offset-1 focus-visible:ring-offset-bg"
              >
                {a.label}
              </a>
            ))}
          </div>
        </div>

        {/* ── Error banner ── */}
        {error && (
          <div role="alert" className="bg-signal-soft border border-signal/20 rounded-xl px-4 py-3 font-sans text-sm text-[#a83020] dark:text-signal mb-4">
            {error}
          </div>
        )}

        {/* ── Empty state ── */}
        {isEmpty && <PlannerEmptyState />}

        {/* ── Two-column layout (lg+) + stacked (below lg) ── */}
        {!isEmpty && (
          <div className="flex gap-6">
            {/* Left: calendar */}
            <div className="flex-1 min-w-0">
              {/* Nav bar */}
              {view !== "agenda" && (
                <div className="flex items-center justify-between gap-3 mb-4">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handlePrev}
                      aria-label="Previous"
                      className="w-8 h-8 rounded-lg border border-rule flex items-center justify-center text-muted-2 hover:text-ink hover:border-rule-strong transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky/60 focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
                    >
                      <ArrowLeft size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={handleNext}
                      aria-label="Next"
                      className="w-8 h-8 rounded-lg border border-rule flex items-center justify-center text-muted-2 hover:text-ink hover:border-rule-strong transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky/60 focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
                    >
                      <ArrowRight size={14} />
                    </button>
                    <span className="font-mono text-[13px] font-medium text-ink ml-1">{navLabel}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={goToday}
                      className="h-8 px-3 rounded-lg border border-rule text-muted-2 hover:text-ink hover:border-rule-strong font-mono text-[10px] uppercase tracking-wide flex items-center gap-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky/60 focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
                    >
                      <RotateCcw size={11} aria-hidden="true" />
                      Today
                    </button>
                    {loading && <Loader2 size={14} className="text-muted-2 animate-spin" aria-label="Loading" />}
                  </div>
                </div>
              )}

              {/* Calendar views */}
              {view === "monthly" && (
                <div className="bg-paper border border-rule rounded-2xl p-4">
                  <MonthlyView
                    year={year}
                    month={month}
                    byDate={byDate}
                    selectedDate={selectedDate}
                    onSelectDate={handleSelectDate}
                  />
                </div>
              )}
              {view === "weekly" && (
                <WeeklyView
                  anchor={weekAnchor}
                  byDate={byDate}
                  selectedDate={selectedDate}
                  onSelectDate={handleSelectDate}
                  onStartMission={handleStartMission}
                  launchingId={launchingId}
                />
              )}
              {view === "agenda" && (
                loading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 size={20} className="text-muted-2 animate-spin" aria-label="Loading missions" />
                  </div>
                ) : (
                  <AgendaView
                    byDate={byDate}
                    onStartMission={handleStartMission}
                    launchingId={launchingId}
                    onSelectDate={handleSelectDate}
                  />
                )
              )}

              {/* Mobile: CalendarSync + Reminders below calendar */}
              {calendarSyncEnabled && (
                <div className="lg:hidden mt-6 grid grid-cols-1 gap-4">
                  <CalendarSyncPanel missions={missions} planTitle="Heading Study Plan" />
                  <ReminderSettings />
                </div>
              )}
            </div>

            {/* Right rail — desktop only (lg+) */}
            <div className="hidden lg:block flex-shrink-0 w-72 xl:w-80">
              <div className="sticky top-6 space-y-4">
                {showDayPanel && selectedDate
                  ? rightRailDayPanel
                  : rightRailDefault}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Day panel — mobile bottom sheet ── */}
      {showDayPanel && selectedDate && (
        <div className="lg:hidden fixed inset-0 z-50 flex flex-col justify-end">
          <button
            type="button"
            className="absolute inset-0 bg-ink/40 backdrop-blur-sm"
            onClick={() => setShowDayPanel(false)}
            aria-label="Close day panel"
          />
          <div
            className="relative bg-bg border-t border-rule rounded-t-2xl max-h-[80dvh] flex flex-col"
            style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
          >
            <div className="flex justify-center pt-3 pb-1 flex-shrink-0" aria-hidden="true">
              <div className="w-10 h-1.5 rounded-full bg-rule-strong" />
            </div>
            <DayPanel
              dateISO={selectedDate}
              missions={selectedMissions}
              onClose={() => setShowDayPanel(false)}
              onStartMission={handleStartMission}
              launchingId={launchingId}
            />
          </div>
        </div>
      )}
    </div>
  );
}
