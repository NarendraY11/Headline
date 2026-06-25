// =====================================================================
// Phase 8.2A — FlightAlerts: slim dismissible alert strip on Today
//
// Renders the single highest-priority reminder from useEngineReminders.
// Appears above ActiveMissionCard, below the briefing header.
// Separation of concerns: this is urgency/retention; mission CTA stays in
// ActiveMissionCard. Returns null when no alert is active.
// =====================================================================

import { AlertCircle, Clock, Flame, Target, X, Zap } from "lucide-react";
import { Link } from "react-router-dom";
import { useEngineReminders, type UseEngineRemindersInput } from "../../hooks/useEngineReminders";

const ICONS = {
  "clock":        <Clock size={14} className="flex-shrink-0" />,
  "flame":        <Flame size={14} className="flex-shrink-0" />,
  "zap":          <Zap size={14} className="flex-shrink-0" />,
  "alert-circle": <AlertCircle size={14} className="flex-shrink-0" />,
  "target":       <Target size={14} className="flex-shrink-0" />,
} as const;

// Icon + accent colour mapping by reminder type
const TYPE_STYLE: Record<string, { textColor: string; borderColor: string; bgColor: string }> = {
  stale_mission:  { textColor: "text-muted-2",  borderColor: "border-rule",       bgColor: "bg-paper"     },
  streak_risk:    { textColor: "text-[#855807] dark:text-amber", borderColor: "border-amber/20",   bgColor: "bg-amber-soft"  },
  rank_proximity: { textColor: "text-[#855807] dark:text-amber", borderColor: "border-amber/20",   bgColor: "bg-amber-soft"  },
  review_overload:{ textColor: "text-signal",    borderColor: "border-signal/15",  bgColor: "bg-signal-soft/60" },
  exam_countdown: { textColor: "text-navy dark:text-sky",       borderColor: "border-navy/20",    bgColor: "bg-navy/5"    },
};

export function FlightAlerts(props: UseEngineRemindersInput) {
  const { reminder, dismiss } = useEngineReminders(props);
  if (!reminder) return null;

  const style = TYPE_STYLE[reminder.type] ?? TYPE_STYLE.stale_mission;
  const icon = ICONS[reminder.icon];

  const inner = (
    <div className={`flex items-center gap-2.5 min-w-0`}>
      <span className={style.textColor}>{icon}</span>
      <div className="min-w-0">
        <span className={`font-mono text-[10px] font-semibold tracking-wide uppercase ${style.textColor}`}>
          {reminder.title}
        </span>
        <span className="font-sans text-[11px] text-muted-2 ml-2 leading-tight">{reminder.body}</span>
      </div>
    </div>
  );

  return (
    <div
      className={`${style.bgColor} border ${style.borderColor} rounded-[12px] px-3.5 py-2.5 mb-3 flex items-center justify-between gap-3 relative overflow-hidden`}
      role="alert"
      aria-label={reminder.title}
    >
      {reminder.href ? (
        <Link to={reminder.href} className="flex-1 min-w-0 hover:opacity-80 transition-opacity">
          {inner}
        </Link>
      ) : (
        <div className="flex-1 min-w-0">{inner}</div>
      )}

      <button
        type="button"
        onClick={dismiss}
        className="text-muted-2 hover:text-ink transition-colors p-2 min-w-[36px] min-h-[36px] flex items-center justify-center flex-shrink-0 -mr-1"
        aria-label="Dismiss alert"
      >
        <X size={12} />
      </button>
    </div>
  );
}
