// =====================================================================
// AI Study Scheduler — Flight Schedule calendar (Phase M6)
//
// Three views:
//   Monthly  — grid of days, dot indicators per mission type
//   Weekly   — 7-day strip with mission cards per day
//   Agenda   — flat list ordered by date, grouped by day
//
// Day Panel (click any day in monthly/weekly) shows full mission list,
// total estimated time, completion %, and Start Studying CTA.
//
// Feature-flag gated (aiStudyScheduler).
// =====================================================================

import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Brain,
  CalendarDays,
  CalendarRange,
  CheckCircle2,
  ChevronLeft,
  ClipboardList,
  Clock,
  Layers,
  List,
  Loader2,
  Mic,
  Play,
  Repeat,
  RotateCcw,
  SkipForward,
  Zap,
} from "lucide-react";
import type { ReactNode } from "react";
import { useCallback, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { useScheduleRange } from "../../hooks/useStudyMissions";
import { launchMission } from "../../lib/launchMission";
import type { MissionStatus, MissionType, StudyMissionRow } from "../../types/studyScheduler";

// ── Constants & helpers ───────────────────────────────────────────────────────

type CalendarView = "monthly" | "weekly" | "agenda";

const TYPE_META: Record<MissionType, { label: string; icon: ReactNode; dot: string; chip: string }> = {
  drill:     { label: "Drill",     icon: <Zap size={10} />,           dot: "bg-signal",  chip: "bg-signal-soft text-[#a83020] dark:text-signal border-signal/15" },
  review:    { label: "Review",    icon: <Repeat size={10} />,        dot: "bg-sky",     chip: "bg-sky-soft text-sky border-sky/15" },
  viva:      { label: "Viva",      icon: <Mic size={10} />,           dot: "bg-amber",   chip: "bg-amber-soft text-[#855807] dark:text-amber border-amber/15" },
  flashcard: { label: "Flashcard", icon: <Brain size={10} />,         dot: "bg-mint",    chip: "bg-mint-soft text-mint border-mint/15" },
  mini_test: { label: "Mini Test", icon: <ClipboardList size={10} />, dot: "bg-ink-2",   chip: "bg-bg-2 text-ink-2 border-rule" },
  mock:      { label: "Mock",      icon: <Layers size={10} />,        dot: "bg-navy",    chip: "bg-navy/10 text-navy dark:text-navy border-navy/20" },
  read:      { label: "Read",      icon: <BookOpen size={10} />,      dot: "bg-muted-2", chip: "bg-bg-2 text-ink-2 border-rule" },
};

// FIX #5: toISOString() returns UTC date, not local date. Users in UTC+X
// timezones would see the wrong day highlighted as "today" — off by up to
// ±24h. Derive the date from local year/month/day instead.
function isoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function todayISO(): string {
  return isoDate(new Date());
}

function formatMin(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function isOverdue(dateISO: string): boolean {
  return dateISO < todayISO();
}

function missionTitle(m: StudyMissionRow): string {
  return m.payload?.subjectId
    ? m.payload.subjectId.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
    : TYPE_META[m.type]?.label ?? "Mission";
}

/** Group missions by scheduled_date. */
function groupByDate(missions: StudyMissionRow[]): Map<string, StudyMissionRow[]> {
  const map = new Map<string, StudyMissionRow[]>();
  for (const m of missions) {
    const arr = map.get(m.scheduled_date) ?? [];
    arr.push(m);
    map.set(m.scheduled_date, arr);
  }
  return map;
}

function completionPct(missions: StudyMissionRow[]): number {
  if (!missions.length) return 0;
  const done = missions.filter((m) => m.status === "completed").length;
  return Math.round((done / missions.length) * 100);
}

// ── Date range helpers ────────────────────────────────────────────────────────

function monthRange(year: number, month: number): { start: string; end: string } {
  const start = new Date(year, month, 1);
  const end = new Date(year, month + 1, 0);
  return { start: isoDate(start), end: isoDate(end) };
}

function weekRange(anchor: Date): { start: string; end: string } {
  const d = new Date(anchor);
  const day = d.getDay();
  d.setDate(d.getDate() - day);
  const start = isoDate(d);
  d.setDate(d.getDate() + 6);
  return { start, end: isoDate(d) };
}

/** All calendar-grid days for a month (including leading/trailing days to fill 6 rows). */
function calendarGrid(year: number, month: number): Date[] {
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const startOffset = first.getDay();
  const endOffset = 6 - last.getDay();
  const days: Date[] = [];
  for (let i = -startOffset; i <= last.getDate() - 1 + endOffset; i++) {
    days.push(new Date(year, month, 1 + i));
  }
  return days;
}

/** 7-day strip starting Sunday of the week containing anchor. */
function weekDays(anchor: Date): Date[] {
  const d = new Date(anchor);
  d.setDate(d.getDate() - d.getDay());
  return Array.from({ length: 7 }, (_, i) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + i));
}

const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const DAY_ABBREV = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

// ── Status dot ────────────────────────────────────────────────────────────────

function StatusDot({ status }: { status: MissionStatus }) {
  const cfg: Record<MissionStatus, { cls: string; label: string }> = {
    pending:     { cls: "bg-rule-strong",         label: "Pending"     },
    in_progress: { cls: "bg-amber animate-pulse",  label: "In progress" },
    completed:   { cls: "bg-mint",                label: "Completed"   },
    skipped:     { cls: "bg-muted-2",             label: "Skipped"     },
  };
  const { cls, label } = cfg[status] ?? cfg.pending;
  return <span className={`w-2 h-2 rounded-full flex-shrink-0 ${cls}`} title={label} aria-label={label} />;
}

// ── Mission list item (used in day panel + agenda) ────────────────────────────

interface MissionItemProps {
  mission: StudyMissionRow;
  onStart: (m: StudyMissionRow) => void;
  onReschedule?: (m: StudyMissionRow) => void;
  launching: boolean;
  showDate?: boolean;
}

function MissionItem({ mission, onStart, launching, showDate }: MissionItemProps) {
  const meta = TYPE_META[mission.type] ?? TYPE_META.drill;
  const isDone = mission.status === "completed" || mission.status === "skipped";
  const overdue = !isDone && isOverdue(mission.scheduled_date);

  return (
    <div
      className={`bg-paper border rounded-xl px-3.5 py-3 flex items-center gap-3 transition-colors ${
        isDone
          ? "border-rule/40 opacity-70"
          : overdue
          ? "border-signal/30 hover:border-signal/50"
          : "border-rule hover:border-rule-strong"
      }`}
    >
      <StatusDot status={mission.status} />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
          <span className={`inline-flex items-center gap-1 h-[18px] px-1.5 rounded-full font-mono text-[8px] uppercase tracking-wider border ${meta.chip}`}>
            {meta.icon}
            {meta.label}
          </span>
          {overdue && (
            <span className="inline-flex items-center gap-1 h-[18px] px-1.5 rounded-full font-mono text-[8px] uppercase tracking-wider border bg-signal-soft text-[#a83020] dark:text-signal border-signal/15">
              <AlertTriangle size={8} />
              Overdue
            </span>
          )}
          {showDate && (
            <span className="font-mono text-[8px] text-muted-2 uppercase tracking-wide">
              {mission.scheduled_date}
            </span>
          )}
        </div>
        <p className="font-sans text-[13px] font-medium text-ink leading-snug truncate">
          {missionTitle(mission)}
        </p>
      </div>

      <div className="flex items-center gap-1 font-mono text-[9px] text-muted-2 uppercase tracking-wide flex-shrink-0">
        <Clock size={9} aria-hidden="true" />
        {formatMin(mission.estimated_min || 20)}
      </div>

      {isDone ? (
        <div className="flex-shrink-0 flex items-center gap-1 font-mono text-[9px] uppercase tracking-wide text-muted-2 pl-1">
          {mission.status === "completed"
            ? <><CheckCircle2 size={12} className="text-mint" /> Done</>
            : <><SkipForward size={12} /> Skipped</>}
        </div>
      ) : overdue ? (
        <div className="flex-shrink-0 flex items-center gap-1.5">
          <button
            type="button"
            disabled={launching}
            onClick={() => onStart(mission)}
            aria-label="Start now"
            className="h-8 px-2.5 rounded-lg bg-signal text-paper font-mono text-[9px] uppercase tracking-wide flex items-center gap-1 hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-wait"
          >
            {launching ? <Loader2 size={11} className="animate-spin" /> : <Play size={11} />}
            Start
          </button>
        </div>
      ) : (
        <button
          type="button"
          disabled={launching}
          onClick={() => onStart(mission)}
          aria-label={`Start ${meta.label}`}
          className="flex-shrink-0 h-8 w-8 rounded-lg bg-ink text-paper flex items-center justify-center hover:bg-ink-2 transition-colors disabled:opacity-50 disabled:cursor-wait"
        >
          {launching ? <Loader2 size={13} className="animate-spin" /> : <Play size={12} aria-hidden="true" />}
        </button>
      )}
    </div>
  );
}

// ── Day Panel (slide-over on mobile, right panel on desktop) ──────────────────

interface DayPanelProps {
  dateISO: string;
  missions: StudyMissionRow[];
  onClose: () => void;
  onStartMission: (m: StudyMissionRow) => void;
  launchingId: string | null;
}

function DayPanel({ dateISO, missions, onClose, onStartMission, launchingId }: DayPanelProps) {
  const totalMin = missions.reduce((s, m) => s + (m.estimated_min || 20), 0);
  const pct = completionPct(missions);
  const pendingMissions = missions.filter((m) => m.status === "pending" || m.status === "in_progress");
  const today = todayISO();
  const isToday = dateISO === today;
  const overdue = dateISO < today;

  const dateLabel = new Date(dateISO + "T12:00:00").toLocaleDateString("en-GB", {
    weekday: "long", day: "numeric", month: "long",
  });

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-4 border-b border-rule flex-shrink-0">
        <div>
          <span className={`font-mono text-[9px] uppercase tracking-wider ${isToday ? "text-signal" : overdue ? "text-amber" : "text-muted-2"}`}>
            {isToday ? "§ TODAY" : overdue ? "§ OVERDUE" : "§ SCHEDULED"}
          </span>
          <h2 className="font-serif text-[20px] text-ink leading-tight mt-0.5">{dateLabel}</h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close day panel"
          className="mt-1 flex-shrink-0 w-8 h-8 rounded-lg border border-rule flex items-center justify-center text-muted-2 hover:text-ink hover:border-rule-strong transition-colors"
        >
          <ChevronLeft size={14} />
        </button>
      </div>

      {/* Stats strip */}
      {missions.length > 0 && (
        <div className="flex items-center gap-4 px-5 py-3 border-b border-rule/50 flex-shrink-0">
          <div className="text-center">
            <p className="font-mono text-[18px] font-bold text-ink leading-none">{missions.length}</p>
            <p className="font-mono text-[8px] uppercase tracking-wider text-muted-2 mt-0.5">Missions</p>
          </div>
          <div className="w-px h-8 bg-rule" />
          <div className="text-center">
            <p className="font-mono text-[18px] font-bold text-ink leading-none">{formatMin(totalMin)}</p>
            <p className="font-mono text-[8px] uppercase tracking-wider text-muted-2 mt-0.5">Est. time</p>
          </div>
          <div className="w-px h-8 bg-rule" />
          <div className="flex-1">
            <div className="flex items-center justify-between mb-1">
              <p className="font-mono text-[8px] uppercase tracking-wider text-muted-2">Progress</p>
              <p className="font-mono text-[10px] font-bold text-ink">{pct}%</p>
            </div>
            <div className="h-1.5 bg-bg-2 rounded-full overflow-hidden">
              <div
                className="h-full bg-mint rounded-full transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Mission list */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-2">
        {missions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <p className="font-sans text-sm text-muted-2">No missions scheduled.</p>
          </div>
        ) : (
          missions.map((m) => (
            <MissionItem
              key={m.id}
              mission={m}
              onStart={onStartMission}
              launching={launchingId === m.id}
            />
          ))
        )}
      </div>

      {/* Start Studying CTA */}
      {pendingMissions.length > 0 && (
        <div className="px-5 py-4 border-t border-rule flex-shrink-0"
          style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 16px)" }}
        >
          <button
            type="button"
            onClick={() => onStartMission(pendingMissions[0])}
            disabled={launchingId === pendingMissions[0].id}
            className="w-full h-12 rounded-2xl bg-navy text-paper dark:bg-paper dark:text-ink font-sans text-[14px] font-semibold flex items-center justify-center gap-2 shadow-[0_4px_20px_rgba(20,48,90,0.25)] transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {launchingId === pendingMissions[0].id
              ? <Loader2 size={16} className="animate-spin" />
              : <Play size={16} aria-hidden="true" />}
            Start Studying
          </button>
        </div>
      )}
    </div>
  );
}

