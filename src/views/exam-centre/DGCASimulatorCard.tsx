// M12: DGCA CPL Full Exam Simulator
// Real exam mode: 100 questions, 120 min, 70% pass, timed, review on finish.

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { PlaneTakeoff, Clock, AlertCircle } from "lucide-react";
import { fetchPublishedQuestions } from "../../lib/content";

const DGCA_SUBJECTS = [
  "air-navigation",
  "meteorology",
  "air-regulation",
  "technical-general",
  "technical-specific",
  "rtr-a",
];

const TOTAL_QUESTIONS = 100;
const DURATION_MIN = 120;
const PASS_MARK = 70;

export function DGCASimulatorCard() {
  const navigate = useNavigate();
  const [launching, setLaunching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function launchSimulator() {
    setLaunching(true);
    setError(null);
    try {
      const all = await fetchPublishedQuestions();
      const dgca = all.filter(q => DGCA_SUBJECTS.includes((q as any).subject_id ?? ""));

      // Equal distribution across subjects, up to TOTAL_QUESTIONS
      const perSubject = Math.floor(TOTAL_QUESTIONS / DGCA_SUBJECTS.length);
      const bySubject: Record<string, typeof all> = {};
      for (const sid of DGCA_SUBJECTS) bySubject[sid] = [];
      for (const q of dgca) {
        const sid = (q as any).subject_id as string;
        if (bySubject[sid]) bySubject[sid].push(q);
      }

      const selected: typeof all = [];
      for (const sid of DGCA_SUBJECTS) {
        const pool = bySubject[sid].sort(() => Math.random() - 0.5);
        selected.push(...pool.slice(0, perSubject));
      }
      // Fill remainder with random if < TOTAL_QUESTIONS
      const remainder = dgca
        .filter(q => !selected.includes(q))
        .sort(() => Math.random() - 0.5)
        .slice(0, TOTAL_QUESTIONS - selected.length);
      selected.push(...remainder);

      // Shuffle final list
      selected.sort(() => Math.random() - 0.5);

      navigate("/quiz/all", {
        state: {
          customQuestions: selected.slice(0, TOTAL_QUESTIONS),
          overrideTimeLimit: DURATION_MIN * 60,
          overridePassMark: PASS_MARK,
          overrideNegMark: 0,
          examTitle: "DGCA CPL Exam Simulator",
        },
      });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load questions.");
    } finally {
      setLaunching(false);
    }
  }

  return (
    <div className="bg-ink text-paper rounded-2xl p-5 relative overflow-hidden">
      <div className="absolute -right-4 -bottom-4 opacity-5 text-[100px] font-serif select-none pointer-events-none">✈</div>

      <div className="flex items-center gap-2 mb-1 relative z-10">
        <PlaneTakeoff size={15} className="text-paper/70" />
        <span className="font-mono text-[9px] uppercase tracking-widest text-paper/50">DGCA Simulator</span>
      </div>
      <h3 className="font-serif text-[20px] text-paper mb-1 relative z-10">Full CPL Exam</h3>
      <p className="font-sans text-[11px] text-paper/60 mb-4 leading-snug relative z-10">
        Real exam conditions. Timed, scored, pass/fail verdict. Review all answers after.
      </p>

      <div className="grid grid-cols-3 gap-2 mb-4 relative z-10">
        {[
          { label: "Questions", value: `${TOTAL_QUESTIONS}` },
          { label: "Duration", value: `${DURATION_MIN}m` },
          { label: "Pass mark", value: `${PASS_MARK}%` },
        ].map(item => (
          <div key={item.label} className="bg-paper/5 rounded-xl p-2 text-center">
            <p className="font-serif text-[18px] text-paper leading-none">{item.value}</p>
            <p className="font-mono text-[7px] uppercase tracking-wide text-paper/40 mt-0.5">{item.label}</p>
          </div>
        ))}
      </div>

      <div className="flex items-start gap-1.5 mb-4 relative z-10">
        <Clock size={11} className="text-amber mt-0.5 flex-shrink-0" />
        <p className="font-mono text-[8px] text-paper/50 leading-snug">
          Timer runs from the moment you start. Answers locked when time expires.
        </p>
      </div>

      {error && (
        <div className="flex items-start gap-1.5 mb-3 relative z-10">
          <AlertCircle size={11} className="text-signal mt-0.5 flex-shrink-0" />
          <p className="font-mono text-[9px] text-signal">{error}</p>
        </div>
      )}

      <button
        onClick={launchSimulator}
        disabled={launching}
        className="w-full h-11 rounded-xl bg-paper text-ink font-mono text-[10px] uppercase tracking-wider font-bold hover:opacity-90 transition-opacity disabled:opacity-50 relative z-10"
      >
        {launching ? "Preparing exam…" : "Enter Exam Room →"}
      </button>
    </div>
  );
}
