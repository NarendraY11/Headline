// =====================================================================
// PHASE 5 — useContentScope React hook
//
// Combines learning context (Phase 2) + content delivery engine (Phase 5)
// to produce the active ContentScope for the current user.
//
// Usage:
//   const { scope, loading } = useContentScope();
//   if (scope.eligibleSubjectIds.has(subjectId)) { ... }
//
// Pass enabled=false to skip DB enrichment (used when contentDeliveryEngine
// flag is OFF — avoids querying registry tables before the flag is enabled).
// =====================================================================

import { useEffect, useRef, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { resolveActiveLearningContext } from "../lib/learningContextDb";
import {
  resolveContentScope,
  EMPTY_SCOPE,
  type ContentScope,
} from "../lib/contentDeliveryEngine";
import {
  enrichContentScope,
  EMPTY_ENRICHED_SCOPE,
  type EnrichedContentScope,
} from "../lib/contentScopeDb";

export interface UseContentScopeResult {
  /** Static scope (sync, available immediately after first render) */
  scope: ContentScope;
  /** Enriched scope with DB registry data (available after async load) */
  enrichedScope: EnrichedContentScope;
  loading: boolean;
  error: string | null;
}

/**
 * Resolves the current user's full content scope.
 *
 * When enabled=false (default when contentDeliveryEngine flag is OFF),
 * skips DB enrichment and returns a static scope from the legacy profile.
 * This avoids querying Phase 1 registry tables before the flag is enabled.
 */
export function useContentScope(enabled = true): UseContentScopeResult {
  const { userData, user } = useAuth();
  const [scope, setScope] = useState<ContentScope>(EMPTY_SCOPE);
  const [enrichedScope, setEnrichedScope] = useState<EnrichedContentScope>(EMPTY_ENRICHED_SCOPE);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);

  const userIdRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    const userId = user?.uid;
    userIdRef.current = userId;

    if (!enabled) {
      // Flag OFF: resolve static scope from legacy profile only (no DB).
      const legacy = userData?.targetExam
        ? { targetExam: userData.targetExam, careerObjective: userData?.careerObjective ?? null }
        : null;

      // resolveActiveLearningContext is async but we can do a sync fallback
      // via buildActiveLearningContext for the flag-off case.
      import("../lib/learningContext").then(({ buildActiveLearningContext }) => {
        const ctx = buildActiveLearningContext({ legacy });
        setScope(resolveContentScope(ctx));
        setLoading(false);
      });
      return;
    }

    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        // 1) Resolve full learning context (enrollment → profile → legacy)
        const legacy = userData?.targetExam
          ? { targetExam: userData.targetExam, careerObjective: userData?.careerObjective ?? null }
          : null;

        const ctx = await resolveActiveLearningContext(userId ?? null, legacy);
        if (cancelled) return;

        // 2) Build static scope from resolved context
        const staticScope = resolveContentScope(ctx);
        setScope(staticScope);

        // 3) Enrich with DB registry data
        const enriched = await enrichContentScope(staticScope);
        if (cancelled) return;

        setEnrichedScope(enriched);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load content scope");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => { cancelled = true; };
  }, [enabled, user?.uid, userData?.targetExam, userData?.careerObjective]);

  return { scope, enrichedScope, loading, error };
}
