import React, { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import { Button } from "../../components/Atoms";
import { Plus, Edit2, Trash2, Save, X, RefreshCw, AlertCircle, Eye, EyeOff, CheckCircle2 } from "lucide-react";
import { trackEvent } from "../../lib/track";

interface Subject {
  id: string;
  title: string;
}

interface Subcategory {
  id: string;
  subject_id: string;
  code: string | null;
  title: string;
  description: string | null;
  sort_order: number;
  status: "draft" | "published" | "archived";
}

interface QuestionCount {
  id: string;
  subcategory_id: string | null;
}

const slugify = (text: string) => {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/^-+|-+$/g, "");
};

export default function SubcategoriesManager() {
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [qcounts, setQcounts] = useState<QuestionCount[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isNew, setIsNew] = useState(false);
  const [currentSubcategory, setCurrentSubcategory] = useState<Partial<Subcategory>>({
    id: "",
    subject_id: "",
    code: "",
    title: "",
    description: "",
    sort_order: 10,
    status: "draft",
  });
  
  const [selectedSubjectFilter, setSelectedSubjectFilter] = useState("all");
  const [errorStatus, setErrorStatus] = useState("");
  const [successStatus, setSuccessStatus] = useState("");

  const fetchData = async () => {
    setLoading(true);
    setErrorStatus("");
    try {
      // 1. Fetch Subjects
      const { data: subjData, error: subjErr } = await supabase
        .from("subjects")
        .select("id, title")
        .order("title");
      if (subjErr) throw subjErr;
      setSubjects(subjData || []);

      // 2. Fetch Subcategories
      const { data: subData, error: subErr } = await supabase
        .from("subcategories")
        .select("*")
        .order("sort_order", { ascending: true });
      if (subErr) throw subErr;
      setSubcategories(subData || []);

      // 3. Fetch Question counts
      const { data: qData, error: qErr } = await supabase
        .from("questions")
        .select("id, subcategory_id");
      if (qErr) throw qErr;
      setQcounts(qData || []);

    } catch (err: any) {
      console.error("Error fetching subcategories dependencies:", err);
      setErrorStatus(err.message || "Failed to retrieve subcategories data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const openNewModal = () => {
    setIsNew(true);
    const parentId = selectedSubjectFilter !== "all" ? selectedSubjectFilter : (subjects[0]?.id || "");
    setCurrentSubcategory({
      id: "",
      subject_id: parentId,
      code: "",
      title: "",
      description: "",
      sort_order: (subcategories.length + 1) * 10,
      status: "draft",
    });
    setErrorStatus("");
    setIsEditing(true);
  };

  const openEditModal = (subcat: Subcategory) => {
    setIsNew(false);
    setCurrentSubcategory(subcat);
    setErrorStatus("");
    setIsEditing(true);
  };

  const handleTitleChange = (title: string) => {
    setCurrentSubcategory((p) => {
      const next: Partial<Subcategory> = { ...p, title };
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

    const targetId = currentSubcategory.id?.trim();
    if (!targetId || !currentSubcategory.subject_id || !currentSubcategory.title?.trim()) {
      setErrorStatus("ID, Parent Subject, and Subcategory Title are mandatory fields.");
      return;
    }

    try {
      const payload = {
        id: targetId,
        subject_id: currentSubcategory.subject_id,
        code: currentSubcategory.code?.trim() || null,
        title: currentSubcategory.title.trim(),
        description: currentSubcategory.description?.trim() || null,
        sort_order: Number(currentSubcategory.sort_order) || 0,
        status: currentSubcategory.status || "draft",
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase.from("subcategories").upsert(payload);
      if (error) throw error;

      trackEvent(isNew ? "admin_create_subcategory" : "admin_update_subcategory", {
        subjectId: payload.subject_id,
        subcategoryId: payload.id,
        metadata: {
          title: payload.title,
          code: payload.code,
          status: payload.status,
          details: isNew
            ? `Successfully created subcategory: ${payload.title} (${payload.id})`
            : `Updated settings of subcategory: ${payload.title} (${payload.id})`,
        },
      });

      setSuccessStatus(`Subcategory '${payload.title}' successfully stored and indexed.`);
      setIsEditing(false);
      fetchData();
    } catch (err: any) {
      console.error("Upsert subcategory error:", err);
      setErrorStatus(err.message || "Failed to commit subcategory updates.");
    }
  };

  const handleDelete = async (id: string, title: string) => {
    const qCount = qcounts.filter((q) => q.subcategory_id === id).length;

    let warningPrompt = `Are you absolutely sure you want to delete the subcategory '${title}'?`;
    if (qCount > 0) {
      warningPrompt = `CRITICAL CASCADE WARNING:\nDeleting the subcategory '${title}' will permanently delete all its ${qCount} nested questions.\n\nThis action is irreversible! Type OK to continue.`;
    }

    if (!window.confirm(warningPrompt)) {
      return;
    }

    setLoading(true);
    setErrorStatus("");
    setSuccessStatus("");
    try {
      const { error } = await supabase.from("subcategories").delete().eq("id", id);
      if (error) throw error;

      trackEvent("admin_delete_subcategory", {
        subcategoryId: id,
        metadata: {
          title: title,
          details: `Deleted subcategory: ${title} (${id}) along with ${qCount} nested questions.`,
        },
      });

      setSuccessStatus(`Subcategory '${title}' and its dependent questions were deleted.`);
      fetchData();
    } catch (err: any) {
      console.error("Delete subcategory error:", err);
      setErrorStatus(err.message || "Failed to execute deletion query.");
      setLoading(false);
    }
  };

  const toggleStatus = async (sub: Subcategory) => {
    const nextStatus = sub.status === "published" ? "draft" : "published";
    try {
      const { error } = await supabase
        .from("subcategories")
        .update({ status: nextStatus, updated_at: new Date().toISOString() })
        .eq("id", sub.id);

      if (error) throw error;

      trackEvent("admin_update_subcategory", {
        subjectId: sub.subject_id,
        subcategoryId: sub.id,
        metadata: {
          title: sub.title,
          status: nextStatus,
          details: `Set subcategory: '${sub.title}' state to: ${nextStatus.toUpperCase()}`,
        },
      });

      fetchData();
    } catch (err: any) {
      console.error("Toggle subcategory status error:", err);
      setErrorStatus(err.message || "Failed to switch status state.");
    }
  };

  const filteredSubcategories = selectedSubjectFilter === "all"
    ? subcategories
    : subcategories.filter((s) => s.subject_id === selectedSubjectFilter);

  return (
    <div className="space-y-6 max-w-7xl mx-auto py-2 font-sans text-ink">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-rule pb-6">
        <div>
          <div className="font-mono text-[9px] tracking-widest text-muted uppercase mb-1">Catalog Substructures</div>
          <h1 className="font-serif text-3xl font-medium tracking-tight text-ink">Subcategories Organizer</h1>
        </div>
        <div className="flex items-center gap-2">
          {/* Parent filter */}
          <select
            value={selectedSubjectFilter}
            onChange={(e) => setSelectedSubjectFilter(e.target.value)}
            className="font-mono text-xs p-2 bg-white border border-rule rounded-full focus:outline-none focus:border-rule-strong mr-2 px-4 h-10 select-none text-ink font-semibold"
          >
            <option value="all">View All Subjects</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title}
              </option>
            ))}
          </select>

          <button
            onClick={fetchData}
            disabled={loading}
            className="p-2 border border-rule hover:bg-bg-2 rounded-full transition-colors inline-flex justify-center items-center text-ink disabled:opacity-50 h-10 w-10 shrink-0"
            aria-label="Reload database metrics" title="Reload database metrics"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          </button>
          
          <Button variant="primary" onClick={openNewModal} className="gap-1.5 h-10 text-xs py-0 whitespace-nowrap">
            <Plus size={14} /> add sub-category
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
          <CheckCircle2 size={16} className="shrink-0" />
          <span>{successStatus}</span>
        </div>
      )}

      {loading ? (
        <div className="h-[250px] flex flex-col items-center justify-center bg-white border border-rule rounded-xl">
          <div className="w-10 h-10 border-4 border-ink border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="font-mono text-xs text-muted tracking-widest uppercase">Fetching Subcategory Map...</p>
        </div>
      ) : filteredSubcategories.length === 0 ? (
        <div className="text-center py-20 bg-white border border-dashed border-rule rounded-xl">
          <AlertCircle className="mx-auto text-muted mb-3" size={32} />
          <h3 className="font-serif text-lg font-medium text-ink mb-1">No Subcategories Found</h3>
          <p className="text-xs text-muted max-w-sm mx-auto mb-6">Create subcategories linked to subjects to enable granular aviation syllabi.</p>
          <Button variant="primary" onClick={openNewModal}>Add Subcategory</Button>
        </div>
      ) : (
        <div className="bg-white border border-rule rounded-xl overflow-x-auto shadow-sm">
          <table className="w-full text-left border-collapse font-sans text-xs">
            <thead>
              <tr className="border-b border-rule font-mono uppercase tracking-wide text-muted text-[10px] bg-bg-2/50">
                <th className="py-3.5 px-4 font-semibold w-24">Order ID</th>
                <th className="py-3.5 px-4 font-semibold w-32">Code</th>
                <th className="py-3.5 px-4 font-semibold">Subcategory Title</th>
                <th className="py-3.5 px-4 font-semibold w-52">Parent Subject</th>
                <th className="py-3.5 px-4 font-semibold w-32 text-center">Questions</th>
                <th className="py-3.5 px-4 font-semibold w-28 text-center">Status</th>
                <th className="py-3.5 px-4 font-semibold w-24 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredSubcategories.map((subcat) => {
                const parentObj = subjects.find((s) => s.id === subcat.subject_id);
                const qCount = qcounts.filter((q) => q.subcategory_id === subcat.id).length;

                return (
                  <tr key={subcat.id} className="border-b border-rule/60 hover:bg-bg-2/30 transition-colors">
                    <td className="py-3 px-4 font-mono font-semibold text-ink text-[11px]">
                      #{subcat.sort_order}
                    </td>
                    <td className="py-3 px-4">
                      {subcat.code ? (
                        <span className="font-mono text-[10px] font-bold text-ink uppercase tracking-wide px-2 py-0.5 border border-rule bg-bg-2 rounded">
                          {subcat.code}
                        </span>
                      ) : (
                        <span className="text-muted-2 italic font-mono text-[10px]">None</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-sans font-medium text-ink leading-relaxed mb-0.5">{subcat.title}</div>
                      <div className="font-mono text-[9px] text-muted-2 uppercase tracking-tight">{subcat.id}</div>
                    </td>
                    <td className="py-3 px-4 text-muted-2 max-w-xs truncate" title={parentObj?.title || ""}>
                      {parentObj?.title || subcat.subject_id}
                    </td>
                    <td className="py-3 px-4 text-center font-mono text-xs font-semibold text-muted-2">
                      {qCount}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <button
                        onClick={() => toggleStatus(subcat)}
                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-mono text-[9px] font-semibold leading-relaxed transition-all cursor-pointer select-none border ${
                          subcat.status === "published"
                            ? "bg-mint/15 text-emerald-700 border-mint/20 hover:bg-mint/20"
                            : "bg-amber-100 text-amber-700 border-amber-200/50 hover:bg-amber-150"
                        }`}
                      >
                        {subcat.status === "published" ? <Eye size={10} /> : <EyeOff size={10} />}
                        {subcat.status.toUpperCase()}
                      </button>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => openEditModal(subcat)}
                          className="p-1 px-2 border border-rule hover:bg-bg-2 rounded text-ink cursor-pointer transition-colors"
                          title="Edit subcategory"
                        >
                          <Edit2 size={12} />
                        </button>
                        <button
                          onClick={() => handleDelete(subcat.id, subcat.title)}
                          className="p-1 px-2 border border-rose-200 hover:bg-rose-50 rounded text-rose-600 cursor-pointer transition-colors"
                          title="Delete subcategory"
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

      {/* Editing Dialog Modal */}
      {isEditing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/30 backdrop-blur-sm">
          <div className="bg-white border border-rule-strong rounded-2xl w-full max-w-lg shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-rule flex justify-between items-center bg-bg-2/30">
              <h3 className="font-serif text-lg font-medium text-ink">
                {isNew ? "New Sub-category Form" : "Edit Sub-category Entry"}
              </h3>
              <button onClick={() => setIsEditing(false)} className="text-muted hover:text-ink cursor-pointer p-1">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-4 overflow-y-auto flex-1">
              <div>
                <label className="block font-mono text-[9px] uppercase text-muted tracking-widest mb-1.5 font-bold">Parent Subject Link</label>
                <select
                  value={currentSubcategory.subject_id || ""}
                  onChange={(e) => setCurrentSubcategory((p) => ({ ...p, subject_id: e.target.value }))}
                  className="w-full text-xs p-2.5 bg-bg-2 border border-rule rounded-lg focus:outline-none focus:border-rule-strong h-[38px] text-ink font-semibold"
                  required
                >
                  <option value="" disabled>-- Pick Subject Parent --</option>
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.title}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-mono text-[9px] uppercase text-muted tracking-widest mb-1.5 font-bold">Subcategory Title</label>
                <input
                  type="text"
                  value={currentSubcategory.title || ""}
                  onChange={(e) => handleTitleChange(e.target.value)}
                  className="w-full text-xs p-2.5 bg-bg-2 border border-rule rounded-lg focus:outline-none focus:border-rule-strong text-ink font-semibold"
                  placeholder="e.g. Navigation Calculations"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-mono text-[9px] uppercase text-muted tracking-widest mb-1.5 font-bold">Unique ID Key (Auto-Slug)</label>
                  <input
                    type="text"
                    value={currentSubcategory.id || ""}
                    onChange={(e) => setCurrentSubcategory((p) => ({ ...p, id: slugify(e.target.value) }))}
                    className="w-full font-mono text-xs p-2.5 bg-bg-2 border border-rule rounded-lg focus:outline-none focus:border-rule-strong font-semibold"
                    placeholder="e.g. navigation-calculations"
                    required
                  />
                </div>
                <div>
                  <label className="block font-mono text-[9px] uppercase text-muted tracking-widest mb-1.5 font-bold">Sort Order sequence</label>
                  <input
                    type="number"
                    value={currentSubcategory.sort_order ?? 10}
                    onChange={(e) => setCurrentSubcategory((p) => ({ ...p, sort_order: Number(e.target.value) }))}
                    className="w-full font-mono text-xs p-2.5 bg-bg-2 border border-rule rounded-lg focus:outline-none focus:border-rule-strong font-semibold"
                    placeholder="10"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-mono text-[9px] uppercase text-muted tracking-widest mb-1.5 font-bold">Category Code / ATA Chapter</label>
                  <input
                    type="text"
                    value={currentSubcategory.code || ""}
                    onChange={(e) => setCurrentSubcategory((p) => ({ ...p, code: e.target.value }))}
                    className="w-full font-mono text-xs p-2.5 bg-bg-2 border border-rule rounded-lg focus:outline-none focus:border-rule-strong text-ink font-semibold"
                    placeholder="e.g. ATA-34 or 061.02"
                  />
                </div>
                <div>
                  <label className="block font-mono text-[9px] uppercase text-muted tracking-widest mb-1.5 font-bold">Database Status</label>
                  <select
                    value={currentSubcategory.status || "draft"}
                    onChange={(e) => setCurrentSubcategory((p) => ({ ...p, status: e.target.value as any }))}
                    className="w-full font-mono text-xs p-2.5 bg-bg-2 border border-rule rounded-lg focus:outline-none focus:border-rule-strong h-[38px] text-ink font-semibold"
                  >
                    <option value="draft">DRAFT</option>
                    <option value="published">PUBLISHED</option>
                    <option value="archived">ARCHIVED</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-mono text-[9px] uppercase text-muted tracking-widest mb-1.5 font-bold">Detailed Description</label>
                <textarea
                  value={currentSubcategory.description || ""}
                  onChange={(e) => setCurrentSubcategory((p) => ({ ...p, description: e.target.value }))}
                  className="w-full text-xs p-2.5 bg-bg-2 border border-rule rounded-lg focus:outline-none focus:border-rule-strong h-20 text-ink leading-relaxed"
                  placeholder="E.g. Groundspeed, drift, wind direction, headwind component calculations."
                />
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
