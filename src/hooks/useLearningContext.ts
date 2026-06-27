// Phase 2 — useLearningContext(): returns the active learning context for
// the current user. DATA ONLY. No production page is switched in Phase 2;
// later phases (Today, Modules, Mission Engine, Mock, Search, Analytics,
// import, admin preview) consume this hook.
//
// Always resolves to a usable context via the legacy fallback chain, so a
// consumer can adopt it without depending on the `learningContext` flag.

import { useEffect, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import {
  resolveActiveLearningContext,
} from "../lib/learningContextDb";
import {
  buildActiveLearningContext,
  type ActiveLearningContext,
} from "../lib/learningContext";

export function useLearningContext(): { context: ActiveLearningContext; loading: boolean } {
  const { user, userData } = useAuth();
  const legacy = {
    targetExam: (userData as any)?.targetExam ?? null,
    careerObjective: (userData as any)?.careerObjective ?? null,
  };

  // Seed with the synchronous legacy context so consumers never see null.
  const [context, setContext] = useState<ActiveLearningContext>(() =>
    buildActiveLearningContext({ legacy })
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    resolveActiveLearningContext(user?.uid, legacy)
      .then((ctx) => { if (alive) setContext(ctx); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid, legacy.targetExam, legacy.careerObjective]);

  return { context, loading };
}
