// M11B: Weak Subject Forecast — per-subject 4-week mastery projection

import type { WeakSubjectForecastPoint } from "../../lib/forecastEngine";

const TREND_ARROW: Record<string, string> = {
  IMPROVING:   "↑",
  PROGRESSING: "↑",
  STABLE:      "→",
  REGRESSING:  "↓",
  DECLINING:   "↓↓",
};

const CLASSIFICATION_COLOR = {
  CRITICAL:   "text-signal",
  WEAK:       "text-amber",
  DEVELOPING: "text-mint",
  STRONG:     "text-mint",
};

interface Props {
  forecasts: WeakSubjectForecastPoint[];
  subjectTitles: Record<string, string>;
  loading?: boolean;
}

export function WeakSubjectForecastCard({ forecasts, subjectTitles, loading }: Props) {
  return (
    <div className="bg-paper border border-rule rounded-2xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <span className="font-mono text-[9px] uppercase tracking-widest text-muted-2">
          § WEAK SUBJECT FORECAST
        </span>
        <span className="ml-auto font-mono text-[8px] text-muted-2">4-week projection</span>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <div key={i} className="h-12 bg-bg-2 rounded-xl animate-pulse" />)}
        </div>
      ) : forecasts.length === 0 ? (
        <div className="py-4 text-center">
          <p className="font-mono text-[9px] text-mint uppercase tracking-wide">No weak subjects detected</p>
        </div>
      ) : (
        <>
          {/* Week header */}
          <div className="flex items-center gap-2 mb-2 pr-1">
            <div className="flex-1 min-w-0" />
            <div className="flex gap-1.5 flex-shrink-0">
              {["Now", "+1w", "+2w", "+3w", "+4w"].map(lbl => (
                <span key={lbl} className="font-mono text-[7px] text-muted-2 w-8 text-center">{lbl}</span>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            {forecasts.map(fc => {
              const title = subjectTitles[fc.subjectId] ?? fc.subjectId;
              const allPts = [fc.currentMastery, ...fc.projections];

              return (
                <div key={fc.subjectId} className="border-b border-rule/30 pb-3 last:border-0 last:pb-0">
                  <div className="flex items-center gap-2 mb-1.5">
                    <div className="flex-1 min-w-0">
                      <span className="font-sans text-[12px] text-ink truncate block">{title}</span>
                      <span className={`font-mono text-[8px] uppercase tracking-wide ${CLASSIFICATION_COLOR[fc.classification]}`}>
                        {fc.classification} · {TREND_ARROW[fc.trend]} {fc.trend.toLowerCase()}
                      </span>
                    </div>
                    {fc.crossesThresholdAt !== null ? (
                      <span className="font-mono text-[8px] px-1.5 py-0.5 rounded bg-mint/10 border border-mint/20 text-mint flex-shrink-0">
                        Crosses 65% at +{fc.crossesThresholdAt}w
                      </span>
                    ) : (
                      <span className="font-mono text-[8px] px-1.5 py-0.5 rounded bg-signal/10 border border-signal/20 text-signal flex-shrink-0">
                        Stays below 65%
                      </span>
                    )}
                  </div>

                  {/* Mini progress bars per week */}
                  <div className="flex items-center gap-1.5">
                    {allPts.map((val, i) => {
                      const barH = Math.max(4, Math.round((val / 100) * 28));
                      const isTarget = val >= 65;
                      const color = isTarget ? "#16a34a" : val >= 50 ? "#e5a93c" : "#e33a2e";
                      return (
                        <div key={i} className="flex flex-col items-center gap-0.5 w-8">
                          <div className="w-full flex flex-col justify-end" style={{ height: 28 }}>
                            <div
                              className="w-full rounded-sm transition-all"
                              style={{ height: barH, backgroundColor: color, opacity: i === 0 ? 1 : 0.7 + i * 0.075 }}
                            />
                          </div>
                          <span className="font-mono text-[7px] text-muted-2">{val}%</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
