// UX-Nav Phase 2C: Preferences tab — the single home for account preferences,
// replacing the old SettingsOverlay modal. Settings are organised into labelled
// groups (Appearance / Learning Experience / Notifications / Accessibility /
// Future) rather than one long list. Write logic is migrated verbatim from
// SettingsOverlay + ProfileView's notification card (via updateUserData).

import { Mail, Moon, Sun } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { trackEvent } from "../../lib/track";
import { CustomDropdown } from "../../components/layout/CustomDropdown";
import { CustomToggle } from "../../components/layout/CustomToggle";

const QUIZ_MODES = [
  { id: "practice", title: "Practice", desc: "Immediate feedback, explanations" },
  { id: "viva", title: "Viva Flashcard", desc: "Self-eval, reveal answers" },
  { id: "exam", title: "Exam Simulator", desc: "Timed, strict evaluation" },
] as const;

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center gap-4 mb-4">
      <h3 className="font-serif font-medium text-lg text-ink">{children}</h3>
      <div className="h-px bg-rule-strong flex-1" />
    </div>
  );
}

function ControlRow({ title, desc, children }: { title: string; desc: string; children: ReactNode }) {
  return (
    <div className="flex justify-between items-center gap-4 py-2.5">
      <div className="min-w-0">
        <span className="block text-sm font-sans font-medium text-ink">{title}</span>
        <span className="block text-xs font-mono tracking-wide text-muted-2 mt-1">{desc}</span>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function Section({ children }: { children: ReactNode }) {
  return <div className="rounded-2xl border border-rule bg-paper p-6">{children}</div>;
}

export default function PreferencesTab() {
  const { userData, updateUserData } = useAuth();

  const [preferredMode, setPreferredMode] = useState(() => userData?.settings?.defaultMode || localStorage.getItem("heading_preferred_mode") || "practice");
  const [isDark, setIsDark] = useState(() => {
    if (userData?.settings?.theme) return userData.settings.theme === "dark";
    return localStorage.getItem("heading_theme") === "dark";
  });
  const [reduceMotion, setReduceMotion] = useState(() => userData?.settings?.reduceMotion || false);
  const [negativeMarking, setNegativeMarking] = useState(() => userData?.settings?.negativeMarking || false);

  useEffect(() => {
    if (userData?.settings?.theme) setIsDark(userData.settings.theme === "dark");
  }, [userData?.settings?.theme]);

  const tracked = (patch: Record<string, any>) => {
    trackEvent("profile_preferences_updated", { metadata: patch });
  };

  const handleModeChange = (mode: string) => {
    setPreferredMode(mode);
    localStorage.setItem("heading_preferred_mode", mode);
    updateUserData({ settings: { ...userData?.settings, defaultMode: mode, reduceMotion, negativeMarking } });
    tracked({ defaultMode: mode });
  };

  const handleToggleReduceMotion = () => {
    const next = !reduceMotion;
    setReduceMotion(next);
    updateUserData({ settings: { ...userData?.settings, defaultMode: preferredMode, reduceMotion: next, negativeMarking } });
    tracked({ reduceMotion: next });
  };

  const handleToggleNegativeMarking = () => {
    const next = !negativeMarking;
    setNegativeMarking(next);
    updateUserData({ settings: { ...userData?.settings, defaultMode: preferredMode, reduceMotion, negativeMarking: next } });
    tracked({ negativeMarking: next });
  };

  const handleThemeToggle = () => {
    const nextDark = !isDark;
    setIsDark(nextDark);
    if (userData) {
      updateUserData({ settings: { ...userData.settings, theme: nextDark ? "dark" : "light" } });
    } else {
      document.documentElement.classList.toggle("dark", nextDark);
      localStorage.setItem("heading_theme", nextDark ? "dark" : "light");
    }
    tracked({ theme: nextDark ? "dark" : "light" });
  };

  const updateLayout = (key: "practiceLayout" | "timedLayout" | "vivaLayout", val: string) => {
    updateUserData({ settings: { ...userData?.settings, defaultMode: preferredMode, reduceMotion, negativeMarking, [key]: val as any } });
    tracked({ [key]: val });
  };

  const toggleReminders = () => {
    const next = !userData?.settings?.remindersEnabled;
    updateUserData({ settings: { ...userData?.settings, remindersEnabled: next } });
    tracked({ remindersEnabled: next });
  };

  const toggleNewsletter = () => {
    const next = !userData?.newsletterOptIn;
    updateUserData({ newsletterOptIn: next });
    tracked({ newsletterOptIn: next });
  };

  return (
    <div className="space-y-6 max-w-3xl">
      {/* ── Appearance & Accessibility (merged for density) ── */}
      <Section>
        <SectionLabel>Appearance &amp; Accessibility</SectionLabel>
        <div className="flex justify-between items-center gap-4 py-2.5">
          <div className="min-w-0">
            <span className="text-sm font-sans font-medium text-ink flex items-center gap-2">
              {isDark ? <Moon size={14} className="text-muted" /> : <Sun size={14} className="text-muted" />} Night Mode
            </span>
            <span className="block text-xs font-mono tracking-wide text-muted-2 mt-1">Dark theme for low-light environments</span>
          </div>
          <CustomToggle isOn={isDark} onToggle={handleThemeToggle} ariaLabel="Night mode" />
        </div>
        <div className="border-t border-rule" />
        <ControlRow title="Reduce Motion" desc="Disable non-essential animations">
          <CustomToggle isOn={reduceMotion} onToggle={handleToggleReduceMotion} ariaLabel="Reduce motion" />
        </ControlRow>
      </Section>

      {/* ── Learning Experience ── */}
      <Section>
        <SectionLabel>Learning Experience</SectionLabel>
        <span className="font-mono text-[10px] uppercase tracking-widest text-muted-2 block mb-2.5">Default Quiz Mode</span>
        <div className="flex flex-col gap-2.5 mb-5">
          {QUIZ_MODES.map((m) => {
            const active = preferredMode === m.id;
            return (
              <label key={m.id} className={`block w-full text-left p-3.5 rounded-lg border-[1.5px] cursor-pointer transition-all ${active ? "border-ink bg-bg-2" : "border-rule bg-paper hover:border-rule-strong"}`}>
                <input type="radio" name="quizMode" checked={active} onChange={() => handleModeChange(m.id)} className="sr-only" />
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

        <div className="border-t border-rule pt-1">
          <ControlRow title="Negative Marking" desc="Deduct points in timed mode">
            <CustomToggle isOn={negativeMarking} onToggle={handleToggleNegativeMarking} ariaLabel="Negative marking" />
          </ControlRow>
          <ControlRow title="Practice Layout" desc="Editorial / split view">
            <CustomDropdown value={userData?.settings?.practiceLayout || "auto"} options={[{ value: "auto", label: "Auto" }, { value: "editorial", label: "Editorial" }, { value: "split", label: "Split" }]} onChange={(v) => updateLayout("practiceLayout", v)} />
          </ControlRow>
          <ControlRow title="Timed Layout" desc="Instrument / editorial view">
            <CustomDropdown value={userData?.settings?.timedLayout || "auto"} options={[{ value: "auto", label: "Auto" }, { value: "instrument", label: "Instrument" }, { value: "editorial", label: "Editorial" }]} onChange={(v) => updateLayout("timedLayout", v)} />
          </ControlRow>
          <ControlRow title="Viva Layout" desc="Flashcard / editorial view">
            <CustomDropdown value={userData?.settings?.vivaLayout || "auto"} options={[{ value: "auto", label: "Auto" }, { value: "flashcard", label: "Flashcard" }, { value: "editorial", label: "Editorial" }]} onChange={(v) => updateLayout("vivaLayout", v)} />
          </ControlRow>
        </div>
      </Section>

      {/* ── Notifications ── */}
      <Section>
        <SectionLabel>Notifications</SectionLabel>
        <ControlRow title="Spaced Review Reminders" desc="Gentle digests when recall is due">
          <CustomToggle isOn={!!userData?.settings?.remindersEnabled} onToggle={toggleReminders} ariaLabel="Toggle spaced review reminder emails" />
        </ControlRow>
        <div className="border-t border-rule" />
        <div className="flex justify-between items-center gap-4 py-2.5">
          <div className="min-w-0">
            <span className="text-sm font-sans font-medium text-ink flex items-center gap-1.5"><Mail size={14} className="text-navy shrink-0" /> Weekly Tips & QOTD</span>
            <span className="block text-xs font-mono tracking-wide text-muted-2 mt-1">Question of the day + hiring bulletins</span>
          </div>
          <CustomToggle isOn={!!userData?.newsletterOptIn} onToggle={toggleNewsletter} ariaLabel="Toggle weekly tips newsletter" />
        </div>
      </Section>

      {/* Future settings — lightweight inline footer, not a full card. */}
      <div className="flex items-center justify-between gap-4 px-2 py-1" aria-disabled="true">
        <span className="font-mono text-[11px] tracking-wide text-muted-2">
          More languages &amp; settings coming soon.
        </span>
        <span className="font-mono text-[9px] uppercase tracking-widest text-muted-2 border border-rule rounded-full px-2.5 py-1 shrink-0">Coming soon</span>
      </div>
    </div>
  );
}
