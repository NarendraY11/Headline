export type TimeRangeType = "Today" | "7d" | "30d" | "All";

export interface AllTimeStats {
  totalUsers: number;
  totalProUsers: number;
  totalQuestions: number;
  totalAttempts: number;
}

export interface KpiStats {
  currentSignups: number;
  prevSignups: number;
  currentUpgrades: number;
  prevUpgrades: number;
  conversionRate: number;
  prevConversionRate: number;
  activeCount: number;
  prevActiveCount: number;
  weeklyActive: number;
  prevWeeklyActive: number;
  totalQuestionsAnswered: number;
  prevTotalQuestionsAnswered: number;
  totalQuizSessions: number;
  prevTotalQuizSessions: number;
  avgScore: number;
  prevAvgScore: number;
}
