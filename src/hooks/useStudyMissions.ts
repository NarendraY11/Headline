// =====================================================================
// AI Study Scheduler — mission hooks (Phase M4)
//
// Three focused hooks that surface the mission data layer to React:
//
//   useTodayMissions   — missions scheduled for today (UTC); derives
//                        `needsMaterialization` so callers don't have to.
//   useMissions        — missions for an arbitrary calendar date.
//   useMaterialize     — imperative trigger with loading + error state.
//
// All hooks are gated behind the `aiStudyScheduler` feature flag. When the
// flag is OFF, they return empty / idle state instantly and make no network
// calls, so they are always safe to mount (even on legacy markdown users).
//
// Progress/completion state is intentionally absent here: it derives from
// the existing `attempts` / `question_progress` tables and is surfaced by
// the existing useLogbook / useUserProgress hooks. No duplication.
// =====================================================================

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useFeature } from "../hooks/useFeatureFlags";
import { getMissionsForDate, getMissionsInRange } from "../lib/studyScheduler";
import type { StudyMissionRow } from "../types/studyScheduler";
import { materializePlan } from "../lib/missionService";
import type { MaterializeResult } from "../lib/missionService";

// ── useTodayMissions ─────────────────────────────────────────────────────────

export interface TodayMissionsState {
  missions: StudyMissionRow[];
  loading: boolean;
  error: string | null;
  /** Plan-source missions are missing → call useMaterialize() to create them. */
  needsMaterialization: boolean;
  refetch: () => void;
}

/**
 * Fetch missions scheduled for today (UTC).
 *
 * `needsMaterialization` is `true` when the load completes, the plan exists
 * (flag is ON), but no plan-source missions are present for today. The caller
 * can react by invoking `useMaterialize().materialize()`.
 */
export function useTodayMissions(): TodayMissionsState {
  const schedulerEnabled = useFeature("aiStudyScheduler");
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const [missions, setMissions] = useState<StudyMissionRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // FIX #1: todayISO was computed outside useCallback and included in deps,
  // causing a new string reference on every render → infinite refetch loop.
  // Compute it inside load() so the callback deps are stable.
  const load = useCallback(async () => {
    if (!schedulerEnabled || !userId) return;
    // Use local date (not UTC) so the query matches scheduled_date values
    // which are also derived from local time in the materialize endpoint.
    const now = new Date();
    const todayISO = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    let active = true;
    setLoading(true);
    setError(null);
    try {
      const rows = await getMissionsForDate(userId, todayISO);
      if (active) setMissions(rows);
    } catch {
      if (active) setError("Failed to load today's missions.");
    } finally {
      if (active) setLoading(false);
    }
    return () => { active = false; };
  }, [schedulerEnabled, userId]);

  useEffect(() => {
    const cleanup = load();
    return () => { cleanup?.then?.(fn => fn?.()); };
  }, [load]);

  const planMissions = missions.filter((m) => m.source === "plan");
  const needsMaterialization =
    schedulerEnabled && !loading && error === null && planMissions.length === 0;

  return { missions, loading, error, needsMaterialization, refetch: load };
}

// ── useMissions ──────────────────────────────────────────────────────────────

