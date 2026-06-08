// =====================================================================
// AI Study Scheduler — server-side plan validation + materialization
// (Phase M1). Self-contained (no src/ import) so the serverless bundle
// stays decoupled from the React app. Mirrors src/types/studyScheduler.ts.
// =====================================================================

const MISSION_TYPES = ["drill", "review", "viva", "flashcard", "mini_test", "mock", "read"] as const;
const LAUNCH_MODES = ["practice", "timed", "viva"] as const;
const LAUNCH_ROUTES = ["quiz", "review", "mock", "topic"] as const;

type MissionType = (typeof MISSION_TYPES)[number];
type LaunchMode = (typeof LAUNCH_MODES)[number];
type LaunchRoute = (typeof LAUNCH_ROUTES)[number];

interface PlanTask {
  taskRef: string;
  taskId?: string;
  type: MissionType;
  title: string;
  subjectId?: string | null;
  subcategoryId?: string | null;
  examId?: string | null;
  paperId?: string | null;
  scope?: string;
  targetCount?: number | null;
  difficulty?: string | null;
  estimatedMin?: number;
  rationale?: string;
  launch: { mode: LaunchMode; route: LaunchRoute };
}

interface PlanDay {
  dayIndex: number;
  theme: string;
  topics?: { subjectId: string; subcategoryId?: string | null }[];
  tasks: PlanTask[];
}

export interface ValidatedPlan {
  version: number;
  meta: { name: string; examId?: string | null; targetDate?: string | null; horizonDays: number; summary: string };
  weakAreas: { subjectId: string; label: string; mastery: number; priority: number; estRecoveryDays?: number }[];
  days: PlanDay[];
}

export interface MissionInsert {
  user_id: string;
  plan_id: string;
  scheduled_date: string; // YYYY-MM-DD
  type: MissionType;
  payload: Record<string, unknown>;
  estimated_min: number;
  position: number;
  status: "pending";
  source: "plan";
}

type ValidationResult =
  | { ok: true; plan: ValidatedPlan }
  | { ok: false; error: string };

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

const MAX_DAYS = 60;
const MAX_TASKS_PER_DAY = 8;
const MAX_TOTAL_TASKS = 200;
const MAX_WEAK_AREAS = 13;

/**
 * Structural validation of a StudyPlan JSON (study_plans.plan). Referential
 * checks (subject/exam ids exist) are deferred to the materialize endpoint /
 * M2 generation — this is the shape gate.
 */
