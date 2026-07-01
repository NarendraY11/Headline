import { ChevronLeft, Loader2, Play } from "lucide-react";
import { completionPct, formatMin, todayISO } from "./calendarHelpers";
import { MissionItem } from "./MissionItem";
import type { StudyMissionRow } from "../../../types/studyScheduler";

interface DayPanelProps {
  dateISO: string;
  missions: StudyMissionRow[];
  onClose: () => void;
  onStartMission: (m: StudyMissionRow) => void;
  launchingId: string | null;
}

export function DayPanel({ dateISO, missions, onClose, onStartMission, launchingId }: DayPanelProps) {
  const totalMin = missions.reduce((s, m) => s + (m.estimated_min || 20), 0);
  const pct = completionPct(missions);
  const pendingMissions = missions.filter((m) => m.status === "pending" || m.status === "in_progress");
  const today = todayISO();
  const isToday = dateISO === today;
  const overdue = dateISO < today;

  const dateLabel = new Date(dateISO + "T12:00:00Z").toLocaleDateString("en-GB", {
    weekday: "long", day: "numeric", month: "long",
  });

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-4 border-b border-rule flex-shrink-0">
        <div>
          <span className={`font-mono text-[10px] uppercase tracking-wider ${isToday ? "text-signal" : overdue ? "text-amber" : "text-muted-2"}`}>
            {isToday ? "§ TODAY" : overdue ? "§ OVERDUE" : "§ SCHEDULED"}
          </span>
          <h2 className="font-serif text-[20px] text-ink leading-tight mt-0.5">{dateLabel}</h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close day panel"
          className="mt-1 flex-shrink-0 w-8 h-8 rounded-lg border border-rule flex items-center justify-center text-muted-2 hover:text-ink hover:border-rule-strong transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky/60 focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
        >
          <ChevronLeft size={14} />
        </button>
      </div>

      {/* Stats strip */}
      {missions.length > 0 && (
        <div className="flex items-center gap-4 px-5 py-3 border-b border-rule/50 flex-shrink-0">
          <div className="text-center">
            <p className="font-mono text-[18px] font-bold text-ink leading-none">{missions.length}</p>
            <p className="font-mono text-[10px] uppercase tracking-wider text-muted-2 mt-0.5">Missions</p>
          </div>
          <div className="w-px h-8 bg-rule" />
          <div className="text-center">
            <p className="font-mono text-[18px] font-bold text-ink leading-none">{formatMin(totalMin)}</p>
            <p className="font-mono text-[10px] uppercase tracking-wider text-muted-2 mt-0.5">Est. time</p>
          </div>
          <div className="w-px h-8 bg-rule" />
          <div className="flex-1">
            <div className="flex items-center justify-between mb-1">
              <p className="font-mono text-[10px] uppercase tracking-wider text-muted-2">Progress</p>
              <p className="font-mono text-[11px] font-bold text-ink">{pct}%</p>
            </div>
            <div className="h-1.5 bg-bg-2 rounded-full overflow-hidden">
              <div className="h-full bg-mint rounded-full transition-all" style={{ width: `${pct}%` }} />
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
        <div
          className="px-5 py-4 border-t border-rule flex-shrink-0"
          style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 16px)" }}
        >
          <button
            type="button"
            onClick={() => onStartMission(pendingMissions[0])}
            disabled={launchingId === pendingMissions[0].id}
            className="w-full h-12 rounded-2xl bg-navy text-paper dark:bg-paper dark:text-ink font-sans text-[14px] font-semibold flex items-center justify-center gap-2 shadow-[0_4px_20px_rgba(20,48,90,0.25)] transition-opacity hover:opacity-90 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky/60 focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
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
