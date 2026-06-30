// UX-Nav Phase 2: unified Practice hub. One nav door for the three testing
// surfaces that were previously separate sidebar items (Mock Exams, Exam Centre,
// VIVA). Tabs render the EXISTING views unmodified — no merge/duplication. VIVA
// is a fullscreen quiz that lives outside AppShell, so its tab is a launcher.
// Tabs appear only when their feature flag is on (Mock = mockExams, Exam Centre
// = advancedTesting); VIVA is always available.

import { Suspense, lazy, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Mic } from "lucide-react";
import { useFeature } from "../hooks/useFeatureFlags";
import { Button } from "../components/Atoms";
import { LoadingFallback } from "../components/layout/LoadingFallback";

const MockExamsView = lazy(() => import("./MockExamsView"));
const ExamCentreView = lazy(() => import("./ExamCentreView"));

type TabKey = "mock" | "exam-centre" | "viva";

interface Tab {
  key: TabKey;
  label: string;
}

export default function PracticeView() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const mockEnabled = useFeature("mockExams");
  const examCentreEnabled = useFeature("advancedTesting");
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const tabs: Tab[] = [
    ...(mockEnabled ? [{ key: "mock" as const, label: "Mock Exams" }] : []),
    ...(examCentreEnabled ? [{ key: "exam-centre" as const, label: "Exam Centre" }] : []),
    { key: "viva" as const, label: "VIVA" },
  ];

  // Active tab from ?tab=, falling back to the first available.
  const requested = params.get("tab") as TabKey | null;
  const active: TabKey = tabs.some((t) => t.key === requested) ? requested! : tabs[0].key;

  const selectTab = (key: TabKey) => {
    const next = new URLSearchParams(params);
    next.set("tab", key);
    setParams(next, { replace: true });
  };

  // Roving-tabindex arrow-key navigation across the tablist.
  const onKeyDown = (e: React.KeyboardEvent, idx: number) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    const dir = e.key === "ArrowRight" ? 1 : -1;
    const nextIdx = (idx + dir + tabs.length) % tabs.length;
    tabRefs.current[nextIdx]?.focus();
    selectTab(tabs[nextIdx].key);
  };

  return (
    <div className="w-full">
      {/* Tab strip — the single Practice door. Kept slim so each tab's own
          page header reads as the section title (no double H1). */}
      <div className="max-w-5xl mx-auto px-4 pt-6">
        <div className="font-mono text-[10px] text-signal tracking-[0.2em] uppercase mb-3">
          § PRACTICE
        </div>
        <div role="tablist" aria-label="Practice surfaces" className="flex gap-1 border-b border-rule">
          {tabs.map((t, idx) => {
            const selected = t.key === active;
            return (
              <button
                key={t.key}
                ref={(el) => { tabRefs.current[idx] = el; }}
                role="tab"
                id={`practice-tab-${t.key}`}
                aria-selected={selected}
                aria-controls={`practice-panel-${t.key}`}
                tabIndex={selected ? 0 : -1}
                onClick={() => selectTab(t.key)}
                onKeyDown={(e) => onKeyDown(e, idx)}
                className={`px-4 py-2.5 min-h-[44px] text-[13px] font-sans font-medium tracking-tight border-b-2 -mb-px transition-colors outline-none focus-visible:ring-2 focus-visible:ring-sky/60 rounded-t ${
                  selected
                    ? "border-ink text-ink"
                    : "border-transparent text-muted hover:text-ink"
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
        id={`practice-panel-${active}`}
        aria-labelledby={`practice-tab-${active}`}
      >
        {active === "viva" ? (
          <div className="max-w-5xl mx-auto px-4 py-16 text-center">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-panel border border-rule mb-5">
              <Mic className="text-ink" size={24} />
            </div>
            <h2 className="font-serif text-2xl text-ink mb-2">VIVA Oral Board</h2>
            <p className="font-sans text-sm text-muted-2 max-w-md mx-auto mb-6">
              Rapid-fire oral exam practice. Opens in a focused fullscreen session.
            </p>
            <Button variant="primary" className="h-11 px-6" onClick={() => navigate("/quiz/viva")}>
              Start VIVA practice →
            </Button>
          </div>
        ) : (
          <Suspense fallback={<LoadingFallback />}>
            {active === "mock" ? <MockExamsView /> : <ExamCentreView />}
          </Suspense>
        )}
      </div>
    </div>
  );
}
