// Phase 5B: Config-driven navigation.
// All sidebar/nav personalization lives here — zero hardcoded logic in AppShell.
// Add a new track or objective = data edit here only.

import {
  BarChart3,
  BookOpen,
  Briefcase,
  CalendarDays,
  Compass,
  GraduationCap,
  Layers,
  Settings,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { getPrimaryTrackFamily } from "../data/trainingPaths";

// UX-Nav Phase 1: Interview Prep stays routable (/interview-prep) but is hidden
// from primary + bottom nav until real content ships — all 3 sections are
// "Coming Soon" stubs today. Flip to true (or wire to a feature flag) when live.
const INTERVIEW_PREP_LIVE = false;

export interface NavItem {
  label: string;
  to: string;
  icon: LucideIcon;
  /** feature flag key that gates this item — undefined means always show */
  featureFlag?: string;
  /** if true, item only shows when user is admin */
  adminOnly?: boolean;
  /** badge source key for runtime badge counts */
  badgeKey?: string;
}

export interface NavSection {
  /** items in this section */
  items: NavItem[];
  /** show divider above this section */
  divider?: boolean;
}

// ── Core items shown to every authenticated user ──────────────────────────────
const CORE_NAV: NavItem[] = [
  { label: "Today",         to: "/today",     icon: Compass },
  { label: "Question bank", to: "/modules",   icon: Layers  },
];

// ── Items gated by feature flag ───────────────────────────────────────────────
// UX-Nav Phase 1: Learning Context removed from nav (read-only enrollment
// metadata → belongs in Profile, not primary nav). Route /learning-context now
// redirects to /profile.
// UX-Nav Phase 2: Mock exams + Exam Centre folded into the unified Practice hub
// (/practice). Their routes stay alive for deep links; Practice shows them as
// tabs (gated by the same flags inside PracticeView).
const FEATURE_GATED_NAV: NavItem[] = [
  { label: "Course", to: "/course", icon: BookOpen, featureFlag: "learningHierarchy" },
];

// ── Career objective items ────────────────────────────────────────────────────
const CAREER_NAV: Record<string, NavItem> = {
  "airline-recruitment": {
    label: "Interview Prep",
    to: "/interview-prep",
    icon: Briefcase,
  },
};

// ── Track-specific items ──────────────────────────────────────────────────────
// UX-Nav Phase 1: A320 systems removed from primary nav — it was a single-topic
// deep link (/topic/a320-systems) masquerading as a destination. Topic stays
// reachable via Question Bank; the route is unchanged.
const TRACK_NAV: Record<string, NavItem[]> = {
  type_rating: [],
  dgca: [],
  faa: [],
  easa: [],
};

// ── Items shown to all tracks ─────────────────────────────────────────────────
// UX-Nav Phase 1: "Flashcards" → "Review", "Flight Schedule" → "Planner".
// UX-Nav Phase 2: "Practice" is the single door to Mock/Exam Centre/VIVA; the
// three separate testing items were removed. Route /bookmarks (Review) and its
// content merge stay for Phase 2b.
const UNIVERSAL_NAV: NavItem[] = [
  { label: "Practice",  to: "/practice",  icon: GraduationCap },
  { label: "Review",    to: "/review",    icon: Zap,     badgeKey: "bookmarks" },
  { label: "Progress",  to: "/analytics", icon: BarChart3 },
  { label: "Planner",   to: "/schedule",  icon: CalendarDays, featureFlag: "aiStudyScheduler" },
];

// ── Bottom items ──────────────────────────────────────────────────────────────
// UX-Nav Phase 1: "Refer & earn" removed from nav — occasional/monetization
// action, already surfaced inside Profile. Route /referral unchanged.
// UX-Nav Phase 2C: "Profile" nav item removed — SidebarAuth (avatar + name +
// plan badge) is the sole profile entry in the sidebar; duplicate removed.
const BOTTOM_NAV: NavItem[] = [
  { label: "Administrative Deck", to: "/admin",    icon: Settings, adminOnly: true },
];

/**
 * Builds the ordered nav item list for a given user context.
 * All personalization logic is here — AppShell just renders whatever this returns.
 */
export function buildNavItems(opts: {
  targetExam: string | null | undefined;
  careerObjective: string | null | undefined;
  enabledFlags: Record<string, boolean>;
  isAdmin: boolean;
}): NavItem[] {
  const { targetExam, careerObjective, enabledFlags, isAdmin } = opts;
  const trackFamily = getPrimaryTrackFamily(targetExam);

  const items: NavItem[] = [];

  // 1. Core (always)
  items.push(...CORE_NAV);

  // 2. Career objective item — inserted after Question Bank (hidden until live)
  if (INTERVIEW_PREP_LIVE && careerObjective && CAREER_NAV[careerObjective]) {
    items.push(CAREER_NAV[careerObjective]);
  }

  // 3. Feature-gated exam/test items
  for (const item of FEATURE_GATED_NAV) {
    if (!item.featureFlag || enabledFlags[item.featureFlag]) {
      items.push(item);
    }
  }

  // 4. Track-specific items
  const trackItems = trackFamily ? (TRACK_NAV[trackFamily] ?? []) : [];
  for (const item of trackItems) {
    if (!item.featureFlag || enabledFlags[item.featureFlag]) {
      items.push(item);
    }
  }

  // 5. Universal items
  for (const item of UNIVERSAL_NAV) {
    if (!item.featureFlag || enabledFlags[item.featureFlag]) {
      items.push(item);
    }
  }

  // 6. Bottom items (admin, referral)
  for (const item of BOTTOM_NAV) {
    if (item.adminOnly && !isAdmin) continue;
    items.push(item);
  }

  return items;
}

/**
 * Builds exactly 5 bottom-tab items for the mobile bottom nav bar.
 * UX-Nav Phase 2: fixed set matching the recommended IA —
 * Today | Question bank | Practice | Review | Progress.
 * (Args kept for caller symmetry / future personalization.)
 */
export function buildBottomNavItems(_opts: {
  targetExam: string | null | undefined;
  careerObjective: string | null | undefined;
  enabledFlags: Record<string, boolean>;
}): NavItem[] {
  return [
    CORE_NAV[0],                                            // Today
    // UX-Nav Mobile Ph1: "Question bank" → "Study" — 5-char label never truncates at 360px
    { ...CORE_NAV[1], label: "Study" },
    { label: "Practice", to: "/practice", icon: GraduationCap },
    { label: "Review",   to: "/review",   icon: Zap },
    { label: "Progress", to: "/analytics", icon: BarChart3 },
  ];
}
