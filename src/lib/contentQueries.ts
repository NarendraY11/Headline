// =====================================================================
// Phase 6 — Content Queries (scope-aware resolver layer)
//
// All quiz/assessment consumers call these functions instead of the raw
// fetch functions in content.ts. When contentDeliveryEngine flag is ON
// and scope.hasContent, questions are restricted to eligible subjects.
//
// When scope.hasContent is false (flag OFF, guest, or empty profile),
// all functions fall through to unscoped fetches — exact same behaviour
// as before Phase 6.
// =====================================================================

import type { ContentScope } from "./contentDeliveryEngine";
import {
  fetchPublishedQuestions,
  fetchQuizQuestionsForTopic,
  fetchQuestionsByIds,
} from "./content";
import type { Question } from "../data/questions";
import type { SubjectItem } from "../data/topics";

// ── Question Resolvers ────────────────────────────────────────────────

/**
 * Fetch published questions scoped to the user's eligible subjects.
 * Falls through to full fetch when scope is empty (guest / flag OFF).
 */
export async function getEligibleQuestions(
  scope: ContentScope,
  opts?: { limit?: number; offset?: number }
): Promise<Question[]> {
  if (!scope.hasContent) return fetchPublishedQuestions(opts);
  const subjectIds = Array.from(scope.eligibleSubjectIds);
  return fetchPublishedQuestions({ ...opts, subjectIds });
}

/**
 * Fetch questions for a specific topic, filtered to scope.
 * If the topic's parent subject is not in scope, returns [].
 */
export async function getEligibleTopicQuestions(
  scope: ContentScope,
  topicId: string,
  limit = 50
): Promise<Question[]> {
  const questions = await fetchQuizQuestionsForTopic(topicId, limit, true);
  if (!scope.hasContent) return questions;
  // Questions fetched for a specific topic are topic-scoped by the topicId param.
  // If subject_id is set, verify it is in scope. If subject_id is null/empty,
  // allow through — the question is indexed only at subcategory level and the
  // caller already constrained the topic to scope before navigating here.
  return questions.filter((q) => {
    const sid = q.subjectId ?? "";
    return sid === "" || scope.eligibleSubjectIds.has(sid);
  });
}

/**
 * Fetch questions by IDs, optionally filtering out-of-scope questions.
 * Out-of-scope IDs are returned (bookmarks are global) but the caller
 * can detect them via the returned metadata.
 */
export async function getEligibleQuestionsByIds(
  scope: ContentScope,
  ids: string[]
): Promise<Question[]> {
  const questions = await fetchQuestionsByIds(ids);
  if (!scope.hasContent) return questions;
  return questions.filter((q) => scope.eligibleSubjectIds.has(q.subjectId ?? ""));
}

/**
 * Fetch bookmarked questions with scope metadata.
 * Returns all bookmarked questions plus a count of how many are out-of-scope.
 * Bookmarks are always returned — callers decide how to handle out-of-scope.
 */
export async function getBookmarkedQuestionsWithScopeInfo(
  scope: ContentScope,
  ids: string[]
): Promise<{ questions: Question[]; outOfScopeCount: number }> {
  const questions = await fetchQuestionsByIds(ids);
  if (!scope.hasContent) return { questions, outOfScopeCount: 0 };
  const inScope = questions.filter((q) => scope.eligibleSubjectIds.has(q.subjectId ?? ""));
  return { questions, outOfScopeCount: questions.length - inScope.length };
}

// ── Subject / Module Resolvers ────────────────────────────────────────

/**
 * Filter a subject list to only those in the active content scope.
 * Returns all subjects when scope is empty.
 */
export function getEligibleSubjects(
  scope: ContentScope,
  allSubjects: SubjectItem[]
): SubjectItem[] {
  if (!scope.hasContent) return allSubjects;
  return allSubjects.filter((s) => scope.eligibleSubjectIds.has(s.id));
}

/**
 * Filter a list of objects with an `id` field to those matching scope.
 * Works for modules, exams, or any item keyed by a subject-like id.
 *
 * For exams/mock papers that declare multiple subject_ids, use the
 * exam-specific helper below.
 */
export function getEligibleModules<T extends { id: string }>(
  scope: ContentScope,
  allModules: T[]
): T[] {
  if (!scope.hasContent) return allModules;
  return allModules.filter((m) => scope.eligibleModuleIds.has(m.id));
}

/**
 * Filter a list of exams to those that have at least one subject_id in scope.
 * Uses an array of subjectIds on each exam (not the eligibleModuleIds set).
 */
export function getEligibleExams<T extends { subject_ids?: string[] }>(
  scope: ContentScope,
  allExams: T[]
): T[] {
  if (!scope.hasContent) return allExams;
  return allExams.filter((e) =>
    (e.subject_ids ?? []).some((sid) => scope.eligibleSubjectIds.has(sid))
  );
}

/**
 * Given a list of subject IDs (e.g. from a hardcoded exam config),
 * return only those that are in the active content scope.
 * Returns the full list when scope is empty.
 */
export function intersectWithScope(
  scope: ContentScope,
  subjectIds: string[]
): string[] {
  if (!scope.hasContent) return subjectIds;
  return subjectIds.filter((sid) => scope.eligibleSubjectIds.has(sid));
}
