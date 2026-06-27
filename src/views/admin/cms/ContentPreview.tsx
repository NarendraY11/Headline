// Phase 3 — student-style content preview. Renders a draft question the way
// a student would see it, WITHOUT publishing. Read-only; reuses the same
// Question shape the student quiz uses (src/data/questions.ts).

import type { QuestionDraft } from "../../../lib/cms/contentModel";

export default function ContentPreview({ q }: { q: QuestionDraft }) {
  const choices = q.choices ?? [];
  return (
    <div className="rounded-lg border border-black/10 dark:border-white/10 p-4">
      <div className="text-xs uppercase tracking-wide opacity-60 mb-2">Student preview (unpublished)</div>
      <p className="font-medium mb-3">{q.prompt || <span className="opacity-40">— no prompt —</span>}</p>
      <ol className="space-y-2">
        {choices.map((c) => (
          <li key={c.id}
              className={`flex gap-2 rounded-md border px-3 py-2 text-sm ${
                q.correct === c.id ? "border-green-500/60 bg-green-500/10" : "border-black/10 dark:border-white/10"
              }`}>
            <span className="font-mono opacity-60">{c.id})</span>
            <span>{c.label}</span>
            {q.correct === c.id && <span className="ml-auto text-green-600 text-xs">correct</span>}
          </li>
        ))}
        {choices.length === 0 && <li className="opacity-40 text-sm">— no options —</li>}
      </ol>
      {q.explanation && (
        <div className="mt-3 rounded-md bg-black/5 dark:bg-white/5 p-3 text-sm">
          <span className="font-semibold">Explanation: </span>{q.explanation}
        </div>
      )}
    </div>
  );
}
