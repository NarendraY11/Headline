// =====================================================================
// AI Study Scheduler — mission service (Phase M4)
//
// Client-side orchestration layer over the materialize endpoint.
// Thin by design: does NOT duplicate the DB logic that lives in
// api/system.ts (?fn=study-materialize); just drives the HTTP call and
// handles result/error translation.
//
// Connects to existing systems:
//   - completed_attempt_id → attempts (M5: completeMission)
//   - progress DERIVED from attempts/question_progress — never written here
// =====================================================================

import { apiFetch, readError } from "./api.js";
import { getMissionsForDate } from "./studyScheduler.js";

// ── Types ────────────────────────────────────────────────────────────────────

export interface MaterializeResult {
  ok: boolean;
  /** Supabase id of the plan that was materialized. */
  planId?: string;
  /** Number of mission rows inserted. */
  missions?: number;
  error?: string;
}

export interface EnsureResult {
  ok: boolean;
  /** true when missions already existed (no API call made). */
  alreadyMaterialized?: boolean;
  error?: string;
}

// ── materializePlan ──────────────────────────────────────────────────────────

/**
 * Trigger full plan → missions expansion on the server.
 *
 * Idempotent: the endpoint deletes future-pending plan-source missions then
 * re-inserts, so calling this multiple times is safe.
 *
 * Requires `aiStudyScheduler` flag ON on the server; returns 403 otherwise.
 */
export async function materializePlan(): Promise<MaterializeResult> {
  const result = await apiFetch(
    "/api/study/materialize",
    { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" },
    15_000
  );

  if (result.ok) {
    try {
      const data = (await result.response.json()) as {
        success: boolean;
        planId: string;
        missions: number;
      };
      return { ok: true, planId: data.planId, missions: data.missions };
    } catch {
      return { ok: true };
    }
  }

  let errorMsg = "Materialization failed. Please try again.";
  if (result.kind === "offline") {
    errorMsg = "You appear to be offline.";
  } else if (result.kind === "timeout") {
    errorMsg = "Request timed out. Please try again.";
  } else if (result.response) {
    errorMsg = await readError(result.response, errorMsg);
  }
  return { ok: false, error: errorMsg };
}

// ── ensureTodayMaterialized ───────────────────────────────────────────────────

/**
 * Check whether today already has plan-source missions; if not, trigger
 * materialize. Returns `alreadyMaterialized: true` if no API call was needed.
 *
 * Safe to call on every mount — the guard means at most one network round-trip
 * when missions are absent, and zero when they exist.
 */
export async function ensureTodayMaterialized(
  userId: string
): Promise<EnsureResult> {
  try {
    const todayISO = new Date().toISOString().slice(0, 10);
    const existing = await getMissionsForDate(userId, todayISO);
    if (existing.some((m) => m.source === "plan")) {
      return { ok: true, alreadyMaterialized: true };
    }
    const r = await materializePlan();
    return r.ok ? { ok: true, alreadyMaterialized: false } : { ok: false, error: r.error };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    console.warn("ensureTodayMaterialized:", msg);
    return { ok: false, error: msg };
  }
}
