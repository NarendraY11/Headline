// =====================================================================
// Phase 7.2 — Mission streak (pure)
//
// Consecutive days the user completed a Mission Engine mission, ending today
// or yesterday. NO freeze (missions are intentional, unlike the question
// streak). Counts ONLY engine completions — the caller (getCompletedMissionDates)
// is responsible for filtering to source='system'.
// =====================================================================

function localISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * Pure: count the consecutive-day streak from a set of YYYY-MM-DD dates.
 * The streak must end today or yesterday (a gap before today = streak 0,
 * unless yesterday is present and counting continues backward).
 *
 * @param dates distinct local YYYY-MM-DD strings of completed-mission days
 * @param todayISO today's local date (injected for determinism/testing)
 */
export function computeMissionStreak(dates: string[], todayISO: string): number {
  if (dates.length === 0) return 0;

  const set = new Set(dates);
  const today = new Date(`${todayISO}T00:00:00`);
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const yesterdayISO = localISO(yesterday);

  // Anchor: streak must be "current" — newest day is today or yesterday.
  let cursor: Date;
  if (set.has(todayISO)) cursor = today;
  else if (set.has(yesterdayISO)) cursor = yesterday;
  else return 0;

  let streak = 0;
  while (set.has(localISO(cursor))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}
