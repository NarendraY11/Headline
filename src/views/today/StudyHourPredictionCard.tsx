// M11B: Study Hour Prediction Card

import type { StudyHourPrediction } from "../../lib/forecastEngine";

interface Props {
  prediction: StudyHourPrediction;
  subjectTitles: Record<string, string>;
  loading?: boolean;
}

export function StudyHourPredictionCard({ prediction, subjectTitles, loading }: Props) {
  const { hoursPerWeek, totalHoursNeeded, weeksToPrepare, breakdown, feasible } = prediction;

  return (
    <div className="bg-paper border border-rule rounded-2xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <span className="font-mono text-[9px] uppercase tracking-widest text-muted-2">
          § STUDY HOUR PREDICTION
        </span>
        <span className={`ml-auto font-mono text-[8px] uppercase tracking-wide px-1.5 py-0.5 rounded border ${
          feasible
            ? "bg-mint/10 border-mint/20 text-mint"
            : "bg-signal/10 border-signal/20 text-signal"
        }`}>
          {feasible ? "Achievable" : "Stretch goal"}
        </span>
      </div>

      {loading ? (
        <div className="space-y-2">
          <div className="h-8 bg-bg-2 rounded animate-pulse" />
          <div className="h-8 bg-bg-2 rounded animate-pulse" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div>
              <p className="font-mono text-[8px] text-muted-2 uppercase tracking-wide">Per week</p>
              <p className="font-serif text-[22px] text-ink leading-none mt-0.5">
                {hoursPerWeek}
                <span className="font-sans text-xs text-muted font-normal ml-1">hrs</span>
              </p>
            </div>
            <div>
              <p className="font-mono text-[8px] text-muted-2 uppercase tracking-wide">Total needed</p>
              <p className="font-serif text-[22px] text-ink leading-none mt-0.5">
                {totalHoursNeeded}
                <span className="font-sans text-xs text-muted font-normal ml-1">hrs</span>
              </p>
            </div>
            <div>
              <p className="font-mono text-[8px] text-muted-2 uppercase tracking-wide">Over</p>
              <p className="font-serif text-[22px] text-ink leading-none mt-0.5">
                {weeksToPrepare}
                <span className="font-sans text-xs text-muted font-normal ml-1">wks</span>
              </p>
            </div>
          </div>

          {breakdown.length > 0 && (
            <>
              <p className="font-mono text-[8px] uppercase tracking-widest text-muted-2 mb-2">Subject breakdown</p>
              <div className="space-y-1.5">
                {breakdown.slice(0, 4).map(item => {
                  const title = subjectTitles[item.subjectId] ?? item.subjectId;
                  const barPct = Math.min(100, Math.round((item.hoursNeeded / Math.max(1, totalHoursNeeded)) * 100));
                  return (
                    <div key={item.subjectId} className="flex items-center gap-2">
                      <span className="font-mono text-[9px] text-ink w-32 truncate flex-shrink-0">{title}</span>
                      <div className="flex-1 h-1.5 bg-bg-2 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full bg-amber"
                          style={{ width: `${barPct}%`, transition: "width 0.5s ease-out" }}
                        />
                      </div>
                      <span className="font-mono text-[9px] text-muted-2 w-10 text-right flex-shrink-0">
                        {item.hoursNeeded}h
                      </span>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {breakdown.length === 0 && (
            <div className="py-2 text-center">
              <p className="font-mono text-[9px] text-mint uppercase tracking-wide">All subjects on track — no extra hours needed</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
