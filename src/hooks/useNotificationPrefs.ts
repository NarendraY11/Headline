// =====================================================================
// Phase 8.2B.1 — useNotificationPrefs: DB-backed push reminder preferences
//
// Account-level (not device-local) opt-out for each reminder type. Stored in
// profiles.notification_prefs jsonb under the "push" namespace:
//   { "push": { "streak_risk": false, ... } }   (false = muted; absent = enabled)
//
// Opt-out model: a type is enabled unless explicitly set false. So an empty
// {} means "all reminders on" — the sensible default for a new account.
//
// Auth-safe: supabase access only inside useCallback/useEffect, never in
// onAuthStateChange (see auth-deadlock-root-cause).
// =====================================================================

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../lib/supabase";
import type { EngineReminderType } from "../lib/reminderSelector";

type PushPrefs = Partial<Record<EngineReminderType, boolean>>;

export interface UseNotificationPrefsResult {
  /** True when the reminder type is enabled (default ON unless explicitly muted). */
  isEnabled: (type: EngineReminderType) => boolean;
  /** Set of muted types — pass to selectReminder's mutedTypes for push. */
  mutedTypes: ReadonlySet<EngineReminderType>;
  /** Persist a single type's on/off state to the DB. */
  setEnabled: (type: EngineReminderType, enabled: boolean) => Promise<void>;
  loading: boolean;
  saving: boolean;
}

export function useNotificationPrefs(): UseNotificationPrefsResult {
  const { user } = useAuth();
  const userId = (user as { uid?: string; id?: string } | null)?.uid
    ?? (user as { id?: string } | null)?.id
    ?? null;

  const [push, setPush] = useState<PushPrefs>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!userId) return;
    let active = true;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("notification_prefs")
        .eq("id", userId)
        .maybeSingle();
      if (error) throw error;
      if (active) {
        const prefs = (data?.notification_prefs as { push?: PushPrefs } | null) ?? {};
        setPush(prefs.push ?? {});
      }
    } catch {
      // Non-fatal — fall back to all-enabled defaults.
    } finally {
      if (active) setLoading(false);
    }
    return () => { active = false; };
  }, [userId]);

  useEffect(() => {
    const cleanup = load();
    return () => { cleanup?.then?.((fn) => fn?.()); };
  }, [load]);

  const setEnabled = useCallback(
    async (type: EngineReminderType, enabled: boolean) => {
      if (!userId) return;
      // Optimistic local update.
      const next: PushPrefs = { ...push, [type]: enabled };
      setPush(next);
      setSaving(true);
      try {
        // Merge so we never clobber a future channel namespace (e.g. email).
        const { error } = await supabase
          .from("profiles")
          .update({ notification_prefs: { push: next } })
          .eq("id", userId);
        if (error) throw error;
      } catch {
        // Roll back on failure.
        setPush(push);
      } finally {
        setSaving(false);
      }
    },
    [userId, push]
  );

  const isEnabled = useCallback(
    (type: EngineReminderType) => push[type] !== false,
    [push]
  );

  const mutedTypes: ReadonlySet<EngineReminderType> = new Set(
    (Object.keys(push) as EngineReminderType[]).filter((t) => push[t] === false)
  );

  return { isEnabled, mutedTypes, setEnabled, loading, saving };
}
