import { useEffect, useState } from "react";
import { Question } from "../data/questions";
import { fetchMergedSubjects, fetchPublishedQuestions } from "../lib/content";
import { supabase } from "../lib/supabase";

export interface HomeStats {
  questionsCount: number;
  subjectsCount: number;
  attemptsCount: number;
  pilotsCount: number;
  siteContent: Record<string, string>;
}

const QUESTION_COUNT_FALLBACK = 6940;
const SUBJECT_COUNT_FALLBACK = 28;

export function useHomeStats() {
  const [stats, setStats] = useState<HomeStats>({
    questionsCount: QUESTION_COUNT_FALLBACK,
    subjectsCount: SUBJECT_COUNT_FALLBACK,
    attemptsCount: 42520,
    pilotsCount: 230,
    siteContent: {},
  });
  const [previewQuestions, setPreviewQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const timer = setTimeout(async () => {
      try {
        const [pQuestions, mergedSubjects, countResponse, profilesResponse, attemptsResponse, settingsResponse] = await Promise.all([
          fetchPublishedQuestions({ limit: 10 }),
          fetchMergedSubjects(),
          supabase.from("questions").select("id", { count: "exact", head: true }).eq("status", "published"),
          supabase.from("profiles").select("id", { count: "exact", head: true }),
          supabase.from("attempts").select("total.sum()"),
          supabase.from("app_settings").select("site_content").eq("id", 1).single(),
        ]);

        if (!active) return;

        const resolvedQuestions = countResponse.count ?? pQuestions.length;
        const attemptsSum = (attemptsResponse?.data as any)?.[0]?.sum ?? 0;

        setPreviewQuestions(pQuestions);
        setStats(prev => ({
          questionsCount: resolvedQuestions > 0 ? resolvedQuestions : prev.questionsCount,
          subjectsCount: mergedSubjects.length > 0 ? mergedSubjects.length : prev.subjectsCount,
          attemptsCount: attemptsSum > 0 ? attemptsSum : prev.attemptsCount,
          pilotsCount: profilesResponse?.count ? profilesResponse.count : prev.pilotsCount,
          siteContent: (settingsResponse?.data?.site_content as Record<string, string>) ?? prev.siteContent,
        }));
      } catch (err) {
        console.warn("useHomeStats error:", err);
      } finally {
        if (active) setLoading(false);
      }
    }, 500);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, []);

  return { stats, previewQuestions, loading };
}
