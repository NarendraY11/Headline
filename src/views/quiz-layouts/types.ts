import { Question } from "../../data/questions";

export interface QuizLayoutProps {
  currentQ: Question;
  currentIndex: number;
  totalQuestions: number;
  questions: Question[];
  mode: "practice" | "timed" | "viva";
  selectedOptionId: string | null;
  answers: Record<string, string>;
  submittedIds: Set<string>;
  revealedIds: Set<string>;
  isSubmittedPractice: boolean;
  isRevealedViva: boolean;
  isBookmarked: boolean;
  timeLeft: number | null;
  timeElapsed: number;
  formatTime: (sec: number) => string;
  aiExplanations: Record<string, string>;
  isAiLoading: boolean;
  handleSelectOption: (id: string) => void;
  handleSubmitPractice: () => void;
  handleRevealViva: (id: string) => void;
  handleNext: () => void;
  handlePrev: () => void;
  handleJump: (index: number) => void;
  toggleBookmark: (q: Question) => void;
  handleExplainDeeper: () => void;
  setShowAbortPrompt: (show: boolean) => void;
  showAbortPrompt: boolean;
  storageKey: string;
  customQuestions?: Question[] | null;
  navigate: (to: string) => void;
  aiExplainEnabled?: boolean;
}
