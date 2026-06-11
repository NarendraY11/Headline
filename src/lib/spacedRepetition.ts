import { supabase } from "./supabase";

export interface QuestionProgress {
  question_id: string;
  topic_id?: string;
  correct: boolean;
  seen_count: number;
  last_seen_at: string;
  next_review_at: string;
  ease: number;
  interval: number;   // days
  // M8C: SM-2 fields (present after migration; undefined for old local-only records)
  quality?: number;       // 0-5; undefined = legacy row
  review_count?: number;  // SM-2 review counter (separate from seen_count)
}

const DEFAULT_PROGRESS = {
  seen_count: 0,
  ease: 2.5,
  interval: 0,
  quality: 4,
  review_count: 0,
};

// ── SM-lite (original) ────────────────────────────────────────────────────────

export function calculateNextReview(
  currentProgress: Partial<QuestionProgress> | null,
  correct: boolean
): Omit<QuestionProgress, "question_id"> {
  const current = currentProgress || DEFAULT_PROGRESS;
  const seen_count = (current.seen_count || 0) + 1;
  let ease = current.ease || 2.5;
  let interval = 0;

  if (!correct) {
    interval = 0;
    ease = Math.max(1.3, ease - 0.2);
  } else {
    if (seen_count === 1)      interval = 1;
    else if (seen_count === 2) interval = 3;
    else if (seen_count === 3) interval = 7;
    else                       interval = 21;
    ease = Math.min(2.8, ease + 0.1);
  }

  const now = new Date();
  return {
    correct,
    seen_count,
    last_seen_at: now.toISOString(),
    next_review_at: new Date(now.getTime() + interval * 864e5).toISOString(),
    ease,
    interval,
    quality: correct ? 4 : 1,
    review_count: (current.review_count ?? current.seen_count ?? 0) + 1,
  };
}

// ── SM-2 quality derivation (M9B) ────────────────────────────────────────────

/**
 * Derive SM-2 quality from response time vs session median.
 * quality 5 = correct + fast (<60% median)
 * quality 4 = correct + normal (60-140%)   ← default when no timing
 * quality 3 = correct + slow  (>140%)
 * quality 1 = wrong
 * quality 0 = wrong + show-answer used (timeSec=0 heuristic)
 */
export function deriveQuality(
  isCorrect: boolean,
  timeSec: number,
  medianTimeSec: number
): number {
  if (!isCorrect) return timeSec === 0 ? 0 : 1;
  if (timeSec <= 0 || medianTimeSec <= 0) return 4;
  if (timeSec < medianTimeSec * 0.6) return 5;
  if (timeSec < medianTimeSec * 1.4) return 4;
  return 3;
}

// ── SM-2 (M8C) ────────────────────────────────────────────────────────────────
//
// quality levels:
//   5 — correct, fast (< median response time)
//   4 — correct, normal                         ← default when no timing
//   3 — correct, slow
//   1 — wrong
//   0 — wrong + "show answer" used
//
// Ease formula (standard SM-2):
//   ease' = ease + 0.1 - (5-q) * (0.08 + (5-q) * 0.02)
//   clamped to [1.3, 2.8]
//
// Interval:
//   review_count 0 → 1d
//   review_count 1 → 3d
//   review_count 2+ → round(prev_interval * ease)
//   wrong (quality < 3) → 0d (due immediately)

