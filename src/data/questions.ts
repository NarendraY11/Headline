export interface Choice {
  id: string; // 'a', 'b', 'c', 'd'
  label: string;
}

export interface Question {
  id: string;
  topicId: string;
  subjectId?: string;
  subcategoryId?: string;
  examId?: string;
  ata: string;
  difficulty: "standard" | "complex" | "extreme";
  prompt: string;
  diagramCaption?: string;
  choices: Choice[];
  correct: string;
  explanation: string;
  references: string[];
  isAiGenerated?: boolean;
}

// Moved staticQuestionBank to staticQuestions.ts to minimize bundle size,
// loaded lazily when needed. Runtime question fetching lives in lib/content.ts
// (fetchPublishedQuestions / fetchQuizQuestionsForTopic) with offline + static
// fallbacks — this module is now types only, so importing it (e.g. for the
// Question type) no longer triggers a full-table fetch on the critical path.

