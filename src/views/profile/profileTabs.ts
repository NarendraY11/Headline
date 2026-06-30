// UX-Nav Phase 2C: tab registry + resolver for the Profile → Account Workspace.
// Kept as a tiny pure module so the active-tab logic is unit-testable without
// mounting the React tree.

export type ProfileTabKey =
  | "overview"
  | "enrollment"
  | "referral"
  | "preferences"
  | "membership"
  | "account";

export interface ProfileTabMeta {
  key: ProfileTabKey;
  label: string;
  /** document.title suffix when this tab is active */
  title: string;
}

export const PROFILE_TABS: ProfileTabMeta[] = [
  { key: "overview",    label: "Overview",    title: "Profile" },
  { key: "enrollment",  label: "Enrollment",  title: "Enrollment" },
  { key: "referral",    label: "Referral",    title: "Refer & Earn" },
  { key: "preferences", label: "Preferences", title: "Preferences" },
  { key: "membership",  label: "Membership",  title: "Membership" },
  { key: "account",     label: "Account",     title: "Account" },
];

const DEFAULT_TAB: ProfileTabKey = "overview";

/** Resolve the active tab from a raw ?tab= value, falling back to Overview. */
export function resolveTab(param: string | null | undefined): ProfileTabKey {
  if (!param) return DEFAULT_TAB;
  const match = PROFILE_TABS.find((t) => t.key === param);
  return match ? match.key : DEFAULT_TAB;
}