export function calculateNextReviewSM2(
  currentProgress: Partial<QuestionProgress> | null,
  quality: number  // 0-5
): Omit<QuestionProgress, "question_id"> {
  const current = currentProgress || DEFAULT_PROGRESS;
  const seen_count = (current.seen_count || 0) + 1;
  const review_count = (current.review_count ?? current.seen_count ?? 0);
  let ease = current.ease || 2.5;
  let interval = current.interval || 0;
  const correct = quality >= 3;

  // SM-2 ease update (applied regardless of correct/wrong)
  const easeDelta = 0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02);
  ease = Math.min(2.8, Math.max(1.3, ease + easeDelta));

  if (!correct) {
    interval = 0;
  } else {
    if (review_count === 0)      interval = 1;
    else if (review_count === 1) interval = 3;
    else                         interval = Math.round(Math.max(interval, 1) * ease);
  }

  const now = new Date();
  return {
    correct,
    seen_count,
    last_seen_at: now.toISOString(),
    next_review_at: new Date(now.getTime() + interval * 864e5).toISOString(),
    ease,
    interval,
    quality,
    review_count: review_count + 1,
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
          quality: row.quality ?? 4,
          review_count: row.review_count ?? 0,
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
  topicId?: string,
  options?: {
    useSM2?: boolean;
    /** Explicit quality 0-5. Takes precedence over timing derivation. */
    quality?: number;
    /** M9B: response time for this question in seconds. */
    timeSec?: number;
    /** M9B: session median response time. Used with timeSec to derive quality 3/5. */
    medianTimeSec?: number;
    /** M9B: when true, derive quality from timeSec/medianTimeSec instead of binary. */
    sm2QualityTiming?: boolean;
  }
): Promise<QuestionProgress> {
  let progressMap: Record<string, QuestionProgress> = {};
  if (userId) {
    progressMap = await fetchUserQuestionProgress(userId);
  } else {
    progressMap = await getLocalQuestionProgress();
  }

  const current = progressMap[questionId] || null;

  // Choose algorithm path
  let nextStats: Omit<QuestionProgress, "question_id">;
  if (options?.useSM2) {
    // M9B: derive quality from timing if available; else binary fallback
    let quality: number;
    if (options.sm2QualityTiming && options.timeSec !== undefined && options.medianTimeSec !== undefined) {
      quality = deriveQuality(correct, options.timeSec, options.medianTimeSec);
    } else {
      quality = options.quality ?? (correct ? 4 : 1);
    }
    nextStats = calculateNextReviewSM2(current, quality);
  } else {
    nextStats = calculateNextReview(current, correct);
  }

  const updatedProgress: QuestionProgress = {
    question_id: questionId,
    topic_id: topicId || current?.topic_id,
    ...nextStats,
  };

  progressMap[questionId] = updatedProgress;
  await saveLocalQuestionProgress(progressMap);

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
          quality: updatedProgress.quality ?? 4,
          review_count: updatedProgress.review_count ?? 0,
        }, { onConflict: "user_id,question_id" });

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

  const getOffsetString = (days: number) => {
    const d = new Date();
    d.setDate(d.getDate() - days);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const today = getTodayString();
  const yesterday = getYesterdayString();
  const dayBeforeYesterday = getOffsetString(2);

  // Streak freeze: a user starts with a small reserve of "freezes" that
  // protect the streak when exactly one day is missed, instead of resetting.
  const DEFAULT_FREEZES = 2;

  if (user) {
    const lastActive = userData?.lastActivityDate ?? "";
    const currentStreak = userData?.streakCount ?? 0;
    const answeredToday = userData?.questionsAnsweredToday ?? 0;
    const baseSettings = userData?.settings || {};
    const freezes = typeof baseSettings.streakFreezes === "number" ? baseSettings.streakFreezes : DEFAULT_FREEZES;

    let nextStreak = currentStreak;
    let nextCount = answeredToday;
    let nextFreezes = freezes;

    if (lastActive === today) {
      nextCount += count;
    } else if (lastActive === yesterday) {
      nextStreak += 1;
      nextCount = count;
    } else if (lastActive === dayBeforeYesterday && currentStreak > 0 && freezes > 0) {
      // Missed exactly one day — spend a freeze to keep the streak (no increment).
      nextStreak = currentStreak;
      nextCount = count;
      nextFreezes = freezes - 1;
    } else {
      nextStreak = 1;
      nextCount = count;
    }

    await updateUserData({
      streakCount: nextStreak,
      questionsAnsweredToday: nextCount,
      lastActivityDate: today,
      settings: { ...baseSettings, streakFreezes: nextFreezes },
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