export interface MissionsState {
  missions: StudyMissionRow[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

/** Missions for an arbitrary calendar date (YYYY-MM-DD). */
export function useMissions(dateISO: string): MissionsState {
  const schedulerEnabled = useFeature("aiStudyScheduler");
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const [missions, setMissions] = useState<StudyMissionRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // FIX #1 (same pattern): dateISO comes from the caller. If the caller
  // re-computes it on every render without memoisation, it creates a new
  // string reference each time, putting it in deps causes infinite re-fetch.
  // Capture into a ref so useCallback deps remain stable; the effect re-runs
  // only when the actual string value changes (via the separate useEffect below).
  const dateISORef = useRef(dateISO);
  dateISORef.current = dateISO;

  const load = useCallback(async () => {
    if (!schedulerEnabled || !userId) return;
    const date = dateISORef.current;
    let active = true;
    setLoading(true);
    setError(null);
    try {
      const rows = await getMissionsForDate(userId, date);
      if (active) setMissions(rows);
    } catch {
      if (active) setError("Failed to load missions.");
    } finally {
      if (active) setLoading(false);
    }
    return () => { active = false; };
  }, [schedulerEnabled, userId]);

  // Re-fetch whenever the date string actually changes value (not reference).
  useEffect(() => {
    const cleanup = load();
    return () => { cleanup?.then?.(fn => fn?.()); };
  }, [load, dateISO]); // eslint-disable-line react-hooks/exhaustive-deps

  return { missions, loading, error, refetch: load };
}

// ── useScheduleRange ─────────────────────────────────────────────────────────

export interface ScheduleRangeState {
  missions: StudyMissionRow[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

/** Missions across an inclusive date range — used by the Flight Schedule calendar. */
export function useScheduleRange(startISO: string, endISO: string): ScheduleRangeState {
  const schedulerEnabled = useFeature("aiStudyScheduler");
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const [missions, setMissions] = useState<StudyMissionRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // FIX #1: startISO/endISO were in useCallback deps — recomputed objects from
  // useMemo in the calendar would create new references on every render and
  // cause an infinite refetch loop. Use refs so callback deps stay stable;
  // re-fetch is triggered by the useEffect dep on the actual string values.
  const startRef = useRef(startISO);
  const endRef = useRef(endISO);
  startRef.current = startISO;
  endRef.current = endISO;

  const load = useCallback(async () => {
    if (!schedulerEnabled || !userId) return;
    const start = startRef.current;
    const end = endRef.current;
    let active = true;
    setLoading(true);
    setError(null);
    try {
      const rows = await getMissionsInRange(userId, start, end);
      if (active) setMissions(rows);
    } catch {
      if (active) setError("Failed to load schedule.");
    } finally {
      if (active) setLoading(false);
    }
    return () => { active = false; };
  }, [schedulerEnabled, userId]);

  // Re-fetch whenever the range string values actually change.
  useEffect(() => {
    const cleanup = load();
    return () => { cleanup?.then?.(fn => fn?.()); };
  }, [load, startISO, endISO]); // eslint-disable-line react-hooks/exhaustive-deps

  return { missions, loading, error, refetch: load };
}

// ── useMaterialize ────────────────────────────────────────────────────────────

export interface MaterializeState {
  /** Call to trigger plan → missions expansion. Returns the result. */
  materialize: () => Promise<MaterializeResult>;
  materializing: boolean;
  error: string | null;
  lastResult: MaterializeResult | null;
}

/**
 * Imperative trigger for plan materialization.
 *
 * Usage:
 *   const { materialize, materializing } = useMaterialize();
 *   const { needsMaterialization, refetch } = useTodayMissions();
 *
 *   if (needsMaterialization) {
 *     const result = await materialize();
 *     if (result.ok) refetch();
 *   }
 */
export function useMaterialize(): MaterializeState {
  const schedulerEnabled = useFeature("aiStudyScheduler");
  const [materializing, setMaterializing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<MaterializeResult | null>(null);
  const abortRef = useRef(false);

  useEffect(() => {
    abortRef.current = false;
    return () => { abortRef.current = true; };
  }, []);

  const materialize = useCallback(async (): Promise<MaterializeResult> => {
    if (!schedulerEnabled) {
      return { ok: false, error: "Study scheduler is not enabled." };
    }
    if (materializing) {
      return { ok: false, error: "Already materializing." };
    }
    setMaterializing(true);
    setError(null);
    try {
      const result = await materializePlan();
      if (!abortRef.current) {
        setLastResult(result);
        if (!result.ok) setError(result.error ?? "Materialization failed.");
      }
      return result;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Unexpected error.";
      if (!abortRef.current) {
        setError(msg);
        const r: MaterializeResult = { ok: false, error: msg };
        setLastResult(r);
        return r;
      }
      return { ok: false, error: msg };
    } finally {
      if (!abortRef.current) setMaterializing(false);
    }
  }, [schedulerEnabled, materializing]);

  return { materialize, materializing, error, lastResult };
}
