// =====================================================================
// AI Study Plan / Coach — shared handler (Phase M2)
//
// Single implementation used by BOTH the prod serverless endpoint
// (api/instructor/[action].ts) and the dev server (server.ts), so the two
// can never drift. Two modes:
//
//   * aiStudyScheduler OFF (default)  -> legacy markdown plan: { text }.
//     Identical to the pre-M2 behaviour, so the existing QuizResults study-
//     plan UI keeps working unchanged.
//   * aiStudyScheduler ON             -> schema-constrained StudyPlan JSON,
//     validated, persisted to study_plans, returned as { plan, planId }.
//     If generation/validation fails, falls back to markdown gracefully.
//
// Both modes cache into ai_cache (24h). The cache key embeds the mode so the
// two output formats never collide.
// =====================================================================

import crypto from "crypto";
import { Type } from "@google/genai";
import { isFeatureEnabled } from "./utils.js";
import { validateStudyPlan } from "./studyPlan.js";

const PLAN_FLAG = "aiStudyScheduler";
const CACHE_MS = 24 * 60 * 60 * 1000;
const MODEL = "gemini-2.5-flash";

const DEFAULT_HORIZON = 7;
const MIN_HORIZON = 3;
const MAX_HORIZON = 14;

// Minimal structural typing for the injected clients (kept loose so this file
// stays decoupled from the @vercel/node vs express callers).
type GenAI = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  models: { generateContent: (args: any) => Promise<{ text?: string }> };
};
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Admin = any;

export interface CoachResult {
  status: number;
  body: Record<string, unknown>;
}

// ---------------------------------------------------------------------
// Gemini responseSchema — mirrors the StudyPlan shape validated by
// validateStudyPlan(). Enum-constrained where the validator is strict.
// ---------------------------------------------------------------------
const MISSION_TYPES = ["drill", "review", "viva", "flashcard", "mini_test", "mock", "read"];
const SCOPES = ["topic", "due", "weak", "custom"];
const DIFFICULTIES = ["standard", "complex", "extreme", "mixed"];
const LAUNCH_MODES = ["practice", "timed", "viva"];
const LAUNCH_ROUTES = ["quiz", "review", "mock", "topic"];

const STUDY_PLAN_RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    version: { type: Type.INTEGER },
    meta: {
      type: Type.OBJECT,
      properties: {
        name: { type: Type.STRING },
        examId: { type: Type.STRING, nullable: true },
        targetDate: { type: Type.STRING, nullable: true },
        horizonDays: { type: Type.INTEGER },
        summary: { type: Type.STRING },
      },
      required: ["name", "horizonDays", "summary"],
      propertyOrdering: ["name", "examId", "targetDate", "horizonDays", "summary"],
    },
    weakAreas: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          subjectId: { type: Type.STRING },
          label: { type: Type.STRING },
          mastery: { type: Type.INTEGER },
          priority: { type: Type.INTEGER },
          estRecoveryDays: { type: Type.INTEGER },
        },
        required: ["subjectId", "label", "mastery", "priority"],
      },
    },
    days: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          dayIndex: { type: Type.INTEGER },
          theme: { type: Type.STRING },
          topics: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                subjectId: { type: Type.STRING },
                subcategoryId: { type: Type.STRING, nullable: true },
              },
              required: ["subjectId"],
            },
          },
          tasks: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                taskRef: { type: Type.STRING },
                type: { type: Type.STRING, enum: MISSION_TYPES },
                title: { type: Type.STRING },
                subjectId: { type: Type.STRING, nullable: true },
                subcategoryId: { type: Type.STRING, nullable: true },
                examId: { type: Type.STRING, nullable: true },
                paperId: { type: Type.STRING, nullable: true },
                scope: { type: Type.STRING, enum: SCOPES },
                targetCount: { type: Type.INTEGER, nullable: true },
                difficulty: { type: Type.STRING, enum: DIFFICULTIES, nullable: true },
                estimatedMin: { type: Type.INTEGER },
                rationale: { type: Type.STRING },
                launch: {
                  type: Type.OBJECT,
                  properties: {
                    mode: { type: Type.STRING, enum: LAUNCH_MODES },
                    route: { type: Type.STRING, enum: LAUNCH_ROUTES },
                  },
                  required: ["mode", "route"],
                },
              },
              required: ["taskRef", "type", "title", "scope", "estimatedMin", "launch"],
            },
          },
        },
        required: ["dayIndex", "theme", "tasks"],
      },
    },
  },
  required: ["version", "meta", "weakAreas", "days"],
  propertyOrdering: ["version", "meta", "weakAreas", "days"],
};

// ---------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------

interface ScoreEntry {
  correct?: number;
  total?: number;
}

