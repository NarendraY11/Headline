// =====================================================================
// M12: Mistake Analysis Engine — pure computation, no side effects
//
// Derives recurring mistakes, weak concepts, and error categories
// from raw attempts + user_question_attempts data.
// No new DB tables — computed from existing attempts.wrong_question_ids.
// =====================================================================

import type { Question } from "../data/questions.js";

// ── Types ────────────────────────────────────────────────────────────────────

export interface MistakeFrequency {
  questionId: string;
  count: number;            // how many times answered wrong
  lastSeen: string;         // ISO date of most recent wrong attempt
  subjectId: string | null;
  subcategoryId: string | null;
  question?: Question;      // enriched after join
}

export interface WeakConcept {
  subcategoryId: string;
  subcategoryLabel: string;
  totalMistakes: number;
  uniqueQuestions: number;
  errorRate: number;        // mistakes / total answered in concept (0..1)
}

export interface ErrorCategory {
  category: string;
  count: number;
  percent: number;
  subjectId: string | null;
}

export interface MistakeAnalysisResult {
  topMistakes: MistakeFrequency[];      // top 10 recurring wrong questions
  weakConcepts: WeakConcept[];           // top 6 weakest subcategories
  errorCategories: ErrorCategory[];      // grouped by subject
  totalUniqueWrong: number;
  totalWrongAnswers: number;
  mostRepeatedSubjectId: string | null;
}

// ── computeMistakeAnalysis ────────────────────────────────────────────────────

export interface AttemptRow {
  wrong_question_ids: string[] | null;
  created_at: string;
  subject_id?: string | null;
  subcategory_id?: string | null;
}

export interface UQARow {
  question_id: string;
  is_correct: boolean;
  subject_id: string | null;
  subcategory_id: string | null;
  answered_at: string;
}

/**
 * Derives mistake patterns from attempts + user_question_attempts rows.
 * Both inputs may be partial (e.g., wrong_question_ids empty/null = skipped).
 */
