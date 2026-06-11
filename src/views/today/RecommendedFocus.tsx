// M8B: Recommended Focus — 3 subjects ranked by urgency_score
// Gated by examReadinessDashboard flag in parent.

import { Zap } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { urgencyScore } from "../../lib/examReadiness";
import type { MasterySnapshot } from "../../lib/masterySnapshot";

interface Props {
  snapshots: MasterySnapshot[];
  subjectTitles: Record<string, string>;
}

const CLASS_LABEL: Record<MasterySnapshot["classification"], string> = {
  CRITICAL:   "Critical",
  WEAK:       "Weak",
  DEVELOPING: "On track",
  STRONG:     "Mastered",
};

const CLASS_CHIP: Record<MasterySnapshot["classification"], string> = {
  CRITICAL:   "bg-signal-soft text-signal border-signal/20",
  WEAK:       "bg-amber-soft text-amber border-amber/20",
  DEVELOPING: "bg-sky-soft text-sky border-sky/20",
  STRONG:     "bg-mint-soft text-mint border-mint/20",
};

export function RecommendedFocus({ snapshots, subjectTitles }: Props) {
  const navigate = useNavigate();

  if (snapshots.length === 0) return null;

  // Rank by urgency; exclude STRONG subjects from focus list
  const ranked = [...snapshots]
    .filter((s) => s.classification !== "STRONG")
    .map((s) => ({ snap: s, score: urgencyScore(s.mastery, s.confidence) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  if (ranked.length === 0) {
    // All subjects STRONG — show maintenance suggestion
    return (
      <div className="bg-paper border border-rule rounded-2xl p-5">
        <span className="font-mono text-[9px] uppercase tracking-widest text-muted-2 block mb-3">
          § RECOMMENDED FOCUS
        </span>
        <div className="bg-mint-soft border border-mint/20 rounded-xl px-4 py-3 text-center">
          <p className="font-sans text-sm text-ink">All subjects at mastery level.</p>
          <p className="font-mono text-[9px] text-muted-2 mt-1 uppercase tracking-wide">
            Keep reviewing to maintain scores.
          </p>
        </div>
      </div>
    );
  }

  const title = (id: string) => subjectTitles[id] ?? id.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase());

  return (
    <div className="bg-paper border border-rule rounded-2xl p-5">
      <span className="font-mono text-[9px] uppercase tracking-widest text-muted-2 block mb-4">
        § RECOMMENDED FOCUS
      </span>
      <div className="space-y-2.5">
        {ranked.map(({ snap }) => (
          <div
            key={snap.subject_id}
            className="flex items-center gap-3 bg-bg-2 border border-rule/60 rounded-xl px-3.5 py-3"
          >
            {/* Classification chip */}
            <span
              className={`inline-flex h-[18px] px-1.5 rounded-full font-mono text-[8px] uppercase tracking-wide border flex-shrink-0 items-center ${CLASS_CHIP[snap.classification]}`}
            >
              {CLASS_LABEL[snap.classification]}
            </span>

            {/* Title + mastery */}
            <div className="flex-1 min-w-0">
              <p className="font-sans text-[13px] font-medium text-ink leading-snug truncate">
                {title(snap.subject_id)}
              </p>
              <p className="font-mono text-[9px] text-muted-2 mt-0.5">
                {snap.mastery}% mastery · {snap.trend === "REGRESSING" || snap.trend === "DECLINING" ? "⚠ declining" : snap.trend === "IMPROVING" ? "↑ improving" : "needs focus"}
              </p>
            </div>

            {/* Drill CTA */}
            <button
              type="button"
              onClick={() => navigate(`/quiz/${snap.subject_id}`)}
              aria-label={`Drill ${title(snap.subject_id)}`}
              className="flex-shrink-0 h-8 px-3 rounded-lg bg-ink text-paper font-mono text-[9px] uppercase tracking-wide flex items-center gap-1 hover:bg-ink-2 transition-colors"
            >
              <Zap size={9} aria-hidden="true" />
              Drill
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
