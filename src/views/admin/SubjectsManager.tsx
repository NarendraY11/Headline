import React, { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import { Button } from "../../components/Atoms";
import { Plus, Edit2, Trash2, Save, X, RefreshCw, AlertCircle, Eye, EyeOff, CheckCircle2, Server } from "lucide-react";
import { trackEvent } from "../../lib/track";
import { seedTaxonomy } from "../../lib/content";

interface Subject {
  id: string;
  title: string;
  description: string | null;
  exam_authority: "DGCA" | "EASA" | "FAA" | "TYPE_RATING" | "TYPE-RATING" | string;
  license?: "PPL" | "CPL" | "ATPL" | "IR" | "TYPE" | "OTHER" | string;
  sort_order: number;
  status: "draft" | "published" | "archived";
}

interface SubcategoryCount {
  id: string;
  subject_id: string;
}

interface QuestionCount {
  id: string;
  subject_id: string | null;
}

const slugify = (text: string) => {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/^-+|-+$/g, "");
};

export default function SubjectsManager() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [subcounts, setSubcounts] = useState<SubcategoryCount[]>([]);
  const [qcounts, setQcounts] = useState<QuestionCount[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isNew, setIsNew] = useState(false);
  const [currentSubject, setCurrentSubject] = useState<Partial<Subject>>({
    id: "",
    title: "",
    description: "",
    exam_authority: "DGCA",
    sort_order: 10,
    status: "draft",
  });
  
  const [errorStatus, setErrorStatus] = useState("");
  const [successStatus, setSuccessStatus] = useState("");

  const fetchData = async () => {
    setLoading(true);
    setErrorStatus("");
    try {
      // 1. Fetch Subjects
      const { data: subjData, error: subjErr } = await supabase
        .from("subjects")
        .select("*")
        .order("sort_order", { ascending: true });

      if (subjErr) throw subjErr;
      setSubjects(subjData || []);

      // 2. Fetch Subcategory counts
      const { data: subData, error: subErr } = await supabase
        .from("subcategories")
        .select("id, subject_id");
      if (subErr) throw subErr;
      setSubcounts(subData || []);

      // 3. Fetch Question counts
      const { data: qData, error: qErr } = await supabase
        .from("questions")
        .select("id, subject_id");
      if (qErr) throw qErr;
      setQcounts(qData || []);

    } catch (err: any) {
      console.error("Error fetching subject manager database metrics:", err);
      setErrorStatus(err.message || "Failed to retrieve database schema metrics.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const openNewModal = () => {
    setIsNew(true);
    setCurrentSubject({
      id: "",
      title: "",
      description: "",
      exam_authority: "DGCA",
      license: "CPL",
      sort_order: (subjects.length + 1) * 10,
      status: "draft",
    });
    setErrorStatus("");
    setIsEditing(true);
  };

  const openEditModal = (subject: Subject) => {
    setIsNew(false);
    setCurrentSubject(subject);
    setErrorStatus("");
    setIsEditing(true);
  };

  const handleTitleChange = (title: string) => {
    setCurrentSubject((p) => {
      const next: Partial<Subject> = { ...p, title };
      if (isNew) {
        next.id = slugify(title);
      }
      return next;
    });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorStatus("");
    setSuccessStatus("");

    const targetId = currentSubject.id?.trim();
    if (!targetId || !currentSubject.title?.trim()) {
      setErrorStatus("Subject ID and Title are mandatory fields.");
      return;
    }

    try {
      const payload = {
        id: targetId,
        title: currentSubject.title.trim(),
        description: currentSubject.description?.trim() || null,
        exam_authority: currentSubject.exam_authority || "DGCA",
        license: currentSubject.license || "CPL",
        sort_order: Number(currentSubject.sort_order) || 0,
        status: currentSubject.status || "draft",
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase.from("subjects").upsert(payload);
      if (error) throw error;

      trackEvent(isNew ? "admin_create_subject" : "admin_update_subject", {
        subjectId: payload.id,
        metadata: {
          title: payload.title,
          exam_authority: payload.exam_authority,
          status: payload.status,
          details: isNew 
            ? `Successfully created syllabus subject: ${payload.title} (${payload.id})`
            : `Updated syllabus subject settings: ${payload.title} (${payload.id})`,
        },
      });

      setSuccessStatus(`Subject '${payload.title}' successfully processed and indexed.`);
      setIsEditing(false);
      fetchData();
    } catch (err: any) {
      console.error("Upsert subject error:", err);
      setErrorStatus(err.message || "Failed to commit record updates.");
    }
  };

  const handleDelete = async (id: string, title: string) => {
    const subCount = subcounts.filter((s) => s.subject_id === id).length;
    const qCount = qcounts.filter((q) => q.subject_id === id).length;

    let warningPrompt = `Are you absolutely sure you want to delete the subject '${title}'?`;
    if (subCount > 0 || qCount > 0) {
      warningPrompt = `CRITICAL CASCADE WARNING:\nDeleting the subject '${title}' will permanently delete:\n- ${subCount} nested subcategories\n- ${qCount} child questions\n\nThis delete operation is irreversible! Type OK to continue.`;
    }

    if (!window.confirm(warningPrompt)) {
      return;
    }

    setLoading(true);
    setErrorStatus("");
    setSuccessStatus("");
    try {
      const { error } = await supabase.from("subjects").delete().eq("id", id);
      if (error) throw error;

      trackEvent("admin_delete_subject", {
        subjectId: id,
        metadata: {
          title: title,
          details: `Deleted subject: ${title} (${id}) along with ${subCount} subcategories and ${qCount} questions.`,
        },
      });

      setSuccessStatus(`Subject '${title}' and its associated hierarchical trees have been cascade deleted.`);
      fetchData();
    } catch (err: any) {
      console.error("Subject cascade deletion error:", err);
      setErrorStatus(err.message || "Failed to complete cascade deletion query.");
      setLoading(false);
    }
  };

  const toggleStatus = async (subject: Subject) => {
    const nextStatus = subject.status === "published" ? "draft" : "published";
    try {
      const { error } = await supabase
        .from("subjects")
        .update({ status: nextStatus, updated_at: new Date().toISOString() })
        .eq("id", subject.id);

      if (error) throw error;

      trackEvent("admin_update_subject", {
        subjectId: subject.id,
        metadata: {
          title: subject.title,
          status: nextStatus,
          details: `Set subject: '${subject.title}' state to: ${nextStatus.toUpperCase()}`,
        },
      });

      fetchData();
    } catch (err: any) {
      console.error("Toggle subject published status status error:", err);
      setErrorStatus(err.message || "Failed to switch live state status.");
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto py-2 font-sans text-ink">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-rule pb-6">
        <div>
          <div className="font-mono text-[9px] tracking-widest text-muted uppercase mb-1">Catalog Structures</div>
          <h1 className="font-serif text-3xl font-medium tracking-tight text-ink">Subjects Inventory</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={async () => {
              if (window.confirm("Do you want to seed real, high-fidelity aviation subjects & exams into the database from standard catalog matrices? (Active connection required)")) {
                setLoading(true);
                setErrorStatus("");
                setSuccessStatus("");
                try {
                  const out = await seedTaxonomy();
                  setSuccessStatus(`Database successfully populated: ${out.subjectsCount} aviation subjects, ${out.examsCount} mock exams, and ${out.questionsCount} questions are now initialized as published.`);
                  fetchData();
                } catch (seededError: any) {
                  setErrorStatus(seededError.message || "Taxonomy bootstrap seeding transaction failed.");
                } finally {
                  setLoading(false);
                }
              }
            }}
            disabled={loading}
            className="flex items-center gap-1.5 h-10 text-xs px-4 border border-rule hover:bg-bg-2 rounded-lg font-medium transition-colors"
          >
            <Server size={13} className="text-navy" /> Seed Syllabus templates
          </button>
          <button
            onClick={fetchData}
            disabled={loading}
            className="p-2 border border-rule hover:bg-bg-2 rounded-full transition-colors inline-flex justify-center items-center text-ink disabled:opacity-50 h-10 w-10 shrink-0"
            title="Refresh database state"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          </button>
          <Button variant="primary" onClick={openNewModal} className="gap-1.5 h-10 text-xs py-0">
            <Plus size={14} /> add subject
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
          <p className="font-mono text-xs text-muted tracking-widest uppercase">Syncing Syllabus Subjects database...</p>
        </div>
      ) : subjects.length === 0 ? (
        <div className="text-center py-20 bg-white border border-dashed border-rule rounded-xl">
          <AlertCircle className="mx-auto text-muted mb-3" size={32} />
          <h3 className="font-serif text-lg font-medium text-ink mb-1">No Subjects Registered</h3>
          <p className="text-xs text-muted max-w-sm mx-auto mb-6">Initialize a subject node to establish base syllabi constraints.</p>
          <Button variant="primary" onClick={openNewModal}>Add Subject</Button>
        </div>
      ) : (
        <div className="bg-white border border-rule rounded-xl overflow-x-auto shadow-sm">
          <table className="w-full text-left border-collapse font-sans text-xs">
            <thead>
              <tr className="border-b border-rule font-mono uppercase tracking-wide text-muted text-[10px] bg-bg-2/50">
                <th className="py-3.5 px-4 font-semibold w-24">Order ID</th>
                <th className="py-3.5 px-4 font-semibold">Subject Title</th>
                <th className="py-3.5 px-4 font-semibold w-36">Authority</th>
                <th className="py-3.5 px-4 font-semibold w-32 text-center">Subcategories</th>
                <th className="py-3.5 px-4 font-semibold w-32 text-center">Questions</th>
                <th className="py-3.5 px-4 font-semibold w-28 text-center">Status</th>
                <th className="py-3.5 px-4 font-semibold w-24 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {subjects.map((subj) => {
                const subCount = subcounts.filter((s) => s.subject_id === subj.id).length;
                const qCount = qcounts.filter((q) => q.subject_id === subj.id).length;

                return (
                  <tr key={subj.id} className="border-b border-rule/60 hover:bg-bg-2/30 transition-colors">
                    <td className="py-3 px-4 font-mono font-semibold text-ink text-[11px]">
                      #{subj.sort_order}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-sans font-medium text-ink leading-relaxed mb-0.5">{subj.title}</div>
                      <div className="font-mono text-[9px] text-muted-2 uppercase tracking-tight">{subj.id}</div>
                    </td>
                    <td className="py-3 px-4 font-mono text-[10px]">
                      <span className="px-2 py-0.5 border border-rule bg-bg-2 text-ink text-[9px] uppercase tracking-wide rounded-md font-semibold font-mono">
                        {subj.exam_authority || "DGCA"}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center font-mono text-xs font-semibold text-muted-2">
                      {subCount}
                    </td>
                    <td className="py-3 px-4 text-center font-mono text-xs font-semibold text-muted-2">
                      {qCount}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <button
                        onClick={() => toggleStatus(subj)}
                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-mono text-[9px] font-semibold leading-relaxed transition-all cursor-pointer select-none border ${
                          subj.status === "published"
                            ? "bg-mint/15 text-emerald-700 border-mint/20 hover:bg-mint/20"
                            : "bg-amber-105 text-amber-700 border-amber-200/50 hover:bg-amber-100"
                        }`}
                      >
                        {subj.status === "published" ? <Eye size={10} /> : <EyeOff size={10} />}
                        {subj.status.toUpperCase()}
                      </button>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => openEditModal(subj)}
                          className="p-1 px-2 border border-rule hover:bg-bg-2 rounded text-ink cursor-pointer transition-colors"
                          title="Edit subject metadata"
                        >
                          <Edit2 size={12} />
                        </button>
                        <button
                          onClick={() => handleDelete(subj.id, subj.title)}
                          className="p-1 px-2 border border-rose-200 hover:bg-rose-50 rounded text-rose-600 cursor-pointer transition-colors"
                          title="Delete"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Editing Dialog modal */}
      {isEditing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/30 backdrop-blur-sm">
          <div className="bg-white border border-rule-strong rounded-2xl w-full max-w-lg shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-rule flex justify-between items-center bg-bg-2/30">
              <h3 className="font-serif text-lg font-medium text-ink">
                {isNew ? "Create Flight Syllabus Subject" : "Configure Subject Node"}
              </h3>
              <button onClick={() => setIsEditing(false)} className="text-muted hover:text-ink cursor-pointer p-1">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-4 overflow-y-auto flex-1">
              <div>
                <label className="block font-mono text-[9px] uppercase text-muted tracking-widest mb-1.5 font-bold">Subject Title Hierarchy</label>
                <input
                  type="text"
                  value={currentSubject.title || ""}
                  onChange={(e) => handleTitleChange(e.target.value)}
                  className="w-full text-xs p-2.5 bg-bg-2 border border-rule rounded-lg focus:outline-none focus:border-rule-strong text-ink font-semibold"
                  placeholder="e.g. Navigation General"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-mono text-[9px] uppercase text-muted tracking-widest mb-1.5 font-bold">Unique subject ID (Auto-Slug)</label>
                  <input
                    type="text"
                    value={currentSubject.id || ""}
                    onChange={(e) => setCurrentSubject((p) => ({ ...p, id: slugify(e.target.value) }))}
                    className="w-full font-mono text-xs p-2.5 bg-bg-2 border border-rule rounded-lg focus:outline-none focus:border-rule-strong font-semibold"
                    placeholder="e.g. navigation-general"
                    required
                  />
                </div>
                <div>
                  <label className="block font-mono text-[9px] uppercase text-muted tracking-widest mb-1.5 font-bold">Sort Order Sequence</label>
                  <input
                    type="number"
                    value={currentSubject.sort_order ?? 10}
                    onChange={(e) => setCurrentSubject((p) => ({ ...p, sort_order: Number(e.target.value) }))}
                    className="w-full font-mono text-xs p-2.5 bg-bg-2 border border-rule rounded-lg focus:outline-none focus:border-rule-strong text-ink font-semibold"
                    placeholder="10"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block font-mono text-[9px] uppercase text-muted tracking-widest mb-1.5 font-bold">Detailed Description / Curricula</label>
                <textarea
                  value={currentSubject.description || ""}
                  onChange={(e) => setCurrentSubject((p) => ({ ...p, description: e.target.value }))}
                  className="w-full text-xs p-2.5 bg-bg-2 border border-rule rounded-lg focus:outline-none focus:border-rule-strong h-20 text-ink leading-relaxed"
                  placeholder="E.g. Magnetic compass corrections, 1 in 60 rule calculations, flight plan plotting, chart projections."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-mono text-[9px] uppercase text-muted tracking-widest mb-1.5 font-bold">Exam Authority</label>
                  <select
                    value={currentSubject.exam_authority || "DGCA"}
                    onChange={(e) => setCurrentSubject((p) => ({ ...p, exam_authority: e.target.value }))}
                    className="w-full font-mono text-xs p-2.5 bg-bg-2 border border-rule rounded-lg focus:outline-none focus:border-rule-strong h-[38px] text-ink font-semibold"
                  >
                    <option value="DGCA">DGCA</option>
                    <option value="EASA">EASA</option>
                    <option value="FAA">FAA</option>
                    <option value="TYPE_RATING">TYPE_RATING</option>
                    <option value="TYPE-RATING">TYPE-RATING</option>
                  </select>
                </div>
                <div>
                  <label className="block font-mono text-[9px] uppercase text-muted tracking-widest mb-1.5 font-bold">Pilot License level</label>
                  <select
                    value={currentSubject.license || "CPL"}
                    onChange={(e) => setCurrentSubject((p) => ({ ...p, license: e.target.value }))}
                    className="w-full font-mono text-xs p-2.5 bg-bg-2 border border-rule rounded-lg focus:outline-none focus:border-rule-strong h-[38px] text-ink font-semibold"
                  >
                    <option value="PPL">PPL (Private Pilot)</option>
                    <option value="CPL">CPL (Commercial Pilot)</option>
                    <option value="ATPL">ATPL (Airline Transport Pilot)</option>
                    <option value="IR">IR (Instrument Rating)</option>
                    <option value="TYPE">TYPE (Type Rating)</option>
                    <option value="OTHER">OTHER (General/Basic)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-mono text-[9px] uppercase text-muted tracking-widest mb-1.5 font-bold">Lifecycle Status</label>
                <select
                  value={currentSubject.status || "draft"}
                  onChange={(e) => setCurrentSubject((p) => ({ ...p, status: e.target.value as any }))}
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
