// WebMCP tool surface for AI agents (navigator.modelContext).
//
// Exposes exactly THREE tools, scoped per docs/agent-readiness-triage.md
// (Phase 4). Loading is route-gated by src/hooks/useWebMcp.ts — this module only
// defines the tools and pushes them to the browser API.
//
// Hard rules enforced here:
//  - search_question_bank returns METADATA ONLY (subject/topic names + counts).
//    It never returns question text, options, correct answers, or explanations,
//    which are paid, auth-gated IP.
//  - start_mock_test and list_bookmarks require an authenticated Supabase
//    session; with no session they return a clear not-authenticated result and
//    touch no user data.
//  - Each execute() defers to the SAME app logic the UI uses (React Router
//    navigation into the real mock-test launcher; the real `bookmarks` table;
//    the real `fetchMergedSubjects()`), never a parallel re-implementation.

import type { NavigateFunction } from "react-router-dom";
import { supabase } from "./supabase";
import { fetchMergedSubjects } from "./content";
import { EXAM_TYPES, EXAM_TYPE_IDS, getExamType } from "./examTypes";

const NOT_AUTHENTICATED = {
  authenticated: false,
  error: "not_authenticated",
  message:
    "No active Heading session. The user must sign in before this tool can run. No data was accessed.",
} as const;

async function getActiveSession() {
  try {
    const { data } = await supabase.auth.getSession();
    return data.session ?? null;
  } catch {
    return null;
  }
}

