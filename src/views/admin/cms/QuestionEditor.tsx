// Phase 3 — Question Manager shell. Authoring UI only; saves DRAFT only.
// No import (Phase 4). Drafts are status='draft' → RLS hides them from
// students. Live validation + student preview. All fields per spec.

import { useMemo, useState } from "react";
import { supabase } from "../../../lib/supabase";
import {
  hasBlockingErrors,
  normalizedHash,
  validateQuestion,
  type QuestionDraft,
  type ValidationIssue,
} from "../../../lib/cms/contentModel";
import { saveVersion } from "../../../lib/cms/cmsDb";
import ContentPreview from "./ContentPreview";

const EMPTY: any = {
  id: "", prompt: "", choices: [{ id: "a", label: "" }, { id: "b", label: "" }, { id: "c", label: "" }, { id: "d", label: "" }],
  correct: "a", explanation: "", difficulty: "standard", bloom_level: "", time_estimate_sec: 45,
  topic_tags: "", refs: "", attachments: "", ata: "", regulation: "", authority: "",
  subject_id: "", subcategory_id: "", revision_notes: "",
};

export default function QuestionEditor({ onSaved }: { onSaved?: () => void } = {}) {
  const [f, setF] = useState<any>(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const draft: QuestionDraft = {
    prompt: f.prompt, choices: f.choices, correct: f.correct, explanation: f.explanation,
    difficulty: f.difficulty, subjectId: f.subject_id, subcategoryId: f.subcategory_id, slug: f.id,
  };
  const issues: ValidationIssue[] = useMemo(() => validateQuestion(draft), [JSON.stringify(draft)]);

  function setChoice(i: number, label: string) {
    const choices = [...f.choices];
    choices[i] = { ...choices[i], label };
    setF({ ...f, choices });
  }

  async function saveDraft() {
    setError(null); setOk(null);
    const id = f.id?.trim() || `q-${normalizedHash((f.prompt || "") + Date.now())}`;
    const row = {
      id,
      prompt: f.prompt, choices: f.choices, correct: f.correct, explanation: f.explanation,
      difficulty: f.difficulty || "standard",
      subject_id: f.subject_id || null, subcategory_id: f.subcategory_id || null,
      ata: f.ata || null, regulation: f.regulation || null, authority: f.authority || null,
      bloom_level: f.bloom_level || null,
      time_estimate_sec: Number(f.time_estimate_sec) || null,
      topic_tags: f.topic_tags ? f.topic_tags.split(",").map((t: string) => t.trim()).filter(Boolean) : [],
      refs: f.refs ? f.refs.split(",").map((t: string) => t.trim()).filter(Boolean) : [],
      attachments: f.attachments ? f.attachments.split(",").map((t: string) => t.trim()).filter(Boolean) : [],
      dedupe_hash: normalizedHash(f.prompt || ""),
      revision_notes: f.revision_notes || null,
      status: "draft", // ALWAYS draft from this editor — never publishes.
    };
    const { error: e } = await supabase.from("questions").upsert(row);
    if (e) { setError(e.message); return; }
    try { await saveVersion("question", id, row, f.revision_notes || "draft save"); } catch { /* version is best-effort */ }
    setOk(`Saved draft ${id}`);
    setF({ ...f, id });
    onSaved?.();
  }

  const input = "rounded-md border border-black/15 dark:border-white/15 bg-transparent px-2 py-1 text-sm w-full";

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      <div className="space-y-3">
        <h2 className="text-lg font-bold">Question editor <span className="text-xs font-normal opacity-60">(draft only)</span></h2>
        {error && <div className="text-red-600 text-sm">{error}</div>}
        {ok && <div className="text-green-600 text-sm">{ok}</div>}

        <label className="block text-sm">Prompt
          <textarea className={input} rows={3} value={f.prompt} onChange={(e) => setF({ ...f, prompt: e.target.value })} />
        </label>

        <div className="space-y-2">
          {f.choices.map((c: any, i: number) => (
            <div key={c.id} className="flex items-center gap-2">
              <input type="radio" name="correct" checked={f.correct === c.id} onChange={() => setF({ ...f, correct: c.id })} />
              <span className="font-mono text-xs opacity-60">{c.id})</span>
              <input className={input} value={c.label} onChange={(e) => setChoice(i, e.target.value)} placeholder={`Option ${c.id}`} />
            </div>
          ))}
        </div>

        <label className="block text-sm">Explanation
          <textarea className={input} rows={2} value={f.explanation} onChange={(e) => setF({ ...f, explanation: e.target.value })} />
        </label>

        <div className="grid grid-cols-2 gap-2">
          <label className="text-sm">Difficulty
            <select className={input} value={f.difficulty} onChange={(e) => setF({ ...f, difficulty: e.target.value })}>
              <option value="standard">standard</option><option value="complex">complex</option><option value="extreme">extreme</option>
            </select>
          </label>
          <label className="text-sm">Bloom level
            <input className={input} value={f.bloom_level} onChange={(e) => setF({ ...f, bloom_level: e.target.value })} placeholder="recall / apply / analyse" />
          </label>
          <label className="text-sm">Time (sec)
            <input className={input} type="number" value={f.time_estimate_sec} onChange={(e) => setF({ ...f, time_estimate_sec: e.target.value })} />
          </label>
          <label className="text-sm">ATA chapter
            <input className={input} value={f.ata} onChange={(e) => setF({ ...f, ata: e.target.value })} placeholder="ATA-24" />
          </label>
          <label className="text-sm">Subject id
            <input className={input} value={f.subject_id} onChange={(e) => setF({ ...f, subject_id: e.target.value })} />
          </label>
          <label className="text-sm">Module (subcategory) id
            <input className={input} value={f.subcategory_id} onChange={(e) => setF({ ...f, subcategory_id: e.target.value })} />
          </label>
          <label className="text-sm">Authority
            <input className={input} value={f.authority} onChange={(e) => setF({ ...f, authority: e.target.value })} placeholder="DGCA" />
          </label>
          <label className="text-sm">Regulation
            <input className={input} value={f.regulation} onChange={(e) => setF({ ...f, regulation: e.target.value })} />
          </label>
          <label className="text-sm">Tags (csv)
            <input className={input} value={f.topic_tags} onChange={(e) => setF({ ...f, topic_tags: e.target.value })} />
          </label>
          <label className="text-sm">References (csv)
            <input className={input} value={f.refs} onChange={(e) => setF({ ...f, refs: e.target.value })} />
          </label>
          <label className="text-sm">Attachments/Images/Video (csv urls)
            <input className={input} value={f.attachments} onChange={(e) => setF({ ...f, attachments: e.target.value })} />
          </label>
          <label className="text-sm">Revision notes
            <input className={input} value={f.revision_notes} onChange={(e) => setF({ ...f, revision_notes: e.target.value })} />
          </label>
        </div>

        <button onClick={saveDraft}
                className="rounded-md bg-black text-white dark:bg-white dark:text-black px-4 py-2 text-sm">
          Save draft
        </button>
      </div>

      <div className="space-y-4">
        <ContentPreview q={draft} />
        <div className="rounded-lg border border-black/10 dark:border-white/10 p-3">
          <div className="text-sm font-semibold mb-2">Validation {hasBlockingErrors(issues) ? "❌" : "✅"}</div>
          {issues.length === 0 ? <p className="text-sm text-green-600">No issues.</p> : (
            <ul className="space-y-1 text-sm">
              {issues.map((i, k) => (
                <li key={k} className={i.level === "error" ? "text-red-600" : "text-amber-600"}>
                  {i.level === "error" ? "⛔" : "⚠️"} <b>{i.field}</b>: {i.message}
                </li>
              ))}
            </ul>
          )}
          <p className="mt-2 text-xs opacity-60">Publishing is blocked while any ⛔ error exists. This editor saves drafts only.</p>
        </div>
      </div>
    </div>
  );
}
