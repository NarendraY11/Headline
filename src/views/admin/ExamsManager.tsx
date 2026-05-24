import React, { useState, useEffect } from "react";
import { Button } from "../../components/Atoms";
import { Plus, Edit2, Trash2, Save, X, AlertCircle, Eye, EyeOff, CheckCircle2, Award } from "lucide-react";
import { trackEvent } from "../../lib/track";
import { fetchExams, saveExam, deleteExam, fetchPublishedSubjects, ExamInfo } from "../../lib/content";

const slugify = (text: string) => {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/^-+|-+$/g, "");
};

export default function ExamsManager() {
  const [exams, setExams] = useState<ExamInfo[]>([]);
  const [subjectsList, setSubjectsList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isNew, setIsNew] = useState(false);
  const [currentExam, setCurrentExam] = useState<Partial<ExamInfo>>({
    id: "",
    authority: "DGCA",
    license: "CPL",
    title: "",
    pass_mark: 70,
    question_count: 50,
    duration_min: 60,
    negative_marking: false,
    subject_ids: [],
    status: "draft",
  });

  const [errorStatus, setErrorStatus] = useState("");
  const [successStatus, setSuccessStatus] = useState("");

  const loadData = async () => {
    setLoading(true);
    setErrorStatus("");
    try {
      const [allExams, listSubjects] = await Promise.all([
        fetchExams(),
        fetchPublishedSubjects(),
      ]);
      setExams(allExams);
      setSubjectsList(listSubjects);
    } catch (err: any) {
      console.error("Error loaded exams telemetry:", err);
      setErrorStatus(err.message || "Failed to sync exams from database.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const openNewModal = () => {
    setIsNew(true);
    setCurrentExam({
      id: "",
      authority: "DGCA",
      license: "CPL",
      title: "",
      pass_mark: 70,
      question_count: 50,
      duration_min: 60,
      negative_marking: false,
      subject_ids: [],
      status: "draft",
    });
    setErrorStatus("");
    setIsEditing(true);
  };

  const openEditModal = (exam: ExamInfo) => {
    setIsNew(false);
    setCurrentExam(exam);
    setErrorStatus("");
    setIsEditing(true);
  };

  const handleTitleChange = (title: string) => {
    setCurrentExam((prev) => {
      const next = { ...prev, title };
      if (isNew) {
        next.id = slugify(title);
      }
      return next;
    });
  };

  const handleSubjectToggle = (subjId: string) => {
    setCurrentExam((prev) => {
      const currentSubjects = prev.subject_ids || [];
      const updated = currentSubjects.includes(subjId)
        ? currentSubjects.filter((id) => id !== subjId)
        : [...currentSubjects, subjId];
      return { ...prev, subject_ids: updated };
    });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorStatus("");
    setSuccessStatus("");

    const targetId = currentExam.id?.trim();
    if (!targetId || !currentExam.title?.trim()) {
      setErrorStatus("Exam ID and Title are mandatory fields.");
      return;
    }

    try {
      const payload: ExamInfo = {
        id: targetId,
        authority: currentExam.authority || "DGCA",
        license: currentExam.license || "CPL",
        title: currentExam.title.trim(),
        pass_mark: Number(currentExam.pass_mark) || 70,
        question_count: Number(currentExam.question_count) || 50,
        duration_min: Number(currentExam.duration_min) || 60,
        negative_marking: !!currentExam.negative_marking,
        subject_ids: currentExam.subject_ids || [],
        status: currentExam.status || "draft",
      };

      await saveExam(payload);

      trackEvent(isNew ? "admin_create_exam" : "admin_update_exam", {
        metadata: {
          examId: payload.id,
          title: payload.title,
          authority: payload.authority,
          status: payload.status,
        },
      });

      setSuccessStatus(`Exam package '${payload.title}' successfully posted.`);
      setIsEditing(false);
      loadData();
    } catch (err: any) {
      console.error("Save exam error:", err);
      setErrorStatus(err.message || "Failed to commit exam package to database.");
    }
  };

  const handleDelete = async (id: string, title: string) => {
    if (!window.confirm(`Are you sure you want to permanently delete exam page '${title}'? This operation is irreversible.`)) {
      return;
    }

    setLoading(true);
    setErrorStatus("");
    setSuccessStatus("");
    try {
      await deleteExam(id);

      trackEvent("admin_delete_exam", {
        metadata: { 
          examId: id,
          title 
        },
      });

      setSuccessStatus(`Exam '${title}' successfully removed.`);
      loadData();
    } catch (err: any) {
      console.error("Delete exam error:", err);
      setErrorStatus(err.message || "Failed to complete deletion process.");
      setLoading(false);
    }
  };

  const toggleStatus = async (exam: ExamInfo) => {
    const nextStatus = exam.status === "published" ? "draft" : "published";
    try {
      await saveExam({ ...exam, status: nextStatus });
      trackEvent("admin_update_exam", {
        metadata: { 
          examId: exam.id,
          title: exam.title, 
          status: nextStatus 
        },
      });
      loadData();
    } catch (err: any) {
      console.error("Toggle dynamic exam status error:", err);
      setErrorStatus(err.message || "Failed to save state switch query.");
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto py-2 font-sans text-ink">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-rule pb-6">
        <div>
          <div className="font-mono text-[9px] tracking-widest text-muted uppercase mb-1">Simulations Index</div>
          <h1 className="font-serif text-3xl font-medium tracking-tight text-ink">Exam Specifications</h1>
        </div>
        <div>
          <Button variant="primary" onClick={openNewModal} className="gap-1.5 h-10 text-xs py-0 font-mono uppercase tracking-widest">
            <Plus size={14} /> configure new exam
          </Button>
        </div>
      </div>

      {errorStatus && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/30 text-rose-800 rounded-lg text-xs flex items-center gap-3">
          <AlertCircle size={16} className="shrink-0" />
          <span>{errorStatus}</span>
        </div>
      )}

      {successStatus && (
        <div className="p-4 bg-mint/15 border border-mint/40 text-emerald-800 rounded-lg text-xs flex items-center gap-3">
          <CheckCircle2 size={16} className="shrink-0 animate-pulse" />
          <span>{successStatus}</span>
        </div>
      )}

      {loading ? (
        <div className="h-[250px] flex flex-col items-center justify-center bg-white border border-rule rounded-xl">
          <div className="w-10 h-10 border-4 border-ink border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="font-mono text-xs text-muted tracking-widest uppercase">Synchronizing exams index...</p>
        </div>
      ) : exams.length === 0 ? (
        <div className="text-center py-20 bg-white border border-dashed border-rule rounded-xl">
          <AlertCircle className="mx-auto text-muted mb-3" size={32} />
          <h3 className="font-serif text-lg font-medium text-ink mb-1">No Custom Exams Defined</h3>
          <p className="text-xs text-muted max-w-sm mx-auto mb-6">Create exam definitions mapping to syllabus templates.</p>
          <Button variant="primary" onClick={openNewModal}>Configure Exam</Button>
        </div>
      ) : (
        <div className="bg-white border border-rule rounded-xl overflow-x-auto shadow-sm">
          <table className="w-full text-left border-collapse font-sans text-xs">
            <thead>
              <tr className="border-b border-rule font-mono uppercase tracking-wide text-muted text-[10px] bg-bg-2/50">
                <th className="py-3.5 px-4 font-semibold">Authority</th>
                <th className="py-3.5 px-4 font-semibold">License</th>
                <th className="py-3.5 px-4 font-semibold">Exam Title</th>
                <th className="py-3.5 px-4 font-semibold text-center">Payload Count</th>
                <th className="py-3.5 px-4 font-semibold text-center">Duration (Min)</th>
                <th className="py-3.5 px-4 font-semibold text-center">Passing score</th>
                <th className="py-3.5 px-4 font-semibold text-center">Neg. Marking</th>
                <th className="py-3.5 px-4 font-semibold text-center">Status</th>
                <th className="py-3.5 px-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {exams.map((exam) => (
                <tr key={exam.id} className="border-b border-rule/60 hover:bg-bg-2/30 transition-colors">
                  <td className="py-3 px-4 font-mono font-bold text-ink">
                    <span className="px-2 py-0.5 border border-rule bg-bg-2 text-ink text-[9px] uppercase tracking-wide rounded-md font-semibold">
                      {exam.authority}
                    </span>
                  </td>
                  <td className="py-3 px-4 font-mono text-[10px] text-muted-2">
                    {exam.license}
                  </td>
                  <td className="py-3 px-4">
                    <div className="font-sans font-medium text-ink leading-relaxed mb-0.5">{exam.title}</div>
                    <div className="font-mono text-[9px] text-muted-2 uppercase tracking-tight">ID: {exam.id}</div>
                  </td>
                  <td className="py-3 px-4 text-center font-mono text-xs font-semibold text-muted-2">
                    {exam.question_count} items
                  </td>
                  <td className="py-3 px-4 text-center font-mono text-xs font-semibold text-muted-2">
                    {exam.duration_min} min
                  </td>
                  <td className="py-3 px-4 text-center font-mono text-xs font-bold text-navy">
                    {exam.pass_mark}%
                  </td>
                  <td className="py-3 px-4 text-center font-mono text-xs">
                    {exam.negative_marking ? (
                      <span className="text-signal font-semibold">Yes (-0.25)</span>
                    ) : (
                      <span className="text-muted-2">None</span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-center">
                    <button
                      onClick={() => toggleStatus(exam)}
                      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-mono text-[9px] font-semibold leading-relaxed transition-all cursor-pointer select-none border ${
                        exam.status === "published"
                          ? "bg-mint/15 text-emerald-700 border-mint/20 hover:bg-mint/20"
                          : "bg-amber-105 text-amber-700 border-amber-200/50 hover:bg-amber-100"
                      }`}
                    >
                      {exam.status === "published" ? <Eye size={10} /> : <EyeOff size={10} />}
                      {exam.status.toUpperCase()}
                    </button>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => openEditModal(exam)}
                        className="p-1 px-2 border border-rule hover:bg-bg-2 rounded text-ink cursor-pointer transition-colors"
                        title="Configure specs"
                      >
                        <Edit2 size={12} />
                      </button>
                      <button
                        onClick={() => handleDelete(exam.id, exam.title)}
                        className="p-1 px-2 border border-rose-200 hover:bg-rose-50 rounded text-rose-600 cursor-pointer transition-colors"
                        title="Delete"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {isEditing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/30 backdrop-blur-sm">
          <div className="bg-white border border-rule-strong rounded-2xl w-full max-w-xl shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-rule flex justify-between items-center bg-bg-2/30 animate-[fadeIn_0.2s_ease-out]">
              <h3 className="font-serif text-lg font-medium text-ink flex items-center gap-2">
                <Award size={18} className="text-navy" /> {isNew ? "Configure Exam blueprint" : "Update Exam Details"}
              </h3>
              <button onClick={() => setIsEditing(false)} className="text-muted hover:text-ink cursor-pointer p-1">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-4 overflow-y-auto flex-1 text-xs">
              <div>
                <label className="block font-mono text-[9px] uppercase text-muted tracking-widest mb-1.5 font-bold">Exam Title / Wordmark</label>
                <input
                  type="text"
                  value={currentExam.title || ""}
                  onChange={(e) => handleTitleChange(e.target.value)}
                  className="w-full text-xs p-2.5 bg-bg-2 border border-rule rounded-lg focus:outline-none focus:border-rule-strong text-ink font-semibold"
                  placeholder="e.g. DGCA CPL Meteorology Paper"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-mono text-[9px] uppercase text-muted tracking-widest mb-1.5 font-bold">Exam ID Reference</label>
                  <input
                    type="text"
                    value={currentExam.id || ""}
                    onChange={(e) => setCurrentExam((p) => ({ ...p, id: slugify(e.target.value) }))}
                    className="w-full font-mono text-xs p-2.5 bg-bg-2 border border-rule rounded-lg focus:outline-none focus:border-rule-strong font-semibold"
                    placeholder="e.g. dgca-cpl-meteo"
                    required
                  />
                </div>
                <div>
                  <label className="block font-mono text-[9px] uppercase text-muted tracking-widest mb-1.5 font-bold">Passing score (%)</label>
                  <input
                    type="number"
                    value={currentExam.pass_mark ?? 70}
                    onChange={(e) => setCurrentExam((p) => ({ ...p, pass_mark: Number(e.target.value) }))}
                    className="w-full font-mono text-xs p-2.5 bg-bg-2 border border-rule rounded-lg focus:outline-none focus:border-rule-strong font-semibold"
                    placeholder="70"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-mono text-[9px] uppercase text-muted tracking-widest mb-1.5 font-bold">Exam Authority</label>
                  <select
                    value={currentExam.authority || "DGCA"}
                    onChange={(e) => setCurrentExam((p) => ({ ...p, authority: e.target.value as any }))}
                    className="w-full font-mono text-xs p-2.5 bg-bg-2 border border-rule rounded-lg focus:outline-none focus:border-rule-strong h-[38px] text-ink font-semibold"
                  >
                    <option value="DGCA">DGCA</option>
                    <option value="EASA">EASA</option>
                    <option value="FAA">FAA</option>
                    <option value="TYPE_RATING">TYPE_RATING</option>
                  </select>
                </div>
                <div>
                  <label className="block font-mono text-[9px] uppercase text-muted tracking-widest mb-1.5 font-bold">License Track</label>
                  <select
                    value={currentExam.license || "CPL"}
                    onChange={(e) => setCurrentExam((p) => ({ ...p, license: e.target.value as any }))}
                    className="w-full font-mono text-xs p-2.5 bg-bg-2 border border-rule rounded-lg focus:outline-none focus:border-rule-strong h-[38px] text-ink font-semibold"
                  >
                    <option value="PPL">PPL (Private)</option>
                    <option value="CPL">CPL (Commercial)</option>
                    <option value="ATPL">ATPL (ATP flight)</option>
                    <option value="IR">IR (Instrument)</option>
                    <option value="TYPE">TYPE (Type rating)</option>
                    <option value="OTHER">OTHER</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-mono text-[9px] uppercase text-muted tracking-widest mb-1.5 font-bold">payload scale (questions count)</label>
                  <input
                    type="number"
                    value={currentExam.question_count ?? 50}
                    onChange={(e) => setCurrentExam((p) => ({ ...p, question_count: Number(e.target.value) }))}
                    className="w-full font-mono text-xs p-2.5 bg-bg-2 border border-rule rounded-lg focus:outline-none focus:border-rule-strong font-semibold"
                    placeholder="50"
                    required
                  />
                </div>
                <div>
                  <label className="block font-mono text-[9px] uppercase text-muted tracking-widest mb-1.5 font-bold">Duration limit (MINS)</label>
                  <input
                    type="number"
                    value={currentExam.duration_min ?? 60}
                    onChange={(e) => setCurrentExam((p) => ({ ...p, duration_min: Number(e.target.value) }))}
                    className="w-full font-mono text-xs p-2.5 bg-bg-2 border border-rule rounded-lg focus:outline-none focus:border-rule-strong font-semibold"
                    placeholder="60"
                    required
                  />
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 bg-bg-2 rounded-lg border border-rule">
                <input
                  type="checkbox"
                  id="negative-marking-toggle"
                  checked={!!currentExam.negative_marking}
                  onChange={(e) => setCurrentExam((p) => ({ ...p, negative_marking: e.target.checked }))}
                  className="h-4 w-4 rounded text-navy border-rule focus:ring-navy cursor-pointer"
                />
                <label id="negative-marking-label" htmlFor="negative-marking-toggle" className="font-mono text-[10px] uppercase font-bold tracking-wider text-ink cursor-pointer select-none">
                  Enable ICAO Negative Marking Compliancy (-0.25 per incorrect payload answer)
                </label>
              </div>

              <div>
                <label className="block font-mono text-[9px] uppercase text-muted tracking-widest mb-2 font-bold select-none">Select subjects feeding this simulation (Multiple Allowed)</label>
                <div className="max-h-[160px] overflow-y-auto border border-rule rounded-lg p-3 bg-bg-2 space-y-2">
                  {subjectsList.map((sub) => (
                    <div key={sub.id} className="flex items-start gap-2.5">
                      <input
                        type="checkbox"
                        id={`sub-feed-${sub.id}`}
                        checked={(currentExam.subject_ids || []).includes(sub.id)}
                        onChange={() => handleSubjectToggle(sub.id)}
                        className="h-3.5 w-3.5 text-navy border-rule rounded focus:ring-navy mt-0.5 cursor-pointer"
                      />
                      <label htmlFor={`sub-feed-${sub.id}`} className="font-sans text-xs text-ink cursor-pointer select-none">
                        <span className="font-semibold block">{sub.title}</span>
                        <span className="opacity-60 block font-mono text-[9px] uppercase tracking-wider">{sub.exam_authority} · {sub.license || "CPL"}</span>
                      </label>
                    </div>
                  ))}
                  {subjectsList.length === 0 && (
                    <p className="text-muted italic text-[11px]">No active subjects found. Seed some templates first!</p>
                  )}
                </div>
              </div>

              <div>
                <label className="block font-mono text-[9px] uppercase text-muted tracking-widest mb-1.5 font-bold">Lifecycle Status</label>
                <select
                  value={currentExam.status || "draft"}
                  onChange={(e) => setCurrentExam((p) => ({ ...p, status: e.target.value as any }))}
                  className="w-full font-mono text-xs p-2.5 bg-bg-2 border border-rule rounded-lg focus:outline-none focus:border-rule-strong h-[38px] text-ink font-semibold"
                >
                  <option value="draft">DRAFT</option>
                  <option value="published">PUBLISHED</option>
                  <option value="archived">ARCHIVED</option>
                </select>
              </div>

              <div className="border-t border-rule pt-4 flex gap-3 justify-end">
                <Button variant="ghost" onClick={() => setIsEditing(false)} className="h-10 py-1 text-xs">
                  Discard
                </Button>
                <Button variant="primary" type="submit" className="h-10 py-1 text-xs gap-1.5">
                  <Save size={14} /> Commit Entry
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
