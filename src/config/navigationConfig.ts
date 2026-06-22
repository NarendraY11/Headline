// Phase 5B: Config-driven navigation.
// All sidebar/nav personalization lives here — zero hardcoded logic in AppShell.
// Add a new track or objective = data edit here only.

import {
  BarChart3,
  Briefcase,
  CalendarDays,
  Compass,
  GraduationCap,
  Gift,
  Layers,
  LayoutGrid,
  Mic,
  Plane,
  Settings,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { getPrimaryTrackFamily } from "../data/trainingPaths";

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
const FEATURE_GATED_NAV: NavItem[] = [
  { label: "Exam Centre",    to: "/exam-centre",       icon: GraduationCap, featureFlag: "advancedTesting" },
  { label: "Mock exams",     to: "/mock-exams",        icon: LayoutGrid,    featureFlag: "mockExams"       },
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
const TRACK_NAV: Record<string, NavItem[]> = {
  type_rating: [
    { label: "A320 systems", to: "/topic/a320-systems", icon: Plane, featureFlag: "a320Systems" },
  ],
  dgca: [],
  faa: [],
  easa: [],
};

// ── Items shown to all tracks ─────────────────────────────────────────────────
const UNIVERSAL_NAV: NavItem[] = [
  { label: "VIVA practice", to: "/quiz/viva",    icon: Mic      },
  { label: "Flashcards",    to: "/bookmarks",    icon: Zap,     badgeKey: "bookmarks" },
  { label: "Progress",      to: "/analytics",    icon: BarChart3 },
  { label: "Flight Schedule", to: "/schedule",  icon: CalendarDays, featureFlag: "aiStudyScheduler" },
];

// ── Bottom items ──────────────────────────────────────────────────────────────
const BOTTOM_NAV: NavItem[] = [
  { label: "Refer & earn",        to: "/referral", icon: Gift     },
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

  // 2. Career objective item — inserted after Question Bank
  if (careerObjective && CAREER_NAV[careerObjective]) {
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
