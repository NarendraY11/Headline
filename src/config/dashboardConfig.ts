// Phase 5B: Config-driven dashboard tile ordering and visibility.
// Tile order: Mission → Readiness → Analytics → Forecasting.
// Career objective overlays added AFTER the primary mission block.

import { getPrimaryTrackFamily } from "../data/trainingPaths";

export type TileId =
  | "todayMissions"
  | "todayStops"
  | "careerObjectiveMissions"   // Phase 5B: airline-recruitment secondary block
  | "examReadinessGauge"
  | "subjectRanking"
  | "recommendedFocus"
  | "adaptiveRegenBanner"
  | "masteryHeatmap"
  | "masteryRadar"
  | "pacingChart"
  | "masteryTrendGraph"
  | "passProbabilityCard"
  | "atRiskSubjectsCard"
  | "successForecastCard"
  | "recommendedActionsCard"
  | "forecastDashboard";

export interface TileConfig {
  id: TileId;
  /** feature flag that gates this tile — undefined = always show */
  featureFlag?: string;
  /** only show for specific primary track families */
  tracks?: Array<"dgca" | "type_rating" | "faa" | "easa">;
  /** only show when careerObjective matches */
  careerObjective?: string;
}

// Ordered priority: Mission → Career overlay → Readiness → Analytics → Forecasting
export const DASHBOARD_TILE_ORDER: TileConfig[] = [
  // ── 1. Action: primary mission ─────────────────────────────────────────────
  { id: "todayMissions" },
  { id: "todayStops" },

  // ── 2. Career objective overlay ────────────────────────────────────────────
  { id: "careerObjectiveMissions", careerObjective: "airline-recruitment" },

  // ── 3. Readiness ──────────────────────────────────────────────────────────
  { id: "examReadinessGauge",   featureFlag: "examReadinessDashboard" },
  { id: "subjectRanking",       featureFlag: "examReadinessDashboard" },
  { id: "recommendedFocus" },
  { id: "adaptiveRegenBanner",  featureFlag: "adaptiveRegen" },

  // ── 4. Analytics ──────────────────────────────────────────────────────────
  { id: "masteryHeatmap",       featureFlag: "masteryAnalytics" },
  { id: "masteryRadar",         featureFlag: "masteryAnalytics" },
  { id: "pacingChart" },
  { id: "masteryTrendGraph" },

  // ── 5. Forecasting ─────────────────────────────────────────────────────────
  { id: "passProbabilityCard",     featureFlag: "predictiveIntelligence" },
  { id: "atRiskSubjectsCard",      featureFlag: "predictiveIntelligence" },
  { id: "successForecastCard",     featureFlag: "predictiveIntelligence" },
  { id: "recommendedActionsCard",  featureFlag: "predictiveIntelligence" },
  { id: "forecastDashboard",       featureFlag: "predictiveIntelligence" },
];

/**
 * Returns ordered tile IDs to render, filtered for the current user context.
 * If the user has custom tile ordering (userData.settings.dashboardTiles),
 * that takes precedence — but careerObjectiveMissions is always injected after
 * todayStops when careerObjective matches.
 */
export function getVisibleTiles(opts: {
  targetExam: string | null | undefined;
  careerObjective: string | null | undefined;
  enabledFlags: Record<string, boolean>;
  customOrder?: string[];
}): TileId[] {
  const { targetExam, careerObjective, enabledFlags, customOrder } = opts;
  const trackFamily = getPrimaryTrackFamily(targetExam);

  const visible = DASHBOARD_TILE_ORDER.filter(tile => {
    if (tile.featureFlag && !enabledFlags[tile.featureFlag]) return false;
    if (tile.tracks && trackFamily && !tile.tracks.includes(trackFamily)) return false;
    if (tile.careerObjective && tile.careerObjective !== careerObjective) return false;
    return true;
  }).map(t => t.id);

  // If user has custom order, apply it while preserving careerObjectiveMissions position
  if (customOrder && customOrder.length > 0) {
    const customVisible = customOrder.filter(id => visible.includes(id as TileId)) as TileId[];
    // Inject careerObjectiveMissions after todayStops if not already in customOrder
    if (visible.includes("careerObjectiveMissions") && !customOrder.includes("careerObjectiveMissions")) {
      const idx = customVisible.indexOf("todayStops");
      if (idx >= 0) {
        customVisible.splice(idx + 1, 0, "careerObjectiveMissions");
      } else {
        customVisible.unshift("careerObjectiveMissions");
      }
    }
    return customVisible;
  }

  return visible;
}
