// M11: At-Risk Subjects Card

import type { SubjectRisk } from "../../lib/predictiveIntelligence";

const RISK_CONFIG = {
  HIGH:   { color: "text-signal",  dot: "bg-signal",  badge: "bg-signal/10 border-signal/20 text-signal" },
  MEDIUM: { color: "text-amber",   dot: "bg-amber",   badge: "bg-amber/10 border-amber/20 text-amber" },
  LOW:    { color: "text-mint",    dot: "bg-mint",    badge: "bg-mint/10 border-mint/20 text-mint" },
};

const TREND_ARROW: Record<string, string> = {
  IMPROVING:   "↑",
  PROGRESSING: "↑",
  STABLE:      "→",
  REGRESSING:  "↓",
  DECLINING:   "↓↓",
};

interface Props {
  subjectRisks: SubjectRisk[];
  subjectTitles: Record<string, string>;
  loading?: boolean;
}

export function AtRiskSubjectsCard({ subjectRisks, subjectTitles, loading }: Props) {
  const atRisk = subjectRisks.filter(r => r.risk !== "LOW");
  const highCount = subjectRisks.filter(r => r.risk === "HIGH").length;
  const mediumCount = subjectRisks.filter(r => r.risk === "MEDIUM").length;

  return (
    <div className="bg-paper border border-rule rounded-2xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <span className="font-mono text-[9px] uppercase tracking-widest text-muted-2">
          § SUBJECT RISK
        </span>
        <div className="ml-auto flex items-center gap-1.5">
          {highCount > 0 && (
            <span className="font-mono text-[8px] px-1.5 py-0.5 rounded bg-signal/10 border border-signal/20 text-signal uppercase tracking-wide">
              {highCount} High
            </span>
          )}
          {mediumCount > 0 && (
            <span className="font-mono text-[8px] px-1.5 py-0.5 rounded bg-amber/10 border border-amber/20 text-amber uppercase tracking-wide">
              {mediumCount} Medium
            </span>
          )}
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-8 bg-bg-2 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : atRisk.length === 0 ? (
        <div className="py-4 text-center">
          <div className="w-6 h-6 rounded-full bg-mint/10 border border-mint/20 flex items-center justify-center mx-auto mb-2">
            <span className="text-mint text-xs">✓</span>
          </div>
          <p className="font-mono text-[9px] text-muted-2 uppercase tracking-wide">All subjects on track</p>
        </div>
      ) : (
        <div className="space-y-2">
          {atRisk.slice(0, 5).map(r => {
            const cfg = RISK_CONFIG[r.risk];
            const title = subjectTitles[r.subjectId] ?? r.subjectId;
            return (
              <div key={r.subjectId} className="flex items-center gap-3 py-1.5 border-b border-rule/30 last:border-0">
                <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${cfg.dot}`} />
                <div className="flex-1 min-w-0">
                  <p className="font-sans text-[12px] text-ink truncate">{title}</p>
                  <p className="font-mono text-[8px] text-muted-2">{r.reason}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="font-mono text-[9px] text-muted-2">
                    {TREND_ARROW[r.trend]} {r.mastery}%
                  </span>
                  <span className={`font-mono text-[8px] px-1.5 py-0.5 rounded border uppercase tracking-wide ${cfg.badge}`}>
                    {r.risk}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
