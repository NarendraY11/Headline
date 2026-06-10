import { CalendarDays, ChevronDown, ChevronUp, Clock, Loader2, Plus, Target } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { launchTask } from "../../lib/launchMission";
import type { StudyPlanDay } from "../../types/studyScheduler";
import { PlanTaskBlock } from "./PlanTaskBlock";

const PRIORITY_HUE: Record<number, { dot: string; label: string }> = {
  1: { dot: "bg-signal",  label: "CRITICAL" },
  2: { dot: "bg-amber",   label: "HIGH"     },
  3: { dot: "bg-mint",    label: "NORMAL"   },
};

function dayPriority(day: StudyPlanDay): number {
  const types = day.tasks.map((t) => t.type);
  if (types.includes("mock") || types.includes("mini_test")) return 1;
  if (types.includes("drill") || types.includes("viva")) return 2;
  return 3;
}

function totalMinutes(day: StudyPlanDay): number {
  if (day.estimatedMin) return day.estimatedMin;
  return day.tasks.reduce((s, t) => s + t.estimatedMin, 0);
}

function formatMin(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

interface Props {
  day: StudyPlanDay;
  defaultOpen?: boolean;
}

export function PlanDayCard({ day, defaultOpen = false }: Props) {
  const [open, setOpen] = useState(defaultOpen);
  const [launching, setLaunching] = useState(false);
  const navigate = useNavigate();
  const { user } = useAuth();
  const priority = dayPriority(day);
  const hue = PRIORITY_HUE[priority] ?? PRIORITY_HUE[3];
  const mins = totalMinutes(day);
  const taskCount = day.tasks.length;

  const handleStartStudying = async () => {
    if (launching || day.tasks.length === 0) return;
    setLaunching(true);
    try {
      await launchTask(day.tasks[0], navigate, user?.id ?? null);
    } finally {
      setLaunching(false);
    }
  };

  return (
    <div
      className={`bg-paper border rounded-2xl overflow-hidden shadow-[0_1px_3px_rgba(13,26,45,0.06)] transition-all duration-200 ${
        open ? "border-rule-strong" : "border-rule"
      }`}
    >
      {/* Header — always visible, tap to toggle */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-bg-2/40 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky/60 focus-visible:ring-inset"
      >
        {/* Day badge */}
        <div className="flex-shrink-0 w-9 h-9 rounded-xl bg-ink text-paper flex flex-col items-center justify-center leading-none shadow-sm">
          <span className="font-mono text-[7px] uppercase tracking-widest opacity-60">DAY</span>
          <span className="font-serif text-[15px] leading-none">{day.dayIndex + 1}</span>
        </div>

        {/* Theme + meta */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
            {/* Priority dot */}
            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${hue.dot}`} aria-hidden="true" />
            <span className="font-mono text-[9px] uppercase tracking-wider text-muted-2">{hue.label}</span>
          </div>
          <p className="font-serif text-[15px] text-ink leading-snug truncate">{day.theme}</p>
          <div className="flex items-center gap-3 mt-1">
            <span className="flex items-center gap-1 font-mono text-[9px] text-muted-2 uppercase tracking-wide">
              <Clock size={10} aria-hidden="true" />
              {formatMin(mins)}
            </span>
            <span className="flex items-center gap-1 font-mono text-[9px] text-muted-2 uppercase tracking-wide">
              <Target size={10} aria-hidden="true" />
              {taskCount} {taskCount === 1 ? "task" : "tasks"}
            </span>
          </div>
        </div>

        {/* Expand icon */}
        <div className="flex-shrink-0 text-muted-2">
          {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </div>
      </button>

      {/* Expanded body */}
      {open && (
        <div className="border-t border-rule/50">
          {/* Tasks */}
          <div className="px-4 pt-1 pb-2">
            {day.tasks.map((task, i) => (
              <PlanTaskBlock key={task.taskRef} task={task} index={i} />
            ))}
          </div>

          {/* Day action row */}
          <div className="flex items-center gap-2 px-4 pb-4 pt-1 border-t border-rule/30">
            <button
              type="button"
              disabled={launching || day.tasks.length === 0}
              onClick={handleStartStudying}
              aria-label="Start studying this day"
              className="flex-1 h-9 rounded-xl bg-ink text-paper font-sans text-[12px] font-medium flex items-center justify-center gap-1.5 hover:bg-ink-2 transition-colors disabled:opacity-50 disabled:cursor-wait"
            >
              {launching ? (
                <Loader2 size={13} className="animate-spin" aria-hidden="true" />
              ) : (
                <CalendarDays size={13} aria-hidden="true" />
              )}
              Start Studying
            </button>
            <button
              type="button"
              disabled
              aria-label="Add this day to schedule (coming soon)"
              className="h-9 px-3 rounded-xl border border-rule text-muted-2 font-sans text-[12px] font-medium flex items-center justify-center gap-1.5 cursor-not-allowed select-none bg-bg-2/50"
            >
              <Plus size={13} aria-hidden="true" />
              Add to Schedule
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
