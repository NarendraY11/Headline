// =====================================================================
// Phase 7.2 — useMissionStreak (auth-safe)
//
// Mission Engine completion streak. Gated on missionEngine + userId (the
// concept only exists when the engine is on). Auth-safe: supabase only inside
// useCallback/useEffect, never in onAuthStateChange. Mirrors useXp's shape.
// =====================================================================

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useFeature } from "./useFeatureFlags";
import { getCompletedMissionDates } from "../lib/studyScheduler";
import { computeMissionStreak } from "../lib/missionStreak";

export interface UseMissionStreakResult {
  streak: number;
  loading: boolean;
  refetch: () => void;
}

export function useMissionStreak(): UseMissionStreakResult {
  const engineEnabled = useFeature("missionEngine");
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const [streak, setStreak] = useState(0);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!engineEnabled || !userId) return;
    let active = true;
    setLoading(true);
    try {
      const dates = await getCompletedMissionDates(userId);
      const now = new Date();
      const todayISO = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
      if (active) setStreak(computeMissionStreak(dates, todayISO));
    } catch {
      if (active) setStreak(0);
    } finally {
      if (active) setLoading(false);
    }
    return () => { active = false; };
  }, [engineEnabled, userId]);

  useEffect(() => {
    const cleanup = load();
    return () => { cleanup?.then?.((fn) => fn?.()); };
  }, [load]);

  return { streak, loading, refetch: load };
}
