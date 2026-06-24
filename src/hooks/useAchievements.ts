// =====================================================================
// Phase 7.1 — useAchievements (auth-safe unlocked-state reader)
//
// Always-on (achievement persistence is a strict improvement, not flag-gated).
// Auth-safe: userId guard, supabase only inside useCallback/useEffect, never
// in onAuthStateChange. Powers future badge galleries (7.3).
// =====================================================================

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { getUnlockedAchievements } from "../lib/achievements";

export interface UseAchievementsResult {
  unlocked: string[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useAchievements(): UseAchievementsResult {
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const [unlocked, setUnlocked] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!userId) return;
    let active = true;
    setLoading(true);
    setError(null);
    try {
      const ids = await getUnlockedAchievements(userId);
      if (active) setUnlocked(ids);
    } catch {
      if (active) setError("Failed to load achievements.");
    } finally {
      if (active) setLoading(false);
    }
    return () => { active = false; };
  }, [userId]);

  useEffect(() => {
    const cleanup = load();
    return () => { cleanup?.then?.((fn) => fn?.()); };
  }, [load]);

  return { unlocked, loading, error, refetch: load };
}
