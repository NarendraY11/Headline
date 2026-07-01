import {
  AlertTriangle, Brain, BookOpen, CheckCircle2, ClipboardList,
  Clock, Layers, Loader2, Mic, Play, Repeat, SkipForward, Zap,
} from "lucide-react";
import type { ReactNode } from "react";
import type { MissionType, StudyMissionRow } from "../../../types/studyScheduler";
import { formatMin, isOverdue, missionTitle, STATUS_CONFIG } from "./calendarHelpers";

export const TYPE_META: Record<MissionType, { label: string; icon: ReactNode; dot: string; chip: string }> = {
  drill:     { label: "Drill",     icon: <Zap size={10} />,           dot: "bg-signal",  chip: "bg-signal-soft text-[#a83020] dark:text-signal border-signal/15" },
  review:    { label: "Review",    icon: <Repeat size={10} />,        dot: "bg-sky",     chip: "bg-sky-soft text-sky border-sky/15" },
  viva:      { label: "Viva",      icon: <Mic size={10} />,           dot: "bg-amber",   chip: "bg-amber-soft text-[#855807] dark:text-amber border-amber/15" },
  flashcard: { label: "Flashcard", icon: <Brain size={10} />,         dot: "bg-mint",    chip: "bg-mint-soft text-mint border-mint/15" },
  mini_test: { label: "Mini Test", icon: <ClipboardList size={10} />, dot: "bg-ink-2",   chip: "bg-bg-2 text-ink-2 border-rule" },
  mock:      { label: "Mock",      icon: <Layers size={10} />,        dot: "bg-navy",    chip: "bg-navy/10 text-navy dark:text-navy border-navy/20" },
  read:      { label: "Read",      icon: <BookOpen size={10} />,      dot: "bg-muted-2", chip: "bg-bg-2 text-ink-2 border-rule" },
};

function StatusDot({ status }: { status: StudyMissionRow["status"] }) {
  const { cls, label } = STATUS_CONFIG[status] ?? STATUS_CONFIG.pending;
  return (
    <span
      className={`w-2 h-2 rounded-full flex-shrink-0 ${cls}`}
      title={label}
      aria-label={label}
    />
  );
}

export interface MissionItemProps {
  mission: StudyMissionRow;
  onStart: (m: StudyMissionRow) => void;
  launching: boolean;
  showDate?: boolean;
}

export function MissionItem({ mission, onStart, launching, showDate }: MissionItemProps) {
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
          <span className={`inline-flex items-center gap-1 h-[18px] px-1.5 rounded-full font-mono text-[9px] uppercase tracking-wider border ${meta.chip}`}>
            {meta.icon}
            {meta.label}
          </span>
          {overdue && (
            <span className="inline-flex items-center gap-1 h-[18px] px-1.5 rounded-full font-mono text-[9px] uppercase tracking-wider border bg-signal-soft text-[#a83020] dark:text-signal border-signal/15">
              <AlertTriangle size={8} />
              Overdue
            </span>
          )}
          {showDate && (
            <span className="font-mono text-[9px] text-muted-2 uppercase tracking-wide">
              {mission.scheduled_date}
            </span>
          )}
        </div>
        <p className="font-sans text-[13px] font-medium text-ink leading-snug truncate">
          {missionTitle(mission)}
        </p>
      </div>

      <div className="flex items-center gap-1 font-mono text-[10px] text-muted-2 uppercase tracking-wide flex-shrink-0">
        <Clock size={9} aria-hidden="true" />
        {formatMin(mission.estimated_min || 20)}
      </div>

      {isDone ? (
        <div className="flex-shrink-0 flex items-center gap-1 font-mono text-[10px] uppercase tracking-wide text-muted-2 pl-1">
          {mission.status === "completed"
            ? <><CheckCircle2 size={12} className="text-mint" /> Done</>
            : <><SkipForward size={12} /> Skipped</>}
        </div>
      ) : overdue ? (
        <button
          type="button"
          disabled={launching}
          onClick={() => onStart(mission)}
          aria-label="Start now"
          className="h-8 px-2.5 rounded-lg bg-signal text-paper font-mono text-[10px] uppercase tracking-wide flex items-center gap-1 hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-wait focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky/60 focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
        >
          {launching ? <Loader2 size={11} className="animate-spin" /> : <Play size={11} />}
          Start
        </button>
      ) : (
        <button
          type="button"
          disabled={launching}
          onClick={() => onStart(mission)}
          aria-label={`Start ${meta.label}`}
          className="flex-shrink-0 h-8 w-8 rounded-lg bg-ink text-paper flex items-center justify-center hover:bg-ink-2 transition-colors disabled:opacity-50 disabled:cursor-wait focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky/60 focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
        >
          {launching ? <Loader2 size={13} className="animate-spin" /> : <Play size={12} aria-hidden="true" />}
        </button>
      )}
    </div>
  );
}
