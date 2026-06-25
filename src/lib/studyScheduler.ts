// =====================================================================
// AI Study Scheduler — client repository layer (Phase M1)
//
// Thin, typed data-access over Supabase for study_plans / study_missions.
// Reads + user-owned writes go directly through RLS (no API round-trip);
// service-role operations (plan generation, materialize) live in /api.
//
// NOTE: this is the data foundation only. No UI consumes these yet — the
// scheduler ships behind the `aiStudyScheduler` flag (OFF by default).
// =====================================================================

import { supabase } from "./supabase";
import { trackMissionCompleted } from "./studyAnalytics.js";
import type { EngineMissionDraft } from "../config/missionConfig";
import type {
  MissionPayload,
  MissionStatus,
  StudyMissionRow,
  StudyPlanRow,
} from "../types/studyScheduler";

/** The single active plan for a user (partial-unique guarantees ≤ 1), or null. */
export async function getActiveStudyPlan(userId: string): Promise<StudyPlanRow | null> {
  const { data, error } = await supabase
    .from("study_plans")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle();
  // FIX #15: previously returned null on error, hiding DB failures from callers.
  // Now throws so the hook's catch block can surface an error to the UI.
  if (error) throw new Error(`getActiveStudyPlan: ${error.message}`);
  return (data as StudyPlanRow) ?? null;
}

/** Missions scheduled for a single calendar day, ordered for display. */
export async function getMissionsForDate(
  userId: string,
  dateISO: string
): Promise<StudyMissionRow[]> {
  const { data, error } = await supabase
    .from("study_missions")
    .select("*")
    .eq("user_id", userId)
    .eq("scheduled_date", dateISO)
    .order("position", { ascending: true })
    .order("created_at", { ascending: true });
  // FIX #15: throw on DB error so the hook's catch block surfaces it.
  if (error) throw new Error(`getMissionsForDate: ${error.message}`);
  return (data as StudyMissionRow[]) ?? [];
}

/** Missions across a date range (inclusive) — calendar / Flight Schedule view. */
export async function getMissionsInRange(
  userId: string,
  startISO: string,
  endISO: string
): Promise<StudyMissionRow[]> {
  const { data, error } = await supabase
    .from("study_missions")
    .select("*")
    .eq("user_id", userId)
    .gte("scheduled_date", startISO)
    .lte("scheduled_date", endISO)
    .order("scheduled_date", { ascending: true })
    .order("position", { ascending: true });
  // FIX #15: throw on DB error.
  if (error) throw new Error(`getMissionsInRange: ${error.message}`);
  return (data as StudyMissionRow[]) ?? [];
}

/** Flip mission status (pending → in_progress → completed/skipped). */
export async function updateMissionStatus(
  missionId: string,
  status: MissionStatus
): Promise<boolean> {
  const { error } = await supabase
    .from("study_missions")
    .update({ status })
    .eq("id", missionId);
  // FIX #15: throw on DB error so callers (launchMission) can log the failure.
  if (error) throw new Error(`updateMissionStatus: ${error.message}`);
  return true;
}

export async function completeMission(
  missionId: string,
  attemptId: string
): Promise<boolean> {
  // M9A: fetch attempt score (non-fatal; stays NULL on error or missing row)
  let score: number | null = null;
  try {
    const { data } = await supabase
      .from("attempts")
      .select("percentage")
      .eq("id", attemptId)
      .maybeSingle();
    if (typeof data?.percentage === "number") {
      score = Math.min(100, Math.max(0, Math.round(data.percentage)));
    }
  } catch {
    // non-fatal — score stays null
  }

  const { error } = await supabase
    .from("study_missions")
    .update({ status: "completed", completed_attempt_id: attemptId, score })
    .eq("id", missionId);
  // FIX #15: throw on DB error so QuizView can log and surface the failure.
  if (error) throw new Error(`completeMission: ${error.message}`);
  trackMissionCompleted(missionId, undefined, attemptId);
  return true;
}

// FIX #18: addManualMission, getMissionById, countPlanMissionsForDate removed —
// confirmed zero consumers outside this file across all of src/ and api/.
// Restore from git history if "Add to Schedule" manual-mission UI is built.

// =====================================================================
// Phase 6 — Mission Activation Engine (source='system')
//
// Engine missions are deterministic, single-active-at-a-time, and stored as
// study_missions rows with source='system' (cleanly separated from the AI
// scheduler's source='plan' rows). All extra Phase-6 fields ride in the
// payload JSONB — no schema migration.
// =====================================================================

