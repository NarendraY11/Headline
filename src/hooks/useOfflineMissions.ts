// M13: useOfflineMissions — cache today's missions to localStorage for offline read

import { useEffect } from "react";
import { useFeature } from "./useFeatureFlags";
import { useTodayMissions } from "./useStudyMissions";
import type { StudyMissionRow } from "../types/studyScheduler";

const STORAGE_PREFIX = "heading_offline_missions_";

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function useOfflineMissions(): { offlineMissions: StudyMissionRow[] } {
  const enabled = useFeature("offlineMissions");
  const { missions, loading } = useTodayMissions();

  // Persist to localStorage when online and loaded
  useEffect(() => {
    if (!enabled || loading || missions.length === 0) return;
    try {
      localStorage.setItem(STORAGE_PREFIX + todayKey(), JSON.stringify(missions));
      // Clean up entries older than 7 days
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith(STORAGE_PREFIX)) {
          const dateStr = key.replace(STORAGE_PREFIX, "");
          const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 7);
          if (dateStr < todayKey()) localStorage.removeItem(key);
        }
      }
    } catch { /* storage full — skip */ }
  }, [enabled, loading, missions]);

  // Read from localStorage (works offline)
  if (!enabled) return { offlineMissions: [] };
  try {
    const cached = localStorage.getItem(STORAGE_PREFIX + todayKey());
    return { offlineMissions: cached ? (JSON.parse(cached) as StudyMissionRow[]) : [] };
  } catch {
    return { offlineMissions: [] };
  }
}
