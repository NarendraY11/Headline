// Phase 8.2A: useStudyReminders is a no-op stub.
//
// It was replaced by useEngineReminders (src/hooks/useEngineReminders.ts) which:
//   - uses engine mission signals (not scheduler plan missions)
//   - has a unified priority model and single suppression key
//   - renders via FlightAlerts strip on Today instead of firing toasts
//
// This file is kept to avoid breaking any lingering import, but the hook
// does nothing. Remove it entirely once StudyCalendarView import is cleaned.

// ponytail: no-op stub. See comment above.
export function useStudyReminders(): void {}
