import { supabase } from "./supabase";
import { useEffect, useState } from "react";
import { useAuth } from "../contexts/AuthContext";

export interface ProgressStats {
  subjectMastery: Record<string, number>; // subject_id -> mastery % (0-100)
  subcategoryMastery: Record<string, number>; // subcategory_id -> mastery % (0-100)
  examReadiness: number; // % of subjects in exam with >= 80% mastery
  totalQuestionsAnswered: number;
  averageScore: number;
  streakCount: number;
}

export function useUserProgress() {
  const { user } = useAuth();
  const [stats, setStats] = useState<ProgressStats>({
    subjectMastery: {},
    subcategoryMastery: {},
    examReadiness: 0,
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
           subjectMastery: {}, subcategoryMastery: {}, examReadiness: 0,
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
            subjectMastery: {}, subcategoryMastery: {}, examReadiness: 0,
            totalQuestionsAnswered: 0, averageScore: 0, streakCount: 0
          });
          setLoading(false);
          return;
        }

        const subjectStats: Record<string, { correct: number, total: number }> = {};
        const subcatStats: Record<string, { correct: number, total: number }> = {};
        let totalCorrect = 0;
        const totalAnswered = data.length;
        
        // streak calc
        const uniqueDays = new Set<string>();
        
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
          
          if (row.answered_at) {
             uniqueDays.add(new Date(row.answered_at).toISOString().split('T')[0]);
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

        // exam readiness: bounded to 0-100, wait, readiness across ALL subjects they have? Or a fixed constant?
        // Let's assume 13 subjects standard if examSubjectsTotal <= 13.
        const examTotalFixed = Math.max(13, examSubjectsTotal); // ATPL has 14, CPL has varies, default 13
        const examReadiness = Math.round((subjectsMasteredForExamCount / examTotalFixed) * 100);

        // calculate streak
        // Just unique days count to be safe, real streak requires checking consecutive days backward from today.
        const sortedDays = Array.from(uniqueDays).sort((a,b) => b.localeCompare(a));
        let streak = 0;
        const todayStr = new Date().toISOString().split('T')[0];
        const yesterdayDate = new Date();
        yesterdayDate.setDate(yesterdayDate.getDate() - 1);
        const yesterdayStr = yesterdayDate.toISOString().split('T')[0];
        
        if (sortedDays.length > 0) {
           if (sortedDays[0] === todayStr || sortedDays[0] === yesterdayStr) {
              streak = 1;
              let currentCheckDate = new Date(sortedDays[0]);
              for (let i = 1; i < sortedDays.length; i++) {
                 currentCheckDate.setDate(currentCheckDate.getDate() - 1);
                 if (sortedDays[i] === currentCheckDate.toISOString().split('T')[0]) {
                    streak++;
                 } else {
                    break;
                 }
              }
           }
        }

        setStats({
          subjectMastery,
          subcategoryMastery,
          examReadiness,
          totalQuestionsAnswered: totalAnswered,
          averageScore: Math.round((totalCorrect / totalAnswered) * 100),
          streakCount: streak
        });
        
      } catch (e) {
        console.error("Failed to load progress stats:", e);
      } finally {
        if (active) setLoading(false);
      }
    }

    fetchProgress();

    return () => { active = false; };
  }, [user]);

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
