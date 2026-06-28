import { Activity, BookOpen, Brain, CheckCircle, Clock, TrendingUp } from "lucide-react";
import { Link } from "react-router-dom";
import type { AdaptiveOutput } from "../../lib/adaptiveLearningEngine";

interface Props {
  output: AdaptiveOutput;
  loading?: boolean;
}

const HEALTH_DOT: Record<string, string> = {
  green: "bg-emerald-500",
  yellow: "bg-amber-400",
  red: "bg-red-500",
};

const READINESS_BADGE: Record<string, { bg: string; text: string; label: string }> = {
  ready: { bg: "bg-emerald-100 dark:bg-emerald-900/30", text: "text-emerald-700 dark:text-emerald-400", label: "Exam Ready" },
  "needs-review": { bg: "bg-amber-100 dark:bg-amber-900/30", text: "text-amber-700 dark:text-amber-400", label: "Needs Review" },
  "at-risk": { bg: "bg-red-100 dark:bg-red-900/30", text: "text-red-700 dark:text-red-400", label: "At Risk" },
};

export function ReadinessPanel({ output, loading }: Props) {
  if (loading) {
    return <div className="w-full h-36 bg-bg-2 animate-pulse rounded-2xl mb-4" />;
  }

  const { recommendation, readinessScore, studyHealth, examReadiness } = output;
  const rb = READINESS_BADGE[examReadiness.status];

  const url = recommendation.nextModuleId
    ? `/quiz/${recommendation.nextModuleId}`
    : "/modules";

  return (
    <div className="bg-paper border border-rule rounded-2xl p-4 shadow-sm mb-4">
      <div className="font-mono text-[9px] text-muted-2 tracking-wide uppercase flex items-center gap-1.5 mb-3">
        <Brain size={12} className="text-ink" />
        ADAPTIVE READINESS — PHASE 9
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        {/* Readiness score */}
        <div className="bg-bg-2 rounded-xl p-3">
          <div className="text-3xl font-bold font-mono text-ink">{readinessScore.score}<span className="text-xs text-muted-2">/100</span></div>
          <div className="text-[10px] text-muted-2 mt-0.5">Readiness Score</div>
          <div className="mt-1.5 h-1 bg-rule rounded-full overflow-hidden">
            <div className="h-full bg-signal rounded-full" style={{ width: `${readinessScore.score}%` }} />
          </div>
        </div>

        {/* Study health */}
        <div className="bg-bg-2 rounded-xl p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <div className={`w-2.5 h-2.5 rounded-full ${HEALTH_DOT[studyHealth.status]}`} />
            <span className="text-sm font-semibold text-ink capitalize">{studyHealth.status === "green" ? "Healthy" : studyHealth.status === "yellow" ? "Fair" : "Needs Work"}</span>
          </div>
          <div className="text-[10px] text-muted-2">Study Health</div>
          {studyHealth.reasons[0] && (
            <div className="text-[9px] text-muted-2 mt-1 truncate">{studyHealth.reasons[0].label}</div>
          )}
        </div>

        {/* Exam readiness */}
        <div className="bg-bg-2 rounded-xl p-3">
          <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium mb-1 ${rb.bg} ${rb.text}`}>
            {rb.label}
          </div>
          <div className="text-[10px] text-muted-2">{examReadiness.remainingSubjects} subjects · {examReadiness.remainingModules} modules left</div>
          <div className="text-[10px] text-muted-2">~{Math.round(examReadiness.estimatedStudyHours)}h remaining</div>
        </div>

        {/* Analytics */}
        <div className="bg-bg-2 rounded-xl p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <Activity size={12} className="text-signal" />
            <span className="text-sm font-semibold text-ink">{output.studyVelocity}</span>
            <span className="text-[10px] text-muted-2">modules/wk</span>
          </div>
          <div className="text-[10px] text-muted-2">Study Velocity</div>
          {output.projectedCompletionDate && (
            <div className="text-[9px] text-muted-2 mt-1">
              Done by {output.projectedCompletionDate.toLocaleDateString("en-IN", { month: "short", day: "numeric" })}
            </div>
          )}
        </div>
      </div>

      {/* Next recommendation */}
      {recommendation.nextSubjectLabel && (
        <Link
          to={url}
          className="flex items-center justify-between bg-signal/5 border border-signal/20 rounded-xl p-3 hover:bg-signal/10 transition-colors group mb-3"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-signal/10 flex items-center justify-center flex-shrink-0">
              <BookOpen size={14} className="text-signal" />
            </div>
            <div>
              <div className="text-xs font-semibold text-ink">
                {recommendation.nextModuleLabel ?? recommendation.nextSubjectLabel}
              </div>
              <div className="text-[10px] text-muted-2">{recommendation.reasonLabel}</div>
            </div>
          </div>
          <div className="flex items-center gap-2 text-muted-2 group-hover:text-signal transition-colors">
            <Clock size={11} />
            <span className="text-[10px]">{recommendation.estimatedMinutes}m</span>
          </div>
        </Link>
      )}

      {/* Weak/strong analytics — only when ≥2 distinct modules have data */}
      {(() => {
        const hasComparative = output.weakestModules.length >= 2 &&
          output.strongestModules[0]?.moduleId !== output.weakestModules[0]?.moduleId;
        if (output.weakestModules.length === 0) return null;
        if (!hasComparative) {
          return (
            <p className="text-[9px] text-muted-2 mt-1">Complete more modules to unlock comparative analytics.</p>
          );
        }
        return null;
      })()}
      <div className="grid grid-cols-2 gap-3">
        {output.weakestModules.length >= 2 && output.strongestModules[0]?.moduleId !== output.weakestModules[0]?.moduleId && (
          <div>
            <div className="flex items-center gap-1.5 mb-1.5">
              <TrendingUp size={10} className="text-red-400" />
              <span className="text-[9px] text-muted-2 uppercase tracking-wide font-mono">Weakest Modules</span>
            </div>
            <div className="space-y-1">
              {output.weakestModules.slice(0, 3).map(m => (
                <div key={m.moduleId} className="flex items-center justify-between">
                  <span className="text-[10px] text-ink truncate">{m.moduleId}</span>
                  <span className="text-[10px] text-red-500 ml-2">{Math.round(m.masteryPct)}%</span>
                </div>
              ))}
            </div>
          </div>
        )}
        {output.strongestModules.length >= 2 && output.strongestModules[0]?.moduleId !== output.weakestModules[0]?.moduleId && (
          <div>
            <div className="flex items-center gap-1.5 mb-1.5">
              <CheckCircle size={10} className="text-emerald-500" />
              <span className="text-[9px] text-muted-2 uppercase tracking-wide font-mono">Strongest Modules</span>
            </div>
            <div className="space-y-1">
              {output.strongestModules.slice(0, 3).map(m => (
                <div key={m.moduleId} className="flex items-center justify-between">
                  <span className="text-[10px] text-ink truncate">{m.moduleId}</span>
                  <span className="text-[10px] text-emerald-500 ml-2">{Math.round(m.masteryPct)}%</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
