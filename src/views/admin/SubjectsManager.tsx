import React, { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Button } from "../../components/Atoms";
import { Plus, Edit2, Trash2, Save, X, AlertCircle, Eye, EyeOff, CheckCircle2, ChevronRight, BookOpen } from "lucide-react";
import { fetchItems, createItem, updateItem, deleteItem, toggleItemActive, reorderItems } from "../../lib/adminData";

interface Subject {
  id: string;
  exam_id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  sort_order: number;
}

interface Exam {
  id: string;
  name: string;
}

export default function SubjectsManager() {
  const [searchParams] = useSearchParams();
  const examId = searchParams.get("exam_id");

  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [parentExam, setParentExam] = useState<Exam | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isNew, setIsNew] = useState(false);
  
  const [currentSubject, setCurrentSubject] = useState<Partial<Subject>>({
    name: "",
    description: "",
    is_active: true,
    sort_order: 0,
  });

  const [errorStatus, setErrorStatus] = useState("");
  const [successStatus, setSuccessStatus] = useState("");

  const loadData = async () => {
    setLoading(true);
    setErrorStatus("");
    try {
      if (examId) {
        const exams = await fetchItems<Exam>('exams');
        const fExam = exams.find(e => e.id === examId);
        if (fExam) setParentExam(fExam);
      }

      const allSubjects = await fetchItems<Subject>('subjects', examId ? 'exam_id' : undefined, examId || undefined);
      setSubjects(allSubjects);
    } catch (err: any) {
      console.error("Error loading subjects:", err);
      setErrorStatus(err.message || "Failed to load subjects.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [examId]);

  const openNewModal = () => {
    setIsNew(true);
    setCurrentSubject({
      exam_id: examId || undefined,
      name: "",
      description: "",
      is_active: true,
      sort_order: (subjects.length + 1) * 10,
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

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorStatus("");
    setSuccessStatus("");

    if (!currentSubject.name?.trim() || !currentSubject.exam_id) {
      setErrorStatus("Name and Parent Exam are mandatory fields.");
      return;
    }

    try {
      const payload = {
        exam_id: currentSubject.exam_id,
        name: currentSubject.name.trim(),
        description: currentSubject.description?.trim() || null,
        is_active: currentSubject.is_active ?? true,
        sort_order: Number(currentSubject.sort_order) || 0,
      };

      if (isNew) {
        await createItem('subjects', payload);
        setSuccessStatus(`Subject '${payload.name}' successfully posted.`);
      } else {
        await updateItem('subjects', currentSubject.id!, payload);
        setSuccessStatus(`Subject '${payload.name}' successfully updated.`);
      }

      setIsEditing(false);
      loadData();
    } catch (err: any) {
      console.error("Save subject error:", err);
      setErrorStatus(err.message || "Failed to commit subject to database.");
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to permanently delete subject '${name}'? This operation is irreversible and will cascade delete all nested items.`)) {
      return;
    }

    setLoading(true);
    setErrorStatus("");
    setSuccessStatus("");
    try {
      await deleteItem('subjects', id);
      setSuccessStatus(`Subject '${name}' successfully removed.`);
      loadData();
    } catch (err: any) {
      console.error("Delete subject error:", err);
      setErrorStatus(err.message || "Failed to complete deletion process.");
      setLoading(false);
    }
  };

  const toggleStatus = async (subject: Subject) => {
    try {
      await toggleItemActive('subjects', subject.id, subject.is_active);
      loadData();
    } catch (err: any) {
      console.error("Toggle subject status error:", err);
      setErrorStatus(err.message || "Failed to save state switch query.");
    }
  };

  const reorder = async (id: string, direction: 1 | -1) => {
    const index = subjects.findIndex(e => e.id === id);
    if (index < 0) return;
    if (direction === -1 && index === 0) return;
    if (direction === 1 && index === subjects.length - 1) return;

    const swapIndex = index + direction;
    const newList = [...subjects];
    const currentList = newList[index];
    const swapList = newList[swapIndex];
    
    const currentSort = currentList.sort_order;
    currentList.sort_order = swapList.sort_order;
    swapList.sort_order = currentSort;
    
    newList.sort((a,b) => a.sort_order - b.sort_order);
    setSubjects(newList);

    try {
      await reorderItems('subjects', [
        { id: currentList.id, sort_order: currentList.sort_order },
        { id: swapList.id, sort_order: swapList.sort_order }
      ]);
    } catch (err: any) {
      setErrorStatus(err.message || "Failed to save sort order.");
      loadData();
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto py-2 font-sans text-ink">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-rule pb-6">
        <div>
          <div className="flex items-center font-mono text-[9px] tracking-widest text-muted uppercase mb-1">
             <a href="/admin/exams" className="hover:text-ink">Exams</a> 
             <ChevronRight size={10} className="mx-1" />
             <span className="text-navy font-bold">{parentExam ? parentExam.name : "All Subjects"}</span>
          </div>
          <h1 className="font-serif text-3xl font-medium tracking-tight text-ink">Subjects Manager</h1>
        </div>
        <div>
          {examId ? (
            <Button variant="primary" onClick={openNewModal} className="gap-1.5 h-10 text-xs py-0 font-mono uppercase tracking-widest">
              <Plus size={14} /> add subject
            </Button>
          ) : (
             <p className="text-xs text-muted">Select an exam first to add a subject.</p>
          )}
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
        </div>
      ) : subjects.length === 0 ? (
        <div className="text-center py-20 bg-white border border-dashed border-rule rounded-xl">
          <AlertCircle className="mx-auto text-muted mb-3" size={32} />
          <h3 className="font-serif text-lg font-medium text-ink mb-1">No Subjects Registered</h3>
          <p className="text-xs text-muted max-w-sm mx-auto mb-6">Create subjects under this exam to build the hierarchy.</p>
          {examId && <Button variant="primary" onClick={openNewModal}>Add Subject</Button>}
        </div>
      ) : (
        <div className="bg-white border border-rule rounded-xl overflow-x-auto shadow-sm">
          <table className="w-full text-left border-collapse font-sans text-xs">
            <thead>
              <tr className="border-b border-rule font-mono uppercase tracking-wide text-muted text-[10px] bg-bg-2/50">
                <th className="py-3.5 px-4 font-semibold text-center w-20">Order</th>
                <th className="py-3.5 px-4 font-semibold">Subject Title</th>
                <th className="py-3.5 px-4 font-semibold">Description</th>
                <th className="py-3.5 px-4 font-semibold text-center">Status</th>
                <th className="py-3.5 px-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {subjects.map((subj, index) => (
                <tr key={subj.id} className="border-b border-rule/60 hover:bg-bg-2/30 transition-colors">
                  <td className="py-3 px-4 font-mono font-bold text-ink text-center">
                    <div className="flex items-center justify-center gap-1">
                       <button onClick={() => reorder(subj.id, -1)} disabled={index === 0} className="disabled:opacity-30 text-muted hover:text-ink cursor-pointer">▲</button>
                       <span className="text-[10px] w-6">#{subj.sort_order}</span>
                       <button onClick={() => reorder(subj.id, 1)} disabled={index === subjects.length - 1} className="disabled:opacity-30 text-muted hover:text-ink cursor-pointer">▼</button>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <div className="font-sans font-medium text-ink leading-relaxed mb-0.5">{subj.name}</div>
                  </td>
                  <td className="py-3 px-4 font-mono text-[10px] text-muted-2 truncate max-w-xs">
                    {subj.description || "-"}
                  </td>
                  <td className="py-3 px-4 text-center">
                    <button
                      onClick={() => toggleStatus(subj)}
                      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-mono text-[9px] font-semibold leading-relaxed transition-all cursor-pointer select-none border ${
                        subj.is_active
                          ? "bg-mint/15 text-emerald-700 border-mint/20 hover:bg-mint/20"
                          : "bg-amber-105 text-amber-700 border-amber-200/50 hover:bg-amber-100"
                      }`}
                    >
                      {subj.is_active ? <Eye size={10} /> : <EyeOff size={10} />}
                      {subj.is_active ? "ACTIVE" : "INACTIVE"}
                    </button>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <Button onClick={() => window.location.href = `/admin/subcategories?subject_id=${subj.id}`} variant="ghost" className="h-6 py-0 px-2 text-[10px]">
                        Subcats
                      </Button>
                      <button
                        onClick={() => openEditModal(subj)}
                        className="p-1 px-2 border border-rule hover:bg-bg-2 rounded text-ink cursor-pointer transition-colors"
                        title="Configure specs"
                      >
                        <Edit2 size={12} />
                      </button>
                      <button
                        onClick={() => handleDelete(subj.id, subj.name)}
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
          <div className="bg-white border border-rule-strong rounded-2xl w-full max-w-2xl shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-rule flex justify-between items-center bg-bg-2/30">
              <h3 className="font-serif text-lg font-medium text-ink flex items-center gap-2">
                <BookOpen size={18} className="text-navy" /> {isNew ? "Create Subject" : "Update Subject"}
              </h3>
              <button onClick={() => setIsEditing(false)} className="text-muted hover:text-ink cursor-pointer p-1">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-4 overflow-y-auto flex-1 text-xs">
              <div>
                <label className="block font-mono text-[9px] uppercase text-muted tracking-widest mb-1.5 font-bold">Subject Name</label>
                <input
                  type="text"
                  value={currentSubject.name || ""}
                  onChange={(e) => setCurrentSubject(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full text-xs p-2.5 bg-bg-2 border border-rule rounded-lg focus:outline-none focus:border-rule-strong text-ink font-semibold"
                  placeholder="e.g. Meteorology"
                  required
                />
              </div>

              <div>
                 <label className="block font-mono text-[9px] uppercase text-muted tracking-widest mb-1.5 font-bold">Description</label>
                 <textarea
                   value={currentSubject.description || ""}
                   onChange={(e) => setCurrentSubject(prev => ({ ...prev, description: e.target.value }))}
                   className="w-full text-xs p-2.5 bg-bg-2 border border-rule rounded-lg focus:outline-none focus:border-rule-strong text-ink font-sans h-24"
                   placeholder="Brief description..."
                 />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-mono text-[9px] uppercase text-muted tracking-widest mb-1.5 font-bold">Sort Order Sequence</label>
                  <input
                    type="number"
                    value={currentSubject.sort_order ?? 10}
                    onChange={(e) => setCurrentSubject((p) => ({ ...p, sort_order: Number(e.target.value) }))}
                    className="w-full font-mono text-xs p-2.5 bg-bg-2 border border-rule rounded-lg focus:outline-none focus:border-rule-strong font-semibold"
                    required
                  />
                </div>
                <div>
                  <label className="block font-mono text-[9px] uppercase text-muted tracking-widest mb-1.5 font-bold">Status</label>
                  <select
                    value={currentSubject.is_active ? "true" : "false"}
                    onChange={(e) => setCurrentSubject((p) => ({ ...p, is_active: e.target.value === "true" }))}
                    className="w-full font-mono text-xs p-2.5 bg-bg-2 border border-rule rounded-lg focus:outline-none focus:border-rule-strong h-[38px] text-ink font-semibold"
                  >
                    <option value="true">ACTIVE</option>
                    <option value="false">INACTIVE</option>
                  </select>
                </div>
              </div>

              <div className="border-t border-rule pt-4 flex gap-3 justify-end">
                <Button variant="ghost" type="button" onClick={() => setIsEditing(false)} className="h-10 py-1 text-xs">
                  Discard
                </Button>
                <Button variant="primary" type="submit" className="h-10 py-1 text-xs gap-1.5">
                  <Save size={14} /> Commit Subject
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
