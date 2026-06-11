// M11: Success Forecast Card

import type { SuccessForecastResult } from "../../lib/predictiveIntelligence";

const CONFIDENCE_CONFIG = {
  high:   { color: "text-mint",   label: "High confidence" },
  medium: { color: "text-amber",  label: "Medium confidence" },
  low:    { color: "text-muted-2", label: "Low confidence" },
};

interface Props {
  forecast: SuccessForecastResult;
  currentScore: number;
  loading?: boolean;
}

export function SuccessForecastCard({ forecast, currentScore, loading }: Props) {
  const cfg = CONFIDENCE_CONFIG[forecast.confidence];
  const progressToReady = Math.min(100, Math.round((currentScore / 80) * 100));

  return (
    <div className="bg-paper border border-rule rounded-2xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <span className="font-mono text-[9px] uppercase tracking-widest text-muted-2">
          § SUCCESS FORECAST
        </span>
        {!loading && (
          <span className={`ml-auto font-mono text-[8px] uppercase tracking-wide ${cfg.color}`}>
            {cfg.label}
          </span>
        )}
      </div>

      {loading ? (
        <div className="space-y-3">
          <div className="h-6 w-2/3 bg-bg-2 rounded animate-pulse" />
          <div className="h-2 bg-bg-2 rounded-full animate-pulse" />
        </div>
      ) : (
        <>
          <p className="font-serif text-[22px] text-ink leading-none mb-1">
            {forecast.alreadyReady ? "Exam ready" : forecast.etaWeeks != null ? `${forecast.etaWeeks}w` : "—"}
          </p>
          <p className="font-mono text-[9px] text-muted-2 uppercase tracking-wide mb-4">
            {forecast.etaLabel}
          </p>

          {/* Progress bar to exam-ready band */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <span className="font-mono text-[8px] text-muted-2 uppercase tracking-wide">Progress to exam ready</span>
              <span className="font-mono text-[9px] text-ink">{currentScore}/80</span>
            </div>
            <div className="w-full h-1.5 bg-bg-2 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${progressToReady}%`,
                  background: progressToReady >= 100 ? "#16a34a" : progressToReady >= 60 ? "#e5a93c" : "#e33a2e",
                }}
              />
            </div>
          </div>

          {forecast.velocityPerWeek > 0 && (
            <div className="mt-3 flex items-center gap-2 pt-3 border-t border-rule/40">
              <span className="font-mono text-[8px] text-muted-2 uppercase tracking-wide">Study velocity</span>
              <span className="font-mono text-[10px] text-mint ml-auto">
                +{forecast.velocityPerWeek.toFixed(1)}%/wk
              </span>
            </div>
          )}
        </>
      )}
    </div>
  );
}
