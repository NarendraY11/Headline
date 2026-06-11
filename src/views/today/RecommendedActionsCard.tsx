// M11: Recommended Actions Card

import { Link } from "react-router-dom";
import type { RecommendedAction } from "../../lib/predictiveIntelligence";

const ACTION_CONFIG = {
  drill:        { icon: "⚡", accent: "text-signal",  bg: "bg-signal/5",  border: "border-signal/15" },
  review:       { icon: "📋", accent: "text-amber",   bg: "bg-amber/5",   border: "border-amber/15" },
  firstAttempt: { icon: "🚀", accent: "text-navy",    bg: "bg-navy/5",    border: "border-navy/15" },
  streak:       { icon: "🔥", accent: "text-orange-400", bg: "bg-orange-500/5", border: "border-orange-500/15" },
  studyToday:   { icon: "📅", accent: "text-mint",    bg: "bg-mint/5",    border: "border-mint/15" },
  mock:         { icon: "✈️", accent: "text-ink",     bg: "bg-bg-2",      border: "border-rule" },
};

function actionHref(action: RecommendedAction): string {
  switch (action.type) {
    case "drill":
    case "review":
      return action.subjectId ? `/quiz/${action.subjectId}` : "/modules";
    case "mock":
      return "/exams";
    case "streak":
    case "studyToday":
    case "firstAttempt":
    default:
      return "/modules";
  }
}

interface Props {
  actions: RecommendedAction[];
  loading?: boolean;
}

export function RecommendedActionsCard({ actions, loading }: Props) {
  return (
    <div className="bg-paper border border-rule rounded-2xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <span className="font-mono text-[9px] uppercase tracking-widest text-muted-2">
          § RECOMMENDED ACTIONS
        </span>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-14 bg-bg-2 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : actions.length === 0 ? (
        <div className="py-4 text-center">
          <p className="font-mono text-[9px] text-muted-2 uppercase tracking-wide">No actions needed — great shape</p>
        </div>
      ) : (
        <div className="space-y-2">
          {actions.map((action) => {
            const cfg = ACTION_CONFIG[action.type];
            return (
              <Link
                key={`${action.type}-${action.subjectId ?? action.priority}`}
                to={actionHref(action)}
                className={`flex items-start gap-3 p-3 rounded-xl border ${cfg.bg} ${cfg.border} hover:opacity-80 transition-opacity`}
              >
                <span className="text-base flex-shrink-0 mt-0.5" aria-hidden="true">{cfg.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className={`font-mono text-[10px] uppercase tracking-wide font-semibold mb-0.5 ${cfg.accent}`}>
                    {action.title}
                  </p>
                  <p className="font-sans text-[11px] text-muted-2 leading-snug">{action.description}</p>
                </div>
                <span className="font-mono text-[8px] text-muted-2 flex-shrink-0 mt-1">
                  #{action.priority}
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
