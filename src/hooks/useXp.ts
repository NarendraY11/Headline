// =====================================================================
// Phase 7.1 — useXp (auth-safe XP reader)
//
// Gated on the xpSystem flag + a resolved userId. All supabase access is in a
// useCallback invoked from useEffect — never inside onAuthStateChange — so it
// cannot reintroduce the auth-lock deadlock and fires no query before auth is
// ready. Display surfaces (badges, bars) land in Phase 7.2/7.3; this hook is
// the read substrate.
// =====================================================================

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useFeature } from "./useFeatureFlags";
import { getXpBalance, getXpEvents, type XpEventRow } from "../lib/xp";

export interface UseXpResult {
  balance: number;
  events: XpEventRow[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useXp(eventLimit = 50): UseXpResult {
  const xpEnabled = useFeature("xpSystem");
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const [balance, setBalance] = useState(0);
  const [events, setEvents] = useState<XpEventRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!xpEnabled || !userId) return;
    let active = true;
    setLoading(true);
    setError(null);
    try {
      const [bal, evs] = await Promise.all([
        getXpBalance(userId),
        getXpEvents(userId, eventLimit),
      ]);
      if (active) {
        setBalance(bal);
        setEvents(evs);
      }
    } catch {
      if (active) setError("Failed to load XP.");
    } finally {
      if (active) setLoading(false);
    }
    return () => { active = false; };
  }, [xpEnabled, userId, eventLimit]);

  useEffect(() => {
    const cleanup = load();
    return () => { cleanup?.then?.((fn) => fn?.()); };
  }, [load]);

  return { balance, events, loading, error, refetch: load };
}
