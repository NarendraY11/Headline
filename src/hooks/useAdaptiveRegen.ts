// =====================================================================
// M8D: Adaptive Regeneration Engine — useAdaptiveRegen hook
//
// On mount (once per day, gated by localStorage timestamp):
//   1. Calls GET /api/study/mastery-check
//   2. If shouldRegen=true: shows banner; optionally auto-triggers regen
//   3. User can dismiss or accept from the banner
//
// POST /api/study/adaptive-regen performs the actual regen server-side.
//
// All behaviour gated behind adaptiveRegen feature flag.
// Zero cost when flag OFF — no network calls.
// =====================================================================

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useFeature } from "./useFeatureFlags";
import { apiFetch, readError } from "../lib/api";

// ── Types ────────────────────────────────────────────────────────────────────

export type RegenTrigger = "mastery_drift" | "recovery" | "staleness" | "new_critical" | "manual";

export interface MasteryCheckResult {
  shouldRegen: boolean;
  reason: RegenTrigger | null;
  cooldownRemaining: number;   // seconds
  autoRegenEnabled: boolean;
  regenCount: number;
  lastRegenAt: string | null;
  planId: string;
  subjects: {
    subjectId: string;
    currentMastery: number;
    baselineMastery: number;
    delta: number;
    trend: string;
    classification: string;
  }[];
}

export interface AdaptiveRegenResult {
  ok: boolean;
  newPlanId?: string;
  missionsCreated?: number;
  error?: string;
  rateLimited?: boolean;
  cooldownRemaining?: number;
}

export interface UseAdaptiveRegenState {
  /** Non-null when a regen trigger is detected and banner should show */
  checkResult: MasteryCheckResult | null;
  checking: boolean;
  regenning: boolean;
  dismissed: boolean;
  dismiss: () => void;
  triggerRegen: (source?: "manual") => Promise<AdaptiveRegenResult>;
}

// ── localStorage gate ─────────────────────────────────────────────────────

function masteryCheckGateKey() {
  const today = new Date().toISOString().slice(0, 10);
  return `heading_mastery_check_${today}`;
}

function checkAlreadyRanToday(): boolean {
  try { return !!localStorage.getItem(masteryCheckGateKey()); } catch { return false; }
}

function markCheckRanToday() {
  try { localStorage.setItem(masteryCheckGateKey(), "1"); } catch {}
}

// ── Hook ──────────────────────────────────────────────────────────────────

export function useAdaptiveRegen(): UseAdaptiveRegenState {
  const flagEnabled = useFeature("adaptiveRegen");
  const { user } = useAuth();

  const [checkResult, setCheckResult] = useState<MasteryCheckResult | null>(null);
  const [checking, setChecking] = useState(false);
  const [regenning, setRegenning] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  // Run mastery check once per day on mount
  useEffect(() => {
    if (!flagEnabled || !user?.id) return;
    if (checkAlreadyRanToday()) return;

    let active = true;
    setChecking(true);

    apiFetch("/api/study/mastery-check", { method: "GET" }, 10_000)
      .then(async (r) => {
        if (!active) return;
        if (r.ok) {
          const data = (await r.response.json()) as MasteryCheckResult;
          if (data.shouldRegen) setCheckResult(data);
          markCheckRanToday();
        }
        // Non-2xx: silently ignore (plan may not exist yet)
      })
      .catch(() => {/* non-fatal */})
      .finally(() => { if (active) setChecking(false); });

    return () => { active = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flagEnabled, user?.id]);

  const dismiss = useCallback(() => setDismissed(true), []);

  const triggerRegen = useCallback(async (source: "manual" | undefined = undefined): Promise<AdaptiveRegenResult> => {
    if (!flagEnabled) return { ok: false, error: "Adaptive regen not enabled." };
    if (regenning) return { ok: false, error: "Already regenerating." };

    setRegenning(true);
    try {
      const r = await apiFetch(
        "/api/study/adaptive-regen",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ source: source ?? "auto" }),
        },
        75_000
      );

      if (r.ok) {
        const data = (await r.response.json()) as { newPlanId?: string; missionsCreated?: number; regenCount?: number };
        setCheckResult(null);
        setDismissed(false);
        // Clear today's gate so a fresh check runs on next mount
        try { localStorage.removeItem(masteryCheckGateKey()); } catch {}
        return { ok: true, newPlanId: data.newPlanId, missionsCreated: data.missionsCreated };
      }

      let errorMsg = "Regen failed. Please try again.";
      let rateLimited = false;
      let cooldownRemaining: number | undefined;

      if (r.kind === "timeout") {
        errorMsg = "Request timed out.";
      } else if (r.response) {
        if (r.response.status === 429) {
          rateLimited = true;
          const body = await r.response.json().catch(() => ({})) as { cooldownRemaining?: number };
          cooldownRemaining = body.cooldownRemaining;
          errorMsg = cooldownRemaining
            ? `Regen on cooldown. Try again in ${Math.ceil(cooldownRemaining / 3600)}h.`
            : "Auto-regen limit reached.";
        } else {
          errorMsg = await readError(r.response, errorMsg);
        }
      }
      return { ok: false, error: errorMsg, rateLimited, cooldownRemaining };
    } finally {
      setRegenning(false);
    }
  }, [flagEnabled, regenning]);

  return { checkResult, checking, regenning, dismissed, dismiss, triggerRegen };
}
