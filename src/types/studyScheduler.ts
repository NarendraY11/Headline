// =====================================================================
// AI Study Scheduler — shared types (Phase M1)
//
// Two layers:
//   1. StudyPlan*  — the structured JSON the AI returns and that lives in
//      study_plans.plan. This is the single source of truth; it holds
//      INTENT only (no progress/score/% — those derive from attempts /
//      question_progress).
//   2. *Row        — the Supabase row shapes for study_plans / study_missions.
//
// Enums reuse existing platform vocabulary:
//   - difficulty mirrors public.questions.difficulty (+ "mixed")
//   - mission types map 1:1 to launch routes (see launchMission, later phases)
// =====================================================================

export type MissionType =
  | "drill"
  | "review"
  | "viva"
  | "flashcard"
  | "mini_test"
  | "mock"
  | "read";

export type MissionStatus = "pending" | "in_progress" | "completed" | "skipped";
export type MissionSource = "plan" | "manual" | "system";

export type PlanStatus = "draft" | "active" | "archived" | "completed";
export type PlanSource = "ai" | "manual" | "fallback";

export type TaskScope = "topic" | "due" | "weak" | "custom";
export type TaskDifficulty = "standard" | "complex" | "extreme" | "mixed";

export type LaunchMode = "practice" | "timed" | "viva";
export type LaunchRoute = "quiz" | "review" | "mock" | "topic";

// ---------------------------------------------------------------------
// StudyPlan JSON (study_plans.plan)
// ---------------------------------------------------------------------

export interface StudyPlanTaskLaunch {
  mode: LaunchMode;
  route: LaunchRoute;
}

export interface StudyPlanTask {
  /** Deterministic per-plan ref, pattern `d{day}.{pos}` (AI-emitted). */
  taskRef: string;
  /** Canonical id stamped by the server on persist (absent in raw AI output). */
  taskId?: string;
  type: MissionType;
  title: string;
  subjectId?: string | null;
  subcategoryId?: string | null;
  examId?: string | null;
  paperId?: string | null;
  scope: TaskScope;
  targetCount?: number | null;
  difficulty?: TaskDifficulty | null;
  estimatedMin: number;
  rationale?: string;
  launch: StudyPlanTaskLaunch;
}

export interface StudyPlanTopic {
  subjectId: string;
  subcategoryId?: string | null;
}

export interface StudyPlanDay {
  dayIndex: number;
  theme: string;
  estimatedMin?: number;
  topics?: StudyPlanTopic[];
  tasks: StudyPlanTask[];
}

export interface StudyPlanWeakArea {
  subjectId: string;
  label: string;
  mastery: number; // 0..100 snapshot at generation time (input echo, baseline)
  priority: number; // 1 = most urgent
  estRecoveryDays?: number;
}

export interface StudyPlanMeta {
  name: string;
  examId?: string | null;
  targetDate?: string | null; // ISO date
  horizonDays: number;
  totalEstimatedMin?: number;
  summary: string;
  generatedAt?: string; // server-stamped
}

export interface StudyPlan {
  version: 1;
  meta: StudyPlanMeta;
  weakAreas: StudyPlanWeakArea[];
  days: StudyPlanDay[];
}

// ---------------------------------------------------------------------
// Row shapes
// ---------------------------------------------------------------------

export interface StudyPlanRow {
  id: string;
  user_id: string;
  exam_id: string | null;
  target_date: string | null;
  status: PlanStatus;
  source: PlanSource;
  model: string | null;
  plan: StudyPlan;
  generated_at: string;
  created_at: string;
  updated_at: string;
}

/** Self-contained launch descriptor stored on each mission row. */
export interface MissionPayload {
  taskId?: string;
  taskRef?: string;
  subjectId?: string | null;
  subcategoryId?: string | null;
  examId?: string | null;
  paperId?: string | null;
  scope?: TaskScope;
  targetCount?: number | null;
  difficulty?: TaskDifficulty | null;
  mode: LaunchMode;
  route: LaunchRoute;
}

export interface StudyMissionRow {
  id: string;
  user_id: string;
  plan_id: string | null;
  scheduled_date: string; // YYYY-MM-DD
  type: MissionType;
  payload: MissionPayload;
  estimated_min: number;
  position: number;
  status: MissionStatus;
  source: MissionSource;
  completed_attempt_id: string | null;
  created_at: string;
  completed_at: string | null;
}

/** Input for adding a manual ("Add to Schedule") mission. */
export interface NewManualMission {
  userId: string;
  scheduledDate: string; // YYYY-MM-DD
  type: MissionType;
  payload: MissionPayload;
  estimatedMin?: number;
  position?: number;
}
