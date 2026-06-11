// M11B: Projected Exam Score Card + Risk Indicators

import type { ForecastEngineResult } from "../../lib/forecastEngine";
import type { PredictiveIntelligenceResult } from "../../lib/predictiveIntelligence";

interface Props {
  forecast: ForecastEngineResult;
  predictive: PredictiveIntelligenceResult;
  loading?: boolean;
}

const RISK_DOT = {
  HIGH:   "bg-signal animate-pulse",
  MEDIUM: "bg-amber",
  LOW:    "bg-mint",
};

const RISK_COLOR = {
  HIGH:   "text-signal",
  MEDIUM: "text-amber",
  LOW:    "text-mint",
};

export function ForecastSummaryCard({ forecast, predictive, loading }: Props) {
  const { projectedExamScore, projectedExamScoreWeeks, studyHourPrediction } = forecast;
  const { failureRisk, passProbability } = predictive;

  const scoreColor =
    projectedExamScore >= 75 ? "text-mint" :
    projectedExamScore >= 60 ? "text-amber" : "text-signal";

  return (
    <div className="bg-ink text-paper rounded-2xl p-5 relative overflow-hidden">
      <div className="absolute -right-6 -bottom-6 opacity-5 pointer-events-none text-[120px] font-serif select-none">
        ✈
      </div>

      <div className="flex items-center gap-2 mb-4 relative z-10">
        <span className="font-mono text-[9px] uppercase tracking-widest text-paper/60">
          § FORECAST SUMMARY
        </span>
      </div>

      {loading ? (
        <div className="space-y-3 relative z-10">
          <div className="h-12 bg-paper/10 rounded animate-pulse" />
          <div className="h-8 bg-paper/10 rounded animate-pulse" />
        </div>
      ) : (
        <div className="relative z-10 space-y-5">
          {/* Projected exam score */}
          <div className="flex items-end gap-3">
            <div>
              <p className="font-mono text-[8px] uppercase tracking-wide text-paper/50 mb-0.5">Projected exam score</p>
              <p className={`font-serif text-[48px] leading-none ${scoreColor}`}>
                {projectedExamScore}%
              </p>
              <p className="font-mono text-[9px] text-paper/50 mt-0.5">
                at +{projectedExamScoreWeeks}w if trend holds
              </p>
            </div>
            <div className="ml-auto text-right">
              <p className="font-mono text-[8px] uppercase tracking-wide text-paper/50 mb-0.5">Pass probability</p>
              <p className="font-serif text-[26px] text-paper leading-none">{passProbability.probability}%</p>
            </div>
          </div>

          {/* Risk indicator grid */}
          <div className="grid grid-cols-2 gap-2 border-t border-paper/10 pt-4">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full flex-shrink-0 ${RISK_DOT[failureRisk.level]}`} />
              <div>
                <p className="font-mono text-[8px] text-paper/50 uppercase tracking-wide">Failure risk</p>
                <p className={`font-mono text-[11px] font-bold ${RISK_COLOR[failureRisk.level]}`}>{failureRisk.level}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                studyHourPrediction.hoursPerWeek <= 5 ? "bg-mint" :
                studyHourPrediction.hoursPerWeek <= 10 ? "bg-amber" : "bg-signal"
              }`} />
              <div>
                <p className="font-mono text-[8px] text-paper/50 uppercase tracking-wide">Study load</p>
                <p className="font-mono text-[11px] font-bold text-paper">{studyHourPrediction.hoursPerWeek}h/wk</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                failureRisk.criticalCount === 0 ? "bg-mint" :
                failureRisk.criticalCount <= 1 ? "bg-amber" : "bg-signal animate-pulse"
              }`} />
              <div>
                <p className="font-mono text-[8px] text-paper/50 uppercase tracking-wide">Critical subjects</p>
                <p className="font-mono text-[11px] font-bold text-paper">{failureRisk.criticalCount}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                failureRisk.decliningCount === 0 ? "bg-mint" :
                failureRisk.decliningCount <= 1 ? "bg-amber" : "bg-signal"
              }`} />
              <div>
                <p className="font-mono text-[8px] text-paper/50 uppercase tracking-wide">Declining</p>
                <p className="font-mono text-[11px] font-bold text-paper">{failureRisk.decliningCount} subjects</p>
              </div>
            </div>
          </div>

          {/* Risk factors */}
          {failureRisk.factors.length > 0 && (
            <div className="border-t border-paper/10 pt-3">
              <p className="font-mono text-[8px] uppercase tracking-wide text-paper/50 mb-1.5">Risk factors</p>
              <ul className="space-y-0.5">
                {failureRisk.factors.slice(0, 3).map((f, i) => (
                  <li key={i} className="font-mono text-[9px] text-paper/70 flex items-start gap-1.5">
                    <span className="text-signal mt-0.5 flex-shrink-0">·</span>
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
