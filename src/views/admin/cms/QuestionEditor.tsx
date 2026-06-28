// Phase 7 — Production Question Editor.
// Supports edit (initialQuestion prop) and create modes.
// Dropdowns for subject/module/topic from registry. Full metadata.
// Preview modes: Student | Mobile | Exam. Version history (lazy). Publish workflow.

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../../lib/supabase";
import {
  hasBlockingErrors,
  normalizedHash,
  validateQuestion,
  type QuestionDraft,
  type ValidationIssue,
} from "../../../lib/cms/contentModel";
import {
  listVersions,
  rollbackToVersion,
  saveVersion,
} from "../../../lib/cms/cmsDb";
import ContentPreview from "./ContentPreview";

// ── Types ─────────────────────────────────────────────────────────────

type PreviewMode = "student" | "mobile" | "exam" | "review";

interface RegistryOption { id: string; title: string }

interface QuestionForm {
  id: string;
  prompt: string;
  choices: { id: string; label: string }[];
  correct: string;
  explanation: string;
  difficulty: string;
  bloom_level: string;
  time_estimate_sec: number;
  ata: string;
  regulation: string;
  authority: string;
  subject_id: string;
  subcategory_id: string;
  topic_id: string;
  program_id: string;
  certification_id: string;
  aircraft_id: string;
  topic_tags: string;
  refs: string;
  attachments: string;
  revision_notes: string;
  question_source: string;
  review_status: string;
  exam_year: string;
  learning_objective: string;
  question_type: string;
  // AI metadata (reserved; no AI integration)
  ai_confidence: string;
  ai_distractor_quality: string;
  ai_review_status: string;
  ai_generation_model: string;
}

const EMPTY: QuestionForm = {
  id: "", prompt: "", choices: [
    { id: "a", label: "" }, { id: "b", label: "" },
    { id: "c", label: "" }, { id: "d", label: "" },
  ],
  correct: "a", explanation: "", difficulty: "standard",
  bloom_level: "", time_estimate_sec: 45,
  ata: "", regulation: "", authority: "",
  subject_id: "", subcategory_id: "", topic_id: "",
  program_id: "", certification_id: "", aircraft_id: "",
  topic_tags: "", refs: "", attachments: "",
  revision_notes: "", question_source: "manual",
  review_status: "pending", exam_year: "",
  learning_objective: "", question_type: "standalone",
  ai_confidence: "", ai_distractor_quality: "",
  ai_review_status: "", ai_generation_model: "",
};

// Map DB question row → form state.
function rowToForm(row: any): QuestionForm {
  return {
    id: row.id ?? "",
    prompt: row.prompt ?? "",
    choices: Array.isArray(row.choices) && row.choices.length >= 2
      ? row.choices
      : [{ id: "a", label: "" }, { id: "b", label: "" }, { id: "c", label: "" }, { id: "d", label: "" }],
    correct: row.correct ?? "a",
    explanation: row.explanation ?? "",
    difficulty: row.difficulty ?? "standard",
    bloom_level: row.bloom_level ?? "",
    time_estimate_sec: row.time_estimate_sec ?? 45,
    ata: row.ata ?? "",
    regulation: row.regulation ?? "",
    authority: row.authority ?? "",
    subject_id: row.subject_id ?? "",
    subcategory_id: row.subcategory_id ?? "",
    topic_id: row.topic_id ?? "",
    program_id: row.program_id ?? "",
    certification_id: row.certification_id ?? "",
    aircraft_id: row.aircraft_id ?? "",
    topic_tags: Array.isArray(row.topic_tags) ? row.topic_tags.join(", ") : (row.topic_tags ?? ""),
    refs: Array.isArray(row.refs) ? row.refs.join(", ") : (row.refs ?? ""),
    attachments: Array.isArray(row.attachments) ? row.attachments.join(", ") : (row.attachments ?? ""),
    revision_notes: row.revision_notes ?? "",
    question_source: row.question_source ?? "manual",
    review_status: row.review_status ?? "pending",
    exam_year: row.exam_year ? String(row.exam_year) : "",
    learning_objective: row.learning_objective ?? "",
    question_type: row.question_type ?? "standalone",
    ai_confidence: row.ai_confidence != null ? String(row.ai_confidence) : "",
    ai_distractor_quality: row.ai_distractor_quality != null ? String(row.ai_distractor_quality) : "",
    ai_review_status: row.ai_review_status ?? "",
    ai_generation_model: row.ai_generation_model ?? "",
  };
}

