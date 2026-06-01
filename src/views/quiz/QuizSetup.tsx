import { Settings2 } from "lucide-react";
import { Button, Chip } from "../../components/Atoms";
import { ProGate } from "../../components/ProGate";
import { QuizMode } from "./types";

interface QuizSetupProps {
  customTopic?: string;
  ata?: string;
  routeTopicId?: string;
  mockExams: any[]; // Or import the type if available
  startQuiz: (mode: QuizMode) => void;
  navigate: (path: string) => void;
}

export default function QuizSetup({
  customTopic,
  ata,
  routeTopicId,
  mockExams,
  startQuiz,
  navigate,
}: QuizSetupProps) {
  return (
    <div className="relative min-h-screen flex items-center justify-center p-4">
      <div className="absolute inset-0 blueprint pointer-events-none opacity-40 z-0" />
      <div className="absolute inset-0 paper-grain pointer-events-none opacity-100 z-1" />

      <div className="relative z-10 w-full max-w-2xl bg-paper border border-rule rounded-xl p-8 shadow-xl">
        <div className="flex items-center gap-4 mb-8">
          <Settings2 className="text-ink" size={28} />
          <div>
            <h1 className="font-serif text-3xl text-ink">Engine Calibration</h1>
            <span className="font-mono text-[10px] text-muted-2 uppercase tracking-widest mt-1 block">
              FLIGHT DECK INITIALIZATION
            </span>
          </div>
        </div>

        <p className="font-sans font-light text-ink-2 mb-10 leading-relaxed">
          Select an operational mode for the "{customTopic || ata || "this module"}" module. Heading adapts to your cognitive training phase.
        </p>

        <div className="space-y-4">
          <button
            onClick={() => startQuiz("practice")}
            className="w-full text-left p-6 border border-rule hover:border-ink rounded-lg bg-panel transition-all group focus:outline-none focus:ring-2 focus:ring-ink focus:ring-offset-2"
          >
            <div className="flex justify-between items-center mb-2">
              <span className="font-sans font-semibold text-lg text-ink">Practice Protocol</span>
              <Chip variant="mint" className="text-[9px]">
                RECOMMENDED
              </Chip>
            </div>
            <p className="font-sans text-sm text-muted font-light w-11/12">
              Standard study mode. Receive immediate technical feedback and high-fidelity references after each selection.
            </p>
          </button>

          <ProGate
            type="timed-mock"
            isUnlocked={mockExams.some((e) => e.id === routeTopicId) && routeTopicId === "nav-cpl-01"}
          >
            <button
              onClick={() => startQuiz("timed")}
              className="w-full text-left p-6 border border-rule hover:border-ink rounded-lg bg-panel transition-all group focus:outline-none focus:ring-2 focus:ring-ink focus:ring-offset-2"
            >
              <div className="flex justify-between items-center mb-2">
                <span className="font-sans font-semibold text-lg text-ink">Timed Authority Exam</span>
                <Chip variant="amber" className="text-[9px]">
                  MOCK EXAM
                </Chip>
              </div>
              <p className="font-sans text-sm text-muted font-light w-11/12">
                Simulates DGCA/EASA stress loading. No feedback until the final payload is delivered. Track your time-per-question metrics.
              </p>
            </button>
          </ProGate>

          <ProGate type="viva-practice" isUnlocked={false}>
            <button
              onClick={() => startQuiz("viva")}
              className="w-full text-left p-6 border border-rule hover:border-ink rounded-lg bg-panel transition-all group focus:outline-none focus:ring-2 focus:ring-ink focus:ring-offset-2"
            >
              <div className="flex justify-between items-center mb-2">
                <span className="font-sans font-semibold text-lg text-ink">Viva Flashcards</span>
                <Chip variant="sky" className="text-[9px]">
                  MEMORY RECALL
                </Chip>
              </div>
              <p className="font-sans text-sm text-muted font-light w-11/12">
                Used for oral board prep or rapid repetition. Formulate the answer mentally, then reveal the regulatory model answer.
              </p>
            </button>
          </ProGate>
        </div>

        <div className="mt-8 pt-4 border-t border-rule text-right">
          <Button variant="ghost" onClick={() => navigate("/modules")}>
            Cancel Operations
          </Button>
        </div>
      </div>
    </div>
  );
}