export function computeMistakeAnalysis(
  attempts: AttemptRow[],
  uqaRows: UQARow[],
  questions: Question[]
): MistakeAnalysisResult {
  const qMap = new Map<string, Question>();
  for (const q of questions) qMap.set(q.id, q);

  // ── 1. Build wrong-count map from attempts.wrong_question_ids ────────────
  const wrongCount = new Map<string, { count: number; lastSeen: string; subjectId: string | null; subcategoryId: string | null }>();

  for (const att of attempts) {
    if (!att.wrong_question_ids?.length) continue;
    for (const qid of att.wrong_question_ids) {
      const existing = wrongCount.get(qid);
      const date = att.created_at ?? "";
      if (!existing) {
        wrongCount.set(qid, { count: 1, lastSeen: date, subjectId: att.subject_id ?? null, subcategoryId: att.subcategory_id ?? null });
      } else {
        existing.count++;
        if (date > existing.lastSeen) existing.lastSeen = date;
      }
    }
  }

  // ── 2. Supplement from UQA rows (more granular, has subcategory) ─────────
  for (const row of uqaRows) {
    if (row.is_correct) continue;
    const existing = wrongCount.get(row.question_id);
    const date = row.answered_at ?? "";
    if (!existing) {
      wrongCount.set(row.question_id, {
        count: 1,
        lastSeen: date,
        subjectId: row.subject_id,
        subcategoryId: row.subcategory_id,
      });
    } else {
      existing.count++;
      if (date > existing.lastSeen) existing.lastSeen = date;
      if (!existing.subcategoryId) existing.subcategoryId = row.subcategory_id;
      if (!existing.subjectId) existing.subjectId = row.subject_id;
    }
  }

  // ── 3. Enrich + sort ─────────────────────────────────────────────────────
  const allMistakes: MistakeFrequency[] = [];
  let totalWrong = 0;

  wrongCount.forEach((v, qid) => {
    totalWrong += v.count;
    const q = qMap.get(qid);
    allMistakes.push({
      questionId: qid,
      count: v.count,
      lastSeen: v.lastSeen,
      subjectId: v.subjectId ?? q?.subjectId ?? null,
      subcategoryId: v.subcategoryId ?? q?.subcategoryId ?? null,
      question: q,
    });
  });

  allMistakes.sort((a, b) => b.count - a.count);
  const topMistakes = allMistakes.slice(0, 10);

  // ── 4. Weak concepts by subcategory ──────────────────────────────────────
  const subcat: Map<string, { label: string; wrong: number; total: number }> = new Map();

  for (const row of uqaRows) {
    const sid = row.subcategory_id ?? "unknown";
    if (!subcat.has(sid)) subcat.set(sid, { label: sid, wrong: 0, total: 0 });
    const s = subcat.get(sid)!;
    s.total++;
    if (!row.is_correct) s.wrong++;
  }

  const weakConcepts: WeakConcept[] = Array.from(subcat.entries())
    .filter(([, v]) => v.total >= 3)
    .map(([id, v]) => ({
      subcategoryId: id,
      subcategoryLabel: id,
      totalMistakes: v.wrong,
      uniqueQuestions: [...wrongCount].filter(([, w]) => w.subcategoryId === id).length,
      errorRate: v.total > 0 ? v.wrong / v.total : 0,
    }))
    .sort((a, b) => b.errorRate - a.errorRate)
    .slice(0, 6);

  // ── 5. Error categories by subject ───────────────────────────────────────
  const subjCount = new Map<string, number>();
  for (const m of allMistakes) {
    const sid = m.subjectId ?? "other";
    subjCount.set(sid, (subjCount.get(sid) ?? 0) + m.count);
  }

  const errorCategories: ErrorCategory[] = Array.from(subjCount.entries())
    .map(([sid, count]) => ({
      category: sid,
      count,
      percent: totalWrong > 0 ? Math.round((count / totalWrong) * 100) : 0,
      subjectId: sid === "other" ? null : sid,
    }))
    .sort((a, b) => b.count - a.count);

  // Most repeated subject
  const mostRepeated = errorCategories[0]?.subjectId ?? null;

  return {
    topMistakes,
    weakConcepts,
    errorCategories,
    totalUniqueWrong: wrongCount.size,
    totalWrongAnswers: totalWrong,
    mostRepeatedSubjectId: mostRepeated,
  };
}

// ── weightedQuestionSample (Adaptive Mock) ────────────────────────────────────

/**
 * Weighted random sample of questions, biased toward low-mastery subjects.
 * CRITICAL (<50%) → 3×, WEAK (50-65%) → 2×, DEVELOPING (65-80%) → 1×, STRONG → 0.4×
 */
export function weightedQuestionSample(
  questions: Question[],
  subjectMasteries: Record<string, number>,
  count: number
): Question[] {
  if (questions.length === 0) return [];

  function weight(q: Question): number {
    const subjectId = (q as any).subject_id as string | undefined;
    const mastery = subjectId ? (subjectMasteries[subjectId] ?? 50) : 50;
    if (mastery < 50) return 3.0;
    if (mastery < 65) return 2.0;
    if (mastery < 80) return 1.0;
    return 0.4;
  }

  // Build cumulative weight array
  const weights = questions.map(weight);
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  const cumulative: number[] = [];
  let running = 0;
  for (const w of weights) {
    running += w;
    cumulative.push(running);
  }

  const picked = new Set<number>();
  const result: Question[] = [];
  const target = Math.min(count, questions.length);
  let attempts = 0;

  while (result.length < target && attempts < target * 20) {
    attempts++;
    const r = Math.random() * totalWeight;
    let lo = 0, hi = cumulative.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (cumulative[mid] < r) lo = mid + 1;
      else hi = mid;
    }
    if (!picked.has(lo)) {
      picked.add(lo);
      result.push(questions[lo]);
    }
  }

  return result;
}
