// =====================================================================
// Phase 8.2B.1 — reminderPush: pure reminder → push payload formatter
//
// Converts a selected EngineReminder into the payload shape the send-push
// Edge Function expects (supabase/functions/send-push). Deterministic copy +
// shared formatting so in-app alerts and push reminders never diverge.
//
// PREP ONLY: nothing is sent here. 8.2B.2 (after VAPID verification) wires the
// cron / Edge Function that actually calls send-push with this payload.
// =====================================================================

import type { EngineReminder, EngineReminderType } from "./reminderSelector";

/** Matches the send-push NotificationType union (reminder subset). */
export type PushNotificationType = "reminder" | "streak" | "exam";

/** Subset of the send-push payload.notification shape this layer produces. */
export interface ReminderPushPayload {
  title: string;
  body: string;
  /** Click-through URL. Defaults to /today. */
  url: string;
  /** Delivery category — drives send-push analytics + SW grouping. */
  type: PushNotificationType;
  /** Groups notifications so a newer reminder replaces an older one. */
  tag: string;
  /** Time-to-live (s). A reminder is stale after the day it targets. */
  ttl: number;
}

const DEFAULT_URL = "/today";
const REMINDER_TTL = 8 * 3600; // 8 hours — a same-day nudge shouldn't outlive the day

// Map each reminder type to the send-push delivery category.
const TYPE_CATEGORY: Record<EngineReminderType, PushNotificationType> = {
  stale_mission:   "reminder",
  streak_risk:     "streak",
  rank_proximity:  "reminder",
  review_overload: "reminder",
  exam_countdown:  "exam",
};

/**
 * Pure: format a selected reminder into a push payload. Title/body come straight
 * from the shared selector so push copy === in-app copy. href (if any) becomes
 * the click URL; otherwise /today.
 */
export function formatReminderPush(reminder: EngineReminder): ReminderPushPayload {
  return {
    title: reminder.title,
    body: reminder.body,
    url: reminder.href ?? DEFAULT_URL,
    type: TYPE_CATEGORY[reminder.type],
    // One tag per type → a new reminder of the same type replaces the old one,
    // distinct types coexist. Prevents stacking duplicate nudges.
    tag: `heading-reminder-${reminder.type}`,
    ttl: REMINDER_TTL,
  };
}
