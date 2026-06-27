// Phase 4 — Admin Content Import Engine. Staged pipeline admin UI.
// Hidden behind `contentImport` flag (OFF). Admin-only; no nav link;
// no student-facing effect. Reuses Phase 4 importService + parsers.

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Download,
  FileJson,
  FileSpreadsheet,
  FileText,
  History,
  Loader2,
  Upload,
  X,
  XCircle,
} from "lucide-react";
import { Button } from "../../components/Atoms";
import { useFeatureFlags } from "../../hooks/useFeatureFlags";
import { detectType, isParserAvailable } from "../../lib/import/parsers";
import type { ImportType } from "../../lib/import/parsers";
import {
  cancelSession,
  commitSession,
  createSession,
  downloadReport,
  failSession,
  listSessions,
  runPipeline,
} from "../../lib/import/importService";
import type { ImportSession, SessionStatus } from "../../lib/import/importService";

// ── Types ──────────────────────────────────────────────────────────────

type Tab = "upload" | "history";

type UploadPhase =
  | "idle"
  | "reading"
  | "processing"
  | "preview"
  | "importing"
  | "done"
  | "error";

interface UploadState {
  phase: UploadPhase;
  sessionId: string | null;
  fileName: string;
  fileType: ImportType | null;
  progress: number; // 0..100
  statusMsg: string;
  preview: Record<string, unknown> | null;
  error: string | null;
  result: { committed: number; skipped: number } | null;
}

const INITIAL: UploadState = {
  phase: "idle",
  sessionId: null,
  fileName: "",
  fileType: null,
  progress: 0,
  statusMsg: "",
  preview: null,
  error: null,
  result: null,
};

// ── Helpers ───────────────────────────────────────────────────────────

function statusColor(s: SessionStatus): string {
  if (s === "completed") return "text-emerald-700 bg-mint/10 border-mint/30";
  if (s === "failed" || s === "cancelled") return "text-rose-700 bg-rose-50 border-rose-200";
  if (s === "preview") return "text-amber-700 bg-amber-50 border-amber-200";
  return "text-blue-700 bg-blue-50 border-blue-200";
}

function typeIcon(t: ImportType) {
  if (t === "csv") return <FileSpreadsheet size={14} className="shrink-0" />;
  if (t === "json") return <FileJson size={14} className="shrink-0" />;
  return <FileText size={14} className="shrink-0" />;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" });
}

// ── Subcomponents ─────────────────────────────────────────────────────

