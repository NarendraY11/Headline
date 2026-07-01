import { CheckCircle2 } from "lucide-react";
import { useMemo } from "react";
import type { StudyMissionRow } from "../../../types/studyScheduler";
import {
  completionPct,
  DAY_ABBREV,
  formatMin,
  isoDate,
  todayISO,
  weekDays,
} from "./calendarHelpers";
import { MissionItem, TYPE_META } from "./MissionItem";

interface WeeklyViewProps {
  anchor: Date;
  byDate: Map<string, StudyMissionRow[]>;
  selectedDate: string | null;
  onSelectDate: (d: string) => void;
  onStartMission: (m: StudyMissionRow) => void;
  launchingId: string | null;
}

export function WeeklyView({
  anchor,
  byDate,
  selectedDate,
  onSelectDate,
  onStartMission,
  launchingId,
}: WeeklyViewProps) {
  const days = useMemo(() => weekDays(anchor), [anchor]);
  const today = todayISO();

  // Week-level stats
  const weekStats = useMemo(() => {
    let totalMissions = 0;
    let completedMissions = 0;
    let totalMin = 0;
    for (const day of days) {
      const ms = byDate.get(isoDate(day)) ?? [];
      totalMissions += ms.length;
      completedMissions += ms.filter((m) => m.status === "completed").length;
      totalMin += ms.reduce((s, m) => s + (m.estimated_min || 20), 0);
    }
    const pct = totalMissions > 0 ? Math.round((completedMissions / totalMissions) * 100) : 0;
    return { totalMissions, completedMissions, totalMin, pct };
  }, [days, byDate]);

  return (
    <div className="space-y-3">
      {/* Week summary header */}
      {weekStats.totalMissions > 0 && (
        <div className="flex items-center gap-4 px-4 py-2.5 bg-paper border border-rule rounded-xl">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="font-mono text-[10px] uppercase tracking-widest text-muted-2">
                This week
              </span>
              <span className="font-sans text-[12px] text-ink font-medium">
                {weekStats.completedMissions}/{weekStats.totalMissions} missions
              </span>
              <span className="font-mono text-[10px] text-muted-2">
                {formatMin(weekStats.totalMin)} planned
              </span>
            </div>
            <div className="h-1 bg-bg-2 rounded-full mt-1.5 overflow-hidden">
              <div
                className="h-full bg-mint rounded-full transition-all duration-500"
                style={{ width: `${weekStats.pct}%` }}
              />
            </div>
          </div>
          <span className={`font-mono text-[13px] font-bold flex-shrink-0 ${weekStats.pct === 100 ? "text-mint" : "text-ink"}`}>
            {weekStats.pct}%
          </span>
        </div>
      )}

      {/* Day rows */}
      {days.map((day) => {
        const iso = isoDate(day);
        const missions = byDate.get(iso) ?? [];
        const isToday = iso === today;
        const isSelected = iso === selectedDate;
        const overdue = iso < today;
        const pct = completionPct(missions);
        const hasContent = missions.length > 0;

        // Collapse empty past days (not today) to a compact single-line row
        if (!hasContent && !isToday && overdue) {
          return (
            <div
              key={iso}
              className="flex items-center gap-3 px-4 py-2 rounded-xl border border-rule/50 opacity-40"
            >
              <span className="font-mono text-[10px] uppercase tracking-wider text-muted-2 w-8 flex-shrink-0">
                {DAY_ABBREV[day.getDay()]}
              </span>
              <span className="font-mono text-[16px] font-bold text-muted-2 w-7 flex-shrink-0">
                {day.getDate()}
              </span>
              <span className="font-sans text-[11px] text-muted-2">No missions</span>
            </div>
          );
        }

        // Collapse empty future days to a compact single-line row
        if (!hasContent && !isToday) {
          return (
            <div
              key={iso}
              className="flex items-center gap-3 px-4 py-2 rounded-xl border border-rule/40"
            >
              <span className="font-mono text-[10px] uppercase tracking-wider text-muted-2 w-8 flex-shrink-0">
                {DAY_ABBREV[day.getDay()]}
              </span>
              <span className="font-mono text-[16px] font-bold text-ink/40 w-7 flex-shrink-0">
                {day.getDate()}
              </span>
              <span className="font-sans text-[11px] text-muted-2 italic">Rest day</span>
            </div>
          );
        }

        // Full card for today or days with missions
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
            <button
              type="button"
              onClick={() => onSelectDate(iso)}
              aria-expanded={isSelected}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky/60 focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
            >
              <div className="flex-shrink-0 text-left">
                <span className={`font-mono text-[10px] uppercase tracking-wider ${
                  isToday
                    ? "text-navy"
                    : overdue && missions.some((m) => m.status === "pending")
                    ? "text-signal"
                    : "text-muted-2"
                }`}>
                  {DAY_ABBREV[day.getDay()]}
                </span>
                <p className={`font-mono text-[20px] font-bold leading-tight ${isToday ? "text-navy dark:text-paper" : "text-ink"}`}>
                  {day.getDate()}
                </p>
              </div>

              <div className="flex-1 min-w-0">
                {missions.length === 0 ? (
                  <p className="font-sans text-[12px] text-muted-2">
                    {isToday ? "No missions today — rest day" : "No missions"}
                  </p>
                ) : (
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-sans text-[12px] text-ink font-medium">
                      {missions.length} mission{missions.length !== 1 ? "s" : ""}
                    </span>
                    <span className="font-mono text-[10px] text-muted-2">
                      {formatMin(missions.reduce((s, m) => s + (m.estimated_min || 20), 0))}
                    </span>
                    {pct > 0 && (
                      <span className={`font-mono text-[10px] font-bold ${pct === 100 ? "text-mint" : "text-ink"}`}>
                        {pct}%
                      </span>
                    )}
                  </div>
                )}

                {missions.length > 0 && (
                  <div className="flex items-center gap-1 mt-1 flex-wrap">
                    {[...new Set(missions.map((m) => m.type))].map((type) => (
                      <span
                        key={type}
                        className={`inline-flex items-center gap-1 h-[16px] px-1.5 rounded-full font-mono text-[9px] uppercase tracking-wider border ${TYPE_META[type]?.chip ?? ""}`}
                      >
                        {TYPE_META[type]?.icon}
                        {TYPE_META[type]?.label}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {pct > 0 && pct < 100 && (
                <div className="flex-shrink-0 w-8 h-8 relative">
                  <svg viewBox="0 0 32 32" className="w-8 h-8 -rotate-90" aria-hidden="true">
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
              {pct === 100 && <CheckCircle2 size={18} className="flex-shrink-0 text-mint" />}
            </button>

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