function buildTools(navigate: NavigateFunction): ModelContextTool[] {
  return [
    // ── Tool 1: start a mock test ────────────────────────────────────────────
    {
      name: "start_mock_test",
      description:
        "Start a full mock pilot-theory test for a given exam type. Requires the user to be signed in; if not, returns a not-authenticated result and does nothing. On success it opens the same mock-test launcher the user uses in the app and auto-runs the standard simulator for that exam.",
      annotations: { readOnlyHint: false },
      inputSchema: {
        type: "object",
        properties: {
          examType: {
            type: "string",
            enum: EXAM_TYPE_IDS,
            description:
              "Exam type id, identical to the /exams/:examId routes: " +
              EXAM_TYPE_IDS.join(", ") + ".",
          },
        },
        required: ["examType"],
      },
      execute: async (input: any) => {
        const session = await getActiveSession();
        if (!session) return NOT_AUTHENTICATED;

        const exam = getExamType(String(input?.examType ?? ""));
        if (!exam) {
          return {
            authenticated: true,
            error: "unknown_exam_type",
            validExamTypes: EXAM_TYPE_IDS,
          };
        }

        // Hand off to the real launcher. MockExamsView reads
        // location.state.webmcpStartExam and runs its own
        // handleStartAutomaticExamMock — the exact flow the "Launch Auto
        // Simulator" button triggers. We do NOT assemble questions here.
        navigate("/mock-exams", { state: { webmcpStartExam: exam } });
        return {
          authenticated: true,
          started: true,
          examType: exam.id,
          message: `Opening the ${exam.label} mock test in the app.`,
        };
      },
    },

    // ── Tool 2: search question bank (METADATA ONLY) ─────────────────────────
    {
      name: "search_question_bank",
      description:
        "Search Heading's question bank METADATA only: subject and topic names with how many questions each contains. This tool NEVER returns question text, answer options, correct answers, or explanations — that material is paid, login-protected content. Read-only; no sign-in required.",
      annotations: { readOnlyHint: true },
      inputSchema: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description:
              "Optional text to match against subject and topic names (case-insensitive).",
          },
          examType: {
            type: "string",
            enum: EXAM_TYPE_IDS,
            description: "Optional exam type id to scope results to one authority.",
          },
        },
      },
      execute: async (input: any) => {
        // Public metadata. Uses the same fetchMergedSubjects() the study UI uses;
        // that function only ever COUNTS question rows — it never exposes any
        // prompt/choice/answer text. We additionally hand-pick metadata-only
        // fields below so no question content can leak even if the source shape
        // changes.
        const subjects = await fetchMergedSubjects();
        const q = String(input?.query ?? "").trim().toLowerCase();
        const exam = input?.examType ? getExamType(String(input.examType)) : null;

        const matchesText = (s: string) => !q || s.toLowerCase().includes(q);

        const result = subjects
          // ponytail: filter by authority only — license matching across the
          // subjects taxonomy is inconsistent and would drop valid rows.
          .filter((s) => !exam || s.exam_authority === exam.authority)
          .map((s) => {
            const topics = (s.subTopics ?? [])
              .filter((t) => matchesText(t.title))
              .map((t) => ({
                id: t.id,
                title: t.title,
                questionCount: t.questionCount,
              }));
            return {
              id: s.id,
              title: s.title,
              authority: s.exam_authority ?? null,
              license: s.license ?? null,
              totalQuestions: s.questionCount,
              topics,
            };
          })
          // keep a subject if it or any of its topics matched the text query
          .filter((s) => matchesText(s.title) || s.topics.length > 0);

        return {
          note: "Metadata only. Question text and answers are not available through this tool.",
          examType: exam?.id ?? null,
          query: q || null,
          subjectCount: result.length,
          subjects: result,
        };
      },
    },

    // ── Tool 3: bookmarks (own user only) ────────────────────────────────────
    {
      name: "list_bookmarks",
      description:
        "List the signed-in user's bookmarked questions (their ids and how many) or check whether one specific question is bookmarked. Returns the user's own bookmark references only — never question text or answers. Requires the user to be signed in; if not, returns a not-authenticated result and accesses no data.",
      annotations: { readOnlyHint: true },
      inputSchema: {
        type: "object",
        properties: {
          questionId: {
            type: "string",
            description:
              "Optional. If provided, returns whether this specific question id is bookmarked by the user.",
          },
        },
      },
      execute: async (input: any) => {
        const session = await getActiveSession();
        if (!session) return NOT_AUTHENTICATED;

        const uid = session.user.id;
        // Same source the app uses (AuthContext.fetchUserData): the bookmarks
        // table, RLS-scoped to the current user (auth.uid() = user_id).
        const { data, error } = await supabase
          .from("bookmarks")
          .select("question_id")
          .eq("user_id", uid);

        if (error) {
          return { authenticated: true, error: "query_failed", message: error.message };
        }

        const ids = (data ?? []).map((b) => b.question_id);
        const questionId = String(input?.questionId ?? "").trim();
        if (questionId) {
          return {
            authenticated: true,
            questionId,
            bookmarked: ids.includes(questionId),
            totalBookmarks: ids.length,
          };
        }
        return {
          authenticated: true,
          totalBookmarks: ids.length,
          bookmarkedQuestionIds: ids,
        };
      },
    },
  ];
}

function applyTools(tools: ModelContextTool[]): () => void {
  const mc = navigator.modelContext;
  if (!mc) return () => {};

  // Primary: the imperative provideContext({ tools }) shape (Phase 4 target).
  if (typeof mc.provideContext === "function") {
    mc.provideContext({ tools });
    return () => {
      try {
        mc.provideContext!({ tools: [] });
      } catch {
        /* ignore */
      }
    };
  }

  // Fallback: the W3C draft registerTool(tool, { signal }) shape.
  if (typeof mc.registerTool === "function") {
    const ctrl = new AbortController();
    for (const t of tools) {
      try {
        mc.registerTool(t, { signal: ctrl.signal });
      } catch {
        /* ignore duplicate/invalid */
      }
    }
    return () => ctrl.abort();
  }

  return () => {};
}

/**
 * Register the WebMCP tool surface. Returns a cleanup that unregisters it.
 * No-op when the browser has no navigator.modelContext.
 */
export function registerWebMcpTools(navigate: NavigateFunction): () => void {
  if (typeof navigator === "undefined" || !navigator.modelContext) return () => {};
  return applyTools(buildTools(navigate));
}

// Re-export so callers (and the manual console check) have one import site.
export { EXAM_TYPES };
