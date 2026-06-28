import { useEffect, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../lib/supabase";

export interface ItemProgress {
  answered: number;
  correct: number;
  mastery: number;
  lastStudied: string | null;
}

export interface LearningProgress {
  modules: Record<string, ItemProgress>;
  topics: Record<string, ItemProgress>;
}

const EMPTY: LearningProgress = { modules: {}, topics: {} };

/**
 * Phase 9.3: skip=true prevents the RPC fetch when a parent provides
 * the data (e.g. TodayView hoists this and passes it to useAdaptiveLearning).
 */
export function useLearningProgress(skip = false): { progress: LearningProgress; loading: boolean } {
  const { user } = useAuth();
  const [progress, setProgress] = useState<LearningProgress>(EMPTY);
  const [loading, setLoading] = useState(!skip);

  useEffect(() => {
    if (skip || !user?.id) { setLoading(false); return; }

    supabase
      .rpc("get_learning_progress")
      .then(({ data, error }) => {
        if (!error && data) {
          const d = data as { modules?: Record<string, ItemProgress>; topics?: Record<string, ItemProgress> };
          setProgress({ modules: d.modules ?? {}, topics: d.topics ?? {} });
        }
        setLoading(false);
      });
  }, [skip, user?.id]);

  return { progress, loading };
}