function buildScoresText(scores: Record<string, ScoreEntry>): string {
  return Object.entries(scores)
    .map(([topic, data]) => {
      const total = Number(data?.total) || 0;
      const correct = Number(data?.correct) || 0;
      if (total <= 0) return null;
      return `${topic}: ${correct}/${total} (${Math.round((correct / total) * 100)}%)`;
    })
    .filter(Boolean)
    .join("\n");
}

function clampHorizon(raw: unknown): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return DEFAULT_HORIZON;
  return Math.min(MAX_HORIZON, Math.max(MIN_HORIZON, Math.round(n)));
}

// Stamp server-owned fields the AI must not author, and recompute estimate
// rollups so they are trustworthy. Mutates and returns the parsed plan.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function finalizePlan(plan: any, meta: { horizonDays: number; examId: string | null; targetDate: string | null }): any {
  if (!plan || typeof plan !== "object") return plan;
  plan.version = 1;
  plan.meta = plan.meta || {};
  plan.meta.horizonDays = meta.horizonDays;
  plan.meta.generatedAt = new Date().toISOString();
  if (meta.examId) plan.meta.examId = meta.examId;
  if (meta.targetDate) plan.meta.targetDate = meta.targetDate;

  let total = 0;
  if (Array.isArray(plan.days)) {
    for (const day of plan.days) {
      let dayMin = 0;
      if (Array.isArray(day?.tasks)) {
        for (const task of day.tasks) {
          if (task && typeof task === "object") {
            if (!task.taskId) task.taskId = task.taskRef;
            dayMin += Number(task.estimatedMin) || 0;
          }
        }
      }
      day.estimatedMin = dayMin;
      total += dayMin;
    }
  }
  plan.meta.totalEstimatedMin = total;
  return plan;
}

