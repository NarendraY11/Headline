// Phase 3/7 — Content preview in multiple modes.
// Read-only; no student-facing code path.

import type { QuestionDraft } from "../../../lib/cms/contentModel";

type PreviewMode = "student" | "mobile" | "exam" | "review";

export default function ContentPreview({ q, mode = "student" }: { q: QuestionDraft; mode?: PreviewMode }) {
  const choices = q.choices ?? [];

  const containerClass =
    mode === "mobile"
      ? "rounded-2xl border border-rule p-4 text-sm bg-paper shadow"
      : mode === "exam"
      ? "rounded-lg border-2 border-rule p-5 bg-paper font-mono"
      : mode === "review"
      ? "rounded-lg border border-dashed border-rule p-4 bg-bg-2"
      : "rounded-lg border border-black/10 dark:border-white/10 p-4";

  return (
    <div className={containerClass}>
      <div className="text-[9px] font-mono uppercase tracking-widest text-muted mb-2">
        {mode} preview {mode !== "student" && `· ${mode}`}
      </div>

      <p className={`font-medium mb-3 ${mode === "exam" ? "text-xs" : ""}`}>
        {q.prompt || <span className="opacity-40">— no prompt —</span>}
      </p>

      <ol className="space-y-2">
        {choices.map((c) => (
          <li
            key={c.id}
            className={`flex gap-2 rounded-md border px-3 py-2 text-xs ${
              mode === "review"
                ? q.correct === c.id
                  ? "border-emerald-400/60 bg-emerald-50"
                  : "border-rule/60"
                : q.correct === c.id
                ? "border-green-500/60 bg-green-500/10"
                : "border-black/10 dark:border-white/10"
            }`}
          >
            <span className="font-mono opacity-60">{c.id})</span>
            <span>{c.label}</span>
            {(mode === "review") && q.correct === c.id && (
              <span className="ml-auto text-emerald-600 text-[10px] font-bold">CORRECT</span>
            )}
          </li>
        ))}
        {choices.length === 0 && <li className="opacity-40 text-xs">— no options —</li>}
      </ol>

      {q.explanation && (
        <div className={`mt-3 rounded-md p-3 text-xs ${mode === "exam" ? "bg-bg-2 border border-rule" : "bg-black/5 dark:bg-white/5"}`}>
          {mode !== "student" && <span className="font-bold text-[10px] font-mono uppercase tracking-wide block mb-1 text-muted">Explanation</span>}
          {q.explanation}
        </div>
      )}
    </div>
  );
}