/** Local YYYY-MM-DD (matches scheduled_date convention used elsewhere). */
function todayLocalISO(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

/** The user's current engine mission (pending or in_progress), or null. */
export async function getActiveEngineMission(
  userId: string
): Promise<StudyMissionRow | null> {
  const { data, error } = await supabase
    .from("study_missions")
    .select("*")
    .eq("user_id", userId)
    .eq("source", "system")
    .in("status", ["pending", "in_progress"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`getActiveEngineMission: ${error.message}`);
  return (data as StudyMissionRow) ?? null;
}

/**
 * Idempotently create an engine mission from a deterministic draft.
 *
 * If an active engine mission already exists it is returned WITHOUT inserting,
 * so rapid double-clicks / remounts never spawn duplicates.
 *
 * ponytail: dedup is a code-level read-then-insert. A narrow race window exists
 * on simultaneous double-submit; add a partial unique index
 * (WHERE source='system' AND status IN ('pending','in_progress')) only if
 * duplicates are ever observed in prod.
 */
export async function createEngineMission(
  userId: string,
  draft: EngineMissionDraft,
  readinessAtStart: number
): Promise<StudyMissionRow> {
  const existing = await getActiveEngineMission(userId);
  if (existing) return existing;

  const payload: MissionPayload = {
    subjectId: draft.subjectId,
    scope: draft.scope,
    targetCount: draft.questionCount,
    difficulty: draft.difficulty,
    mode: draft.mode,
    route: draft.route,
    category: draft.category,
    title: draft.title,
    description: draft.description,
    readinessAtStart,
  };

  const { data, error } = await supabase
    .from("study_missions")
    .insert({
      user_id: userId,
      plan_id: null,
      scheduled_date: todayLocalISO(),
      type: draft.missionType,
      payload,
      estimated_min: draft.estimatedMin,
      position: 0,
      status: "pending",
      source: "system",
    })
    .select("*")
    .single();
  if (error) throw new Error(`createEngineMission: ${error.message}`);
  return data as StudyMissionRow;
}

/** Flip an engine mission to in_progress and stamp payload.startedAt. */
export async function startEngineMission(
  mission: StudyMissionRow
): Promise<void> {
  const payload: MissionPayload = {
    ...mission.payload,
    startedAt: mission.payload.startedAt ?? new Date().toISOString(),
  };
  const { error } = await supabase
    .from("study_missions")
    .update({ status: "in_progress", payload })
    .eq("id", mission.id);
  if (error) throw new Error(`startEngineMission: ${error.message}`);
}

/** Abandon an engine mission (status → skipped). */
export async function abandonEngineMission(missionId: string): Promise<void> {
  const { error } = await supabase
    .from("study_missions")
    .update({ status: "skipped" })
    .eq("id", missionId);
  if (error) throw new Error(`abandonEngineMission: ${error.message}`);
}

/**
 * Compute and persist readinessImpact for a finished mission:
 *   impact = round(readinessNow − payload.readinessAtStart)
 * Best-effort: never throws (called after the quiz already saved its attempt).
 */
export async function finalizeReadinessImpact(
  missionId: string,
  readinessNow: number
): Promise<number> {
  try {
    const { data } = await supabase
      .from("study_missions")
      .select("payload")
      .eq("id", missionId)
      .maybeSingle();
    const payload = (data?.payload as MissionPayload) ?? null;
    if (!payload) return 0;
    const baseline = payload.readinessAtStart ?? readinessNow;
    const impact = Math.round(readinessNow - baseline);
    await supabase
      .from("study_missions")
      .update({ payload: { ...payload, readinessImpact: impact } })
      .eq("id", missionId);
    return impact;
  } catch {
    return 0;
  }
}

/** A single completed/abandoned engine mission, by id. */
export async function getEngineMissionById(
  missionId: string
): Promise<StudyMissionRow | null> {
  const { data, error } = await supabase
    .from("study_missions")
    .select("*")
    .eq("id", missionId)
    .maybeSingle();
  if (error) throw new Error(`getEngineMissionById: ${error.message}`);
  return (data as StudyMissionRow) ?? null;
}

/**
 * Distinct local dates (YYYY-MM-DD) on which the user completed a Mission Engine
 * mission. Phase 7.2 mission-streak input.
 *
 * STRICTLY engine-only: source='system' + status='completed'. Excludes scheduler
 * plan completions (source='plan'), manual missions (source='manual'), and any
 * non-completed rows — so the streak represents the Mission Engine loop alone.
 */
export async function getCompletedMissionDates(userId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from("study_missions")
    .select("completed_at")
    .eq("user_id", userId)
    .eq("source", "system")
    .eq("status", "completed")
    .not("completed_at", "is", null);
  if (error) throw new Error(`getCompletedMissionDates: ${error.message}`);
  const days = new Set<string>();
  for (const r of data ?? []) {
    const ts = (r as { completed_at: string | null }).completed_at;
    if (!ts) continue;
    const d = new Date(ts);
    days.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`);
  }
  return [...days];
}

/**
 * Phase 8.1: the most recent completed system mission from today (UTC), or null.
 * Used by useActiveMission to surface the completed-today state so Today never
 * immediately falls back to "Generate Today's Mission" after same-day completion.
 */
export async function getLatestCompletedMissionToday(userId: string): Promise<StudyMissionRow | null> {
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD UTC
  const { data, error } = await supabase
    .from("study_missions")
    .select("*")
    .eq("user_id", userId)
    .eq("source", "system")
    .eq("status", "completed")
    .gte("completed_at", `${today}T00:00:00.000Z`)
    .order("completed_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`getLatestCompletedMissionToday: ${error.message}`);
  return (data as StudyMissionRow) ?? null;
}

/** Engine mission history (completed + abandoned), newest first. */
export async function getEngineMissionHistory(
  userId: string,
  limit = 50
): Promise<StudyMissionRow[]> {
  const { data, error } = await supabase
    .from("study_missions")
    .select("*")
    .eq("user_id", userId)
    .eq("source", "system")
    .in("status", ["completed", "skipped"])
    .order("completed_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`getEngineMissionHistory: ${error.message}`);
  return (data as StudyMissionRow[]) ?? [];
}
