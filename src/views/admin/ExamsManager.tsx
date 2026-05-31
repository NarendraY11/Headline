import React, { useState, useEffect } from "react";
import { Button } from "../../components/Atoms";
import { Plus, Edit2, Trash2, Save, X, AlertCircle, Eye, EyeOff, CheckCircle2, Award } from "lucide-react";
import { fetchItems, createItem, updateItem, deleteItem, toggleItemActive, reorderItems } from "../../lib/adminData";

// Using the new schema Exam
interface Exam {
  id: string;
  name: string;
  authority: string;
  pass_pct: number;
  duration_min: number;
  question_count: number;
  is_active: boolean;
  sort_order: number;
}

export default function ExamsManager() {
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isNew, setIsNew] = useState(false);
  
  const [currentExam, setCurrentExam] = useState<Partial<Exam>>({
    name: "",
    authority: "DGCA",
    pass_pct: 75,
    duration_min: 120,
    question_count: 100,
    is_active: true,
    sort_order: 0,
  });

  const [errorStatus, setErrorStatus] = useState("");
  const [successStatus, setSuccessStatus] = useState("");

  const loadData = async () => {
    setLoading(true);
    setErrorStatus("");
    try {
      const allExams = await fetchItems<Exam>('exams');
      setExams(allExams);
    } catch (err: any) {
      console.error("Error loaded exams:", err);
      // It's possible the table doesn't exist yet, we catch and show error.
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
      name: "",
      authority: "DGCA",
      pass_pct: 75,
      duration_min: 120,
      question_count: 100,
      is_active: true,
      sort_order: (exams.length + 1) * 10,
    });
    setErrorStatus("");
    setIsEditing(true);
  };

  const openEditModal = (exam: Exam) => {
    setIsNew(false);
    setCurrentExam(exam);
    setErrorStatus("");
    setIsEditing(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorStatus("");
    setSuccessStatus("");

    if (!currentExam.name?.trim()) {
      setErrorStatus("Name is a mandatory field.");
      return;
    }

    try {
      const payload = {
        name: currentExam.name.trim(),
        authority: currentExam.authority || "DGCA",
        pass_pct: Number(currentExam.pass_pct) || 75,
        duration_min: Number(currentExam.duration_min) || 120,
        question_count: Number(currentExam.question_count) || 100,
        is_active: currentExam.is_active ?? true,
        sort_order: Number(currentExam.sort_order) || 0,
      };

      if (isNew) {
        await createItem('exams', payload);
        setSuccessStatus(`Exam '${payload.name}' successfully posted.`);
      } else {
        await updateItem('exams', currentExam.id!, payload);
        setSuccessStatus(`Exam '${payload.name}' successfully updated.`);
      }

      setIsEditing(false);
      loadData();
    } catch (err: any) {
      console.error("Save exam error:", err);
      setErrorStatus(err.message || "Failed to commit exam package to database.");
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to permanently delete exam '${name}'? This operation is irreversible and will delete all nested subjects.`)) {
      return;
    }

    setLoading(true);
    setErrorStatus("");
    setSuccessStatus("");
    try {
      await deleteItem('exams', id);
      setSuccessStatus(`Exam '${name}' successfully removed.`);
      loadData();
    } catch (err: any) {
      console.error("Delete exam error:", err);
      setErrorStatus(err.message || "Failed to complete deletion process.");
      setLoading(false);
    }
  };

  const toggleStatus = async (exam: Exam) => {
    try {
      await toggleItemActive('exams', exam.id, exam.is_active);
      loadData();
    } catch (err: any) {
      console.error("Toggle exam status error:", err);
      setErrorStatus(err.message || "Failed to save state switch query.");
    }
  };

  const reorder = async (id: string, direction: 1 | -1) => {
    const index = exams.findIndex(e => e.id === id);
    if (index < 0) return;
    if (direction === -1 && index === 0) return;
    if (direction === 1 && index === exams.length - 1) return;

    const swapIndex = index + direction;
    const newExams = [...exams];
    const currentList = newExams[index];
    const swapList = newExams[swapIndex];
    
    // Swap sort orders conceptually
    const currentSort = currentList.sort_order;
    currentList.sort_order = swapList.sort_order;
    swapList.sort_order = currentSort;
    
    // Update locally for quick UI
    newExams.sort((a,b) => a.sort_order - b.sort_order);
    setExams(newExams);

    try {
      await reorderItems('exams', [
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
                <th className="py-3.5 px-4 font-semibold text-center w-20">Order</th>
                <th className="py-3.5 px-4 font-semibold">Authority</th>
                <th className="py-3.5 px-4 font-semibold">Exam Title</th>
                <th className="py-3.5 px-4 font-semibold text-center">Questions</th>
                <th className="py-3.5 px-4 font-semibold text-center">Duration (m)</th>
                <th className="py-3.5 px-4 font-semibold text-center">Pass %</th>
                <th className="py-3.5 px-4 font-semibold text-center">Status</th>
                <th className="py-3.5 px-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {exams.map((exam, index) => (
                <tr key={exam.id} className="border-b border-rule/60 hover:bg-bg-2/30 transition-colors">
                  <td className="py-3 px-4 font-mono font-bold text-ink text-center">
                    <div className="flex items-center justify-center gap-1">
                       <button onClick={() => reorder(exam.id, -1)} disabled={index === 0} className="disabled:opacity-30 text-muted hover:text-ink cursor-pointer">▲</button>
                       <span className="text-[10px] w-6">#{exam.sort_order}</span>
                       <button onClick={() => reorder(exam.id, 1)} disabled={index === exams.length - 1} className="disabled:opacity-30 text-muted hover:text-ink cursor-pointer">▼</button>
                    </div>
                  </td>
                  <td className="py-3 px-4 font-mono font-bold text-ink">
                    <span className="px-2 py-0.5 border border-rule bg-bg-2 text-ink text-[9px] uppercase tracking-wide rounded-md font-semibold">
                      {exam.authority}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <div className="font-sans font-medium text-ink leading-relaxed mb-0.5">{exam.name}</div>
                  </td>
                  <td className="py-3 px-4 text-center font-mono text-xs font-semibold text-muted-2">
                    {exam.question_count}
                  </td>
                  <td className="py-3 px-4 text-center font-mono text-xs font-semibold text-muted-2">
                    {exam.duration_min}
                  </td>
                  <td className="py-3 px-4 text-center font-mono text-xs font-bold text-navy">
                    {exam.pass_pct}%
                  </td>
                  <td className="py-3 px-4 text-center">
                    <button
                      onClick={() => toggleStatus(exam)}
                      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-mono text-[9px] font-semibold leading-relaxed transition-all cursor-pointer select-none border ${
                        exam.is_active
                          ? "bg-mint/15 text-emerald-700 border-mint/20 hover:bg-mint/20"
                          : "bg-amber-105 text-amber-700 border-amber-200/50 hover:bg-amber-100"
                      }`}
                    >
                      {exam.is_active ? <Eye size={10} /> : <EyeOff size={10} />}
                      {exam.is_active ? "ACTIVE" : "INACTIVE"}
                    </button>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <Button onClick={() => window.location.href = `/admin/subjects?exam_id=${exam.id}`} variant="ghost" className="h-6 py-0 px-2 text-[10px]">
                        Subjects
                      </Button>
                      <button
                        onClick={() => openEditModal(exam)}
                        className="p-1 px-2 border border-rule hover:bg-bg-2 rounded text-ink cursor-pointer transition-colors"
                        title="Configure specs"
                      >
                        <Edit2 size={12} />
                      </button>
                      <button
                        onClick={() => handleDelete(exam.id, exam.name)}
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
                <Award size={18} className="text-navy" /> {isNew ? "Configure Exam" : "Update Exam"}
              </h3>
              <button onClick={() => setIsEditing(false)} className="text-muted hover:text-ink cursor-pointer p-1">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-4 overflow-y-auto flex-1 text-xs">
              <div>
                <label className="block font-mono text-[9px] uppercase text-muted tracking-widest mb-1.5 font-bold">Exam Name</label>
                <input
                  type="text"
                  value={currentExam.name || ""}
                  onChange={(e) => setCurrentExam(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full text-xs p-2.5 bg-bg-2 border border-rule rounded-lg focus:outline-none focus:border-rule-strong text-ink font-semibold"
                  placeholder="e.g. DGCA CPL Meteorology"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-mono text-[9px] uppercase text-muted tracking-widest mb-1.5 font-bold">Sort Order</label>
                  <input
                    type="number"
                    value={currentExam.sort_order ?? 10}
                    onChange={(e) => setCurrentExam((p) => ({ ...p, sort_order: Number(e.target.value) }))}
                    className="w-full font-mono text-xs p-2.5 bg-bg-2 border border-rule rounded-lg focus:outline-none focus:border-rule-strong font-semibold"
                    required
                  />
                </div>
                <div>
                  <label className="block font-mono text-[9px] uppercase text-muted tracking-widest mb-1.5 font-bold">Pass Percentage</label>
                  <input
                    type="number"
                    value={currentExam.pass_pct ?? 75}
                    onChange={(e) => setCurrentExam((p) => ({ ...p, pass_pct: Number(e.target.value) }))}
                    className="w-full font-mono text-xs p-2.5 bg-bg-2 border border-rule rounded-lg focus:outline-none focus:border-rule-strong font-semibold"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-mono text-[9px] uppercase text-muted tracking-widest mb-1.5 font-bold">Authority</label>
                  <select
                    value={currentExam.authority || "DGCA"}
                    onChange={(e) => setCurrentExam((p) => ({ ...p, authority: e.target.value }))}
                    className="w-full font-mono text-xs p-2.5 bg-bg-2 border border-rule rounded-lg focus:outline-none focus:border-rule-strong h-[38px] text-ink font-semibold"
                  >
                    <option value="DGCA">DGCA</option>
                    <option value="EASA">EASA</option>
                    <option value="FAA">FAA</option>
                    <option value="TYPE_RATING">TYPE_RATING</option>
                    <option value="General">General</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-mono text-[9px] uppercase text-muted tracking-widest mb-1.5 font-bold">Question Count (Per generated paper)</label>
                  <input
                    type="number"
                    value={currentExam.question_count ?? 100}
                    onChange={(e) => setCurrentExam((p) => ({ ...p, question_count: Number(e.target.value) }))}
                    className="w-full font-mono text-xs p-2.5 bg-bg-2 border border-rule rounded-lg focus:outline-none focus:border-rule-strong font-semibold"
                    required
                  />
                </div>
                <div>
                  <label className="block font-mono text-[9px] uppercase text-muted tracking-widest mb-1.5 font-bold">Duration (Minutes)</label>
                  <input
                    type="number"
                    value={currentExam.duration_min ?? 120}
                    onChange={(e) => setCurrentExam((p) => ({ ...p, duration_min: Number(e.target.value) }))}
                    className="w-full font-mono text-xs p-2.5 bg-bg-2 border border-rule rounded-lg focus:outline-none focus:border-rule-strong font-semibold"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block font-mono text-[9px] uppercase text-muted tracking-widest mb-1.5 font-bold">Status</label>
                <select
                  value={currentExam.is_active ? "true" : "false"}
                  onChange={(e) => setCurrentExam((p) => ({ ...p, is_active: e.target.value === "true" }))}
                  className="w-full font-mono text-xs p-2.5 bg-bg-2 border border-rule rounded-lg focus:outline-none focus:border-rule-strong h-[38px] text-ink font-semibold"
                >
                  <option value="true">ACTIVE</option>
                  <option value="false">INACTIVE</option>
                </select>
              </div>

              <div className="border-t border-rule pt-4 flex gap-3 justify-end">
                <Button variant="ghost" type="button" onClick={() => setIsEditing(false)} className="h-10 py-1 text-xs">
                  Discard
                </Button>
                <Button variant="primary" type="submit" className="h-10 py-1 text-xs gap-1.5">
                  <Save size={14} /> Commit Settings
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
