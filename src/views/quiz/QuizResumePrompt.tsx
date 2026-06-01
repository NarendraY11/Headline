import { Button } from "../../components/Atoms";
import { QuizMode } from "./types";

interface QuizResumePromptProps {
  customTopic?: string;
  ata?: string;
  setStatus: (status: "active") => void;
  startQuiz: (mode: QuizMode) => void;
  savedModeSelection: QuizMode;
}

export default function QuizResumePrompt({
  customTopic,
  ata,
  setStatus,
  startQuiz,
  savedModeSelection,
}: QuizResumePromptProps) {
  return (
    <div className="relative min-h-screen flex items-center justify-center p-4">
      <div className="absolute inset-0 blueprint pointer-events-none opacity-40 z-0" />
      <div className="relative z-10 w-full max-w-sm bg-panel border border-rule rounded-xl shadow-2xl p-6 text-center">
        <h2 className="font-serif text-2xl text-ink mb-2">Resume Session?</h2>
        <p className="font-sans text-sm text-ink-2 mb-8">
          You have an active session for{" "}
          <strong>{customTopic || ata || "this module"}</strong>{" "}
          with saved progress.
        </p>
        <div className="flex flex-col gap-3">
          <Button variant="primary" onClick={() => setStatus("active")}>
            Resume Session
          </Button>
          <Button
            variant="ghost"
            className="border border-rule text-signal hover:bg-signal-soft hover:border-signal"
            onClick={() => startQuiz(savedModeSelection)}
          >
            Discard & Start New
          </Button>
        </div>
      </div>
    </div>
  );
}
