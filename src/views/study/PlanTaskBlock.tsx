import {
  BookOpen,
  Brain,
  ClipboardList,
  Layers,
  Mic,
  Repeat,
  Zap,
} from "lucide-react";
import type { StudyPlanTask } from "../../types/studyScheduler";

const MISSION_META: Record<
  string,
  { label: string; icon: React.ReactNode; chipClass: string }
> = {
  drill:     { label: "Drill",     icon: <Zap size={11} />,         chipClass: "bg-signal-soft text-[#a83020] dark:text-signal border-signal/15" },
  review:    { label: "Review",    icon: <Repeat size={11} />,      chipClass: "bg-sky-soft text-sky border-sky/15" },
  viva:      { label: "Viva",      icon: <Mic size={11} />,         chipClass: "bg-amber-soft text-[#855807] dark:text-amber border-amber/15" },
  flashcard: { label: "Flashcard", icon: <Brain size={11} />,       chipClass: "bg-mint-soft text-mint border-mint/15" },
  mini_test: { label: "Mini Test", icon: <ClipboardList size={11} />, chipClass: "bg-bg-2 text-ink-2 border-rule" },
  mock:      { label: "Mock Exam", icon: <Layers size={11} />,      chipClass: "bg-navy/10 text-navy dark:text-navy border-navy/20" },
  read:      { label: "Read",      icon: <BookOpen size={11} />,    chipClass: "bg-bg-2 text-ink-2 border-rule" },
};

const DIFF_CHIP: Record<string, { label: string; cls: string }> = {
  standard: { label: "STD",     cls: "bg-mint-soft text-mint border-mint/15" },
  complex:  { label: "COMPLEX", cls: "bg-amber-soft text-[#855807] dark:text-amber border-amber/15" },
  extreme:  { label: "EXTREME", cls: "bg-signal-soft text-[#a83020] dark:text-signal border-signal/15" },
  mixed:    { label: "MIXED",   cls: "bg-sky-soft text-sky border-sky/15" },
};

interface Props {
  task: StudyPlanTask;
  index: number;
}

export function PlanTaskBlock({ task, index }: Props) {
  const meta = MISSION_META[task.type] ?? MISSION_META.drill;
  const diff = task.difficulty ? DIFF_CHIP[task.difficulty] : null;

  return (
    <div className="flex gap-3 py-3 border-b border-rule/40 last:border-0 group">
      {/* Left: index bubble */}
      <div className="flex-shrink-0 w-6 h-6 rounded-full bg-bg-2 border border-rule flex items-center justify-center mt-0.5">
        <span className="font-mono text-[9px] text-muted-2 leading-none">{index + 1}</span>
      </div>

      {/* Right: content */}
      <div className="flex-1 min-w-0">
        {/* Chips row */}
        <div className="flex items-center flex-wrap gap-1.5 mb-1.5">
          <span
            className={`inline-flex items-center gap-1 h-[22px] px-2 rounded-full font-mono text-[9px] uppercase tracking-wider border ${meta.chipClass}`}
          >
            {meta.icon}
            {meta.label}
          </span>
          {diff && (
            <span
              className={`h-[22px] px-2 rounded-full font-mono text-[9px] uppercase tracking-wider border inline-flex items-center ${diff.cls}`}
            >
              {diff.label}
            </span>
          )}
          {task.targetCount && (
            <span className="h-[22px] px-2 rounded-full font-mono text-[9px] uppercase tracking-wider border bg-bg-2 text-ink-2 border-rule inline-flex items-center">
              {task.targetCount}Q
            </span>
          )}
        </div>

        {/* Title */}
        <p className="font-sans text-[13px] font-medium text-ink leading-snug mb-0.5 truncate">
          {task.title}
        </p>

        {/* Rationale */}
        {task.rationale && (
          <p className="font-sans text-[11px] text-muted-2 leading-snug line-clamp-2">
            {task.rationale}
          </p>
        )}

        {/* Footer: duration */}
        <div className="flex items-center gap-3 mt-1.5">
          <span className="font-mono text-[9px] text-muted-2 uppercase tracking-wide">
            ~{task.estimatedMin}min
          </span>
        </div>
      </div>
    </div>
  );
}
