import { useMemo } from "react";
import type { StudyMissionRow } from "../../../types/studyScheduler";
import {
  calendarGrid,
  completionPct,
  DAY_ABBREV,
  formatMin,
  isoDate,
  MONTH_NAMES,
  todayISO,
} from "./calendarHelpers";
import { TYPE_META } from "./MissionItem";

interface MonthlyViewProps {
  year: number;
  month: number;
  byDate: Map<string, StudyMissionRow[]>;
  selectedDate: string | null;
  onSelectDate: (d: string) => void;
}

export function MonthlyView({ year, month, byDate, selectedDate, onSelectDate }: MonthlyViewProps) {
  const days = useMemo(() => calendarGrid(year, month), [year, month]);
  const today = todayISO();

  return (
    <div>
      {/* Day-of-week header */}
      <div className="grid grid-cols-7 mb-1">
        {DAY_ABBREV.map((d) => (
          <div key={d} className="text-center font-mono text-[10px] uppercase tracking-wider text-muted-2 py-2">
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
          const overdueAny =
            !isToday &&
            iso < today &&
            missions.some((m) => m.status === "pending" || m.status === "in_progress");
          const pct = completionPct(missions);
          const allDone = missions.length > 0 && pct === 100;
          const totalMin = missions.reduce((s, m) => s + (m.estimated_min || 20), 0);

          const dots = [...new Set(missions.map((m) => m.type))].slice(0, 3);

          return (
            <button
              key={iso}
              type="button"
              onClick={() => onSelectDate(iso)}
              aria-label={`${day.getDate()} ${MONTH_NAMES[day.getMonth()]}, ${missions.length} mission${missions.length !== 1 ? "s" : ""}`}
              aria-pressed={isSelected}
              className={[
                "relative rounded-xl flex flex-col items-center justify-start pt-2 pb-1.5 px-1",
                "transition-colors text-center min-h-[52px] lg:min-h-[76px]",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky/60 focus-visible:ring-offset-1 focus-visible:ring-offset-bg",
                isSelected
                  ? "bg-ink text-paper"
                  : isToday
                  ? "bg-navy/10 dark:bg-navy/20 border border-navy/30 text-ink hover:bg-navy/15"
                  : overdueAny
                  ? "bg-signal-soft/50 border border-signal/20 text-ink hover:border-signal/40"
                  : "bg-paper border border-rule hover:border-rule-strong text-ink",
                !isCurrentMonth ? "opacity-35" : "",
              ].join(" ")}
            >
              <span className={`font-mono text-[12px] leading-none ${isSelected || isToday ? "font-bold" : "font-normal"}`}>
                {day.getDate()}
              </span>

              {missions.length > 0 && (
                <span className={`font-mono text-[9px] mt-0.5 ${isSelected ? "text-paper/70" : allDone ? "text-mint" : "text-muted-2"}`}>
                  {allDone ? "✓" : `${missions.length}`}
                </span>
              )}

              {/* Desktop: show est. time when missions exist */}
              {missions.length > 0 && !allDone && totalMin > 0 && (
                <span className={`hidden lg:block font-mono text-[8px] mt-0.5 ${isSelected ? "text-paper/50" : "text-muted-2"}`}>
                  {formatMin(totalMin)}
                </span>
              )}

              {dots.length > 0 && (
                <div className="flex items-center gap-0.5 mt-auto mb-0.5">
                  {dots.map((type) => (
                    <span
                      key={type}
                      className={`w-1.5 h-1.5 rounded-full ${isSelected ? "bg-paper/60" : (TYPE_META[type]?.dot ?? "bg-muted-2")}`}
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
