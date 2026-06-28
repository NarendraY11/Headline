// Thin adapter — delegates to useLearningProgress (RPC-backed) so callers
// don't need updating. New code should use useLearningProgress directly.
import { useLearningProgress } from "./useLearningProgress";

export interface ModuleProgress {
  mastery: number;
  answeredCount: number;
  lastStudied: string | null;
}

export function useModuleProgress(): { moduleProgress: Record<string, ModuleProgress>; loading: boolean } {
  const { progress, loading } = useLearningProgress();
  const moduleProgress: Record<string, ModuleProgress> = {};
  for (const [id, mp] of Object.entries(progress.modules)) {
    moduleProgress[id] = { mastery: mp.mastery, answeredCount: mp.answered, lastStudied: mp.lastStudied };
  }
  return { moduleProgress, loading };
}
