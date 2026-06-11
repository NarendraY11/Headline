// M8D: Adaptive Regen Banner
// Shows when useAdaptiveRegen detects a regen trigger.
// Gated by parent (only rendered when checkResult non-null and not dismissed).

import { AlertTriangle, RefreshCw, X } from "lucide-react";
import type { MasteryCheckResult, RegenTrigger } from "../../hooks/useAdaptiveRegen";

const TRIGGER_LABEL: Record<RegenTrigger, string> = {
  mastery_drift: "A subject dropped significantly.",
  recovery:      "A weak subject is now at mastery level.",
  staleness:     "Your study plan is over 3 weeks old.",
  new_critical:  "A new critical weakness detected.",
  manual:        "Manual update requested.",
};

interface Props {
  checkResult: MasteryCheckResult;
  regenning: boolean;
  onDismiss: () => void;
  onAccept: () => void;
}

export function AdaptiveRegenBanner({ checkResult, regenning, onDismiss, onAccept }: Props) {
  const label = checkResult.reason ? TRIGGER_LABEL[checkResult.reason] : "Your study plan may need updating.";

  // Find the most impactful changed subject for the message
  const topChanged = [...checkResult.subjects]
    .filter(s => Math.abs(s.delta) >= 5)
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))[0];

  const detail = topChanged
    ? `${topChanged.subjectId.replace(/-/g, " ")} ${topChanged.delta > 0 ? "↑" : "↓"} ${Math.abs(topChanged.delta)}%`
    : null;

  return (
    <div
      role="alert"
      className="bg-amber-soft border border-amber/30 rounded-2xl px-4 py-3.5 flex items-start gap-3 mb-3"
    >
      <AlertTriangle size={16} className="text-amber flex-shrink-0 mt-0.5" aria-hidden="true" />

      <div className="flex-1 min-w-0">
        <p className="font-sans text-[13px] font-medium text-ink leading-snug">
          {label}
          {detail && (
            <span className="font-mono text-[10px] text-muted-2 ml-1.5">{detail}</span>
          )}
        </p>
        <p className="font-mono text-[9px] text-muted-2 uppercase tracking-wide mt-0.5">
          Refresh your plan to rebalance missions
        </p>
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        <button
          type="button"
          onClick={onAccept}
          disabled={regenning}
          aria-label="Refresh study plan"
          className="h-7 px-3 rounded-lg bg-amber text-bg font-mono text-[8px] uppercase tracking-wide flex items-center gap-1 hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-wait"
        >
          <RefreshCw size={9} className={regenning ? "animate-spin" : ""} aria-hidden="true" />
          {regenning ? "Updating…" : "Update Plan"}
        </button>
        <button
          type="button"
          onClick={onDismiss}
          disabled={regenning}
          aria-label="Dismiss"
          className="h-7 w-7 rounded-lg text-muted-2 hover:text-ink transition-colors flex items-center justify-center disabled:opacity-40"
        >
          <X size={13} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
