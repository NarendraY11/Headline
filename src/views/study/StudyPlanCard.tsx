import {
  AlertTriangle,
  BarChart2,
  BookOpen,
  Calendar,
  CheckCircle2,
  Clock,
  Layers,
  TrendingUp,
} from "lucide-react";
import { useEffect } from "react";
import type { StudyPlan, StudyPlanWeakArea } from "../../types/studyScheduler";
import { PlanDayCard } from "./PlanDayCard";
import { trackStudyPlanViewed } from "../../lib/studyAnalytics";

function masteryColor(mastery: number): string {
  if (mastery >= 80) return "bg-mint";
  if (mastery >= 50) return "bg-amber";
  return "bg-signal";
}

function masteryLabel(mastery: number): string {
  if (mastery >= 80) return "Strong";
  if (mastery >= 50) return "Developing";
  return "Weak";
}

function formatMin(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function WeakAreaRow({ area }: { area: StudyPlanWeakArea }) {
  const col = masteryColor(area.mastery);
  const lbl = masteryLabel(area.mastery);

  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-rule/40 last:border-0">
      {/* Priority badge */}
      <div className="flex-shrink-0 w-7 h-7 rounded-lg bg-signal-soft border border-signal/15 flex items-center justify-center">
        <span className="font-mono text-[9px] font-bold text-[#a83020] dark:text-signal">
          #{area.priority}
        </span>
      </div>

      {/* Label + bar */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2 mb-1">
          <span className="font-sans text-[12px] font-medium text-ink truncate">{area.label}</span>
          <span className="font-mono text-[9px] text-muted-2 flex-shrink-0">{area.mastery}% · {lbl}</span>
        </div>
        <div className="h-1.5 rounded-full bg-bg-2 border border-rule/30 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${col}`}
            style={{ width: `${area.mastery}%` }}
          />
        </div>
      </div>

      {/* Est. recovery */}
      {area.estRecoveryDays != null && (
        <div className="flex-shrink-0 text-right">
          <span className="font-mono text-[9px] text-muted-2 uppercase tracking-wide">
            ~{area.estRecoveryDays}d
          </span>
        </div>
      )}
    </div>
  );
}

interface Props {
  plan: StudyPlan;
  planId?: string;
  generatedAt?: string;
}

export function StudyPlanCard({ plan, planId, generatedAt }: Props) {
  const { meta, weakAreas, days } = plan;

  useEffect(() => {
    if (planId) trackStudyPlanViewed(planId);
  }, [planId]);
  const totalMin = meta.totalEstimatedMin ?? days.reduce((s, d) => {
    const dm = d.estimatedMin ?? d.tasks.reduce((ts, t) => ts + t.estimatedMin, 0);
    return s + dm;
  }, 0);

  const maxRecovery = weakAreas.length > 0
    ? Math.max(...weakAreas.map((a) => a.estRecoveryDays ?? 0))
    : null;

  const genDate = generatedAt
    ? new Date(generatedAt).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : null;

  return (
    <div className="space-y-5">
      {/* ── Plan Header Card ─────────────────────────────────── */}
      <div className="bg-ink rounded-2xl p-5 md:p-6 relative overflow-hidden shadow-lg">
        {/* Background compass watermark */}
        <div className="absolute -right-8 -bottom-8 opacity-10 pointer-events-none select-none">
          <Layers size={180} strokeWidth={0.8} className="text-paper" />
        </div>

        <div className="relative z-10">
          {/* Eyebrow */}
          <div className="flex items-center gap-2 mb-3">
            <span className="w-1.5 h-1.5 rounded-sm bg-mint rotate-45 flex-shrink-0" />
            <span className="font-mono text-[10px] uppercase tracking-widest text-paper/60">
              AI STUDY PLAN · FLIGHT BRIEF
            </span>
          </div>

          {/* Plan name */}
          <h2 className="font-serif text-[28px] md:text-[34px] text-paper leading-tight tracking-tight mb-2">
            {meta.name}
          </h2>

          {/* Summary */}
          <p className="font-sans text-[13px] text-paper/70 leading-relaxed mb-5 max-w-lg">
            {meta.summary}
          </p>

          {/* Stats row */}
          <div className="flex flex-wrap items-center gap-4 border-t border-paper/15 pt-4">
            <div className="flex items-center gap-1.5">
              <Calendar size={13} className="text-paper/50" />
              <span className="font-mono text-[11px] text-paper/70">
                {meta.horizonDays} day{meta.horizonDays !== 1 ? "s" : ""}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <Clock size={13} className="text-paper/50" />
              <span className="font-mono text-[11px] text-paper/70">
                {formatMin(totalMin)} total
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <BookOpen size={13} className="text-paper/50" />
              <span className="font-mono text-[11px] text-paper/70">
                {days.length} sessions
              </span>
            </div>
            {meta.targetDate && (
              <div className="flex items-center gap-1.5">
                <CheckCircle2 size={13} className="text-paper/50" />
                <span className="font-mono text-[11px] text-paper/70">
                  Target:{" "}
                  {new Date(meta.targetDate).toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "short",
                  })}
                </span>
              </div>
            )}
            {genDate && (
              <span className="font-mono text-[9px] text-paper/40 ml-auto">
                Generated {genDate}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── Weak Areas ───────────────────────────────────────── */}
      {weakAreas.length > 0 && (
        <div className="bg-paper border border-rule-strong rounded-2xl overflow-hidden shadow-[0_1px_3px_rgba(13,26,45,0.06)]">
          <div className="flex items-center gap-2 px-5 py-3.5 border-b border-rule/50">
            <AlertTriangle size={14} className="text-signal flex-shrink-0" />
            <span className="font-mono text-[10px] uppercase tracking-widest text-ink-2">
              Weak Areas · Priority Focus
            </span>
            <div className="ml-auto flex items-center gap-3">
              {maxRecovery != null && maxRecovery > 0 && (
                <div className="flex items-center gap-1.5">
                  <TrendingUp size={12} className="text-muted-2" />
                  <span className="font-mono text-[9px] text-muted-2 uppercase tracking-wide">
                    Recovery ~{maxRecovery}d
                  </span>
                </div>
              )}
              <span className="font-mono text-[9px] text-muted-2 uppercase">
                {weakAreas.length} area{weakAreas.length !== 1 ? "s" : ""}
              </span>
            </div>
          </div>
          <div className="px-5 py-1">
            {weakAreas.map((area) => (
              <WeakAreaRow key={area.subjectId} area={area} />
            ))}
          </div>
        </div>
      )}

      {/* ── Plan overview strip ───────────────────────────────── */}
      <div className="bg-bg-2/60 border border-rule rounded-2xl px-5 py-4">
        <div className="flex items-center gap-2 mb-3">
          <BarChart2 size={13} className="text-navy" />
          <span className="font-mono text-[10px] uppercase tracking-widest text-ink-2">
            Plan Overview
          </span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Total Days",    value: String(days.length)        },
            { label: "Study Time",    value: formatMin(totalMin)        },
            { label: "Weak Subjects", value: String(weakAreas.length)   },
            { label: "Tasks",         value: String(days.reduce((s, d) => s + d.tasks.length, 0)) },
          ].map(({ label, value }) => (
            <div key={label} className="bg-paper border border-rule rounded-xl px-3 py-2.5">
              <span className="block font-mono text-[9px] uppercase tracking-wide text-muted-2 mb-1">
                {label}
              </span>
              <span className="font-serif text-[20px] text-ink leading-none">{value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Day-by-day breakdown ─────────────────────────────── */}
      <div>
        <div className="flex items-center gap-2 mb-3 px-1">
          <span className="font-mono text-[10px] uppercase tracking-widest text-ink-2">
            Day-by-Day Briefing
          </span>
          <span className="flex-1 h-px bg-rule" />
          <span className="font-mono text-[9px] text-muted-2 uppercase">
            {days.length} sessions
          </span>
        </div>
        <div className="space-y-2">
          {days.map((day, i) => (
            <PlanDayCard key={day.dayIndex} day={day} defaultOpen={i === 0} />
          ))}
        </div>
      </div>
    </div>
  );
}
