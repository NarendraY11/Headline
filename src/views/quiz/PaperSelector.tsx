import { CheckSquare, Play, Square } from "lucide-react";
import { useState } from "react";
import { Button, Chip } from "../../components/Atoms";
import { rawSubjects } from "../../data/topics";

interface PaperSelectorProps {
  mode: "viva" | "flashcard";
  onConfirm: (selectedSubjectIds: string[]) => void;
  onBack: () => void;
}

const GROUPS: { label: string; authority: string }[] = [
  { label: "DGCA", authority: "DGCA" },
  { label: "EASA", authority: "EASA" },
  { label: "FAA", authority: "FAA" },
  { label: "Type Rating", authority: "TYPE_RATING" },
];

export default function PaperSelector({ mode, onConfirm, onBack }: PaperSelectorProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const activeSubjects = rawSubjects.filter((s) => s.status === "active");

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectGroup = (authority: string) => {
    const groupIds = activeSubjects.filter((s) => s.exam_authority === authority).map((s) => s.id);
    setSelected((prev) => {
      const next = new Set(prev);
      const allSelected = groupIds.every((id) => next.has(id));
      if (allSelected) groupIds.forEach((id) => next.delete(id));
      else groupIds.forEach((id) => next.add(id));
      return next;
    });
  };

  const handleConfirm = () => {
    onConfirm(selected.size > 0 ? Array.from(selected) : []);
  };

  const modeLabel = mode === "viva" ? "VIVA Practice" : "Flashcard Practice";

  return (
    <div className="relative min-h-screen flex items-center justify-center p-4">
      <div className="absolute inset-0 blueprint pointer-events-none opacity-40 z-0" />
      <div className="absolute inset-0 paper-grain pointer-events-none opacity-100 z-1" />

      <div className="relative z-10 w-full max-w-2xl bg-paper border border-rule rounded-xl p-8 shadow-xl">
        <div className="mb-6">
          <span className="font-mono text-[10px] text-muted-2 uppercase tracking-widest">
            {modeLabel} · Paper Selection
          </span>
          <h1 className="font-serif text-3xl text-ink mt-1">Select Papers</h1>
          <p className="font-sans text-sm text-muted font-light mt-2">
            Pick one or more subjects to include. Leave all unselected to practice all available questions.
          </p>
        </div>

        <div className="space-y-6 max-h-[50vh] overflow-y-auto pr-1">
          {GROUPS.map((group) => {
            const subjects = activeSubjects.filter((s) => s.exam_authority === group.authority);
            if (subjects.length === 0) return null;
            const groupIds = subjects.map((s) => s.id);
            const allGroupSelected = groupIds.every((id) => selected.has(id));
            const someGroupSelected = groupIds.some((id) => selected.has(id));
            return (
              <div key={group.authority}>
                <button
                  onClick={() => selectGroup(group.authority)}
                  className="flex items-center gap-2 mb-2 text-[11px] font-mono uppercase tracking-widest text-muted-2 hover:text-ink transition-colors"
                >
                  {allGroupSelected ? (
                    <CheckSquare size={13} className="text-ink" />
                  ) : someGroupSelected ? (
                    <CheckSquare size={13} className="text-muted-2" />
                  ) : (
                    <Square size={13} />
                  )}
                  {group.label}
                </button>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {subjects.map((subj) => {
                    const isSelected = selected.has(subj.id);
                    return (
                      <button
                        key={subj.id}
                        onClick={() => toggle(subj.id)}
                        className={`flex items-center gap-3 p-3 rounded-lg border text-left transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-sky/60 ${
                          isSelected
                            ? "bg-panel border-ink text-ink shadow-sm"
                            : "bg-bg-2/40 border-rule hover:border-ink/40 text-muted hover:text-ink"
                        }`}
                      >
                        <div className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${isSelected ? "bg-ink border-ink" : "border-rule-strong"}`}>
                          {isSelected && (
                            <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                              <path d="M1 4l3 3 5-6" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="font-sans text-[13px] font-medium leading-tight truncate">{subj.title}</div>
                          <div className="font-mono text-[9px] text-muted-2 mt-0.5">{subj.questionCount} Q</div>
                        </div>
                        {subj.license && (
                          <Chip variant="solid" className="text-[8px] ml-auto flex-shrink-0">{subj.license}</Chip>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-6 pt-4 border-t border-rule flex items-center justify-between gap-3">
          <Button variant="ghost" onClick={onBack}>Back</Button>
          <div className="flex items-center gap-3">
            {selected.size > 0 && (
              <span className="font-mono text-[11px] text-muted-2">{selected.size} selected</span>
            )}
            <Button variant="primary" onClick={handleConfirm}>
              <Play size={14} fill="currentColor" />
              {selected.size > 0 ? `Practice ${selected.size} Paper${selected.size > 1 ? "s" : ""}` : "Practice All"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
