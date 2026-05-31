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

// Moved staticQuestionBank to staticQuestions.ts to minimize bundle size
// It will be lazily loaded when needed.


import { supabase } from "../lib/supabase";

export let questionBank: Question[] = [];

try {
  const { data, error } = await supabase
    .from("questions")
    .select("*")
    .eq("status", "published");

  if (error) {
    console.warn("Failed to fetch questions from Supabase, using static bank:", error);
    const { staticQuestionBank } = await import("./staticQuestions");
    questionBank = staticQuestionBank;
  } else if (data && data.length > 0) {
    questionBank = data
      .filter((q: any) => q.status === "published")
      .map((q: any) => ({
        id: q.id,
        topicId: q.subcategory_id || q.subject_id || "",
        ata: q.ata || "Uncategorized",
        difficulty: q.difficulty || "standard",
        prompt: q.prompt,
        diagramCaption: q.diagram_caption || undefined,
        choices: Array.isArray(q.choices)
          ? q.choices
          : (typeof q.choices === "string" ? JSON.parse(q.choices) : []),
        correct: q.correct,
        explanation: q.explanation || "",
        references: Array.isArray(q.refs)
          ? q.refs
          : (Array.isArray(q.references)
            ? q.references
            : (typeof q.refs === "string"
              ? JSON.parse(q.refs)
              : (typeof q.references === "string" ? JSON.parse(q.references) : []))),
        isAiGenerated: !!q.is_ai_generated,
      }));
  } else {
    const { staticQuestionBank } = await import("./staticQuestions");
    questionBank = staticQuestionBank;
  }
} catch (err) {
  console.warn("Exception fetching questions from Supabase, using static bank:", err);
  const { staticQuestionBank } = await import("./staticQuestions");
  questionBank = staticQuestionBank;
}

