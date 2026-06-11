// M8B: Subject Ranking panel — top 3 strongest / weakest subjects
// Data from useMasterySnapshots(). Gated by examReadinessDashboard flag in parent.

import type { MasterySnapshot } from "../../lib/masterySnapshot";

interface Props {
  snapshots: MasterySnapshot[];
  /** Maps subject_id → display title */
  subjectTitles: Record<string, string>;
}

const TREND_ARROW: Record<MasterySnapshot["trend"], string> = {
  IMPROVING:   "↑",
  PROGRESSING: "↗",
  STABLE:      "→",
  REGRESSING:  "↘",
  DECLINING:   "↓",
};

const TREND_COLOR: Record<MasterySnapshot["trend"], string> = {
  IMPROVING:   "text-mint",
  PROGRESSING: "text-mint/70",
  STABLE:      "text-muted-2",
  REGRESSING:  "text-amber",
  DECLINING:   "text-signal",
};

const CLASS_CHIP: Record<MasterySnapshot["classification"], string> = {
  CRITICAL:   "bg-signal-soft text-signal border-signal/20",
  WEAK:       "bg-amber-soft text-amber border-amber/20",
  DEVELOPING: "bg-sky-soft text-sky border-sky/20",
  STRONG:     "bg-mint-soft text-mint border-mint/20",
};

function SubjectRow({
  snap,
  title,
}: {
  snap: MasterySnapshot;
  title: string;
}) {
  return (
    <div className="flex items-center gap-2 py-1.5">
      <span
        className={`inline-flex h-[16px] px-1.5 rounded-full font-mono text-[7px] uppercase tracking-wide border flex-shrink-0 items-center ${CLASS_CHIP[snap.classification]}`}
      >
        {snap.classification === "STRONG" ? "★" : snap.classification.slice(0, 3)}
      </span>
      <span className="flex-1 font-sans text-[12px] text-ink truncate min-w-0">{title}</span>
      <span className="font-mono text-[11px] font-semibold text-ink flex-shrink-0">
        {snap.mastery}%
      </span>
      <span
        className={`font-mono text-[11px] flex-shrink-0 w-4 text-right ${TREND_COLOR[snap.trend]}`}
        title={snap.trend}
      >
        {TREND_ARROW[snap.trend]}
      </span>
    </div>
  );
}

export function SubjectRanking({ snapshots, subjectTitles }: Props) {
  if (snapshots.length === 0) return null;

  const sorted = [...snapshots].sort((a, b) => b.mastery - a.mastery);
  const strongest = sorted.slice(0, 3);
  const weakest = sorted.slice(-3).reverse();  // lowest mastery first

  const title = (id: string) => subjectTitles[id] ?? id.replace(/-/g, " ");

  return (
    <div className="bg-paper border border-rule rounded-2xl p-5">
      <span className="font-mono text-[9px] uppercase tracking-widest text-muted-2 block mb-4">
        § SUBJECT RANKING
      </span>
      <div className="grid grid-cols-2 gap-x-5">
        {/* Strongest */}
        <div>
          <p className="font-mono text-[8px] uppercase tracking-wide text-mint mb-2">
            Strongest
          </p>
          <div className="divide-y divide-rule/50">
            {strongest.map((s) => (
              <SubjectRow key={s.subject_id} snap={s} title={title(s.subject_id)} />
            ))}
          </div>
        </div>
        {/* Weakest */}
        <div>
          <p className="font-mono text-[8px] uppercase tracking-wide text-signal mb-2">
            Needs Work
          </p>
          <div className="divide-y divide-rule/50">
            {weakest.map((s) => (
              <SubjectRow key={s.subject_id} snap={s} title={title(s.subject_id)} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
