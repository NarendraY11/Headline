// M13 + Phase 2: ReminderSettings — push toggle up front, reminder types collapsed.
// Diagnostic panel removed. CustomToggle used throughout.

import { Bell, ChevronDown } from "lucide-react";
import { useState } from "react";
import { CustomToggle } from "../../components/layout/CustomToggle";
import { useNotificationPrefs } from "../../hooks/useNotificationPrefs";
import { usePushNotifications } from "../../hooks/usePushNotifications";
import type { EngineReminderType } from "../../lib/reminderSelector";

const REMINDER_TYPES: { key: EngineReminderType; label: string; description: string }[] = [
  { key: "stale_mission",   label: "Paused mission",    description: "When a started mission sits unfinished for days" },
  { key: "streak_risk",     label: "Streak at risk",    description: "When today's mission would break your streak" },
  { key: "rank_proximity",  label: "Rank within reach", description: "When you're close to the next rank" },
  { key: "review_overload", label: "Reviews piling up", description: "When spaced-review questions stack up" },
  { key: "exam_countdown",  label: "Exam countdown",    description: "In the final week before your exam" },
];

export function ReminderSettings() {
  const push = usePushNotifications();
  const prefs = useNotificationPrefs();
  const [showTypes, setShowTypes] = useState(false);

  const isPushUnsupported = push.permission === "unsupported";
  const isPushDenied = push.permission === "denied";

  return (
    <div className="bg-paper border border-rule rounded-2xl p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Bell size={13} className="text-amber flex-shrink-0" aria-hidden="true" />
        <span className="font-mono text-[10px] uppercase tracking-widest text-muted-2">
          Reminders
        </span>
      </div>

      {/* Push toggle — primary control, always visible */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="font-sans text-[13px] text-ink font-medium">Push notifications</p>
          <p className="font-mono text-[10px] text-muted-2 mt-0.5">
            {isPushUnsupported
              ? "Not supported on this device"
              : isPushDenied
              ? "Blocked — update site permissions"
              : push.subscribed
              ? "Active — background reminders on"
              : "Enable background reminders"}
          </p>
        </div>
        {!isPushUnsupported && !isPushDenied && (
          <CustomToggle
            isOn={push.subscribed}
            onToggle={push.subscribed ? push.disable : push.enable}
            ariaLabel="Toggle push notifications"
          />
        )}
        {isPushDenied && <span className="font-mono text-[10px] text-signal">Blocked</span>}
        {isPushUnsupported && <span className="font-mono text-[10px] text-muted-2">N/A</span>}
      </div>

      {/* Reminder types — collapsed by default */}
      <div>
        <button
          onClick={() => setShowTypes((s) => !s)}
          aria-expanded={showTypes}
          className="flex items-center gap-1 font-mono text-[10px] text-muted-2 hover:text-ink transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-sky/60 rounded"
        >
          <ChevronDown
            size={11}
            className={`transition-transform ${showTypes ? "rotate-180" : ""}`}
            aria-hidden="true"
          />
          Reminder types
        </button>

        {showTypes && (
          <div className="mt-3 space-y-2 border-t border-rule/40 pt-3">
            {REMINDER_TYPES.map((rt) => {
              const on = prefs.isEnabled(rt.key);
              return (
                <div
                  key={rt.key}
                  className="flex items-center justify-between gap-3 py-1 border-b border-rule/20 last:border-0"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-sans text-[12px] text-ink">{rt.label}</p>
                    <p className="font-mono text-[10px] text-muted-2">{rt.description}</p>
                  </div>
                  <CustomToggle
                    isOn={on}
                    onToggle={() => void prefs.setEnabled(rt.key, !on)}
                    ariaLabel={`Toggle ${rt.label} reminder`}
                  />
                </div>
              );
            })}
            <p className="font-mono text-[10px] text-muted-2 pt-1 leading-snug">
              Preferences saved to your account, apply across devices.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