// ── Mini components ───────────────────────────────────────────────────

const INPUT = "rounded-md border border-rule/60 bg-transparent px-2 py-1.5 text-xs w-full focus:outline-none focus:border-rule-strong";
const SEL   = `${INPUT} bg-bg-2 cursor-pointer`;
const LABEL = "block text-[10px] font-mono uppercase tracking-widest text-muted mb-1";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className={LABEL}>{label}</span>
      {children}
    </label>
  );
}

function Section({ title }: { title: string }) {
  return (
    <div className="font-mono text-[9px] uppercase tracking-widest text-muted font-bold border-b border-rule pt-3 pb-1.5 mb-2">
      {title}
    </div>
  );
}

// ── Main editor ───────────────────────────────────────────────────────

export default function QuestionEditor({
  initialQuestion,
  onSaved,
  onCancel,
}: {
  initialQuestion?: any;
  onSaved?: () => void;
  onCancel?: () => void;
} = {}) {
  const isEdit = !!(initialQuestion?.id);
  const [f, setF] = useState<QuestionForm>(initialQuestion ? rowToForm(initialQuestion) : EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [previewMode, setPreviewMode] = useState<PreviewMode>("student");
  const [versions, setVersions] = useState<any[] | null>(null);
  const [versionsLoading, setVersionsLoading] = useState(false);

  // Registry options
  const [subjects, setSubjects] = useState<RegistryOption[]>([]);
  const [modules, setModules] = useState<RegistryOption[]>([]);
  const [topics, setTopics] = useState<RegistryOption[]>([]);
  const [programs, setPrograms] = useState<RegistryOption[]>([]);
  const [certs, setCerts] = useState<RegistryOption[]>([]);
  const [aircraft, setAircraft] = useState<RegistryOption[]>([]);

  // Load registry on mount
  useEffect(() => {
    async function loadRegistry() {
      const [s, m, t, p, c, a] = await Promise.all([
        supabase.from("subjects").select("id,title").order("title"),
        supabase.from("subcategories").select("id,title").order("title"),
        supabase.from("topics").select("id,title").order("title"),
        supabase.from("programs").select("id,title").order("title"),
        supabase.from("certifications").select("id,title").order("title"),
        supabase.from("aircraft").select("id,title").order("title"),
      ]);
      // Deduplicate by id — same entity can appear under multiple parents.
      const dedup = (rows: RegistryOption[]) => [...new Map(rows.map((r) => [r.id, r])).values()];
      setSubjects(dedup(s.data ?? []));
      setModules(dedup(m.data ?? []));
      setTopics(dedup(t.data ?? []));
      setPrograms(dedup(p.data ?? []));
      setCerts(dedup(c.data ?? []));
      setAircraft(dedup(a.data ?? []));
    }
    loadRegistry().catch(() => {});
  }, []);

  // Sync form when initialQuestion prop changes
  useEffect(() => {
    if (initialQuestion) setF(rowToForm(initialQuestion));
    else setF(EMPTY);
    setError(null); setOk(null); setVersions(null);
  }, [initialQuestion?.id]);

  const draft: QuestionDraft = {
    prompt: f.prompt, choices: f.choices, correct: f.correct,
    explanation: f.explanation, difficulty: f.difficulty,
    subjectId: f.subject_id, subcategoryId: f.subcategory_id,
    topicId: f.topic_id, slug: f.id,
  };

  const issues: ValidationIssue[] = useMemo(() => validateQuestion(draft), [JSON.stringify(draft)]);
  const hasErrors = hasBlockingErrors(issues);

  function setChoice(i: number, label: string) {
    const choices = [...f.choices];
    choices[i] = { ...choices[i], label };
    setF({ ...f, choices });
  }

  function upd(patch: Partial<QuestionForm>) { setF((prev) => ({ ...prev, ...patch })); }

  // ── Build row for DB ────────────────────────────────────────────────

  function buildRow(status: string) {
    const id = f.id?.trim() || `q-${normalizedHash((f.prompt || "") + Date.now())}`;
    return {
      id,
      prompt: f.prompt,
      choices: f.choices,
      correct: f.correct,
      explanation: f.explanation,
      difficulty: f.difficulty || "standard",
      bloom_level: f.bloom_level || null,
      time_estimate_sec: Number(f.time_estimate_sec) || null,
      ata: f.ata || null,
      regulation: f.regulation || null,
      authority: f.authority || null,
      subject_id: f.subject_id || null,
      subcategory_id: f.subcategory_id || null,
      topic_id: f.topic_id || null,
      program_id: f.program_id || null,
      certification_id: f.certification_id || null,
      aircraft_id: f.aircraft_id || null,
      topic_tags: f.topic_tags ? f.topic_tags.split(",").map((t) => t.trim()).filter(Boolean) : [],
      refs: f.refs ? f.refs.split(",").map((t) => t.trim()).filter(Boolean) : [],
      attachments: f.attachments ? f.attachments.split(",").map((t) => t.trim()).filter(Boolean) : [],
      revision_notes: f.revision_notes || null,
      question_source: f.question_source || "manual",
      review_status: f.review_status || "pending",
      exam_year: f.exam_year ? Number(f.exam_year) : null,
      learning_objective: f.learning_objective || null,
      question_type: f.question_type || "standalone",
      ai_confidence: f.ai_confidence ? Number(f.ai_confidence) : null,
      ai_distractor_quality: f.ai_distractor_quality ? Number(f.ai_distractor_quality) : null,
      ai_review_status: f.ai_review_status || null,
      ai_generation_model: f.ai_generation_model || null,
      dedupe_hash: normalizedHash(f.prompt || ""),
      status,
    };
  }

  // ── Save ────────────────────────────────────────────────────────────

  async function save(targetStatus: string) {
    if (saving) return;
    if (targetStatus === "published" && hasErrors) {
      setError("Fix validation errors before publishing."); return;
    }
    setSaving(true); setError(null); setOk(null);
    try {
      const row = buildRow(targetStatus);
      const { error: e } = await supabase.from("questions").upsert(row);
      if (e) throw e;
      try { await saveVersion("question", row.id, row, f.revision_notes || `${targetStatus} save`); }
      catch { /* version best-effort */ }
      setOk(`${targetStatus === "published" ? "Published" : "Saved draft"}: ${row.id}`);
      upd({ id: row.id });
      onSaved?.();
    } catch (e: any) {
      setError(e?.message ?? "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  async function archive() {
    if (saving || !f.id) return;
    setSaving(true); setError(null);
    try {
      const { error } = await supabase.from("questions").update({ status: "archived" }).eq("id", f.id);
      if (error) throw error;
      setOk("Archived.");
      onSaved?.();
    } catch (e: any) { setError(e?.message ?? "Archive failed."); }
    finally { setSaving(false); }
  }

  // ── Version history ─────────────────────────────────────────────────

  async function loadVersions() {
    if (!f.id) return;
    setVersionsLoading(true);
    try { setVersions(await listVersions("question", f.id)); }
    catch (e: any) { setError(e?.message ?? "Failed to load versions."); }
    finally { setVersionsLoading(false); }
  }

  async function doRollback(versionId: number) {
    if (!f.id) return;
    try {
      await rollbackToVersion("question", f.id, versionId);
      const { data } = await supabase.from("questions").select("*").eq("id", f.id).single();
      if (data) setF(rowToForm(data));
      setVersions(null);
      setOk("Rolled back.");
    } catch (e: any) { setError(e?.message ?? "Rollback failed."); }
  }

  // ── Image preview check ──────────────────────────────────────────────

  const attachmentUrls = f.attachments
    ? f.attachments.split(",").map((u) => u.trim()).filter((u) => u.startsWith("http"))
    : [];

  // ── Render ───────────────────────────────────────────────────────────

  return (
    <div className="grid lg:grid-cols-[1fr_400px] gap-6 font-sans text-ink">
      {/* ── LEFT: Form ── */}
      <div className="space-y-3 bg-paper border border-rule rounded-2xl p-5 shadow-sm">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-base font-semibold">
            {isEdit ? `Edit question: ${f.id}` : "New question"}
          </h2>
          {onCancel && (
            <button onClick={onCancel} className="text-xs text-muted hover:text-ink">← Cancel</button>
          )}
        </div>

        {error && <div className="text-rose-600 text-xs p-2 bg-rose-50 rounded-lg border border-rose-200">{error}</div>}
        {ok && <div className="text-emerald-700 text-xs p-2 bg-mint/10 rounded-lg border border-mint/30">{ok}</div>}

        <Section title="1. Identity" />
        <div className="grid grid-cols-2 gap-2">
          <Field label="Question ID">
            <input className={INPUT} value={f.id} onChange={(e) => upd({ id: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") })} placeholder="q-ata-21-001" />
          </Field>
          <Field label="Question type">
            <select className={SEL} value={f.question_type} onChange={(e) => upd({ question_type: e.target.value })}>
              <option value="standalone">Standalone</option>
              <option value="scenario">Scenario</option>
              <option value="passage">Passage</option>
              <option value="image">Image</option>
              <option value="case_study">Case Study</option>
            </select>
          </Field>
        </div>

        <Section title="2. Classification" />
        <div className="grid grid-cols-2 gap-2">
          <Field label="Program">
            <select className={SEL} value={f.program_id} onChange={(e) => upd({ program_id: e.target.value })}>
              <option value="">— none —</option>
              {programs.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
            </select>
          </Field>
          <Field label="Certification">
            <select className={SEL} value={f.certification_id} onChange={(e) => upd({ certification_id: e.target.value })}>
              <option value="">— none —</option>
              {certs.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
            </select>
          </Field>
          <Field label="Aircraft">
            <select className={SEL} value={f.aircraft_id} onChange={(e) => upd({ aircraft_id: e.target.value })}>
              <option value="">— none —</option>
              {aircraft.map((a) => <option key={a.id} value={a.id}>{a.title}</option>)}
            </select>
          </Field>
          <Field label="Subject">
            <select className={SEL} value={f.subject_id} onChange={(e) => upd({ subject_id: e.target.value, subcategory_id: "", topic_id: "" })}>
              <option value="">— none —</option>
              {subjects.map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}
            </select>
          </Field>
          <Field label="Module (subcategory)">
            <select className={SEL} value={f.subcategory_id} onChange={(e) => upd({ subcategory_id: e.target.value })}>
              <option value="">— none —</option>
              {modules.map((m) => <option key={m.id} value={m.id}>{m.title}</option>)}
            </select>
          </Field>
          <Field label="Topic">
            <select className={SEL} value={f.topic_id} onChange={(e) => upd({ topic_id: e.target.value })}>
              <option value="">— none —</option>
              {topics.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
            </select>
          </Field>
          <Field label="Authority">
            <input className={INPUT} value={f.authority} onChange={(e) => upd({ authority: e.target.value })} placeholder="DGCA / EASA / FAA" />
          </Field>
          <Field label="ATA chapter">
            <input className={INPUT} value={f.ata} onChange={(e) => upd({ ata: e.target.value })} placeholder="ATA-34" />
          </Field>
          <Field label="Difficulty">
            <select className={SEL} value={f.difficulty} onChange={(e) => upd({ difficulty: e.target.value })}>
              <option value="standard">Standard</option>
              <option value="complex">Complex</option>
              <option value="extreme">Extreme</option>
            </select>
          </Field>
          <Field label="Bloom level">
            <input className={INPUT} value={f.bloom_level} onChange={(e) => upd({ bloom_level: e.target.value })} placeholder="recall / apply / analyse" />
          </Field>
          <Field label="Question source">
            <select className={SEL} value={f.question_source} onChange={(e) => upd({ question_source: e.target.value })}>
              <option value="manual">Manual</option>
              <option value="csv">CSV import</option>
              <option value="json">JSON import</option>
              <option value="ai">AI generated</option>
            </select>
          </Field>
          <Field label="Exam year">
            <input className={INPUT} type="number" value={f.exam_year} onChange={(e) => upd({ exam_year: e.target.value })} placeholder="2024" />
          </Field>
        </div>

        <Section title="3. Question content" />
        <Field label="Prompt">
          <textarea className={`${INPUT} resize-y`} rows={3} value={f.prompt} onChange={(e) => upd({ prompt: e.target.value })} />
        </Field>

        <div className="space-y-2">
          {f.choices.map((c, i) => (
            <div key={c.id} className="flex items-center gap-2">
              <input type="radio" name="correct" checked={f.correct === c.id} onChange={() => upd({ correct: c.id })} />
              <span className="font-mono text-[10px] opacity-60 w-4">{c.id})</span>
              <input className={INPUT} value={c.label} onChange={(e) => setChoice(i, e.target.value)} placeholder={`Option ${c.id}`} />
            </div>
          ))}
        </div>

        <Field label="Explanation">
          <textarea className={`${INPUT} resize-y`} rows={2} value={f.explanation} onChange={(e) => upd({ explanation: e.target.value })} />
        </Field>

        <Field label="Learning objective">
          <input className={INPUT} value={f.learning_objective} onChange={(e) => upd({ learning_objective: e.target.value })} placeholder="Student can identify…" />
        </Field>

        <Section title="4. Metadata" />
        <div className="grid grid-cols-2 gap-2">
          <Field label="Tags (csv)">
            <input className={INPUT} value={f.topic_tags} onChange={(e) => upd({ topic_tags: e.target.value })} />
          </Field>
          <Field label="References (csv)">
            <input className={INPUT} value={f.refs} onChange={(e) => upd({ refs: e.target.value })} />
          </Field>
          <Field label="Attachments / image URLs (csv)">
            <input className={INPUT} value={f.attachments} onChange={(e) => upd({ attachments: e.target.value })} placeholder="https://…" />
          </Field>
          <Field label="Regulation">
            <input className={INPUT} value={f.regulation} onChange={(e) => upd({ regulation: e.target.value })} />
          </Field>
          <Field label="Est. time (sec)">
            <input className={INPUT} type="number" value={f.time_estimate_sec} onChange={(e) => upd({ time_estimate_sec: Number(e.target.value) })} />
          </Field>
          <Field label="Review status">
            <select className={SEL} value={f.review_status} onChange={(e) => upd({ review_status: e.target.value })}>
              <option value="pending">Pending</option>
              <option value="in_review">In review</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
          </Field>
          <Field label="Revision notes">
            <input className={INPUT} value={f.revision_notes} onChange={(e) => upd({ revision_notes: e.target.value })} />
          </Field>
        </div>

        <Section title="5. AI metadata (reserved)" />
        <div className="grid grid-cols-2 gap-2 opacity-70">
          <Field label="AI confidence (0–1)">
            <input className={INPUT} type="number" min="0" max="1" step="0.01" value={f.ai_confidence} onChange={(e) => upd({ ai_confidence: e.target.value })} placeholder="0.95" />
          </Field>
          <Field label="Distractor quality (0–1)">
            <input className={INPUT} type="number" min="0" max="1" step="0.01" value={f.ai_distractor_quality} onChange={(e) => upd({ ai_distractor_quality: e.target.value })} placeholder="0.80" />
          </Field>
          <Field label="AI review status">
            <select className={SEL} value={f.ai_review_status} onChange={(e) => upd({ ai_review_status: e.target.value })}>
              <option value="">— none —</option>
              <option value="auto_approved">Auto-approved</option>
              <option value="needs_human">Needs human review</option>
              <option value="rejected">Rejected</option>
            </select>
          </Field>
          <Field label="Generation model">
            <input className={INPUT} value={f.ai_generation_model} onChange={(e) => upd({ ai_generation_model: e.target.value })} placeholder="claude-opus-4" />
          </Field>
        </div>
        <p className="text-[10px] font-mono text-muted italic">AI fields reserved — no AI integration in Phase 7.</p>

        {/* Image preview */}
        {attachmentUrls.length > 0 && (
          <div>
            <span className={LABEL}>Image preview</span>
            <div className="flex flex-wrap gap-2">
              {attachmentUrls.map((url) => (
                <img key={url} src={url} alt="" className="max-w-[200px] max-h-[120px] rounded-lg border border-rule object-contain bg-bg-2" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
              ))}
            </div>
          </div>
        )}

        {/* Version history */}
        {isEdit && (
          <div>
            <div className="flex items-center gap-2 pt-2">
              <span className={LABEL}>Version history</span>
              <button
                onClick={loadVersions}
                disabled={versionsLoading}
                className="text-[10px] font-mono text-blue-600 hover:underline ml-auto"
              >
                {versionsLoading ? "Loading…" : versions === null ? "Load" : "Refresh"}
              </button>
            </div>
            {versions !== null && (
              <ul className="space-y-1 mt-1">
                {versions.slice(0, 8).map((v) => (
                  <li key={v.id} className="flex items-center gap-2 text-xs border-b border-rule/30 pb-1">
                    <span className="font-mono text-[10px] text-muted">v{v.version}</span>
                    <span className="text-muted text-[10px] truncate flex-1">{v.reason ?? "—"}</span>
                    <button onClick={() => doRollback(v.id)} className="text-[10px] text-blue-600 hover:underline shrink-0">rollback</button>
                  </li>
                ))}
                {versions.length === 0 && <li className="text-xs text-muted">No revisions yet.</li>}
              </ul>
            )}
          </div>
        )}

        {/* Publish workflow */}
        <div className="flex flex-wrap gap-2 pt-4 border-t border-rule">
          <button
            onClick={() => save("draft")}
            disabled={saving}
            className="px-3 py-2 text-xs border border-rule rounded-lg hover:bg-bg-2 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save draft"}
          </button>
          <button
            onClick={() => save("published")}
            disabled={saving || hasErrors}
            title={hasErrors ? "Fix validation errors to publish" : "Publish"}
            className="px-3 py-2 text-xs bg-ink text-bg rounded-lg disabled:opacity-40"
          >
            Publish
          </button>
          {isEdit && (
            <button
              onClick={archive}
              disabled={saving}
              className="px-3 py-2 text-xs border border-rose-200 text-rose-600 hover:bg-rose-50 rounded-lg disabled:opacity-50 ml-auto"
            >
              Archive
            </button>
          )}
        </div>
      </div>

      {/* ── RIGHT: Preview + Validation ── */}
      <div className="space-y-4">
        {/* Preview mode switcher */}
        <div className="flex gap-1 bg-bg-2 border border-rule rounded-xl p-1">
          {(["student", "mobile", "exam", "review"] as PreviewMode[]).map((m) => (
            <button
              key={m}
              onClick={() => setPreviewMode(m)}
              className={`flex-1 text-[10px] font-mono uppercase py-1.5 rounded-lg capitalize transition-colors ${
                previewMode === m ? "bg-ink text-bg" : "text-muted hover:text-ink"
              }`}
            >
              {m}
            </button>
          ))}
        </div>

        <div className={previewMode === "mobile" ? "max-w-[375px] mx-auto" : ""}>
          <ContentPreview q={draft} mode={previewMode} />
        </div>

        {/* Validation panel */}
        <div className="rounded-xl border border-rule p-3 bg-paper shadow-sm">
          <div className="text-xs font-semibold mb-2 flex items-center gap-2">
            Validation
            <span className={hasErrors ? "text-rose-600" : "text-emerald-600"}>
              {hasErrors ? "❌ Errors — publish blocked" : "✅ Ready to publish"}
            </span>
          </div>
          {issues.length === 0 ? (
            <p className="text-xs text-emerald-600">No issues.</p>
          ) : (
            <ul className="space-y-1 text-xs">
              {issues.map((i, k) => (
                <li key={k} className={i.level === "error" ? "text-rose-600" : "text-amber-600"}>
                  {i.level === "error" ? "⛔" : "⚠️"} <b>{i.field}</b>: {i.message}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
