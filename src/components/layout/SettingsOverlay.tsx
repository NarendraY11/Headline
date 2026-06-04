import {
    Moon, Sun,
    X
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { isPaidActive, planLabel } from "../../lib/plan";
import { Button } from "../Atoms";

import { CustomDropdown } from './CustomDropdown';
import { CustomToggle } from './CustomToggle';

type SettingsTab = "quiz" | "appearance" | "account";

const QUIZ_MODES = [
  { id: "practice", title: "Practice", desc: "Immediate feedback, explanations" },
  { id: "viva", title: "Viva Flashcard", desc: "Self-eval, reveal answers" },
  { id: "exam", title: "Exam Simulator", desc: "Timed, strict evaluation" },
] as const;

// Serif sub-head with trailing hairline — the established section marker, reused
// so every group inside a tab reads the same way.
function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center gap-4 mb-3.5">
      <h3 className="font-serif font-medium text-lg text-ink">{children}</h3>
      <div className="h-px bg-rule-strong flex-1" />
    </div>
  );
}

// Label + description on the left, control slotted on the right.
function ControlRow({ title, desc, children }: { title: string; desc: string; children: ReactNode }) {
  return (
    <div className="flex justify-between items-center gap-4 py-2">
      <div className="min-w-0">
        <span className="block text-sm font-sans font-medium text-ink">{title}</span>
        <span className="block text-xs font-mono tracking-wide text-muted-2 mt-1">{desc}</span>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

export function SettingsOverlay({ onClose }: { onClose: () => void }) {
  const { userData, updateUserData, resetAccount } = useAuth();

  const [activeTab, setActiveTab] = useState<SettingsTab>("quiz");

  // Use Auth settings if available, fallback to local storage
  const [preferredMode, setPreferredMode] = useState(() => userData?.settings?.defaultMode || localStorage.getItem("heading_preferred_mode") || "practice");
  const [isDark, setIsDark] = useState(() => {
    if (userData?.settings?.theme) return userData.settings.theme === "dark";
    return localStorage.getItem("heading_theme") === "dark";
  });
  const [reduceMotion, setReduceMotion] = useState(() => userData?.settings?.reduceMotion || false);
  const [negativeMarking, setNegativeMarking] = useState(() => userData?.settings?.negativeMarking || false);
  const [showWipeConfirm, setShowWipeConfirm] = useState(false);

  useEffect(() => {
    if (userData?.settings?.theme) {
       setIsDark(userData.settings.theme === "dark");
    }
  }, [userData?.settings?.theme]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const handleModeChange = (mode: string) => {
    setPreferredMode(mode);
    localStorage.setItem("heading_preferred_mode", mode);
    updateUserData({ settings: { ...userData?.settings, defaultMode: mode, reduceMotion, negativeMarking } });
  };

  const handleToggleReduceMotion = () => {
    const next = !reduceMotion;
    setReduceMotion(next);
    updateUserData({ settings: { ...userData?.settings, defaultMode: preferredMode, reduceMotion: next, negativeMarking } });
  };

  const handleToggleNegativeMarking = () => {
    const next = !negativeMarking;
    setNegativeMarking(next);
    updateUserData({ settings: { ...userData?.settings, defaultMode: preferredMode, reduceMotion, negativeMarking: next } });
  };

  const handleThemeToggle = () => {
    const nextDark = !isDark;
    setIsDark(nextDark);
    if (userData) {
      updateUserData({ settings: { ...userData.settings, theme: nextDark ? "dark" : "light" } });
    } else {
      if (nextDark) {
        document.documentElement.classList.add("dark");
        localStorage.setItem("heading_theme", "dark");
      } else {
        document.documentElement.classList.remove("dark");
        localStorage.setItem("heading_theme", "light");
      }
    }
  };

  const handleResetSetup = () => {
    if (userData) {
      updateUserData({ onboardingCompleted: false }).finally(() => {
        localStorage.removeItem("heading_onboarding_completed");
        window.location.reload();
      });
    } else {
      localStorage.removeItem("heading_onboarding_completed");
      window.location.reload();
    }
  };

  const planTitle =
    userData?.plan === "lifetime" ? "Captain (Lifetime Pro)" :
    userData?.plan === "pro" ? "Captain (Pro Access)" :
    userData?.plan === "trial" ? "Co-Pilot (7-Day Trial)" : "Cadet (Free Account)";

  const tabs: { id: SettingsTab; label: string }[] = [
    { id: "quiz", label: "Quiz" },
    { id: "appearance", label: "Appearance" },
    { id: "account", label: "Account" },
  ];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-ink/40 dark:bg-ink/60 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]">
      <div className="bg-paper border border-rule-strong shadow-2xl rounded-xl w-full max-w-lg relative max-h-[85vh] flex flex-col">

        {/* Header */}
        <div className="flex-shrink-0 px-8 pt-7 pb-5">
          <button onClick={onClose} aria-label="Close settings" className="absolute top-7 right-7 text-muted-2 hover:text-ink transition-colors"><X size={24} /></button>
          <h2 className="font-serif text-[30px] text-ink m-0 leading-none mb-5">Settings</h2>

          {/* Plan strip — status, kept compact on one row so it never eats a section */}
          <div className="bg-panel border border-rule-strong rounded-xl px-4 py-3 flex items-center justify-between gap-3 mb-5">
            <div className="flex items-center gap-2 min-w-0">
              <span className="font-sans font-semibold text-sm text-ink truncate">{planTitle}</span>
              {isPaidActive(userData) && (
                <span className="bg-mint text-bg font-mono font-bold text-[8px] tracking-wider uppercase px-1.5 py-0.5 rounded leading-none shrink-0" title={planLabel(userData)}>
                  ACTIVE
                </span>
              )}
            </div>
            <Link to="/pricing" onClick={onClose} className="shrink-0">
              <Button variant="primary" className="h-8 text-[11px] px-3.5 bg-navy hover:bg-navy/90 text-bg rounded-md font-mono uppercase tracking-wider">
                {isPaidActive(userData) ? "Manage" : "Upgrade"}
              </Button>
            </Link>
          </div>

          {/* Segmented tabs */}
          <div className="bg-panel border border-rule-strong p-1 rounded-full flex gap-1" role="tablist" aria-label="Settings sections">
            {tabs.map((t) => (
              <button
                key={t.id}
                role="tab"
                aria-selected={activeTab === t.id}
                onClick={() => setActiveTab(t.id)}
                className={`flex-1 px-3 py-2 rounded-full text-[11px] font-mono uppercase tracking-wider transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky/60 focus-visible:ring-offset-2 focus-visible:ring-offset-panel ${
                  activeTab === t.id ? "bg-navy text-bg font-semibold shadow-sm" : "text-muted hover:text-ink"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tab body */}
        <div className="px-8 pb-8 pt-1 overflow-y-auto sidebar-nav-scroll">

          {/* ── QUIZ ── */}
          {activeTab === "quiz" && (
            <div className="space-y-6 animate-[fadeIn_0.15s_ease-out]">
              <div>
                <SectionLabel>Default Mode</SectionLabel>
                <div className="flex flex-col gap-2.5">
                  {QUIZ_MODES.map((m) => {
                    const active = preferredMode === m.id;
                    return (
                      <label
                        key={m.id}
                        className={`block w-full text-left p-3.5 rounded-lg border-[1.5px] cursor-pointer transition-all ${
                          active ? "border-ink bg-bg-2" : "border-rule bg-paper hover:border-rule-strong"
                        }`}
                      >
                        <input
                          type="radio"
                          name="quizMode"
                          checked={active}
                          onChange={() => handleModeChange(m.id)}
                          className="sr-only"
                        />
                        <div className="flex items-center justify-between">
                          <div>
                            <span className={`block font-sans text-[14px] font-bold ${active ? "text-ink" : "text-ink-2"}`}>{m.title}</span>
                            <span className="block font-mono text-[10px] text-muted-2 uppercase tracking-tight mt-1">{m.desc}</span>
                          </div>
                          <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ml-4 ${active ? "border-ink" : "border-rule-strong"}`}>
                            {active && <div className="w-2.5 h-2.5 rounded-full bg-ink" />}
                          </div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              <ControlRow title="Negative Marking" desc="Deduct points in timed mode">
                <CustomToggle isOn={negativeMarking} onToggle={handleToggleNegativeMarking} />
              </ControlRow>

              <div>
                <SectionLabel>Layout</SectionLabel>
                <div className="space-y-2">
                  <ControlRow title="Practice Mode" desc="Editorial / split view">
                    <CustomDropdown
                      value={userData?.settings?.practiceLayout || 'auto'}
                      options={[
                        { value: 'auto', label: 'Auto' },
                        { value: 'editorial', label: 'Editorial' },
                        { value: 'split', label: 'Split' }
                      ]}
                      onChange={(val) => updateUserData({ settings: { ...userData?.settings, defaultMode: preferredMode, reduceMotion, negativeMarking, practiceLayout: val as any } })}
                    />
                  </ControlRow>
                  <ControlRow title="Timed Mode" desc="Instrument / editorial view">
                    <CustomDropdown
                      value={userData?.settings?.timedLayout || 'auto'}
                      options={[
                        { value: 'auto', label: 'Auto' },
                        { value: 'instrument', label: 'Instrument' },
                        { value: 'editorial', label: 'Editorial' }
                      ]}
                      onChange={(val) => updateUserData({ settings: { ...userData?.settings, defaultMode: preferredMode, reduceMotion, negativeMarking, timedLayout: val as any } })}
                    />
                  </ControlRow>
                  <ControlRow title="Viva Mode" desc="Flashcard / editorial view">
                    <CustomDropdown
                      value={userData?.settings?.vivaLayout || 'auto'}
                      options={[
                        { value: 'auto', label: 'Auto' },
                        { value: 'flashcard', label: 'Flashcard' },
                        { value: 'editorial', label: 'Editorial' }
                      ]}
                      onChange={(val) => updateUserData({ settings: { ...userData?.settings, defaultMode: preferredMode, reduceMotion, negativeMarking, vivaLayout: val as any } })}
                    />
                  </ControlRow>
                </div>
              </div>
            </div>
          )}

          {/* ── APPEARANCE ── */}
          {activeTab === "appearance" && (
            <div className="space-y-4 animate-[fadeIn_0.15s_ease-out]">
              <SectionLabel>Display</SectionLabel>
              <div className="flex justify-between items-center gap-4 py-2">
                <div className="min-w-0">
                  <span className="block text-sm font-sans font-medium text-ink flex items-center gap-2">
                    {isDark ? <Moon size={14} className="text-muted" /> : <Sun size={14} className="text-muted" />} Night Mode
                  </span>
                  <span className="block text-xs font-mono tracking-wide text-muted-2 mt-1">Dark theme for low-light environments</span>
                </div>
                <CustomToggle isOn={isDark} onToggle={handleThemeToggle} />
              </div>

              <div className="border-t border-rule" />

              <ControlRow title="Reduce Motion" desc="Disable non-essential animations">
                <CustomToggle isOn={reduceMotion} onToggle={handleToggleReduceMotion} />
              </ControlRow>

              <div className="border-t border-rule" />

              <ControlRow title="Reset Setup" desc="Replay the onboarding flow">
                <button
                  onClick={handleResetSetup}
                  className="px-4 py-2 text-xs font-mono uppercase tracking-wider font-medium bg-panel border border-rule-strong rounded-full text-ink hover:border-ink/40 hover:bg-bg-2 transition-colors shadow-sm"
                >
                  Reset
                </button>
              </ControlRow>
            </div>
          )}

          {/* ── ACCOUNT ── */}
          {activeTab === "account" && (
            <div className="space-y-4 animate-[fadeIn_0.15s_ease-out]">
              <SectionLabel>Danger Zone</SectionLabel>

              {/* Destructive actions get their own framed, signal-bordered panel —
                  fully separated from routine settings. */}
              <div className="border-[1.5px] border-signal/30 bg-signal/5 rounded-xl p-5 relative">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <span className="block text-sm font-sans font-bold text-signal">Wipe All Data</span>
                    <span className="block text-xs font-sans text-ink-2 leading-relaxed mt-1">
                      Permanently erase every mock attempt, study history entry, and telemetry log. This cannot be undone.
                    </span>
                  </div>
                  <button
                    onClick={() => setShowWipeConfirm(true)}
                    className="shrink-0 px-4 py-2 text-xs font-mono uppercase tracking-wider font-bold bg-signal/10 border border-signal/40 rounded-full text-signal hover:bg-signal hover:text-bg transition-colors shadow-sm"
                  >
                    Wipe Data
                  </button>
                </div>

                {showWipeConfirm && (
                  <div className="mt-4 pt-4 border-t border-signal/20 animate-[fadeIn_0.2s_ease-out]">
                    <div className="flex gap-3 items-start mb-3">
                      <div className="w-8 h-8 rounded-full bg-signal/10 flex items-center justify-center shrink-0">
                        <span className="text-signal font-serif text-lg leading-none">!</span>
                      </div>
                      <div>
                        <h4 className="font-sans font-bold text-ink text-sm mb-1">Confirm permanent wipe</h4>
                        <p className="font-sans text-xs text-ink-2 leading-relaxed">
                          Type-rated double-check: this is irreversible. All progress is lost.
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2 justify-end">
                      <button onClick={() => setShowWipeConfirm(false)} className="px-3 py-1.5 font-sans text-xs font-medium text-ink bg-bg hover:bg-bg-2 rounded-md transition-colors">
                        Cancel
                      </button>
                      <button onClick={async () => { await resetAccount(); onClose(); }} className="px-3 py-1.5 font-sans text-xs font-bold text-bg bg-signal hover:bg-signal/80 rounded-md transition-colors">
                        Wipe Data
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
