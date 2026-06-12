// M12: Pass Probability + Readiness Indicators for Exam Centre

import { TrendingUp } from "lucide-react";
import type { PredictiveIntelligenceResult } from "../../lib/predictiveIntelligence";
import type { ExamReadinessResult } from "../../lib/examReadiness";
import { BAND_LABEL, BAND_COLOR } from "../../lib/examReadiness";

interface Props {
  predictive: PredictiveIntelligenceResult | null;
  readiness: ExamReadinessResult;
  loading: boolean;
}

const INDICATOR_THRESHOLDS = [
  { key: "mastery",     label: "Mastery",     good: 0.65, warn: 0.45 },
  { key: "coverage",   label: "Coverage",    good: 0.70, warn: 0.50 },
  { key: "consistency",label: "Consistency", good: 0.50, warn: 0.30 },
  { key: "recency",    label: "Recency",     good: 0.80, warn: 0.50 },
] as const;

function indicatorColor(value: number, good: number, warn: number): string {
  if (value >= good) return "bg-mint";
  if (value >= warn) return "bg-amber";
  return "bg-signal";
}

export function ExamPassProbabilityCard({ predictive, readiness, loading }: Props) {
  const prob = predictive?.passProbability;
  const bandColor = BAND_COLOR[readiness.band];
  const bandLabel = BAND_LABEL[readiness.band];

  return (
    <div className="bg-paper border border-rule rounded-2xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <TrendingUp size={15} className="text-mint" />
        <span className="font-mono text-[9px] uppercase tracking-widest text-muted-2">Pass Probability</span>
      </div>

      {loading ? (
        <div className="space-y-2">
          <div className="h-16 bg-bg-2 rounded-xl animate-pulse" />
          <div className="h-8 bg-bg-2 rounded-xl animate-pulse" />
        </div>
      ) : (
        <>
          {/* Main probability display */}
          <div className="flex items-end gap-3 mb-4">
            <div>
              <p
                className="font-serif text-[52px] leading-none"
                style={{ color: prob ? undefined : bandColor, ...(prob ? { color: prob.probability >= 75 ? "#16a34a" : prob.probability >= 55 ? "#e5a93c" : "#e33a2e" } : {}) }}
              >
                {prob ? `${prob.probability}%` : `${readiness.score}`}
              </p>
              <p className="font-mono text-[9px] text-muted-2 uppercase tracking-wide mt-0.5">
                {prob ? "pass probability" : "readiness score"}
              </p>
            </div>
            <div className="ml-auto text-right pb-1">
              <span
                className="font-mono text-[10px] font-bold uppercase tracking-wide px-2 py-1 rounded-lg"
                style={{ color: bandColor, backgroundColor: `${bandColor}18` }}
              >
                {bandLabel}
              </span>
              {prob && (
                <p className="font-mono text-[8px] text-muted-2 mt-1 capitalize">
                  {prob.band.replace("_", " ")} confidence
                </p>
              )}
            </div>
          </div>

          {/* Readiness indicators */}
          <div className="space-y-2 border-t border-rule/40 pt-3">
            <p className="font-mono text-[8px] uppercase tracking-widest text-muted-2 mb-2">Readiness indicators</p>
            {INDICATOR_THRESHOLDS.map(ind => {
              const val = readiness.components[ind.key as keyof typeof readiness.components] ?? 0;
              const pct = Math.round(val * 100);
              const color = indicatorColor(val, ind.good, ind.warn);
              return (
                <div key={ind.key} className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${color}`} />
                  <span className="font-mono text-[8px] text-muted-2 w-20 flex-shrink-0">{ind.label}</span>
                  <div className="flex-1 h-1.5 bg-bg-2 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${color} transition-all duration-700`} style={{ width: `${pct}%` }} />
                  </div>
                  <span className="font-mono text-[9px] text-ink w-8 text-right flex-shrink-0">{pct}%</span>
                </div>
              );
            })}
          </div>

          {/* Confidence band */}
          {prob && (
            <div className="mt-3 pt-3 border-t border-rule/40">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[8px] text-muted-2 uppercase tracking-wide">Trend factor</span>
                <span className={`font-mono text-[10px] font-semibold ${
                  prob.trendMultiplier > 1 ? "text-mint" :
                  prob.trendMultiplier < 0.95 ? "text-signal" : "text-muted"
                }`}>
                  {prob.trendMultiplier > 1 ? "↑" : prob.trendMultiplier < 1 ? "↓" : "→"}
                  {" "}{((prob.trendMultiplier - 1) * 100).toFixed(0)}%
                </span>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
