// =====================================================================
// Phase 8.2B.2 — mission-reminders: scheduled mission-aware push reminders.
//
// One brain: reuses the SAME pure selector + formatter the in-app Flight Alerts
// use (src/lib), plus computeMissionStreak + computeRank. No reminder priority
// logic is duplicated here or in SQL — the batched RPC only gathers raw signals.
//
// Flow:
//   1. auth (X-Internal-Secret == service role) — server-only, like send-push
//   2. rpc('get_reminder_candidates') — one row per subscribed user
//   3. per user: skip if reminded today; build ReminderInputs; selectReminder
//   4. dryRun → return the plan; else POST each to send-push (which logs delivery)
//
// Cooldown: already_reminded_today comes from the RPC (a successful reminder-class
// push_delivery_log row today). send-push writes the delivery log, so the loop is
// self-consistent. TTL 8h (from formatReminderPush) self-expires stale nudges.
//
// SAFE ROLLOUT: deploy this, verify with { dryRun: true }, then a real send to a
// test subscription, confirm push_delivery_log success, THEN enable the cron.
// =====================================================================

import { createClient } from "npm:@supabase/supabase-js@2";

// One-brain imports — pure modules shared with the app (esbuild bundles them).
import { selectReminder, type ReminderInputs } from "../../../src/lib/reminderSelector.ts";
import { formatReminderPush } from "../../../src/lib/reminderPush.ts";
import { computeMissionStreak } from "../../../src/lib/missionStreak.ts";
import { computeRank } from "../../../src/lib/xpValues.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-internal-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

interface CandidateRow {
  user_id: string;
  notification_prefs: { push?: Record<string, boolean> } | null;
  mission_status: string | null;
  mission_started_at: string | null;
  mission_title: string | null;
  completed_today: boolean;
  completed_days: string[];
  xp_balance: number;
  due_count: number;
  next_exam: string | null;
  already_reminded_today: boolean;
}

function todayUTCISO(): string {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD (UTC)
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // Server-only: cron (and manual verification) pass the service role as the
  // internal secret. No user JWT path — this is never called from a browser.
  const internalSecret = req.headers.get("X-Internal-Secret");
  if (!internalSecret || internalSecret !== SERVICE_ROLE) {
    return json({ error: "unauthorized" }, 401);
  }

  let dryRun = false;
  try {
    const body = await req.json().catch(() => ({}));
    dryRun = body?.dryRun === true;
  } catch { /* no body — default live run */ }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

  // 1. Batched signal gather — one row per subscribed user.
  const { data: rows, error: rpcErr } = await admin.rpc("get_reminder_candidates");
  if (rpcErr) {
    console.error("[mission-reminders] RPC failed:", rpcErr.message);
    return json({ error: rpcErr.message }, 500);
  }
  const candidates = (rows ?? []) as CandidateRow[];

  const nowMs = Date.now();
  const today = todayUTCISO();
  const plan: { user_id: string; type: string; title: string; body: string }[] = [];
  let skippedCooldown = 0, skippedNoReminder = 0;

  // 2. Decide one reminder per user via the shared brain.
  for (const row of candidates) {
    if (row.already_reminded_today) { skippedCooldown++; continue; }

    const inputs: ReminderInputs = {
      mission: row.mission_status
        ? { status: row.mission_status, startedAt: row.mission_started_at, title: row.mission_title }
        : null,
      completedToday: row.completed_today,
      missionStreak: computeMissionStreak(row.completed_days ?? [], today),
      xpRank: (() => {
        const r = computeRank(row.xp_balance ?? 0);
        return { isMax: r.isMax, xpRemaining: r.xpRemaining, nextName: r.next?.name ?? null };
      })(),
      dueCount: Number(row.due_count ?? 0),
      nextExam: row.next_exam,
      nowMs,
    };

    const mutedTypes = new Set(
      Object.entries(row.notification_prefs?.push ?? {})
        .filter(([, v]) => v === false)
        .map(([k]) => k)
    );

    const reminder = selectReminder(inputs, { mutedTypes });
    if (!reminder) { skippedNoReminder++; continue; }

    plan.push({ user_id: row.user_id, type: reminder.type, title: reminder.title, body: reminder.body });
  }

  // 3. Dry run: return the plan without sending. Use for pre-cron verification.
  if (dryRun) {
    return json({
      dryRun: true,
      candidates: candidates.length,
      eligible: plan.length,
      skippedCooldown,
      skippedNoReminder,
      plan,
    });
  }

  // 4. Live: send each via send-push (which writes push_delivery_log).
  const sendPushUrl = `${SUPABASE_URL}/functions/v1/send-push`;
  let sent = 0, failed = 0;

  await Promise.all(
    candidates
      .filter((row) => !row.already_reminded_today)
      .map(async (row) => {
        const inputs: ReminderInputs = {
          mission: row.mission_status
            ? { status: row.mission_status, startedAt: row.mission_started_at, title: row.mission_title }
            : null,
          completedToday: row.completed_today,
          missionStreak: computeMissionStreak(row.completed_days ?? [], today),
          xpRank: (() => {
            const r = computeRank(row.xp_balance ?? 0);
            return { isMax: r.isMax, xpRemaining: r.xpRemaining, nextName: r.next?.name ?? null };
          })(),
          dueCount: Number(row.due_count ?? 0),
          nextExam: row.next_exam,
          nowMs,
        };
        const mutedTypes = new Set(
          Object.entries(row.notification_prefs?.push ?? {})
            .filter(([, v]) => v === false)
            .map(([k]) => k)
        );
        const reminder = selectReminder(inputs, { mutedTypes });
        if (!reminder) return;

        const payload = formatReminderPush(reminder);
        try {
          const resp = await fetch(sendPushUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Internal-Secret": SERVICE_ROLE,
            },
            body: JSON.stringify({
              userIds: [row.user_id],
              notification: {
                title: payload.title,
                body: payload.body,
                url: payload.url,
                tag: payload.tag,
                type: payload.type,
              },
              ttl: payload.ttl,
              notificationId: `reminder-${reminder.type}-${today}`,
            }),
          });
          if (resp.ok) sent++; else failed++;
        } catch (e) {
          failed++;
          console.warn("[mission-reminders] send-push call failed for", row.user_id, String(e).slice(0, 120));
        }
      })
  );

  console.log("[mission-reminders] summary:", JSON.stringify({ candidates: candidates.length, sent, failed, skippedCooldown }));
  return json({ candidates: candidates.length, sent, failed, skippedCooldown, skippedNoReminder });
});