// Archive the prior active plan and insert the new one as active. Two
// statements (supabase-js has no transaction); the partial-unique index is the
// backstop. Returns the new row id, or null if persistence failed.
async function persistPlan(
  admin: Admin,
  uid: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  plan: any,
  meta: { examId: string | null; targetDate: string | null }
): Promise<string | null> {
  try {
    // FIX #19 (known edge case, documented): archive + insert are two separate
    // Supabase calls — not atomic. If a concurrent coach request fires between
    // the archive and the insert, both requests archive the prior plan, then
    // both attempt to insert a new active plan. The second insert hits the
    // partial-unique index (uniq_study_plans_active_per_user) and fails.
    // At current request volume this is acceptable: the failing request returns
    // null and the coach falls back to markdown. A future fix would be to wrap
    // both calls in a Postgres RPC (requires a new migration). Tracked in audit.
    await admin.from("study_plans").update({ status: "archived" }).eq("user_id", uid).eq("status", "active");
    const { data, error } = await admin
      .from("study_plans")
      .insert({
        user_id: uid,
        exam_id: meta.examId,
        target_date: meta.targetDate,
        status: "active",
        source: "ai",
        model: MODEL,
        plan,
        generated_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (error) {
      console.error("persistPlan insert failed:", error.message);
      return null;
    }
    return (data?.id as string) ?? null;
  } catch (e) {
    console.error("persistPlan threw:", e);
    return null;
  }
}

async function generateMarkdownPlan(ai: GenAI, scoresText: string): Promise<string> {
  const response = await ai.models.generateContent({
    model: MODEL,
    contents: [
      {
        role: "user",
        parts: [
          {
            text: `My pilot exam scores are:\n${scoresText}\n\nBased on these pilot exam scores, write a focused 7-day study plan prioritising the weakest ATA chapters/topics. For each day, suggest specific sub-topics or concepts to focus on. Ensure the response is concise and highly actionable. Under 250 words.`,
          },
        ],
      },
    ],
    config: {
      systemInstruction:
        "You are an expert aviation instructor guiding a CPL/ATPL cadet. Use their score breakdown to identify their weakest areas and provide specific, actionable concepts to study.",
    },
  });
  return response.text || "";
}

// ---------------------------------------------------------------------
// Main entry — pure of res/req; returns { status, body } for the caller.
// ---------------------------------------------------------------------
export async function handleCoach(
  ai: GenAI,
  admin: Admin,
  uid: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  body: any
): Promise<CoachResult> {
  const scores: Record<string, ScoreEntry> = body?.scores || {};
  const scoresText = buildScoresText(scores);
  if (!scoresText) {
    return { status: 400, body: { error: "No scored topics provided." } };
  }

  const jsonMode = await isFeatureEnabled(PLAN_FLAG);
  const horizonDays = clampHorizon(body?.horizonDays);
  const examId: string | null = typeof body?.examId === "string" ? body.examId.slice(0, 100) : null;
  const targetDate: string | null = typeof body?.targetDate === "string" ? body.targetDate.slice(0, 10) : null;
  // M9C: optional enrichment fields (present when coachContextEnrichment flag ON)
  const completionRate7d: number | null = typeof body?.completionRate7d === "number" ? body.completionRate7d : null;
  const streakCount: number = typeof body?.streakCount === "number" ? body.streakCount : 0;

  const keyMaterial = JSON.stringify({ scores, horizonDays, examId, targetDate });
  const payloadHash = crypto.createHash("sha256").update(keyMaterial).digest("hex");
  const cacheKey = `coach_${jsonMode ? "v2" : "v1"}_${uid}_${payloadHash}`;

  // Cache lookup.
  try {
    const { data: cacheRow } = await admin.from("ai_cache").select("*").eq("cache_key", cacheKey).single();
    if (cacheRow && Date.now() - new Date(cacheRow.updated_at).getTime() < CACHE_MS) {
      return { status: 200, body: cacheRow.data };
    }
  } catch {
    // cache miss / unavailable — fall through to generation.
  }

  let finalData: Record<string, unknown>;

  if (jsonMode) {
    finalData = await generateJsonPlan(ai, admin, uid, { scoresText, horizonDays, examId, targetDate, completionRate7d, streakCount });
  } else {
    const text = await generateMarkdownPlan(ai, scoresText);
    finalData = { text, format: "markdown" };
  }

  // Cache write (best-effort).
  try {
    await admin
      .from("ai_cache")
      .upsert({ cache_key: cacheKey, data: finalData, updated_at: new Date().toISOString() }, { onConflict: "cache_key" });
  } catch (e) {
    console.warn("coach cache write failed:", e);
  }

  return { status: 200, body: finalData };
}

async function generateJsonPlan(
  ai: GenAI,
  admin: Admin,
  uid: string,
  ctx: {
    scoresText: string;
    horizonDays: number;
    examId: string | null;
    targetDate: string | null;
    /** M9C: 7-day mission completion rate 0-100, null if no data */
    completionRate7d?: number | null;
    /** M9C: current study streak in days */
    streakCount?: number;
  }
): Promise<Record<string, unknown>> {
  // Constrain subjectId hallucination: hand the model the real published
  // subjects to choose from. Failure here is non-fatal (empty list).
  let subjectsText = "";
  try {
    const { data: subjects } = await admin
      .from("subjects")
      .select("id, title")
      .eq("status", "published")
      .limit(60);
    if (Array.isArray(subjects) && subjects.length > 0) {
      subjectsText =
        "\nUse ONLY these subjectId values (id => title):\n" +
        subjects.map((s: { id: string; title: string }) => `${s.id} => ${s.title}`).join("\n");
    }
  } catch {
    /* non-fatal */
  }

  const prompt =
    `My pilot exam scores are:\n${ctx.scoresText}\n\n` +
    `Produce a ${ctx.horizonDays}-day study plan as JSON. Exactly ${ctx.horizonDays} day objects, ` +
    `dayIndex 0..${ctx.horizonDays - 1}. Each task.taskRef must be unique ("d{dayIndex}.{position}"). ` +
    `Prioritise the weakest topics. Mix task types: drill (MCQs), review (spaced repetition, scope "due"), ` +
    `viva, flashcard, mini_test, mock. version must be 1.` +
    subjectsText +
    (ctx.completionRate7d != null
      ? `\n\nRecent effort context: the student completed ${ctx.completionRate7d}% of scheduled missions in the last 7 days.` +
        (ctx.streakCount ? ` Current study streak: ${ctx.streakCount} days.` : "") +
        ` Adjust workload intensity accordingly: if completion rate is low, reduce daily task count; if high, maintain or increase.`
      : "");

  try {
    const response = await ai.models.generateContent({
      model: MODEL,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: {
        systemInstruction:
          "You are an expert aviation instructor. Return ONLY a StudyPlan JSON object matching the provided schema. No prose, no markdown fences.",
        responseMimeType: "application/json",
        responseSchema: STUDY_PLAN_RESPONSE_SCHEMA,
      },
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let parsed: any = null;
    try {
      parsed = JSON.parse(response.text || "null");
    } catch {
      parsed = null;
    }

    if (parsed) {
      finalizePlan(parsed, { horizonDays: ctx.horizonDays, examId: ctx.examId, targetDate: ctx.targetDate });
      const validation = validateStudyPlan(parsed);
      if (validation.ok) {
        const planId = await persistPlan(admin, uid, parsed, { examId: ctx.examId, targetDate: ctx.targetDate });
        return { plan: parsed, planId, format: "json" };
      }
      console.warn("Study plan JSON failed validation, falling back to markdown:", validation.error);
    }
  } catch (e) {
    console.warn("Study plan JSON generation failed, falling back to markdown:", e);
  }

  // Graceful fallback: legacy markdown so the caller always gets a usable plan.
  const text = await generateMarkdownPlan(ai, ctx.scoresText);
  return { text, format: "markdown", fallback: true };
}