function ProgressBar({ pct, label }: { pct: number; label: string }) {
  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center text-[11px] font-mono text-muted">
        <span>{label}</span>
        <span>{pct}%</span>
      </div>
      <div className="h-2 rounded-full bg-bg-2 overflow-hidden">
        <div
          className="h-full bg-ink transition-all duration-150 rounded-full"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function StatCard({ label, value, accent }: { label: string; value: number; accent?: string }) {
  return (
    <div className={`border rounded-lg p-3 text-center ${accent ?? "border-rule bg-paper"}`}>
      <div className="text-2xl font-mono font-bold text-ink">{value.toLocaleString()}</div>
      <div className="font-mono text-[9px] uppercase tracking-widest text-muted mt-1">{label}</div>
    </div>
  );
}

function PreviewTable({ rows }: { rows: unknown[] }) {
  if (!rows.length) return null;
  return (
    <div className="overflow-auto max-h-80 rounded-xl border border-rule">
      <table className="w-full text-xs font-sans border-collapse">
        <thead className="sticky top-0 bg-bg-2/90 backdrop-blur-sm">
          <tr className="border-b border-rule">
            <th className="py-2 px-3 text-left font-mono text-[9px] uppercase tracking-wide text-muted">Row</th>
            <th className="py-2 px-3 text-left font-mono text-[9px] uppercase tracking-wide text-muted">Prompt</th>
            <th className="py-2 px-3 text-left font-mono text-[9px] uppercase tracking-wide text-muted">Cert</th>
            <th className="py-2 px-3 text-left font-mono text-[9px] uppercase tracking-wide text-muted">Diff</th>
            <th className="py-2 px-3 text-center font-mono text-[9px] uppercase tracking-wide text-muted">Status</th>
          </tr>
        </thead>
        <tbody>
          {(rows as Record<string, unknown>[]).map((r, i) => {
            const n = (r.normalized ?? {}) as Record<string, unknown>;
            const status = r.status as string;
            const issues = (r.issues ?? []) as unknown[];
            return (
              <tr key={i} className={`border-b border-rule/50 hover:bg-bg-2/30 ${status === "invalid" ? "bg-rose-50/20" : status === "duplicate" ? "bg-amber-50/10" : ""}`}>
                <td className="py-2 px-3 font-mono text-[10px] text-muted">{(r.rowIndex as number ?? i) + 1}</td>
                <td className="py-2 px-3 max-w-[280px] truncate text-ink" title={String(n.prompt ?? "")}>
                  {String(n.prompt ?? "").slice(0, 80)}{String(n.prompt ?? "").length > 80 ? "…" : ""}
                </td>
                <td className="py-2 px-3 font-mono text-[10px] text-muted truncate">{String(n.certificationId ?? "—")}</td>
                <td className="py-2 px-3 font-mono text-[10px] text-muted">{String(n.difficulty ?? "std")}</td>
                <td className="py-2 px-3 text-center">
                  {status === "valid" && <span className="inline-flex items-center gap-1 text-emerald-700 bg-mint/10 border border-mint/30 text-[8px] font-bold font-mono px-2 py-0.5 rounded-full uppercase"><CheckCircle2 size={8} />ok</span>}
                  {status === "invalid" && (
                    <span className="inline-flex items-center gap-1 text-rose-700 bg-rose-50 border border-rose-200 text-[8px] font-bold font-mono px-2 py-0.5 rounded-full uppercase" title={(issues as { message: string }[]).map(e => e.message).join("; ")}>
                      <XCircle size={8} />{issues.length}err
                    </span>
                  )}
                  {status === "duplicate" && <span className="inline-flex items-center gap-1 text-amber-700 bg-amber-50 border border-amber-200 text-[8px] font-bold font-mono px-2 py-0.5 rounded-full uppercase"><AlertTriangle size={8} />dup</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── History Tab ───────────────────────────────────────────────────────

function HistoryTab() {
  const [sessions, setSessions] = useState<ImportSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    listSessions()
      .then(setSessions)
      .catch((e) => setErr(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center h-40">
      <Loader2 size={20} className="animate-spin text-muted" />
    </div>
  );
  if (err) return <div className="p-4 text-rose-600 text-sm">{err}</div>;
  if (!sessions.length) return (
    <div className="flex flex-col items-center justify-center h-40 text-muted">
      <History size={28} className="mb-2" />
      <p className="font-mono text-[10px] uppercase tracking-widest">No import sessions yet</p>
    </div>
  );

  return (
    <div className="overflow-auto rounded-xl border border-rule">
      <table className="w-full text-xs font-sans border-collapse">
        <thead className="sticky top-0 bg-bg-2/90 backdrop-blur-sm">
          <tr className="border-b border-rule">
            {["File", "Type", "Status", "Total", "Valid", "Invalid", "Dup", "Imported", "Started", "Actions"].map((h) => (
              <th key={h} className="py-2.5 px-3 text-left font-mono text-[9px] uppercase tracking-wide text-muted whitespace-nowrap">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sessions.map((s) => {
            const st = s.statistics;
            return (
              <tr key={s.id} className="border-b border-rule/50 hover:bg-bg-2/20">
                <td className="py-2 px-3 max-w-[140px] truncate text-ink font-medium" title={s.fileName}>{s.fileName}</td>
                <td className="py-2 px-3">
                  <span className="inline-flex items-center gap-1 font-mono text-[10px] text-muted">{typeIcon(s.importType)}{s.importType}</span>
                </td>
                <td className="py-2 px-3">
                  <span className={`text-[8px] font-bold font-mono px-2 py-0.5 rounded-full border uppercase ${statusColor(s.status)}`}>{s.status}</span>
                </td>
                <td className="py-2 px-3 font-mono text-[10px] text-muted">{st.total ?? "—"}</td>
                <td className="py-2 px-3 font-mono text-[10px] text-emerald-700">{st.valid ?? "—"}</td>
                <td className="py-2 px-3 font-mono text-[10px] text-rose-600">{st.invalid ?? "—"}</td>
                <td className="py-2 px-3 font-mono text-[10px] text-amber-600">{st.duplicates ?? "—"}</td>
                <td className="py-2 px-3 font-mono text-[10px] text-blue-600">{st.imported ?? "—"}</td>
                <td className="py-2 px-3 font-mono text-[10px] text-muted whitespace-nowrap">{fmtDate(s.startedAt)}</td>
                <td className="py-2 px-3">
                  <div className="flex gap-1">
                    <button
                      onClick={() => downloadReport(s)}
                      className="p-1 rounded hover:bg-bg-2 text-muted hover:text-ink transition-colors"
                      title="Download validation report"
                    >
                      <Download size={12} />
                    </button>
                    {(s.status === "preview" || s.status === "failed") && (
                      <button
                        onClick={async () => { await cancelSession(s.id); setSessions((ss) => ss.map((x) => x.id === s.id ? { ...x, status: "cancelled" } : x)); }}
                        className="p-1 rounded hover:bg-rose-50 text-muted hover:text-rose-600 transition-colors"
                        title="Cancel"
                      >
                        <X size={12} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── Main View ─────────────────────────────────────────────────────────

export default function ContentImportView() {
  const { flags } = useFeatureFlags();
  const enabled = !!flags.contentImport;

  const [tab, setTab] = useState<Tab>("upload");
  const [state, setState] = useState<UploadState>(INITIAL);
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef(false);

  const setPhase = useCallback((phase: UploadPhase, extra?: Partial<UploadState>) =>
    setState((s) => ({ ...s, phase, ...extra })), []);

  // ── File processing pipeline ────────────────────────────────────────

  async function processFile(file: File) {
    abortRef.current = false;
    const detectedType = detectType(file.name);
    if (!detectedType) {
      setPhase("error", { error: `Unknown file type: "${file.name}". Use CSV or JSON.` });
      return;
    }
    if (!isParserAvailable(detectedType)) {
      setPhase("error", { error: `Parser for "${detectedType}" is not available yet. Use CSV or JSON.` });
      return;
    }

    setPhase("reading", { fileName: file.name, fileType: detectedType, statusMsg: "Reading file…" });

    let text: string;
    try {
      text = await file.text();
    } catch (e: unknown) {
      setPhase("error", { error: `Failed to read file: ${(e as Error).message}` });
      return;
    }

    let sessionId: string;
    try {
      sessionId = await createSession(detectedType, file.name);
    } catch (e: unknown) {
      setPhase("error", { error: `Failed to create session: ${(e as Error).message}` });
      return;
    }

    setState((s) => ({ ...s, sessionId, phase: "processing", statusMsg: "Parsing and validating…", progress: 0 }));

    try {
      const preview = await runPipeline(sessionId, text, detectedType, (n, total) => {
        if (abortRef.current) throw new Error("Cancelled.");
        setState((s) => ({ ...s, progress: Math.round((n / total) * 100), statusMsg: `Processed ${n.toLocaleString()} / ${total.toLocaleString()} rows…` }));
      });

      setPhase("preview", {
        preview,
        statusMsg: "",
        progress: 100,
      });
    } catch (e: unknown) {
      if (abortRef.current) {
        await cancelSession(sessionId).catch(() => {});
        setPhase("idle", { ...INITIAL });
      } else {
        await failSession(sessionId, (e as Error).message).catch(() => {});
        setPhase("error", { error: (e as Error).message });
      }
    }
  }

  async function handleCommit() {
    if (!state.sessionId) return;
    setPhase("importing", { statusMsg: "Committing questions as drafts…", progress: 0 });
    try {
      const result = await commitSession(state.sessionId, (n, total) => {
        setState((s) => ({ ...s, progress: Math.round((n / total) * 100), statusMsg: `Committed ${n.toLocaleString()} / ${total.toLocaleString()}…` }));
      });
      setPhase("done", { result, statusMsg: "" });
    } catch (e: unknown) {
      await failSession(state.sessionId, (e as Error).message).catch(() => {});
      setPhase("error", { error: (e as Error).message });
    }
  }

  async function handleCancel() {
    abortRef.current = true;
    if (state.sessionId && (state.phase === "preview" || state.phase === "importing")) {
      await cancelSession(state.sessionId).catch(() => {});
    }
    setState(INITIAL);
  }

  // ── Drop zone ───────────────────────────────────────────────────────

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) processFile(f);
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) processFile(f);
    e.target.value = "";
  }

  // ── Render ──────────────────────────────────────────────────────────

  if (!enabled) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-muted">
        <AlertCircle size={28} className="mb-3" />
        <p className="font-mono text-[10px] uppercase tracking-widest">Content Import Engine is not enabled.</p>
        <p className="font-sans text-xs text-muted mt-1">Enable the <strong>contentImport</strong> flag in Admin → Features.</p>
      </div>
    );
  }

  const preview = state.preview as Record<string, unknown> | null;

  return (
    <div className="space-y-6 max-w-7xl mx-auto py-2 font-sans text-ink">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-rule pb-6">
        <div>
          <div className="font-mono text-[9px] tracking-widest text-[#00a3ff] uppercase mb-1 font-semibold">Content Foundation · Phase 4</div>
          <h1 className="font-serif text-3xl font-medium tracking-tight text-ink">Content Import Engine</h1>
          <p className="text-xs text-muted mt-1">Staged import pipeline — all questions land as <strong>Draft</strong>. Nothing published automatically.</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-rule">
        {(["upload", "history"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-xs font-mono font-semibold uppercase tracking-wider transition-colors border-b-2 -mb-px ${tab === t ? "border-ink text-ink" : "border-transparent text-muted hover:text-ink"}`}
          >
            {t === "upload" ? <><Upload size={11} className="inline mr-1.5" />Upload</> : <><History size={11} className="inline mr-1.5" />History</>}
          </button>
        ))}
      </div>

      {/* Upload tab */}
      {tab === "upload" && (
        <div className="space-y-6">
          {/* Drop zone (only in idle/error) */}
          {(state.phase === "idle" || state.phase === "error") && (
            <>
              <div
                role="button"
                tabIndex={0}
                aria-label="Upload file for import"
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); fileRef.current?.click(); } }}
                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={onDrop}
                onClick={() => fileRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-8 bg-paper cursor-pointer transition-colors text-center flex flex-col justify-center items-center h-52 select-none ${dragging ? "border-ink bg-bg-2" : "border-rule hover:border-ink"}`}
              >
                <input ref={fileRef} type="file" accept=".csv,.json" className="hidden" onChange={onFileChange} />
                <div className="w-14 h-14 rounded-full bg-ink/5 text-muted-2 flex items-center justify-center mb-4">
                  <FileSpreadsheet size={24} />
                </div>
                <p className="font-sans font-semibold text-xs text-ink">Drag and drop a CSV or JSON file here</p>
                <p className="font-mono text-[9px] text-muted-2 uppercase mt-1 tracking-widest">or click to browse · CSV and JSON supported</p>
              </div>

              {state.phase === "error" && state.error && (
                <div className="p-4 bg-rose-500/10 border border-rose-500/30 text-rose-800 rounded-lg text-xs flex items-center gap-3">
                  <AlertCircle size={16} className="shrink-0" />
                  <span>{state.error}</span>
                </div>
              )}
            </>
          )}

          {/* Processing + reading */}
          {(state.phase === "reading" || state.phase === "processing") && (
            <div className="bg-paper border border-rule rounded-2xl p-8 space-y-6">
              <div className="flex items-center gap-3">
                <Loader2 size={18} className="animate-spin text-muted" />
                <div>
                  <p className="font-semibold text-sm text-ink">{state.fileName}</p>
                  <p className="text-xs text-muted mt-0.5">{state.statusMsg}</p>
                </div>
              </div>
              {state.phase === "processing" && <ProgressBar pct={state.progress} label="Normalizing & validating…" />}
              <Button variant="ghost" onClick={handleCancel} className="text-xs text-rose-600 border border-rose-200 hover:bg-rose-50 px-3 py-1.5 rounded-lg">
                <X size={12} className="inline mr-1" />Cancel
              </Button>
            </div>
          )}

          {/* Preview */}
          {state.phase === "preview" && preview && (
            <div className="space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="font-mono text-[10px] uppercase tracking-widest text-muted mb-1">Import Preview</div>
                  <h2 className="font-serif text-xl font-medium text-ink">{state.fileName}</h2>
                </div>
                <div className="flex gap-2">
                  <Button variant="ghost" onClick={handleCancel} className="text-xs border border-rule hover:bg-bg-2 px-3 py-1.5 rounded-lg">
                    <X size={12} className="inline mr-1" />Cancel
                  </Button>
                  <Button
                    variant="primary"
                    onClick={handleCommit}
                    disabled={(preview.valid as number) === 0}
                    className="text-xs px-4 py-1.5 rounded-lg gap-1.5 flex items-center"
                  >
                    <Upload size={12} />Import {((preview.valid as number) ?? 0).toLocaleString()} Valid as Draft
                  </Button>
                </div>
              </div>

              {/* Stats grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                <StatCard label="Total" value={preview.total as number ?? 0} />
                <StatCard label="Valid" value={preview.valid as number ?? 0} accent="border-mint/30 bg-mint/5" />
                <StatCard label="Invalid" value={preview.invalid as number ?? 0} accent="border-rose-200 bg-rose-50" />
                <StatCard label="Duplicates" value={preview.duplicates as number ?? 0} accent="border-amber-200 bg-amber-50" />
                <StatCard label="Warnings" value={preview.warnings as number ?? 0} />
                <StatCard label="Errors" value={preview.errors as number ?? 0} accent={(preview.errors as number ?? 0) > 0 ? "border-rose-200 bg-rose-50" : undefined} />
              </div>

              {/* Coverage chips */}
              {(["certifications", "programs", "aircraft", "subjects", "topics"] as const).map((key) => {
                const items = (preview[key] as string[]) ?? [];
                if (!items.length) return null;
                return (
                  <div key={key} className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-[9px] uppercase tracking-widest text-muted w-20 shrink-0">{key}</span>
                    {items.slice(0, 8).map((v) => (
                      <span key={v} className="text-[10px] font-mono bg-bg-2 border border-rule px-2 py-0.5 rounded-full text-ink">{v}</span>
                    ))}
                    {items.length > 8 && <span className="text-[10px] text-muted font-mono">+{items.length - 8} more</span>}
                  </div>
                );
              })}

              {/* First 20 rows */}
              <div>
                <div className="font-mono text-[10px] uppercase tracking-widest text-muted mb-2">First 20 questions</div>
                <PreviewTable rows={(preview.first20 as unknown[]) ?? []} />
              </div>
            </div>
          )}

          {/* Importing */}
          {state.phase === "importing" && (
            <div className="bg-paper border border-rule rounded-2xl p-8 space-y-6">
              <div className="flex items-center gap-3">
                <Loader2 size={18} className="animate-spin text-muted" />
                <div>
                  <p className="font-semibold text-sm text-ink">Committing questions…</p>
                  <p className="text-xs text-muted mt-0.5">{state.statusMsg}</p>
                </div>
              </div>
              <ProgressBar pct={state.progress} label="Writing to draft questions table…" />
            </div>
          )}

          {/* Done */}
          {state.phase === "done" && state.result && (
            <div className="bg-paper border border-mint/30 rounded-2xl p-8 space-y-4">
              <div className="flex items-center gap-3">
                <CheckCircle2 size={24} className="text-emerald-600 shrink-0" />
                <div>
                  <p className="font-semibold text-sm text-ink">Import complete</p>
                  <p className="text-xs text-muted mt-0.5">
                    {state.result.committed.toLocaleString()} questions imported as <strong>Draft</strong>
                    {state.result.skipped > 0 && ` · ${state.result.skipped} skipped due to errors`}
                  </p>
                </div>
              </div>
              <Button variant="ghost" onClick={() => { setState(INITIAL); setTab("history"); }} className="text-xs border border-rule hover:bg-bg-2 px-3 py-1.5 rounded-lg">
                <History size={12} className="inline mr-1" />View in History
              </Button>
            </div>
          )}

          {/* Format guide */}
          {state.phase === "idle" && (
            <div className="bg-bg-2/40 border border-rule rounded-xl p-5 space-y-3">
              <div className="font-mono text-[10px] uppercase tracking-widest text-muted">Supported formats &amp; required columns</div>
              <div className="grid sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <div className="flex items-center gap-1.5 font-semibold text-ink mb-1"><FileSpreadsheet size={13} />CSV / TSV</div>
                  <p className="text-muted font-mono text-[10px] leading-relaxed">
                    prompt, option_a, option_b, option_c, option_d, correct (a/b/c/d), explanation<br />
                    Optional: certification, aircraft, subject, module, topic, difficulty, tags, references, ata
                  </p>
                </div>
                <div>
                  <div className="flex items-center gap-1.5 font-semibold text-ink mb-1"><FileJson size={13} />JSON</div>
                  <p className="text-muted font-mono text-[10px] leading-relaxed">
                    Array of objects or <code>{"{ questions: [...] }"}</code><br />
                    Same field names as CSV (camelCase or snake_case both work)
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-2 text-[10px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                <AlertTriangle size={12} className="mt-0.5 shrink-0" />
                <span>All questions import as <strong>Draft</strong>. Review in CMS before publishing. Duplicates are flagged but never auto-deleted.</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* History tab */}
      {tab === "history" && <HistoryTab />}
    </div>
  );
}
