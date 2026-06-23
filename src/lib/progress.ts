import { supabase } from "./supabase";
import { useEffect, useState } from "react";
import { useAuth } from "../contexts/AuthContext";

export interface ProgressStats {
  subjectMastery: Record<string, number>; // subject_id -> mastery % (0-100)
  subcategoryMastery: Record<string, number>; // subcategory_id -> mastery % (0-100)
  /** % of subjects in exam with >= 80% mastery. NOT the composite readiness
   *  score — that lives in useExamReadiness().score. Renamed (Phase 7.1 P0-2)
   *  to end the "examReadiness" naming collision. */
  masteredSubjectPct: number;
  totalQuestionsAnswered: number;
  averageScore: number;
  /** Mirrors profiles.streak_count (the single source of truth, written by
   *  trackAnswerForStreakAndGoal). NOT re-derived here (Phase 7.1 P0-1). */
  streakCount: number;
}

export function useUserProgress() {
  const { user, userData } = useAuth();
  const [stats, setStats] = useState<ProgressStats>({
    subjectMastery: {},
    subcategoryMastery: {},
    masteredSubjectPct: 0,
    totalQuestionsAnswered: 0,
    averageScore: 0,
    streakCount: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function fetchProgress() {
      if (!user) {
        setStats({
           subjectMastery: {}, subcategoryMastery: {}, masteredSubjectPct: 0,
           totalQuestionsAnswered: 0, averageScore: 0, streakCount: 0
        });
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from("user_question_attempts")
          .select("is_correct, subject_id, subcategory_id, answered_at")
          .eq("user_id", user.uid);

        if (error) throw error;
        if (!active) return;
        
        if (!data || data.length === 0) {
          setStats({
            subjectMastery: {}, subcategoryMastery: {}, masteredSubjectPct: 0,
            totalQuestionsAnswered: 0, averageScore: 0,
            streakCount: userData?.streakCount ?? 0,
          });
          setLoading(false);
          return;
        }

        const subjectStats: Record<string, { correct: number, total: number }> = {};
        const subcatStats: Record<string, { correct: number, total: number }> = {};
        let totalCorrect = 0;
        const totalAnswered = data.length;

        data.forEach(row => {
          const isCorrect = row.is_correct ? 1 : 0;
          totalCorrect += isCorrect;

          if (row.subject_id) {
            if (!subjectStats[row.subject_id]) subjectStats[row.subject_id] = { correct: 0, total: 0 };
            subjectStats[row.subject_id].correct += isCorrect;
            subjectStats[row.subject_id].total += 1;
          }
          if (row.subcategory_id) {
            if (!subcatStats[row.subcategory_id]) subcatStats[row.subcategory_id] = { correct: 0, total: 0 };
            subcatStats[row.subcategory_id].correct += isCorrect;
            subcatStats[row.subcategory_id].total += 1;
          }
        });

        const subjectMastery: Record<string, number> = {};
        let examSubjectsTotal = 0; // rough heuristic if we don't know the exact subjects array for an exam, wait, exam readiness needs subjects in exam. For now, assume all subjects the user interacted with + logic. 
        // Actually, we'll calculate readiness safely below.
        let subjectsMasteredForExamCount = 0;

        for (const [subj, counts] of Object.entries(subjectStats)) {
          const mastery = Math.round((counts.correct / counts.total) * 100);
          subjectMastery[subj] = mastery;
          examSubjectsTotal++;
          if (mastery >= 80) subjectsMasteredForExamCount++;
        }

        const subcategoryMastery: Record<string, number> = {};
        for (const [subcat, counts] of Object.entries(subcatStats)) {
          subcategoryMastery[subcat] = Math.round((counts.correct / counts.total) * 100);
        }

        // % of exam subjects at >= 80% mastery. Fixed denominator floor of 13
        // (ATPL ~14, CPL varies) so a single mastered subject doesn't read 100%.
        const examTotalFixed = Math.max(13, examSubjectsTotal);
        const masteredSubjectPct = Math.round((subjectsMasteredForExamCount / examTotalFixed) * 100);

        // P0-1: streak is NOT re-derived here. profiles.streak_count (written by
        // trackAnswerForStreakAndGoal, with freeze logic) is the single source of
        // truth — we just mirror it so consumers reading progressStats.streakCount
        // never disagree with the profile value.
        setStats({
          subjectMastery,
          subcategoryMastery,
          masteredSubjectPct,
          totalQuestionsAnswered: totalAnswered,
          averageScore: Math.round((totalCorrect / totalAnswered) * 100),
          streakCount: userData?.streakCount ?? 0,
        });
        
      } catch (e) {
        console.error("Failed to load progress stats:", e);
      } finally {
        if (active) setLoading(false);
      }
    }

    fetchProgress();

    return () => { active = false; };
    // streakCount dep keeps the mirrored streak fresh when the profile updates
    // (changes ~once/day at the streak boundary, not per-answer).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, userData?.streakCount]);

  return { stats, loading };
}

export async function submitQuestionAttempt(
  userId: string,
  questionId: string,
  isCorrect: boolean,
  subjectId?: string,
  subcategoryId?: string,
  examId?: string
) {
  if (!userId) return;
  try {
    await supabase.from("user_question_attempts").insert({
      user_id: userId,
      question_id: questionId,
      is_correct: isCorrect,
      subject_id: subjectId || null,
      subcategory_id: subcategoryId || null,
      exam_id: examId || null
    });
  } catch(e) {
    console.error("Failed to submit question attempt", e);
  }
}
