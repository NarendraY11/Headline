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

export function useResolvedExamDate(): Date | null {
  const contentDeliveryEnabled = useFeature("contentDeliveryEngine");
  const { userData } = useAuth();
  const { scope } = useContentScope(!!contentDeliveryEnabled);

  return useMemo<Date | null>(() => {
    // No enrollment at all → no exam date signal
    if (scope.source === "none") return null;

    // Enrollment or profile/legacy → use user-set next_exam date
    const raw = userData?.nextExam ?? "";
    if (!raw) return null;
    const d = new Date(raw);
    return isNaN(d.getTime()) ? null : d;
  }, [scope.source, userData?.nextExam]);
}
