// M12: Mistake Analysis Panel
// Recurring mistakes, weak concepts, error categories by subject.

import { AlertTriangle, BarChart3, RefreshCw } from "lucide-react";
import type { MistakeAnalysisResult } from "../../lib/mistakeAnalysis";

interface Props {
  result: MistakeAnalysisResult | null;
  loading: boolean;
  error: string | null;
  subjectTitles: Record<string, string>;
  onRefetch: () => void;
}

const ERROR_COLORS = ["#e33a2e", "#e5a93c", "#557B96", "#16a34a", "#0F1E3C", "#9ca3af"];

export function MistakeAnalysisPanel({ result, loading, error, subjectTitles, onRefetch }: Props) {
  return (
    <div className="bg-paper border border-rule rounded-2xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <AlertTriangle size={15} className="text-signal" />
        <span className="font-mono text-[9px] uppercase tracking-widest text-muted-2">Mistake Analysis</span>
        <button
          onClick={onRefetch}
          className="ml-auto text-muted-2 hover:text-ink transition-colors"
          aria-label="Refresh"
        >
          <RefreshCw size={12} />
        </button>
      </div>

      {loading && (
        <div className="space-y-2">
          {[1, 2, 3].map(i => <div key={i} className="h-10 bg-bg-2 rounded-lg animate-pulse" />)}
        </div>
      )}

      {!loading && error && (
        <p className="font-sans text-sm text-signal">{error}</p>
      )}

      {!loading && result && result.totalUniqueWrong === 0 && (
        <div className="py-6 text-center">
          <p className="font-serif text-[16px] text-ink mb-1">Clean slate</p>
          <p className="font-mono text-[9px] text-muted-2 uppercase tracking-wide">No mistakes recorded yet. Complete some quizzes first.</p>
        </div>
      )}

      {!loading && result && result.totalUniqueWrong > 0 && (
        <div className="space-y-5">
          {/* Summary row */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: "Unique wrong Qs", value: result.totalUniqueWrong },
              { label: "Total wrong", value: result.totalWrongAnswers },
              { label: "Weak concepts", value: result.weakConcepts.length },
            ].map(s => (
              <div key={s.label} className="bg-bg-2 rounded-xl px-3 py-2 text-center">
                <p className="font-serif text-[20px] text-ink leading-none">{s.value}</p>
                <p className="font-mono text-[7px] uppercase tracking-wide text-muted-2 mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Top recurring mistakes */}
          {result.topMistakes.length > 0 && (
            <div>
              <p className="font-mono text-[8px] uppercase tracking-widest text-muted-2 mb-2">Recurring mistakes (top {result.topMistakes.length})</p>
              <div className="space-y-1.5">
                {result.topMistakes.slice(0, 5).map(m => (
                  <div key={m.questionId} className="flex items-center gap-2 p-2 rounded-lg border border-rule/50 hover:bg-bg-2/40">
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 font-mono text-[9px] font-bold ${
                      m.count >= 3 ? "bg-signal/10 text-signal" : "bg-amber/10 text-amber"
                    }`}>{m.count}×</div>
                    <div className="flex-1 min-w-0">
                      <p className="font-sans text-[11px] text-ink truncate">
                        {m.question?.prompt
                          ? String(m.question.prompt).slice(0, 80) + (String(m.question.prompt).length > 80 ? "…" : "")
                          : `Q ${m.questionId.slice(0, 8)}…`}
                      </p>
                      <p className="font-mono text-[7px] text-muted-2">
                        {subjectTitles[m.subjectId ?? ""] ?? m.subjectId ?? "Unknown subject"}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Error categories by subject */}
          {result.errorCategories.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <BarChart3 size={11} className="text-muted-2" />
                <p className="font-mono text-[8px] uppercase tracking-widest text-muted-2">Errors by subject</p>
              </div>
              <div className="space-y-1.5">
                {result.errorCategories.slice(0, 5).map((cat, i) => (
                  <div key={cat.category} className="flex items-center gap-2">
                    <span className="font-mono text-[9px] text-ink w-28 truncate flex-shrink-0">
                      {subjectTitles[cat.subjectId ?? ""] ?? cat.category}
                    </span>
                    <div className="flex-1 h-1.5 bg-bg-2 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${cat.percent}%`, backgroundColor: ERROR_COLORS[i % ERROR_COLORS.length] }}
                      />
                    </div>
                    <span className="font-mono text-[9px] text-muted-2 w-10 text-right flex-shrink-0">
                      {cat.count} ({cat.percent}%)
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Weak concepts */}
          {result.weakConcepts.length > 0 && (
            <div>
              <p className="font-mono text-[8px] uppercase tracking-widest text-muted-2 mb-2">Weak concepts</p>
              <div className="flex flex-wrap gap-1.5">
                {result.weakConcepts.map(c => (
                  <span
                    key={c.subcategoryId}
                    className="font-mono text-[8px] px-2 py-0.5 rounded-full bg-signal/10 border border-signal/20 text-signal"
                    title={`${c.totalMistakes} mistakes · ${Math.round(c.errorRate * 100)}% error rate`}
                  >
                    {c.subcategoryLabel} · {Math.round(c.errorRate * 100)}%
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
