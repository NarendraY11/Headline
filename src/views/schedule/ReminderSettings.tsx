// M13: ReminderSettings — push notifications + reminder preferences
// Phase 8.2B.1: per-type toggles repointed from the dead in-app reminder
// taxonomy (useStudyReminders, now a no-op) to the real engine reminder types,
// backed by account-level DB prefs (useNotificationPrefs). These govern which
// PUSH reminders a user receives once delivery ships in 8.2B.2.

import { Bell } from "lucide-react";
import { useState } from "react";
import { usePushNotifications } from "../../hooks/usePushNotifications";
import { useNotificationPrefs } from "../../hooks/useNotificationPrefs";
import type { EngineReminderType } from "../../lib/reminderSelector";

// Maps 1:1 to the shared reminderSelector reminder types (priority order).
const REMINDER_TYPES: { key: EngineReminderType; label: string; description: string }[] = [
  { key: "stale_mission",   label: "Paused mission",   description: "When a started mission sits unfinished for days" },
  { key: "streak_risk",     label: "Streak at risk",   description: "When today's mission would break your streak" },
  { key: "rank_proximity",  label: "Rank within reach", description: "When you're close to the next rank" },
  { key: "review_overload", label: "Reviews piling up", description: "When spaced-review questions stack up" },
  { key: "exam_countdown",  label: "Exam countdown",   description: "In the final week before your exam" },
];

export function ReminderSettings() {
  const push = usePushNotifications();
  const prefs = useNotificationPrefs();
  const [debugInfo, setDebugInfo] = useState<string | null>(null);

  async function runDiagnostic() {
    const lines: string[] = [];
    lines.push(`Notification API: ${"Notification" in window ? "supported" : "missing"}`);
    lines.push(`Notification.permission: ${("Notification" in window) ? Notification.permission : "N/A"}`);
    lines.push(`ServiceWorker: ${"serviceWorker" in navigator ? "supported" : "missing"}`);
    lines.push(`PushManager: ${"PushManager" in window ? "supported" : "missing"}`);
    if ("serviceWorker" in navigator) {
      const reg = await navigator.serviceWorker.getRegistration().catch(() => null);
      lines.push(`SW registered: ${reg ? "yes (" + reg.scope + ")" : "no"}`);
      if (reg) {
        const sub = await reg.pushManager?.getSubscription().catch(() => null);
        lines.push(`Existing subscription: ${sub ? "yes (endpoint prefix: " + sub.endpoint.slice(0, 40) + "…)" : "none"}`);
      }
    }
    const vapidPresent = !!(import.meta.env.VITE_VAPID_PUBLIC_KEY);
    lines.push(`VITE_VAPID_PUBLIC_KEY: ${vapidPresent ? "present (len " + (import.meta.env.VITE_VAPID_PUBLIC_KEY as string).length + ")" : "MISSING"}`);
    setDebugInfo(lines.join("\n"));
  }

  const isPushUnsupported = push.permission === "unsupported";
  const isPushDenied = push.permission === "denied";

  return (
    <div className="bg-paper border border-rule rounded-2xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <Bell size={15} className="text-amber" />
        <span className="font-mono text-[9px] uppercase tracking-widest text-muted-2">Reminders</span>
      </div>

      {/* Push notification toggle — same pill style as in-app reminders */}
      <div className="mb-4 p-3 rounded-xl border border-rule bg-bg-2/30">
        <div className="flex items-center justify-between gap-3">
          <div className="flex-1 min-w-0">
            <p className="font-sans text-[12px] text-ink font-medium">Push notifications</p>
            <p className="font-mono text-[8px] text-muted-2 mt-0.5">
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
            <button
              onClick={push.subscribed ? push.disable : push.enable}
              disabled={push.loading}
              className={`w-9 h-5 rounded-full transition-colors flex-shrink-0 relative disabled:opacity-50 ${
                push.subscribed ? "bg-mint" : "bg-bg-2 border border-rule"
              }`}
              aria-checked={push.subscribed}
              role="switch"
              aria-label="Toggle push notifications"
            >
              {push.loading ? (
                <span className="absolute inset-0 flex items-center justify-center">
                  <span className="w-2.5 h-2.5 rounded-full border-2 border-paper border-t-transparent animate-spin" />
                </span>
              ) : (
                <span
                  className={`absolute top-0.5 w-4 h-4 rounded-full bg-paper shadow transition-transform ${
                    push.subscribed ? "translate-x-4" : "translate-x-0.5"
                  }`}
                />
              )}
            </button>
          )}
          {isPushDenied && (
            <span className="font-mono text-[8px] text-signal flex-shrink-0">Blocked</span>
          )}
          {isPushUnsupported && (
            <span className="font-mono text-[8px] text-muted-2 flex-shrink-0">N/A</span>
          )}
        </div>
      </div>

      {/* Per-type push reminder toggles (DB-backed, account-level) */}
      <p className="font-mono text-[8px] uppercase tracking-widest text-muted-2 mb-2">Push reminder types</p>
      <div className="space-y-2">
        {REMINDER_TYPES.map(rt => {
          const on = prefs.isEnabled(rt.key); // default ON (opt-out model)
          return (
            <div
              key={rt.key}
              className="flex items-center justify-between gap-3 py-1.5 border-b border-rule/30 last:border-0"
            >
              <div className="flex-1 min-w-0">
                <p className="font-sans text-[12px] text-ink">{rt.label}</p>
                <p className="font-mono text-[8px] text-muted-2">{rt.description}</p>
              </div>
              <button
                onClick={() => void prefs.setEnabled(rt.key, !on)}
                disabled={prefs.loading || prefs.saving}
                className={`w-9 h-5 rounded-full transition-colors flex-shrink-0 relative disabled:opacity-50 ${
                  on ? "bg-mint" : "bg-bg-2 border border-rule"
                }`}
                aria-checked={on}
                role="switch"
                aria-label={`Toggle ${rt.label} push reminder`}
              >
                <span
                  className={`absolute top-0.5 w-4 h-4 rounded-full bg-paper shadow transition-transform ${
                    on ? "translate-x-4" : "translate-x-0.5"
                  }`}
                />
              </button>
            </div>
          );
        })}
      </div>

      <p className="font-mono text-[7px] text-muted-2 mt-3 leading-snug">
        Reminder preferences are saved to your account and apply across devices.
        Push delivery requires push notifications enabled above.
      </p>

      {/* Diagnostic tool */}
      <div className="border-t border-rule/40 pt-3">
        <button
          onClick={runDiagnostic}
          className="font-mono text-[8px] text-muted-2 hover:text-ink underline underline-offset-2"
        >
          Run push diagnostic
        </button>
        {debugInfo && (
          <pre className="mt-2 p-2 bg-bg-2 rounded-lg font-mono text-[8px] text-ink leading-relaxed whitespace-pre-wrap border border-rule">
            {debugInfo}
          </pre>
        )}
      </div>
    </div>
  );
}
