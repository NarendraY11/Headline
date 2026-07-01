// M13: ReminderSettings — push notifications + reminder preferences.
// Phase 8.2B.1: per-type toggles backed by account-level DB prefs.
// These govern which PUSH reminders a user receives once delivery ships.

import { Bell } from "lucide-react";
import { useNotificationPrefs } from "../../hooks/useNotificationPrefs";
import { usePushNotifications } from "../../hooks/usePushNotifications";
import { CustomToggle } from "../../components/layout/CustomToggle";
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

  const isPushUnsupported = push.permission === "unsupported";
  const isPushDenied = push.permission === "denied";

  return (
    <div className="bg-paper border border-rule rounded-2xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <Bell size={15} className="text-amber" aria-hidden="true" />
        <span className="font-mono text-[10px] uppercase tracking-widest text-muted-2">Reminders</span>
      </div>

      {/* Push notification master toggle */}
      <div className="mb-4 p-3 rounded-xl border border-rule bg-bg-2/30">
        <div className="flex items-center justify-between gap-3">
          <div className="flex-1 min-w-0">
            <p className="font-sans text-[13px] text-ink font-medium">Push notifications</p>
            <p className="font-mono text-[11px] text-muted-2 mt-0.5">
              {isPushUnsupported
                ? "Not supported on this device"
                : isPushDenied
                ? "Blocked — update site permissions to allow"
                : push.subscribed
                ? "Active — background reminders enabled"
                : "Enable to receive background reminders"}
            </p>
          </div>
          {!isPushUnsupported && !isPushDenied && (
            <CustomToggle
              isOn={push.subscribed}
              onToggle={push.subscribed ? push.disable : push.enable}
              ariaLabel="Toggle push notifications"
            />
          )}
          {isPushDenied && (
            <span className="font-mono text-[11px] text-signal flex-shrink-0">Blocked</span>
          )}
          {isPushUnsupported && (
            <span className="font-mono text-[11px] text-muted-2 flex-shrink-0">N/A</span>
          )}
        </div>
      </div>

      {/* Per-type reminder toggles */}
      <p className="font-mono text-[10px] uppercase tracking-widest text-muted-2 mb-2">Push reminder types</p>
      <div className="space-y-2">
        {REMINDER_TYPES.map((rt) => {
          const on = prefs.isEnabled(rt.key);
          return (
            <div
              key={rt.key}
              className="flex items-center justify-between gap-3 py-1.5 border-b border-rule/30 last:border-0"
            >
              <div className="flex-1 min-w-0">
                <p className="font-sans text-[13px] text-ink">{rt.label}</p>
                <p className="font-mono text-[11px] text-muted-2">{rt.description}</p>
              </div>
              <CustomToggle
                isOn={on}
                onToggle={() => void prefs.setEnabled(rt.key, !on)}
                ariaLabel={`Toggle ${rt.label} push reminder`}
              />
            </div>
          );
        })}
      </div>

      <p className="font-mono text-[11px] text-muted-2 mt-3 leading-snug">
        Reminder preferences are saved to your account and apply across devices.
        Push delivery requires push notifications enabled above.
      </p>
    </div>
  );
}
