export interface PreviewMetricSummary {
  label: string;
  value: string;
  delta?: string;
  tone?: "positive" | "neutral" | "warning";
}

export interface PreviewMasteryPoint {
  subject: string;
  mastery: number;
  trend: string;
}

export interface PreviewLeaderboardEntry {
  rank: number;
  name: string;
  score: string;
  streak: string;
  currentUser?: boolean;
}

export interface PreviewBookmarkTopic {
  title: string;
  kind: string;
  count: string;
}

export interface PreviewSearchResult {
  title: string;
  route: string;
  tag: string;
}

export interface PreviewReferralStat {
  label: string;
  value: string;
}

export interface PreviewAICoachingResponse {
  coachName: string;
  headline: string;
  summary: string;
  strengths: string[];
  focusAreas: string[];
  nextActions: string[];
}

export interface PreviewAIExplanation {
  questionStem: string;
  correctAnswer: string;
  explanation: string;
  whyOthersMissIt: string[];
}

export interface PreviewWeatherBriefingData {
  station: string;
  flightCategory: "VFR" | "MVFR" | "IFR";
  issuedAt: string;
  wind: string;
  visibility: string;
  ceiling: string;
  hazards: string[];
  summary: string;
}

export interface PreviewStudyScheduleItem {
  id: string;
  title: string;
  block: string;
  durationMinutes: number;
  mode: "review" | "quiz" | "mock" | "reading";
  focus: string;
}

export interface PreviewStudyScheduleDay {
  dateLabel: string;
  completion: string;
  items: PreviewStudyScheduleItem[];
}

export interface PreviewPredictiveIntelligenceMetric {
  label: string;
  value: string;
  confidence: string;
  trend: "up" | "flat" | "down";
  narrative: string;
}

export interface PreviewReadinessSubjectBreakdown {
  subject: string;
  readiness: number;
  trend: string;
}

export interface PreviewReadinessDashboardSnapshot {
  readinessPercentage: string;
  readinessTrend: string;
  recommendationSummary: string;
  subjectBreakdown: PreviewReadinessSubjectBreakdown[];
}

export interface PreviewReadinessEtaMilestone {
  label: string;
  targetDate: string;
  status: "completed" | "active" | "upcoming";
}

export interface PreviewReadinessEtaSnapshot {
  estimatedReadyDate: string;
  completionTrajectory: string;
  milestones: PreviewReadinessEtaMilestone[];
}

export interface PreviewMasteryAnalyticsSnapshot {
  distribution: Array<{ label: string; value: string }>;
  strengths: string[];
  weaknesses: string[];
  suggestions: string[];
}

export interface PreviewMissionScoreCard {
  title: string;
  score: string;
  progressLabel: string;
  rankLabel: string;
}

export interface PreviewNotificationPayload {
  id: string;
  title: string;
  body: string;
  category: "streak" | "referral" | "system" | "schedule";
  timestampLabel: string;
  unread: boolean;
}

export interface PreviewPushNotificationExample {
  id: string;
  title: string;
  body: string;
  device: string;
  deliveryLabel: string;
}

export interface PreviewPushSubscriptionStatus {
  channelLabel: string;
  browserLabel: string;
  deviceLabel: string;
  state: "subscribed" | "inactive";
  lastSynced: string;
}

export interface PreviewCalendarSyncItem {
  id: string;
  title: string;
  dateLabel: string;
  timeLabel: string;
  calendarLabel: string;
  exportType: "ics" | "google" | "outlook";
}

export interface PreviewCalendarSyncSnapshot {
  accountLabel: string;
  statusLabel: string;
  upcoming: PreviewCalendarSyncItem[];
}
