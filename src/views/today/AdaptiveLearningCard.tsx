import { ArrowRight, BookOpen, Brain, CheckCircle, Clock, TrendingUp } from "lucide-react";
import { Link } from "react-router-dom";
import type { AdaptiveOutput } from "../../lib/adaptiveLearningEngine";

interface Props {
  output: AdaptiveOutput;
  loading?: boolean;
}

const HEALTH_COLORS: Record<string, string> = {
  green: "bg-emerald-500",
  yellow: "bg-amber-400",
  red: "bg-red-500",
};

const HEALTH_LABELS: Record<string, string> = {
  green: "On Track",
  yellow: "Needs Attention",
  red: "At Risk",
};

const READINESS_LABELS: Record<string, string> = {
  ready: "Exam Ready",
  "needs-review": "Needs Review",
  "at-risk": "At Risk",
};

export function AdaptiveLearningCard({ output, loading }: Props) {
  if (loading) {
    return <div className="w-full h-24 bg-bg-2 animate-pulse rounded-2xl" />;
  }

  const { recommendation, readinessScore, studyHealth, examReadiness } = output;

  const url = recommendation.nextModuleId
    ? `/quiz/${recommendation.nextModuleId}`
    : recommendation.nextSubjectId
    ? `/modules`
    : "/modules";

  return (
    <div className="bg-paper border border-rule rounded-2xl p-4 shadow-sm">
      <div className="font-mono text-[9px] text-muted-2 tracking-wide uppercase flex items-center gap-1.5 mb-3">
        <Brain size={12} className="text-ink" />
        ADAPTIVE RECOMMENDATION
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        {/* Readiness Score */}
        <div className="bg-bg-2 rounded-xl p-3 text-center">
          <div className="text-2xl font-bold font-mono text-ink">{readinessScore.score}</div>
          <div className="text-[10px] text-muted-2 mt-0.5">Readiness</div>
        </div>

        {/* Study Health */}
        <div className="bg-bg-2 rounded-xl p-3 text-center">
          <div className="flex items-center justify-center gap-1.5">
            <div className={`w-2 h-2 rounded-full ${HEALTH_COLORS[studyHealth.status]}`} />
            <span className="text-xs font-medium text-ink">{HEALTH_LABELS[studyHealth.status]}</span>
          </div>
          <div className="text-[10px] text-muted-2 mt-0.5">Study Health</div>
        </div>

        {/* Exam Readiness */}
        <div className="bg-bg-2 rounded-xl p-3 text-center">
          <div className="text-xs font-medium text-ink">{READINESS_LABELS[examReadiness.status]}</div>
          <div className="text-[10px] text-muted-2 mt-0.5">{examReadiness.remainingSubjects} subjects left</div>
        </div>

        {/* Review Debt */}
        <div className="bg-bg-2 rounded-xl p-3 text-center">
          <div className="text-2xl font-bold font-mono text-ink">{output.reviewDebt}</div>
          <div className="text-[10px] text-muted-2 mt-0.5">Reviews Due</div>
        </div>
      </div>

      {/* Next recommendation */}
      {recommendation.nextSubjectLabel ? (
        <Link
          to={url}
          className="flex items-center justify-between bg-signal/5 border border-signal/20 rounded-xl p-3 hover:bg-signal/10 transition-colors group"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-signal/10 flex items-center justify-center flex-shrink-0">
              <BookOpen size={14} className="text-signal" />
            </div>
            <div>
              <div className="text-xs font-semibold text-ink">{recommendation.nextModuleLabel ?? recommendation.nextSubjectLabel}</div>
              <div className="text-[10px] text-muted-2">{recommendation.reasonLabel}</div>
            </div>
          </div>
          <div className="flex items-center gap-2 text-muted-2 group-hover:text-signal transition-colors">
            <Clock size={11} />
            <span className="text-[10px]">{recommendation.estimatedMinutes}m</span>
            <ArrowRight size={14} />
          </div>
        </Link>
      ) : (
        <div className="text-xs text-muted-2 text-center py-2">No content in scope</div>
      )}

      {/* Health reasons */}
      {studyHealth.examples.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {studyHealth.examples.slice(0, 3).map((ex, i) => (
            <span key={i} className="text-[9px] text-muted-2 bg-bg-2 rounded-full px-2 py-0.5 border border-rule">{ex}</span>
          ))}
        </div>
      )}

      {/* Analytics strip */}
      {output.weakestSubjects.length > 0 && (
        <div className="mt-3 pt-3 border-t border-rule">
          <div className="flex items-center gap-1.5 mb-2">
            <TrendingUp size={10} className="text-muted-2" />
            <span className="text-[9px] text-muted-2 uppercase tracking-wide font-mono">Weakest</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {output.weakestSubjects.slice(0, 3).map(s => (
              <span key={s.subjectId} className="text-[9px] bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 rounded-full px-2 py-0.5 border border-red-200 dark:border-red-800">
                {s.subjectId} {Math.round(s.masteryPct)}%
              </span>
            ))}
          </div>
        </div>
      )}

      {output.strongestSubjects.length > 0 && (
        <div className="mt-2">
          <div className="flex items-center gap-1.5 mb-2">
            <CheckCircle size={10} className="text-emerald-500" />
            <span className="text-[9px] text-muted-2 uppercase tracking-wide font-mono">Strongest</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {output.strongestSubjects.slice(0, 3).map(s => (
              <span key={s.subjectId} className="text-[9px] bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 rounded-full px-2 py-0.5 border border-emerald-200 dark:border-emerald-800">
                {s.subjectId} {Math.round(s.masteryPct)}%
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
