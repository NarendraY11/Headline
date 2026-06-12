// M13: ReminderSettings — push notifications + reminder preferences

import { Bell, BellOff, Loader2 } from "lucide-react";
import { useState } from "react";
import { usePushNotifications } from "../../hooks/usePushNotifications";

const REMINDER_TYPES = [
  { key: "mission",   label: "Study session due",  description: "When you have pending missions today" },
  { key: "review",    label: "Review due",          description: "When spaced-review cards are due" },
  { key: "streak",    label: "Streak reminder",     description: "Evening nudge when streak at risk" },
  { key: "exam",      label: "Exam countdown",      description: "30-day and 7-day exam approach alerts" },
] as const;

const STORAGE_KEY = "heading_reminder_prefs";

function getPrefs(): Record<string, boolean> {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}"); } catch { return {}; }
}
function savePrefs(prefs: Record<string, boolean>) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs)); } catch { /* ignore */ }
}

export function ReminderSettings() {
  const push = usePushNotifications();
  const [prefs, setPrefs] = useState<Record<string, boolean>>(getPrefs);

  function toggle(key: string) {
    const next = { ...prefs, [key]: !prefs[key] };
    setPrefs(next);
    savePrefs(next);
  }

  const isPushUnsupported = push.permission === "unsupported";
  const isPushDenied = push.permission === "denied";

  return (
    <div className="bg-paper border border-rule rounded-2xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <Bell size={15} className="text-amber" />
        <span className="font-mono text-[9px] uppercase tracking-widest text-muted-2">Reminders</span>
      </div>

      {/* Push notification toggle */}
      <div className="mb-4 p-3 rounded-xl border border-rule bg-bg-2/30">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-sans text-[12px] text-ink font-medium">Push notifications</p>
            <p className="font-mono text-[8px] text-muted-2 mt-0.5">
              {isPushUnsupported
                ? "Not supported on this device"
                : isPushDenied
                ? "Blocked in browser — update site permissions"
                : push.subscribed
                ? "Active — notifications enabled"
                : "Enable to receive background reminders"}
            </p>
          </div>
          {!isPushUnsupported && !isPushDenied && (
            <button
              onClick={push.subscribed ? push.disable : push.enable}
              disabled={push.loading}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-mono text-[9px] uppercase tracking-wide font-semibold transition-colors ${
                push.subscribed
                  ? "bg-signal/10 border border-signal/20 text-signal hover:bg-signal/15"
                  : "bg-mint/10 border border-mint/20 text-mint hover:bg-mint/15"
              }`}
            >
              {push.loading ? (
                <Loader2 size={10} className="animate-spin" />
              ) : push.subscribed ? (
                <><BellOff size={10} /> Disable</>
              ) : (
                <><Bell size={10} /> Enable</>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Per-type toggles */}
      <p className="font-mono text-[8px] uppercase tracking-widest text-muted-2 mb-2">In-app reminders</p>
      <div className="space-y-2">
        {REMINDER_TYPES.map(rt => {
          const on = prefs[rt.key] !== false; // default ON
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
                onClick={() => toggle(rt.key)}
                className={`w-9 h-5 rounded-full transition-colors flex-shrink-0 relative ${
                  on ? "bg-mint" : "bg-bg-2 border border-rule"
                }`}
                aria-checked={on}
                role="switch"
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
        In-app reminders fire when the app is open. Push notifications work in the background on supported devices.
      </p>
    </div>
  );
}