export function validateStudyPlan(input: unknown): ValidationResult {
  if (!isObject(input)) return { ok: false, error: "plan must be an object." };
  if (input.version !== 1) return { ok: false, error: "Unsupported plan version." };

  const meta = input.meta;
  if (!isObject(meta)) return { ok: false, error: "plan.meta is required." };
  if (typeof meta.name !== "string" || meta.name.trim() === "") {
    return { ok: false, error: "plan.meta.name is required." };
  }
  if (typeof meta.summary !== "string") return { ok: false, error: "plan.meta.summary is required." };
  const horizonDays = Number(meta.horizonDays);
  if (!Number.isInteger(horizonDays) || horizonDays < 1 || horizonDays > MAX_DAYS) {
    return { ok: false, error: "plan.meta.horizonDays out of range (1..60)." };
  }

  if (!Array.isArray(input.weakAreas)) return { ok: false, error: "plan.weakAreas must be an array." };
  if (input.weakAreas.length > MAX_WEAK_AREAS) return { ok: false, error: "plan.weakAreas has too many entries." };

  if (!Array.isArray(input.days)) return { ok: false, error: "plan.days must be an array." };
  if (input.days.length !== horizonDays) {
    return { ok: false, error: "plan.days length must equal meta.horizonDays." };
  }

  const seenDayIndex = new Set<number>();
  const seenTaskRef = new Set<string>();
  let totalTasks = 0;

  for (const day of input.days) {
    if (!isObject(day)) return { ok: false, error: "Each plan day must be an object." };
    const dayIndex = Number(day.dayIndex);
    if (!Number.isInteger(dayIndex) || dayIndex < 0 || dayIndex >= horizonDays) {
      return { ok: false, error: "plan day has an invalid dayIndex." };
    }
    if (seenDayIndex.has(dayIndex)) return { ok: false, error: "Duplicate dayIndex in plan." };
    seenDayIndex.add(dayIndex);

    if (typeof day.theme !== "string") return { ok: false, error: "plan day.theme is required." };
    if (!Array.isArray(day.tasks)) return { ok: false, error: "plan day.tasks must be an array." };
    if (day.tasks.length > MAX_TASKS_PER_DAY) return { ok: false, error: "plan day has too many tasks." };

    for (const task of day.tasks) {
      if (!isObject(task)) return { ok: false, error: "Each task must be an object." };
      if (typeof task.taskRef !== "string" || task.taskRef.trim() === "") {
        return { ok: false, error: "task.taskRef is required." };
      }
      if (seenTaskRef.has(task.taskRef)) return { ok: false, error: `Duplicate taskRef ${task.taskRef}.` };
      seenTaskRef.add(task.taskRef);

      if (!MISSION_TYPES.includes(task.type as MissionType)) {
        return { ok: false, error: `task.type invalid: ${String(task.type)}.` };
      }
      if (typeof task.title !== "string" || task.title.trim() === "") {
        return { ok: false, error: "task.title is required." };
      }
      const launch = task.launch;
      if (!isObject(launch)) return { ok: false, error: "task.launch is required." };
      if (!LAUNCH_MODES.includes(launch.mode as LaunchMode)) {
        return { ok: false, error: `task.launch.mode invalid: ${String(launch.mode)}.` };
      }
      if (!LAUNCH_ROUTES.includes(launch.route as LaunchRoute)) {
        return { ok: false, error: `task.launch.route invalid: ${String(launch.route)}.` };
      }
      const est = Number(task.estimatedMin);
      if (!Number.isFinite(est) || est < 0 || est > 240) {
        return { ok: false, error: "task.estimatedMin out of range (0..240)." };
      }

      totalTasks++;
      if (totalTasks > MAX_TOTAL_TASKS) return { ok: false, error: "plan has too many tasks." };
    }
  }

  if (totalTasks === 0) return { ok: false, error: "plan has no tasks." };

  return { ok: true, plan: input as unknown as ValidatedPlan };
}

/** UTC date string (YYYY-MM-DD) for `base` + `offsetDays`. */
function addDaysISO(base: Date, offsetDays: number): string {
  const d = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate()));
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

/**
 * Expand a validated plan into mission insert rows. Day 0 maps to `baseDate`
 * (caller passes "today" in the project timezone, computed server-side).
 * Idempotency (delete future-pending → insert) is handled by the caller, not here.
 */
export function expandPlanToMissions(
  plan: ValidatedPlan,
  opts: { planId: string; userId: string; baseDate: Date }
): MissionInsert[] {
  const rows: MissionInsert[] = [];
  for (const day of plan.days) {
    const scheduledDate = addDaysISO(opts.baseDate, day.dayIndex);
    day.tasks.forEach((task, position) => {
      rows.push({
        user_id: opts.userId,
        plan_id: opts.planId,
        scheduled_date: scheduledDate,
        type: task.type,
        payload: {
          taskId: task.taskId ?? task.taskRef,
          taskRef: task.taskRef,
          subjectId: task.subjectId ?? null,
          subcategoryId: task.subcategoryId ?? null,
          examId: task.examId ?? null,
          paperId: task.paperId ?? null,
          scope: task.scope ?? "topic",
          targetCount: task.targetCount ?? null,
          difficulty: task.difficulty ?? null,
          mode: task.launch.mode,
          route: task.launch.route,
        },
        estimated_min: Math.round(Number(task.estimatedMin) || 0),
        position,
        status: "pending",
        source: "plan",
      });
    });
  }
  return rows;
}
