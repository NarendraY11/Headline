import { inngest } from "./inngest.js";
import { getSupabaseAdmin } from "./utils.js";

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "";
const SEND_PUSH_URL = `${SUPABASE_URL}/functions/v1/send-push`;

async function callSendPush(body: {
  userIds: string[];
  notification: Record<string, unknown>;
  notificationId?: string;
  ttl?: number;
}) {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  const res = await fetch(SEND_PUSH_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": serviceKey,
      "X-Internal-Secret": serviceKey,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`send-push ${res.status}: ${JSON.stringify(err)}`);
  }
  return res.json() as Promise<{ sent: number; failed: number; pruned: number }>;
}

// ── Cron: daily study reminder ───────────────────────────────────────────────
// Runs 7am UTC. Finds users with pending missions today → sends push reminder.
export const studyDailyReminder = inngest.createFunction(
  { id: "study-daily-reminder", triggers: [{ cron: "0 7 * * *" }] },
  async ({ step }: { step: any }) => {
    const today = new Date().toISOString().slice(0, 10);

    const userIds: string[] = await step.run("fetch-users-with-missions-today", async () => {
      const admin = getSupabaseAdmin();
      const { data, error } = await admin
        .from("study_missions")
        .select("user_id")
        .eq("status", "pending")
        .eq("scheduled_date", today);
      if (error) throw new Error(error.message);
      return [...new Set((data ?? []).map((r: { user_id: string }) => r.user_id))];
    });

    if (userIds.length === 0) return { sent: 0, date: today };

    const result = await step.run("send-push-reminders", () =>
      callSendPush({
        userIds,
        notification: {
          title: "Study time! ✈️",
          body: "You have study missions scheduled for today. Keep your streak going!",
          url: "/today",
          type: "reminder",
          tag: "study-daily",
        },
        notificationId: `study-daily-${today}`,
        ttl: 43200,
      })
    );

    return { sent: userIds.length, date: today, pushResult: result };
  }
);

// ── Event: send push to specific users ──────────────────────────────────────
// inngest.send({ name: "push/send", data: { userIds, notification, notificationId?, ttl? } })
export const sendPushNotification = inngest.createFunction(
  { id: "send-push-notification", triggers: [{ event: "push/send" }], retries: 3 },
  async ({ event, step }: { event: any; step: any }) => {
    const { userIds, notification, notificationId, ttl } = event.data as {
      userIds: string[];
      notification: Record<string, unknown>;
      notificationId?: string;
      ttl?: number;
    };

    const result = await step.run("send-push", () =>
      callSendPush({ userIds, notification, notificationId, ttl })
    );

    return { ok: true, userIds, result };
  }
);

// ── Event: streak at-risk alert ──────────────────────────────────────────────
// inngest.send({ name: "streak/at-risk", data: { userId, streakCount } })
export const streakAtRiskAlert = inngest.createFunction(
  { id: "streak-at-risk-alert", triggers: [{ event: "streak/at-risk" }], retries: 2 },
  async ({ event, step }: { event: any; step: any }) => {
    const { userId, streakCount } = event.data as { userId: string; streakCount: number };

    await step.run("send-streak-push", () =>
      callSendPush({
        userIds: [userId],
        notification: {
          title: "Don't break your streak! 🔥",
          body: `You have a ${streakCount}-day streak. Study today to keep it alive.`,
          url: "/today",
          type: "streak",
          tag: "streak-alert",
          requireInteraction: true,
        },
        notificationId: `streak-${userId}-${new Date().toISOString().slice(0, 10)}`,
        ttl: 28800,
      })
    );

    return { ok: true, userId, streakCount };
  }
);

export const allFunctions = [studyDailyReminder, sendPushNotification, streakAtRiskAlert];
