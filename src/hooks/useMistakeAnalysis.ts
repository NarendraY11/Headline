// M12: useMistakeAnalysis — fetches attempts + UQA rows, derives mistake patterns

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { fetchPublishedQuestions } from "../lib/content";
import { useContentScope } from "./useContentScope";
import { useFeature } from "./useFeatureFlags";
import {
  computeMistakeAnalysis,
  type MistakeAnalysisResult,
} from "../lib/mistakeAnalysis";
import { supabase } from "../lib/supabase";

export interface UseMistakeAnalysisState {
  result: MistakeAnalysisResult | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useMistakeAnalysis(): UseMistakeAnalysisState {
  const { user } = useAuth();
  const contentDeliveryEnabled = useFeature("contentDeliveryEngine");
  const { scope } = useContentScope(contentDeliveryEnabled);
  const [result, setResult] = useState<MistakeAnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    setError(null);

    try {
      const [attemptsRes, uqaRes, questions] = await Promise.all([
        supabase
          .from("attempts")
          .select("wrong_question_ids, created_at, subject_id")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(100),
        supabase
          .from("user_question_attempts")
          .select("question_id, is_correct, subject_id, subcategory_id, answered_at")
          .eq("user_id", user.id)
          .order("answered_at", { ascending: false })
          .limit(500),
        fetchPublishedQuestions().catch(() => []),
      ]);

      const attempts = (attemptsRes.data ?? []).map((r: any) => ({
        wrong_question_ids: Array.isArray(r.wrong_question_ids) ? r.wrong_question_ids : [],
        created_at: r.created_at ?? "",
        subject_id: r.subject_id ?? null,
        subcategory_id: null,
      }));

      const uqaRows = (uqaRes.data ?? []).map((r: any) => ({
        question_id: r.question_id,
        is_correct: r.is_correct,
        subject_id: r.subject_id ?? null,
        subcategory_id: r.subcategory_id ?? null,
        answered_at: r.answered_at ?? "",
      }));

      const scopedQuestions =
        contentDeliveryEnabled && scope.hasContent
          ? questions.filter((q) => scope.eligibleSubjectIds.has(q.subjectId ?? ""))
          : questions;

      setResult(computeMistakeAnalysis(attempts, uqaRows, scopedQuestions));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load mistake analysis.");
    } finally {
      setLoading(false);
    }
  }, [user?.id, contentDeliveryEnabled, scope]);

  useEffect(() => { void load(); }, [load]);

  return { result, loading, error, refetch: load };
}
