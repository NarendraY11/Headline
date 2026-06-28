import { BookOpen, ChevronRight, Play } from "lucide-react";
import { Link } from "react-router-dom";
import { SubjectItem } from "../../data/topics";
import { useContinueLearning } from "../../hooks/useContinueLearning";
import type { LearningProgress } from "../../hooks/useLearningProgress";

interface Props {
  subjects: SubjectItem[];
  masteryMap: Record<string, number>;
  /** Phase 9.3: pre-fetched progress from TodayView — skips internal RPC. */
  progress?: LearningProgress;
}

export function ContinueLearningCard({ subjects, masteryMap, progress }: Props) {
  const cl = useContinueLearning(subjects, masteryMap, progress);

  if (!cl.moduleId) return null;

  return (
    <div className="bg-paper border border-rule rounded-2xl overflow-hidden shadow-sm">
      <div className="flex items-center gap-3 px-5 py-3 border-b border-rule/50">
        <Play size={13} className="text-navy" />
        <span className="font-mono text-[9px] uppercase tracking-widest text-muted-2">CONTINUE LEARNING</span>
      </div>
      <Link to={cl.url} className="flex items-center justify-between px-5 py-4 hover:bg-bg-2/30 transition-colors group">
        <div className="min-w-0">
          {cl.subjectTitle && (
            <div className="flex items-center gap-1.5 mb-1">
              <BookOpen size={11} className="text-muted-2 shrink-0" />
              <span className="font-mono text-[9px] text-muted-2 uppercase tracking-wide truncate">{cl.subjectTitle}</span>
            </div>
          )}
          <div className="font-sans text-[14px] font-medium text-ink truncate">{cl.moduleTitle}</div>
          <div className="font-mono text-[9px] text-muted-2 mt-0.5">
            {cl.questionsRemaining > 0
              ? `${cl.questionsRemaining} questions remaining`
              : "Review session"}
          </div>
        </div>
        <ChevronRight size={16} className="text-muted-2 group-hover:text-ink transition-colors shrink-0 ml-4" />
      </Link>
    </div>
  );
}
