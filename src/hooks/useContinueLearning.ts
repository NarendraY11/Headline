import { useMemo } from "react";
import { SubjectItem } from "../data/topics";
import { useLearningProgress, type LearningProgress } from "./useLearningProgress";

export interface ContinueLearningState {
  subjectTitle: string | null;
  moduleId: string | null;
  moduleTitle: string | null;
  questionsRemaining: number;
  url: string;
}

/**
 * Finds the deepest incomplete learning position:
 * weakest subject → first module with unanswered questions.
 * Pure derived — no new DB calls (uses useLearningProgress).
 *
 * Phase 9.3: accepts optional pre-fetched progress to skip internal RPC.
 * When provided, useLearningProgress is called with skip=true.
 * Backward-compatible: omit progress to preserve standalone behavior.
 */
export function useContinueLearning(
  subjects: SubjectItem[],
  masteryMap: Record<string, number>,
  injectedProgress?: LearningProgress
): ContinueLearningState {
  const { progress: ownProgress } = useLearningProgress(!!injectedProgress);
  const progress = injectedProgress ?? ownProgress;

  return useMemo(() => {
    const active = subjects.filter(s => s.status === "active");
    // Sort weakest mastery first so we resume from the area that needs most work
    const sorted = [...active].sort((a, b) => (masteryMap[a.id] ?? 0) - (masteryMap[b.id] ?? 0));

    for (const sub of sorted) {
      const modules = sub.subTopics ?? [];
      for (const mod of modules) {
        const mp = progress.modules[mod.id];
        const answered = mp?.answered ?? 0;
        const total = mod.questionCount ?? 0;
        if (total > 0 && answered < total) {
          return {
            subjectTitle: sub.title,
            moduleId: mod.id,
            moduleTitle: mod.title,
            questionsRemaining: total - answered,
            url: `/quiz/${mod.id}`,
          };
        }
      }
    }

    // All answered — go to weakest subject's first module for review
    const fallbackSub = sorted[0];
    const fallbackMod = fallbackSub?.subTopics?.[0];
    return {
      subjectTitle: fallbackSub?.title ?? null,
      moduleId: fallbackMod?.id ?? null,
      moduleTitle: fallbackMod?.title ?? null,
      questionsRemaining: 0,
      url: fallbackMod ? `/quiz/${fallbackMod.id}` : "/modules",
    };
  }, [subjects, masteryMap, progress.modules]);
}
