import type { StudyMissionRow } from "../../../types/studyScheduler";
import { completionPct, formatMin, todayISO } from "./calendarHelpers";
import { MissionItem } from "./MissionItem";

interface AgendaViewProps {
  byDate: Map<string, StudyMissionRow[]>;
  onStartMission: (m: StudyMissionRow) => void;
  launchingId: string | null;
  onSelectDate: (d: string) => void;
}

export function AgendaView({ byDate, onStartMission, launchingId, onSelectDate }: AgendaViewProps) {
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

        const dateLabel = new Date(iso + "T12:00:00Z").toLocaleDateString("en-GB", {
          weekday: "long", day: "numeric", month: "long",
        });

        return (
          <div key={iso}>
            <button
              type="button"
              onClick={() => onSelectDate(iso)}
              className="flex items-center gap-3 mb-2 w-full text-left group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky/60 focus-visible:ring-offset-2 focus-visible:ring-offset-bg rounded-lg"
            >
              <div className={`flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center font-mono text-[13px] font-bold border ${
                isToday
                  ? "bg-navy text-paper border-navy/50"
                  : overdue && missions.some((m) => m.status === "pending")
                  ? "bg-signal-soft text-[#a83020] dark:text-signal border-signal/20"
                  : pct === 100
                  ? "bg-mint/10 text-mint border-mint/20"
                  : "bg-bg-2 text-ink border-rule"
              }`}>
                {pct === 100 ? "✓" : new Date(iso + "T12:00:00Z").getDate()}
              </div>
              <div>
                <p className={`font-sans text-[13px] font-semibold ${isToday ? "text-navy dark:text-paper" : "text-ink"}`}>
                  {isToday ? "Today — " : ""}{dateLabel}
                </p>
                <p className="font-mono text-[10px] uppercase tracking-wide text-muted-2">
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
