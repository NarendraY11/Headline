// UX-Nav Phase 2C: Profile is now the single Account Workspace. This file is the
// tab shell only — each tab owns its own bespoke layout. Deep-linkable via
// ?tab=; Back/Forward walks tabs (we push, not replace). Overview is eager
// (default landing); the rest lazy-load on first open.

import { Suspense, lazy, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { LogIn } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { Button } from "../components/Atoms";
import { LoadingFallback } from "../components/layout/LoadingFallback";
import { trackEvent } from "../lib/track";
import { PROFILE_TABS, resolveTab, type ProfileTabKey } from "./profile/profileTabs";
import OverviewTab from "./profile/OverviewTab";

const EnrollmentTab = lazy(() => import("./profile/EnrollmentTab"));
const ReferralTab = lazy(() => import("./profile/ReferralTab"));
const PreferencesTab = lazy(() => import("./profile/PreferencesTab"));
const MembershipTab = lazy(() => import("./profile/MembershipTab"));
const AccountTab = lazy(() => import("./profile/AccountTab"));

export default function ProfileView() {
  const { user, loading, openAuthModal } = useAuth();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const openedOnce = useRef(false);

  const active: ProfileTabKey = resolveTab(params.get("tab"));

  // Per-tab document title + analytics. profile_tab_opened fires once on first
  // mount; profile_tab_changed on every subsequent switch.
  useEffect(() => {
    const meta = PROFILE_TABS.find((t) => t.key === active)!;
    document.title = `${meta.title} — Heading`;
    if (!openedOnce.current) {
      openedOnce.current = true;
      trackEvent("profile_tab_opened", { metadata: { tab: active } });
    } else {
      trackEvent("profile_tab_changed", { metadata: { tab: active } });
    }
  }, [active]);

  const selectTab = (key: ProfileTabKey) => {
    const next = new URLSearchParams(params);
    if (key === "overview") next.delete("tab");
    else next.set("tab", key);
    // Push (no replace) so browser Back/Forward navigates between tabs.
    setParams(next);
  };

  // Roving-tabindex arrow-key navigation across the tablist.
  const onKeyDown = (e: React.KeyboardEvent, idx: number) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    const dir = e.key === "ArrowRight" ? 1 : -1;
    const nextIdx = (idx + dir + PROFILE_TABS.length) % PROFILE_TABS.length;
    tabRefs.current[nextIdx]?.focus();
    selectTab(PROFILE_TABS[nextIdx].key);
  };

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto py-10 px-4 w-full animate-pulse space-y-6">
        <div className="h-10 bg-rule/60 w-48 rounded" />
        <div className="h-12 bg-rule/40 rounded-xl" />
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
          <div className="h-40 bg-rule/40 rounded-2xl md:col-span-8" />
          <div className="h-40 bg-rule/40 rounded-2xl md:col-span-4" />
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="relative min-h-[80vh] flex flex-col items-center justify-center p-4">
        <div className="absolute inset-0 blueprint pointer-events-none opacity-20 z-0" />
        <div className="max-w-md mx-auto w-full text-center flex flex-col items-center relative z-10">
          <div className="w-16 h-16 rounded-full bg-paper border border-rule shadow-sm flex items-center justify-center mb-6">
            <LogIn className="text-muted" size={32} />
          </div>
          <h1 className="font-serif text-3xl md:text-4xl text-ink mb-3 tracking-tight">Pilot Records Restricted</h1>
          <p className="font-mono text-xs text-muted mb-8 max-w-[300px] mx-auto leading-relaxed">
            Sign in to access your logbook, progress, and exam history.
          </p>
          <div className="flex flex-col gap-3 w-full max-w-[280px] mx-auto">
            <Button variant="primary" className="w-full h-12 rounded-full shadow-sm" onClick={() => openAuthModal("signin")}>
              Sign In →
            </Button>
            <Button variant="ghost" className="w-full h-12 rounded-full text-muted hover:text-ink hover:bg-paper/50" onClick={() => navigate("/")}>
              ← Back to Home
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 pt-6 pb-16 w-full">
      {/* Sticky tab bar — stays in reach while scrolling a tall panel; scrolls
          horizontally on mobile so 6 tabs never wrap or overflow the viewport. */}
      <div className="sticky top-0 z-20 -mx-4 px-4 bg-bg/95 backdrop-blur-sm">
        <div className="font-mono text-[10px] text-signal tracking-[0.2em] uppercase mb-3 pt-1">
          § ACCOUNT WORKSPACE
        </div>
        <div
          role="tablist"
          aria-label="Account workspace sections"
          className="flex gap-1 border-b border-rule overflow-x-auto no-scrollbar"
        >
          {PROFILE_TABS.map((t, idx) => {
            const selected = t.key === active;
            return (
              <button
                key={t.key}
                ref={(el) => { tabRefs.current[idx] = el; }}
                role="tab"
                id={`profile-tab-${t.key}`}
                aria-selected={selected}
                aria-controls="profile-panel"
                tabIndex={selected ? 0 : -1}
                onClick={() => selectTab(t.key)}
                onKeyDown={(e) => onKeyDown(e, idx)}
                className={`px-4 py-2.5 min-h-[44px] whitespace-nowrap text-[13px] font-sans font-medium tracking-tight border-b-2 -mb-px transition-colors outline-none focus-visible:ring-2 focus-visible:ring-sky/60 rounded-t ${
                  selected ? "border-ink text-ink" : "border-transparent text-muted hover:text-ink"
                }`}
              >
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      <div
        role="tabpanel"
        id="profile-panel"
        aria-labelledby={`profile-tab-${active}`}
        className="pt-8"
      >
        {active === "overview" ? (
          <OverviewTab onNavigateTab={selectTab} />
        ) : (
          <Suspense fallback={<LoadingFallback />}>
            {active === "enrollment" && <EnrollmentTab />}
            {active === "referral" && <ReferralTab />}
            {active === "preferences" && <PreferencesTab />}
            {active === "membership" && <MembershipTab />}
            {active === "account" && <AccountTab />}
          </Suspense>
        )}
      </div>
    </div>
  );
}
