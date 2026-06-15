import { lazy, type ComponentType } from "react";
import type { FlagKeys } from "../../hooks/useFeatureFlags";
import { warnPreviewRegistryIssues } from "../../preview/previewDiagnostics";
import { featureRegistry, type FeaturePreviewType } from "./featureRegistry";
import { previewRoutes } from "./previewRoutes";

export type FeaturePreviewRiskLevel = "low" | "medium" | "high";
export type FeaturePreviewImplementationStatus = "planned" | "ready" | "unsupported";

export interface FeaturePreviewDefinition {
  previewType: FeaturePreviewType;
  previewComponent: ComponentType | null;
  previewRoute: string | null;
  riskLevel: FeaturePreviewRiskLevel;
  implementationStatus: FeaturePreviewImplementationStatus;
}

const riskByPreviewType: Record<FeaturePreviewType, FeaturePreviewRiskLevel> = {
  component: "low",
  route: "medium",
  "api-only": "high",
  none: "low",
};

function lazyPreviewComponent<T extends keyof typeof import("./featureComponentPreviews")>(
  exportName: T
) {
  return lazy(async () => {
    const module = await import("./featureComponentPreviews");
    return { default: module[exportName] as ComponentType };
  });
}

const readyComponentPreviews: Partial<Record<FlagKeys, ComponentType>> = {
  analytics: lazyPreviewComponent("AnalyticsPreview"),
  announcementBanner: lazyPreviewComponent("AnnouncementBannerPreview"),
  bookmarksEnabled: lazyPreviewComponent("BookmarksEnabledPreview"),
  calendarSync: lazyPreviewComponent("CalendarSyncPreview"),
  examReadinessDashboard: lazyPreviewComponent("ExamReadinessDashboardPreview"),
  examReadinessEta: lazyPreviewComponent("ExamReadinessEtaPreview"),
  maintenanceMode: lazyPreviewComponent("MaintenanceModePreview"),
  masteryAnalytics: lazyPreviewComponent("MasteryAnalyticsPreview"),
  masteryCharts: lazyPreviewComponent("MasteryChartsPreview"),
  missionScores: lazyPreviewComponent("MissionScoresPreview"),
  leaderboard: lazyPreviewComponent("LeaderboardPreview"),
  predictiveIntelligence: lazyPreviewComponent("PredictiveIntelligencePreview"),
  signupsOpen: lazyPreviewComponent("SignupsOpenPreview"),
  cookieConsent: lazyPreviewComponent("CookieConsentPreview"),
  themeToggle: lazyPreviewComponent("ThemeTogglePreview"),
  notifications: lazyPreviewComponent("NotificationsPreview"),
  pwaInstallPrompt: lazyPreviewComponent("PwaInstallPromptPreview"),
  pushNotifications: lazyPreviewComponent("PushNotificationsPreview"),
  referralProgram: lazyPreviewComponent("ReferralProgramPreview"),
  searchEnabled: lazyPreviewComponent("SearchEnabledPreview"),
  weatherBriefing: lazyPreviewComponent("WeatherBriefingPreview"),
};

export const featurePreviewRegistry = Object.fromEntries(
  Object.values(featureRegistry).map((feature) => [
    feature.key,
    (() => {
      const componentPreview = readyComponentPreviews[feature.key] ?? null;
      const routePreview = previewRoutes[feature.key] ?? null;
      const isReady = Boolean(componentPreview || routePreview);
      const isUnsupported = feature.previewType === ("none" as FeaturePreviewType);

      return {
        previewType: feature.previewType,
        previewComponent: componentPreview,
        previewRoute: routePreview?.path ?? null,
        riskLevel: riskByPreviewType[feature.previewType],
        implementationStatus:
          isUnsupported
            ? "unsupported"
            : isReady
            ? "ready"
            : "planned",
      };
    })(),
  ])
) as { [K in FlagKeys]: FeaturePreviewDefinition };

const unresolvedReadyFeatures = Object.values(featureRegistry).filter((feature) => {
  const preview = featurePreviewRegistry[feature.key];
  return preview.implementationStatus === "ready" && !preview.previewComponent && !preview.previewRoute;
});

if (unresolvedReadyFeatures.length > 0) {
  warnPreviewRegistryIssues(
    `Preview registry has ready features without a component or route: ${unresolvedReadyFeatures
      .map((feature) => feature.key)
      .join(", ")}`
  );
}
