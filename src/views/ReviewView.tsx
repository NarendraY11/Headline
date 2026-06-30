// UX-Nav Phase 2b: unified Review hub. "Things to revisit" in one place —
// Saved questions (the former Flashcards/Bookmarks page) + Mistake analysis
// (previously buried in Exam Centre). Tabs render existing pieces unmodified;
// no logic duplicated. Same slim-tab-strip pattern as PracticeView.

import { Suspense, lazy, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useMistakeAnalysis } from "../hooks/useMistakeAnalysis";
import { fetchMergedSubjects } from "../lib/content";
import type { SubjectItem } from "../data/topics";
import { MistakeAnalysisPanel } from "./exam-centre/MistakeAnalysisPanel";
import { LoadingFallback } from "../components/layout/LoadingFallback";

const BookmarksView = lazy(() => import("./BookmarksView"));

type TabKey = "saved" | "mistakes";

const TABS: { key: TabKey; label: string }[] = [
  { key: "saved", label: "Saved" },
  { key: "mistakes", label: "Mistakes" },
];

export default function ReviewView() {
  const [params, setParams] = useSearchParams();
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const requested = params.get("tab") as TabKey | null;
  const active: TabKey = TABS.some((t) => t.key === requested) ? requested! : "saved";

  const selectTab = (key: TabKey) => {
    const next = new URLSearchParams(params);
    next.set("tab", key);
    setParams(next, { replace: true });
  };

  const onKeyDown = (e: React.KeyboardEvent, idx: number) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    const dir = e.key === "ArrowRight" ? 1 : -1;
    const nextIdx = (idx + dir + TABS.length) % TABS.length;
    tabRefs.current[nextIdx]?.focus();
    selectTab(TABS[nextIdx].key);
  };

  // Mistakes data — only needed for that tab, but cheap hook; subject titles for
  // human-readable labels (same source ExamCentreView uses).
  const mistakes = useMistakeAnalysis();
  const [subjectTitleMap, setSubjectTitleMap] = useState<Record<string, string>>({});
  useEffect(() => {
    let alive = true;
    fetchMergedSubjects()
      .then((subjects: SubjectItem[]) => {
        if (!alive) return;
        const map: Record<string, string> = {};
        for (const s of subjects) map[s.id] = s.title;
        setSubjectTitleMap(map);
      })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  return (
    <div className="w-full">
      <div className="max-w-5xl mx-auto px-4 pt-6">
        <div className="font-mono text-[10px] text-signal tracking-[0.2em] uppercase mb-3">
          § REVIEW
        </div>
        <div role="tablist" aria-label="Review surfaces" className="flex gap-1 border-b border-rule">
          {TABS.map((t, idx) => {
            const selected = t.key === active;
            return (
              <button
                key={t.key}
                ref={(el) => { tabRefs.current[idx] = el; }}
                role="tab"
                id={`review-tab-${t.key}`}
                aria-selected={selected}
                aria-controls={`review-panel-${t.key}`}
                tabIndex={selected ? 0 : -1}
                onClick={() => selectTab(t.key)}
                onKeyDown={(e) => onKeyDown(e, idx)}
                className={`px-4 py-2.5 min-h-[44px] text-[13px] font-sans font-medium tracking-tight border-b-2 -mb-px transition-colors outline-none focus-visible:ring-2 focus-visible:ring-sky/60 rounded-t ${
                  selected ? "border-ink text-ink" : "border-transparent text-muted hover:text-ink"
                }`}
              >
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      <div role="tabpanel" id={`review-panel-${active}`} aria-labelledby={`review-tab-${active}`}>
        {active === "saved" ? (
          <Suspense fallback={<LoadingFallback />}>
            <BookmarksView />
          </Suspense>
        ) : (
          <div className="max-w-5xl mx-auto px-4 py-8">
            <MistakeAnalysisPanel
              result={mistakes.result}
              loading={mistakes.loading}
              error={mistakes.error}
              subjectTitles={subjectTitleMap}
              onRefetch={mistakes.refetch}
            />
          </div>
        )}
      </div>
    </div>
  );
}
