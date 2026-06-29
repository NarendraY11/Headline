import { CheckCircle } from "lucide-react";
import { Link } from "react-router-dom";
import { TILE_BASE } from "./tileClasses";

interface ContinueModuleTileProps {
  subjectMastery: Record<string, number>;
  subjectsList: Array<{
    id: string;
    title: string;
    subTopics?: Array<{ id: string; title: string; questionCount?: number }>;
  }>;
}

export function ContinueModuleTile({ subjectMastery, subjectsList }: ContinueModuleTileProps) {
  const weakestSubjectId = Object.entries(subjectMastery)
    .sort(([, a], [, b]) => a - b)[0]?.[0];
  const weakestSubject = subjectsList.find(s => s.id === weakestSubjectId);
  const continueModule = weakestSubject?.subTopics?.[0];
  return (
    <div className={TILE_BASE}>
      <div>
        <div className="flex items-center gap-1.5 mb-1 text-muted-2">
          <CheckCircle size={14} className="text-mint" />
          <span className="font-mono text-[9px] uppercase tracking-wide text-muted-2">
            NEXT MODULE
          </span>
        </div>
        {continueModule ? (
          <>
            <div className="font-sans text-sm font-medium text-ink mt-2 line-clamp-2 leading-snug">
              {continueModule.title}
            </div>
            <div className="font-mono text-[9px] text-muted-2 mt-1">
              {weakestSubject?.title} · {continueModule.questionCount} q's
            </div>
          </>
        ) : (
          <div className="font-mono text-[9px] text-muted-2 mt-2">No modules yet</div>
        )}
      </div>
      {continueModule && (
        <Link
          to={`/quiz/${continueModule.id}`}
          className="font-mono text-[9px] uppercase tracking-wide text-mint hover:opacity-70 transition-opacity mt-2 inline-block"
        >
          Start →
        </Link>
      )}
    </div>
  );
}
