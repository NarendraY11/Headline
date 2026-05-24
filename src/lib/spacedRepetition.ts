import { supabase } from "./supabase";

export interface QuestionProgress {
  question_id: string;
  topic_id?: string;
  correct: boolean;
  seen_count: number;
  last_seen_at: string;
  next_review_at: string;
  ease: number;
  interval: number; // in days
}

// Initial/default progress for a question
const DEFAULT_PROGRESS = {
  seen_count: 0,
  ease: 2.5,
  interval: 0,
};

export function calculateNextReview(currentProgress: Partial<QuestionProgress> | null, correct: boolean): Omit<QuestionProgress, 'question_id'> {
  const current = currentProgress || DEFAULT_PROGRESS;
  const seen_count = (current.seen_count || 0) + 1;
  let ease = current.ease || 2.5;
  let interval = 0; // in days

  if (!correct) {
    // Wrong answers come back soon (due immediately)
    interval = 0;
    ease = Math.max(1.3, ease - 0.2);
  } else {
    // Correct answers space out: 1d -> 3d -> 7d -> 21d
    if (seen_count === 1) {
      interval = 1;
    } else if (seen_count === 2) {
      interval = 3;
    } else if (seen_count === 3) {
      interval = 7;
    } else {
      interval = 21;
    }
    ease = Math.min(2.8, ease + 0.1);
  }

  const now = new Date();
  const nextReviewDate = new Date(now.getTime() + interval * 24 * 60 * 60 * 1000);

  return {
    correct,
    seen_count,
    last_seen_at: now.toISOString(),
    next_review_at: nextReviewDate.toISOString(),
    ease,
    interval,
  };
}

// Global functions for retrieving / recording progress
export async function getLocalQuestionProgress(): Promise<Record<string, QuestionProgress>> {
  try {
    const saved = localStorage.getItem("heading_question_progress");
    return saved ? JSON.parse(saved) : {};
  } catch (e) {
    console.error("Local storage error getting question progress:", e);
    return {};
  }
}

export async function saveLocalQuestionProgress(progress: Record<string, QuestionProgress>) {
  try {
    localStorage.setItem("heading_question_progress", JSON.stringify(progress));
  } catch (e) {
    console.error("Local storage error saving question progress:", e);
  }
}

export async function fetchUserQuestionProgress(userId: string): Promise<Record<string, QuestionProgress>> {
  try {
    const { data, error } = await supabase
      .from("question_progress")
      .select("*")
      .eq("user_id", userId);

    if (error) {
      console.warn("Could not read question_progress table:", error);
      // Fallback to local
      return getLocalQuestionProgress();
    }

    const progressMap: Record<string, QuestionProgress> = {};
    if (data) {
      data.forEach((row: any) => {
        progressMap[row.question_id] = {
          question_id: row.question_id,
          correct: row.correct,
          seen_count: row.seen_count,
          last_seen_at: row.last_seen_at,
          next_review_at: row.next_review_at,
          ease: row.ease,
          interval: row.interval,
        };
      });
    }
    return progressMap;
  } catch (err) {
    console.error("Error in fetchUserQuestionProgress:", err);
    return getLocalQuestionProgress();
  }
}

export async function recordAnswerProgress(
  userId: string | null,
  questionId: string,
  correct: boolean,
  topicId?: string
): Promise<QuestionProgress> {
  // Load current progress
  let progressMap: Record<string, QuestionProgress> = {};
  if (userId) {
    progressMap = await fetchUserQuestionProgress(userId);
  } else {
    progressMap = await getLocalQuestionProgress();
  }

  const current = progressMap[questionId] || null;
  const nextStats = calculateNextReview(current, correct);

  const updatedProgress: QuestionProgress = {
    question_id: questionId,
    topic_id: topicId || current?.topic_id,
    ...nextStats,
  };

  progressMap[questionId] = updatedProgress;

  // Always back up locally
  await saveLocalQuestionProgress(progressMap);

  // If user logged in, send to Supabase
  if (userId) {
    try {
      const { error } = await supabase
        .from("question_progress")
        .upsert({
          user_id: userId,
          question_id: questionId,
          topic_id: topicId || current?.topic_id,
          correct: updatedProgress.correct,
          seen_count: updatedProgress.seen_count,
          last_seen_at: updatedProgress.last_seen_at,
          next_review_at: updatedProgress.next_review_at,
          ease: updatedProgress.ease,
          interval: updatedProgress.interval,
        }, {
          onConflict: "user_id,question_id"
        });

      if (error) {
        console.warn("Failed to upsert to question_progress table:", error);
      }
    } catch (err) {
      console.error("Exception in recording answer progress on Supabase:", err);
    }
  }

  return updatedProgress;
}

export async function trackAnswerForStreakAndGoal(
  user: any,
  userData: any,
  updateUserData: Function,
  count: number = 1
) {
  const getTodayString = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const getYesterdayString = () => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const today = getTodayString();
  const yesterday = getYesterdayString();

  if (user) {
    const lastActive = userData?.lastActivityDate ?? "";
    const currentStreak = userData?.streakCount ?? 0;
    const answeredToday = userData?.questionsAnsweredToday ?? 0;

    let nextStreak = currentStreak;
    let nextCount = answeredToday;

    if (lastActive === today) {
      nextCount += count;
    } else if (lastActive === yesterday) {
      nextStreak += 1;
      nextCount = count;
    } else {
      nextStreak = 1;
      nextCount = count;
    }

    await updateUserData({
      streakCount: nextStreak,
      questionsAnsweredToday: nextCount,
      lastActivityDate: today,
    });
  } else {
    try {
      const lastActive = localStorage.getItem("heading_last_activity_date") || "";
      let currentStreak = parseInt(localStorage.getItem("heading_streak_count") || "0");
      let answeredToday = parseInt(localStorage.getItem("heading_questions_answered_today") || "0");

      if (lastActive === today) {
        answeredToday += count;
      } else if (lastActive === yesterday) {
        currentStreak += 1;
        answeredToday = count;
      } else {
        currentStreak = 1;
        answeredToday = count;
      }

      localStorage.setItem("heading_questions_answered_today", String(answeredToday));
      localStorage.setItem("heading_streak_count", String(currentStreak));
      localStorage.setItem("heading_last_activity_date", today);
    } catch (e) {
      console.error("Local storage error tracking streak/goal:", e);
    }
  }
}

export async function getDueQuestionIds(userId: string | null): Promise<string[]> {
  let progressMap: Record<string, QuestionProgress> = {};
  if (userId) {
    progressMap = await fetchUserQuestionProgress(userId);
  } else {
    progressMap = await getLocalQuestionProgress();
  }

  const now = new Date();
  const dueIds: string[] = [];
  const wrongOrWeakIds: string[] = [];

  Object.values(progressMap).forEach((prog) => {
    const nextReview = new Date(prog.next_review_at);
    if (nextReview <= now) {
      dueIds.push(prog.question_id);
    } else if (!prog.correct) {
      wrongOrWeakIds.push(prog.question_id);
    }
  });

  // If there are less than 10 questions due, top up with wrong/weak ones
  if (dueIds.length < 10) {
    const remaining = 10 - dueIds.length;
    const extra = wrongOrWeakIds.filter(id => !dueIds.includes(id)).slice(0, remaining);
    dueIds.push(...extra);
  }

  return dueIds;
}
