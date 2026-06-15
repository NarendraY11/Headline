import { previewMockData } from "./previewMockData";
import type {
  PreviewBookmarkTopic,
  PreviewLeaderboardEntry,
  PreviewMasteryAnalyticsSnapshot,
  PreviewMasteryPoint,
  PreviewMissionScoreCard,
  PreviewMetricSummary,
  PreviewPredictiveIntelligenceMetric,
  PreviewReadinessDashboardSnapshot,
  PreviewReadinessEtaSnapshot,
  PreviewReferralStat,
  PreviewSearchResult,
} from "./previewServiceTypes";

export const previewAnalyticsService = {
  getAnalyticsSummaries(): PreviewMetricSummary[] {
    return previewMockData.analyticsSummaries;
  },
  getMasteryChartSeries(): PreviewMasteryPoint[] {
    return previewMockData.masteryChartSeries;
  },
  getLeaderboardRankings(): PreviewLeaderboardEntry[] {
    return previewMockData.leaderboardRankings;
  },
  getBookmarkedTopics(): PreviewBookmarkTopic[] {
    return previewMockData.bookmarkedTopics;
  },
  getSearchResults(): PreviewSearchResult[] {
    return previewMockData.searchResults;
  },
  getReferralStatistics(): PreviewReferralStat[] {
    return previewMockData.referralStatistics;
  },
  getPredictiveMetrics(): PreviewPredictiveIntelligenceMetric[] {
    return previewMockData.predictiveMetrics;
  },
  getReadinessDashboard(): PreviewReadinessDashboardSnapshot {
    return previewMockData.readinessDashboard;
  },
  getReadinessEta(): PreviewReadinessEtaSnapshot {
    return previewMockData.readinessEta;
  },
  getMasteryAnalytics(): PreviewMasteryAnalyticsSnapshot {
    return previewMockData.masteryAnalytics;
  },
  getMissionScores(): PreviewMissionScoreCard[] {
    return previewMockData.missionScores;
  },
};