// ── Monthly view ──────────────────────────────────────────────────────────────

interface MonthlyViewProps {
  year: number;
  month: number;
  byDate: Map<string, StudyMissionRow[]>;
  selectedDate: string | null;
  onSelectDate: (d: string) => void;
}

function MonthlyView({ year, month, byDate, selectedDate, onSelectDate }: MonthlyViewProps) {
  const days = calendarGrid(year, month);
  const today = todayISO();

  return (
    <div>
      {/* Day-of-week header */}
      <div className="grid grid-cols-7 mb-1">
        {DAY_ABBREV.map((d) => (
          <div key={d} className="text-center font-mono text-[9px] uppercase tracking-wider text-muted-2 py-2">
            {d}
          </div>
        ))}
      </div>

      {/* Day grid */}
      <div className="grid grid-cols-7 gap-1">
        {days.map((day) => {
          const iso = isoDate(day);
          const isCurrentMonth = day.getMonth() === month;
          const isToday = iso === today;
          const isSelected = iso === selectedDate;
          const missions = byDate.get(iso) ?? [];
          const overdueAny = !isToday && iso < today && missions.some((m) => m.status === "pending" || m.status === "in_progress");
          const allDone = missions.length > 0 && missions.every((m) => m.status === "completed" || m.status === "skipped");

          // Collect up to 3 unique mission types for dots
          const dots = [...new Set(missions.map((m) => m.type))].slice(0, 3);

          return (
            <button
              key={iso}
              type="button"
              onClick={() => onSelectDate(iso)}
              aria-label={`${day.getDate()} ${MONTH_NAMES[day.getMonth()]}, ${missions.length} missions`}
              aria-pressed={isSelected}
              className={`
                relative aspect-square rounded-xl flex flex-col items-center justify-start pt-2 pb-1.5 px-1
                transition-colors text-center min-h-[52px]
                ${isSelected
                  ? "bg-ink text-paper"
                  : isToday
                  ? "bg-navy/10 dark:bg-navy/20 border border-navy/30 text-ink hover:bg-navy/15"
                  : overdueAny
                  ? "bg-signal-soft/50 border border-signal/20 text-ink hover:border-signal/40"
                  : "bg-paper border border-rule hover:border-rule-strong text-ink"
                }
                ${!isCurrentMonth ? "opacity-35" : ""}
              `}
            >
              <span className={`font-mono text-[12px] leading-none ${isSelected ? "font-bold" : isToday ? "font-bold" : "font-normal"}`}>
                {day.getDate()}
              </span>

              {/* Mission count badge */}
              {missions.length > 0 && (
                <span className={`font-mono text-[8px] mt-0.5 ${isSelected ? "text-paper/70" : allDone ? "text-mint" : "text-muted-2"}`}>
                  {allDone ? "✓" : `${missions.length}`}
                </span>
              )}

              {/* Type dots */}
              {dots.length > 0 && (
                <div className="flex items-center gap-0.5 mt-auto mb-0.5">
                  {dots.map((type) => (
                    <span
                      key={type}
                      className={`w-1.5 h-1.5 rounded-full ${isSelected ? "bg-paper/60" : TYPE_META[type]?.dot ?? "bg-muted-2"}`}
                    />
                  ))}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Weekly view ───────────────────────────────────────────────────────────────

interface WeeklyViewProps {
  anchor: Date;
  byDate: Map<string, StudyMissionRow[]>;
  selectedDate: string | null;
  onSelectDate: (d: string) => void;
  onStartMission: (m: StudyMissionRow) => void;
  launchingId: string | null;
}

function WeeklyView({ anchor, byDate, selectedDate, onSelectDate, onStartMission, launchingId }: WeeklyViewProps) {
  const days = weekDays(anchor);
  const today = todayISO();

  return (
    <div className="space-y-3">
      {days.map((day) => {
        const iso = isoDate(day);
        const missions = byDate.get(iso) ?? [];
        const isToday = iso === today;
        const isSelected = iso === selectedDate;
        const overdue = iso < today;
        const pct = completionPct(missions);

        return (
          <div
            key={iso}
            className={`rounded-2xl border transition-colors ${
              isSelected
                ? "border-ink"
                : isToday
                ? "border-navy/30 bg-navy/5 dark:bg-navy/10"
                : "border-rule hover:border-rule-strong"
            }`}
          >
            {/* Day header */}
            <button
              type="button"
              onClick={() => onSelectDate(iso)}
              aria-expanded={isSelected}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-t-2xl"
            >
              <div className="flex-shrink-0 text-left">
                <span className={`font-mono text-[9px] uppercase tracking-wider ${isToday ? "text-navy" : overdue && missions.some(m => m.status === "pending") ? "text-signal" : "text-muted-2"}`}>
                  {DAY_ABBREV[day.getDay()]}
                </span>
                <p className={`font-mono text-[20px] font-bold leading-tight ${isToday ? "text-navy dark:text-paper" : "text-ink"}`}>
                  {day.getDate()}
                </p>
              </div>

              <div className="flex-1 min-w-0">
                {missions.length === 0 ? (
                  <p className="font-sans text-[12px] text-muted-2">No missions</p>
                ) : (
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-sans text-[12px] text-ink font-medium">{missions.length} mission{missions.length !== 1 ? "s" : ""}</span>
                    <span className="font-mono text-[9px] text-muted-2">{formatMin(missions.reduce((s, m) => s + (m.estimated_min || 20), 0))}</span>
                    {pct > 0 && (
                      <span className={`font-mono text-[9px] font-bold ${pct === 100 ? "text-mint" : "text-ink"}`}>{pct}%</span>
                    )}
                  </div>
                )}

                {/* Type dot row */}
                {missions.length > 0 && (
                  <div className="flex items-center gap-1 mt-1 flex-wrap">
                    {[...new Set(missions.map((m) => m.type))].map((type) => (
                      <span
                        key={type}
                        className={`inline-flex items-center gap-1 h-[16px] px-1.5 rounded-full font-mono text-[7px] uppercase tracking-wider border ${TYPE_META[type]?.chip ?? ""}`}
                      >
                        {TYPE_META[type]?.icon}
                        {TYPE_META[type]?.label}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Progress arc */}
              {pct > 0 && pct < 100 && (
                <div className="flex-shrink-0 w-8 h-8 relative">
                  <svg viewBox="0 0 32 32" className="w-8 h-8 -rotate-90">
                    <circle cx="16" cy="16" r="12" fill="none" stroke="currentColor" strokeWidth="3" className="text-bg-2" />
                    <circle
                      cx="16" cy="16" r="12"
                      fill="none" stroke="currentColor" strokeWidth="3"
                      strokeDasharray={`${(pct / 100) * 75.4} 75.4`}
                      className="text-mint transition-all"
                    />
                  </svg>
                </div>
              )}
              {pct === 100 && (
                <CheckCircle2 size={18} className="flex-shrink-0 text-mint" />
              )}
            </button>

            {/* Expanded mission list */}
            {isSelected && missions.length > 0 && (
              <div className="px-4 pb-4 space-y-2 border-t border-rule/40 pt-3">
                {missions.map((m) => (
                  <MissionItem
                    key={m.id}
                    mission={m}
                    onStart={onStartMission}
                    launching={launchingId === m.id}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Agenda view ───────────────────────────────────────────────────────────────

interface AgendaViewProps {
  byDate: Map<string, StudyMissionRow[]>;
  onStartMission: (m: StudyMissionRow) => void;
  launchingId: string | null;
  onSelectDate: (d: string) => void;
}

function AgendaView({ byDate, onStartMission, launchingId, onSelectDate }: AgendaViewProps) {
  const today = todayISO();
  const sortedDates = [...byDate.keys()].sort();

  if (sortedDates.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <p className="font-sans text-sm text-muted-2">No missions in this range.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {sortedDates.map((iso) => {
        const missions = byDate.get(iso) ?? [];
        const isToday = iso === today;
        const overdue = iso < today;
        const pct = completionPct(missions);

        const dateLabel = new Date(iso + "T12:00:00").toLocaleDateString("en-GB", {
          weekday: "long", day: "numeric", month: "long",
        });

        return (
          <div key={iso}>
            <button
              type="button"
              onClick={() => onSelectDate(iso)}
              className="flex items-center gap-3 mb-2 w-full text-left group"
            >
              <div className={`flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center font-mono text-[13px] font-bold border ${
                isToday
                  ? "bg-navy text-paper border-navy/50"
                  : overdue && missions.some(m => m.status === "pending")
                  ? "bg-signal-soft text-[#a83020] dark:text-signal border-signal/20"
                  : pct === 100
                  ? "bg-mint/10 text-mint border-mint/20"
                  : "bg-bg-2 text-ink border-rule"
              }`}>
                {pct === 100 ? "✓" : new Date(iso + "T12:00:00").getDate()}
              </div>
              <div>
                <p className={`font-sans text-[13px] font-semibold ${isToday ? "text-navy dark:text-paper" : "text-ink"}`}>
                  {isToday ? "Today — " : ""}{dateLabel}
                </p>
                <p className="font-mono text-[9px] uppercase tracking-wide text-muted-2">
                  {missions.length} mission{missions.length !== 1 ? "s" : ""} · {formatMin(missions.reduce((s, m) => s + (m.estimated_min || 20), 0))}
                  {pct > 0 ? ` · ${pct}% done` : ""}
                </p>
              </div>
            </button>

            <div className="ml-12 space-y-2">
              {missions.map((m) => (
                <MissionItem
                  key={m.id}
                  mission={m}
                  onStart={onStartMission}
                  launching={launchingId === m.id}
                  showDate={false}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Main view ─────────────────────────────────────────────────────────────────

export default function StudyCalendarView() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [view, setView] = useState<CalendarView>("monthly");
  const [selectedDate, setSelectedDate] = useState<string | null>(todayISO());
  const [showPanel, setShowPanel] = useState(false);
  const [launchingId, setLaunchingId] = useState<string | null>(null);

  // FIX #6: Track the current local date as state so the agenda fetchRange
  // updates after midnight without requiring a page reload or navigation.
  // A useEffect schedules a timeout to tick at the next local midnight.
  const [currentDateStr, setCurrentDateStr] = useState(() => todayISO());
  useEffect(() => {
    // Compute ms until next local midnight and schedule a single tick.
    const now = new Date();
    const msUntilMidnight =
      new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime() - now.getTime();
    const timer = setTimeout(() => setCurrentDateStr(todayISO()), msUntilMidnight + 100);
    return () => clearTimeout(timer);
  }, [currentDateStr]); // re-arm after each midnight tick

  // Track the pivot point for monthly/weekly navigation
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [month, setMonth] = useState(() => new Date().getMonth());
  const [weekAnchor, setWeekAnchor] = useState(() => new Date());

  // Compute fetch range based on current view.
  // FIX #6: agenda start is derived from currentDateStr (state) not a bare
  // todayISO() call, so it updates reactively after midnight.
  const fetchRange = useMemo(() => {
    if (view === "monthly") return monthRange(year, month);
    if (view === "weekly") return weekRange(weekAnchor);
    // Agenda: fetch 90 days from today (local)
    const start = currentDateStr;
    const end90 = new Date();
    end90.setDate(end90.getDate() + 89);
    return { start, end: isoDate(end90) };
  }, [view, year, month, weekAnchor, currentDateStr]);

  const { missions, loading, error } = useScheduleRange(fetchRange.start, fetchRange.end);

  const byDate = useMemo(() => groupByDate(missions), [missions]);

  const selectedMissions = useMemo(
    () => (selectedDate ? byDate.get(selectedDate) ?? [] : []),
    [selectedDate, byDate]
  );

  // Auto-open panel on date select when there are missions
  const handleSelectDate = useCallback((iso: string) => {
    setSelectedDate(iso);
    setShowPanel(true);
  }, []);

  const handleStartMission = useCallback(async (m: StudyMissionRow) => {
    if (launchingId) return;
    setLaunchingId(m.id);
    try {
      await launchMission(m, navigate, user?.id ?? null);
    } finally {
      setLaunchingId(null);
    }
  }, [launchingId, navigate, user?.id]);

  // Navigate monthly
  const prevMonth = () => {
    if (month === 0) { setYear(y => y - 1); setMonth(11); }
    else setMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (month === 11) { setYear(y => y + 1); setMonth(0); }
    else setMonth(m => m + 1);
  };

  // Navigate weekly
  const prevWeek = () => {
    const d = new Date(weekAnchor);
    d.setDate(d.getDate() - 7);
    setWeekAnchor(d);
  };
  const nextWeek = () => {
    const d = new Date(weekAnchor);
    d.setDate(d.getDate() + 7);
    setWeekAnchor(d);
  };

  const goToday = () => {
    const now = new Date();
    setYear(now.getFullYear());
    setMonth(now.getMonth());
    setWeekAnchor(new Date());
    setSelectedDate(todayISO());
    setShowPanel(true);
  };

  // Nav label
  const navLabel = useMemo(() => {
    if (view === "monthly") return `${MONTH_NAMES[month]} ${year}`;
    if (view === "weekly") {
      const days = weekDays(weekAnchor);
      const first = days[0];
      const last = days[6];
      if (first.getMonth() === last.getMonth()) {
        return `${first.getDate()}–${last.getDate()} ${MONTH_NAMES[first.getMonth()]} ${first.getFullYear()}`;
      }
      return `${first.getDate()} ${MONTH_NAMES[first.getMonth()]} – ${last.getDate()} ${MONTH_NAMES[last.getMonth()]}`;
    }
    return "Upcoming";
  }, [view, year, month, weekAnchor]);

  const canPrev = view !== "agenda";
  const canNext = view !== "agenda";
  const handlePrev = view === "monthly" ? prevMonth : prevWeek;
  const handleNext = view === "monthly" ? nextMonth : nextWeek;

  return (
    <div className="relative min-h-screen pb-24">
      {/* Background */}
      <div className="absolute inset-0 blueprint pointer-events-none opacity-40 z-0" />
      <div className="absolute inset-0 paper-grain pointer-events-none opacity-100 z-1" />

      <div className="relative z-10 max-w-[1100px] mx-auto px-4 pt-14 pb-6">
        {/* Page header */}
        <div className="mb-6">
          <Link
            to="/today"
            className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-muted-2 hover:text-ink transition-colors mb-4"
          >
            <ArrowLeft size={12} />
            Back to Briefing
          </Link>
          <div className="flex items-end justify-between gap-3 flex-wrap">
            <div>
              <span className="block font-mono text-[10px] tracking-[0.2em] uppercase text-signal mb-1.5">
                § FLIGHT SCHEDULE · STUDY CALENDAR
              </span>
              <h1 className="font-serif text-[34px] md:text-[42px] text-ink leading-tight tracking-tight">
                Flight Schedule
              </h1>
              <p className="font-sans text-sm text-muted-2 mt-1">
                Your study missions, visualised on a calendar.
              </p>
            </div>

            {/* View toggle */}
            <div className="flex items-center gap-1 bg-bg-2 border border-rule rounded-xl p-1">
              {(["monthly", "weekly", "agenda"] as CalendarView[]).map((v) => {
                const icons: Record<CalendarView, ReactNode> = {
                  monthly: <CalendarDays size={13} />,
                  weekly:  <CalendarRange size={13} />,
                  agenda:  <List size={13} />,
                };
                return (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setView(v)}
                    aria-pressed={view === v}
                    className={`flex items-center gap-1.5 h-8 px-3 rounded-lg font-mono text-[10px] uppercase tracking-wide transition-colors ${
                      view === v
                        ? "bg-paper shadow-sm text-ink border border-rule"
                        : "text-muted-2 hover:text-ink"
                    }`}
                  >
                    {icons[v]}
                    <span className="hidden sm:inline">{v}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Nav bar */}
        {view !== "agenda" && (
          <div className="flex items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handlePrev}
                disabled={!canPrev}
                aria-label="Previous"
                className="w-8 h-8 rounded-lg border border-rule flex items-center justify-center text-muted-2 hover:text-ink hover:border-rule-strong transition-colors disabled:opacity-30"
              >
                <ArrowLeft size={14} />
              </button>
              <button
                type="button"
                onClick={handleNext}
                disabled={!canNext}
                aria-label="Next"
                className="w-8 h-8 rounded-lg border border-rule flex items-center justify-center text-muted-2 hover:text-ink hover:border-rule-strong transition-colors disabled:opacity-30"
              >
                <ArrowRight size={14} />
              </button>
              <span className="font-mono text-[13px] font-medium text-ink ml-1">{navLabel}</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={goToday}
                className="h-8 px-3 rounded-lg border border-rule text-muted-2 hover:text-ink hover:border-rule-strong font-mono text-[10px] uppercase tracking-wide flex items-center gap-1.5 transition-colors"
              >
                <RotateCcw size={11} />
                Today
              </button>
              {loading && <Loader2 size={14} className="text-muted-2 animate-spin" />}
            </div>
          </div>
        )}

        {/* Error banner */}
        {error && (
          <div className="bg-signal-soft border border-signal/20 rounded-xl px-4 py-3 font-sans text-sm text-[#a83020] dark:text-signal mb-4">
            {error}
          </div>
        )}

        {/* Main content + optional day panel side-by-side on desktop */}
        <div className={`flex gap-6 ${showPanel ? "lg:flex-row" : ""}`}>
          {/* Calendar / agenda column */}
          <div className={`flex-1 min-w-0 ${showPanel ? "lg:max-w-[580px]" : ""}`}>
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
              <AgendaView
                byDate={byDate}
                onStartMission={handleStartMission}
                launchingId={launchingId}
                onSelectDate={handleSelectDate}
              />
            )}

            {/* Loading overlay for agenda (no nav bar) */}
            {view === "agenda" && loading && (
              <div className="flex items-center justify-center py-12">
                <Loader2 size={20} className="text-muted-2 animate-spin" />
              </div>
            )}
          </div>

          {/* Day panel — desktop side panel */}
          {showPanel && selectedDate && (
            <div className="hidden lg:block flex-shrink-0 w-[360px] bg-paper border border-rule rounded-2xl overflow-hidden max-h-[700px] sticky top-6">
              <DayPanel
                dateISO={selectedDate}
                missions={selectedMissions}
                onClose={() => setShowPanel(false)}
                onStartMission={handleStartMission}
                launchingId={launchingId}
              />
            </div>
          )}
        </div>

        {/* Day panel — mobile bottom sheet */}
        {showPanel && selectedDate && (
          <div className="lg:hidden fixed inset-0 z-50 flex flex-col justify-end">
            {/* Backdrop */}
            <button
              type="button"
              className="absolute inset-0 bg-ink/40 backdrop-blur-sm"
              onClick={() => setShowPanel(false)}
              aria-label="Close day panel"
            />
            <div
              className="relative bg-bg border-t border-rule rounded-t-2xl max-h-[80dvh] flex flex-col"
              style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
            >
              {/* Pull indicator */}
              <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
                <div className="w-10 h-1 rounded-full bg-rule-strong" />
              </div>
              <DayPanel
                dateISO={selectedDate}
                missions={selectedMissions}
                onClose={() => setShowPanel(false)}
                onStartMission={handleStartMission}
                launchingId={launchingId}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
