// M12: Exam Centre — Advanced Testing System hub

import { useEffect, useState } from "react";
import { Shield } from "lucide-react";
import { useExamReadiness } from "../hooks/useExamReadiness";
import { useMistakeAnalysis } from "../hooks/useMistakeAnalysis";
import { usePredictiveIntelligence } from "../hooks/usePredictiveIntelligence";
import { fetchMergedSubjects } from "../lib/content";
import type { SubjectItem } from "../data/topics";

import { AdaptiveMockLauncher } from "./exam-centre/AdaptiveMockLauncher";
import { TopicMockGrid } from "./exam-centre/TopicMockGrid";
import { DGCASimulatorCard } from "./exam-centre/DGCASimulatorCard";
import { MistakeAnalysisPanel } from "./exam-centre/MistakeAnalysisPanel";
import { ExamPassProbabilityCard } from "./exam-centre/ExamPassProbabilityCard";

export default function ExamCentreView() {
  const [subjects, setSubjects] = useState<SubjectItem[]>([]);

  useEffect(() => {
    fetchMergedSubjects().then(setSubjects).catch(() => {});
  }, []);

  const subjectTitleMap: Record<string, string> = {};
  for (const s of subjects) subjectTitleMap[s.id] = s.title;

  const examReadiness = useExamReadiness(subjects.length || 6);
  const predictive = usePredictiveIntelligence(subjects.length || 6, subjectTitleMap);
  const mistakes = useMistakeAnalysis();

  return (
    <div className="max-w-5xl mx-auto py-6 px-4 space-y-8">
      {/* Header */}
      <div>
        <div className="font-mono text-[10px] text-signal tracking-[0.2em] uppercase mb-2">
          § EXAM CENTRE
        </div>
        <h1 className="font-serif text-[32px] text-ink leading-tight tracking-tight mb-1">
          Advanced Testing
        </h1>
        <p className="font-sans text-[13px] text-muted-2">
          Adaptive mocks, topic drills, full DGCA simulator, and mistake analysis.
        </p>
      </div>

      {/* Row 1: Pass Probability + DGCA Simulator */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ExamPassProbabilityCard
          predictive={predictive.result}
          readiness={{ score: examReadiness.score, band: examReadiness.band, components: examReadiness.components }}
          loading={examReadiness.loading || predictive.loading}
        />
        <DGCASimulatorCard />
      </div>

      {/* Row 2: Adaptive Mock + Topic Mocks */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <AdaptiveMockLauncher />
        <TopicMockGrid />
      </div>

      {/* Row 3: Mistake Analysis (full width) */}
      <MistakeAnalysisPanel
        result={mistakes.result}
        loading={mistakes.loading}
        error={mistakes.error}
        subjectTitles={subjectTitleMap}
        onRefetch={mistakes.refetch}
      />

      {/* Footer note */}
      <div className="flex items-center gap-2 text-muted-2">
        <Shield size={12} />
        <p className="font-mono text-[8px] uppercase tracking-wide">
          All exams use your live question bank. Results feed your mastery + predictive score.
        </p>
      </div>
    </div>
  );
}
