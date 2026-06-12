// M12: Adaptive Mock Exam Launcher
// Weights questions by mastery — weak subjects appear more frequently.

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Zap } from "lucide-react";
import { useUserProgress } from "../../lib/progress";
import { fetchPublishedQuestions } from "../../lib/content";
import { weightedQuestionSample } from "../../lib/mistakeAnalysis";
import { useMasterySnapshots } from "../../hooks/useMasterySnapshots";

const PRESET = [
  { label: "Quick", questions: 20, minutes: 25 },
  { label: "Standard", questions: 50, minutes: 60 },
  { label: "Full", questions: 100, minutes: 120 },
] as const;

export function AdaptiveMockLauncher() {
  const navigate = useNavigate();
  const { stats } = useUserProgress();
  const { snapshots } = useMasterySnapshots();
  const [launching, setLaunching] = useState(false);
  const [preset, setPreset] = useState<0 | 1 | 2>(1);

  const { label, questions: qCount, minutes } = PRESET[preset];

  async function launch() {
    setLaunching(true);
    try {
      const all = await fetchPublishedQuestions();
      // Build mastery map — prefer snapshot data over progress stats
      const masteries: Record<string, number> = { ...stats.subjectMastery };
      for (const s of snapshots) masteries[s.subject_id] = s.mastery;

      const selected = weightedQuestionSample(all, masteries, qCount);
      if (selected.length === 0) {
        navigate("/quiz/all", { state: { overrideTimeLimit: minutes * 60, examTitle: `Adaptive Mock — ${label}` } });
        return;
      }
      navigate("/quiz/all", {
        state: {
          customQuestions: selected,
          overrideTimeLimit: minutes * 60,
          overridePassMark: 70,
          examTitle: `Adaptive Mock — ${label}`,
        },
      });
    } finally {
      setLaunching(false);
    }
  }

  return (
    <div className="bg-paper border border-rule rounded-2xl p-5">
      <div className="flex items-center gap-2 mb-1">
        <Zap size={15} className="text-amber" />
        <span className="font-mono text-[9px] uppercase tracking-widest text-muted-2">Adaptive Mock</span>
      </div>
      <h3 className="font-serif text-[18px] text-ink mb-1">Smart Exam</h3>
      <p className="font-sans text-[11px] text-muted-2 mb-4 leading-snug">
        Questions weighted by your weakest subjects. Critical gaps appear 3× more often.
      </p>

      {/* Preset selector */}
      <div className="flex gap-2 mb-4">
        {PRESET.map((p, i) => (
          <button
            key={p.label}
            onClick={() => setPreset(i as 0 | 1 | 2)}
            className={`flex-1 py-1.5 rounded-lg font-mono text-[9px] uppercase tracking-wide border transition-colors ${
              preset === i
                ? "bg-amber/10 border-amber/30 text-amber"
                : "border-rule text-muted-2 hover:border-amber/20 hover:text-ink"
            }`}
          >
            {p.label}
            <span className="block text-[7px] opacity-70">{p.questions}Q · {p.minutes}min</span>
          </button>
        ))}
      </div>

      <button
        onClick={launch}
        disabled={launching}
        className="w-full h-10 rounded-xl bg-amber text-white font-mono text-[10px] uppercase tracking-wider font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
      >
        {launching ? "Building exam…" : `Start ${label} Adaptive Mock`}
      </button>
    </div>
  );
}
