// =====================================================================
// PHASE 9.1 — useResolvedExamDate
//
// Resolves the student's exam date via the learning context:
//   1. Active enrollment exists → use profiles.next_exam (user-set date)
//   2. No enrollment (source=none) → null (no exam on record)
//   3. Legacy / profile source → profiles.next_exam as fallback
//
// Callers must NOT read userData.nextExam directly for adaptive signals.
// =====================================================================

import { useMemo } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useContentScope } from "./useContentScope";
import { useFeature } from "./useFeatureFlags";
import type { ContentScope } from "../lib/contentDeliveryEngine";

export function daysUntilExam(savedDate: string | null): { daysDiff: number | null; isPast: boolean } {
  if (!savedDate) return { daysDiff: null, isPast: false };
  const d = new Date(savedDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  const daysDiff = Math.ceil((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  return { daysDiff, isPast: daysDiff < 0 };
}

/**
 * Phase 9.2: accepts optional pre-resolved scope to skip internal
 * useContentScope DB fetch when called from TodayView.
 */
export function useResolvedExamDate(scope?: ContentScope): Date | null {
  const contentDeliveryEnabled = useFeature("contentDeliveryEngine");
  const { userData } = useAuth();
  // Skip internal fetch when scope is provided by caller.
  const { scope: internalScope } = useContentScope(!scope && !!contentDeliveryEnabled);
  const effectiveScope = scope ?? internalScope;

  return useMemo<Date | null>(() => {
    // No enrollment at all → no exam date signal
    if (effectiveScope.source === "none") return null;

    // Enrollment or profile/legacy → use user-set next_exam date
    const raw = userData?.nextExam ?? "";
    if (!raw) return null;
    const d = new Date(raw);
    return isNaN(d.getTime()) ? null : d;
  }, [effectiveScope.source, userData?.nextExam]);
}
