import React, { useState, useEffect } from "react";
import { Button } from "../../components/Atoms";
import { Plus, Edit2, Trash2, Save, X, AlertCircle, Eye, EyeOff, CheckCircle2, Award, Sliders, Settings } from "lucide-react";
import { trackEvent } from "../../lib/track";
import { 
  fetchExams, 
  saveExam, 
  deleteExam, 
  fetchPublishedSubjects, 
  fetchPublishedSubcategories,
  fetchMockPapersForExam,
  saveMockPaper,
  deleteMockPaper,
  ExamInfo, 
  MockPaperSpec 
} from "../../lib/content";

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
  const [subcategoriesList, setSubcategoriesList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isNew, setIsNew] = useState(false);
  
  const [currentExam, setCurrentExam] = useState<Partial<ExamInfo>>({
    id: "",
    authority: "DGCA",
    license: "CPL",
    title: "",
    pass_mark: 70,
    total_questions: 50,
    question_count: 50,
    duration_min: 60,
    neg_marking_percent: 0,
    negative_marking: false,
    subject_ids: [],
    status: "draft",
  });

  const [errorStatus, setErrorStatus] = useState("");
  const [successStatus, setSuccessStatus] = useState("");

  // Managing Mock Papers associated with exam
  const [activeTab, setActiveTab] = useState<"specs" | "mocks">("specs");
  const [mockPapers, setMockPapers] = useState<MockPaperSpec[]>([]);
  const [loadingMocks, setLoadingMocks] = useState(false);
  const [editingMock, setEditingMock] = useState<Partial<MockPaperSpec> | null>(null);

  const loadData = async () => {
    setLoading(true);
    setErrorStatus("");
    try {
      const [allExams, listSubjects, listSubcats] = await Promise.all([
        fetchExams(),
        fetchPublishedSubjects(),
        fetchPublishedSubcategories()
      ]);
      setExams(allExams);
      setSubjectsList(listSubjects);
      setSubcategoriesList(listSubcats);
    } catch (err: any) {
      console.error("Error loaded exams telemetry:", err);
      setErrorStatus(err.message || "Failed to sync exams from database.");
    } finally {
      setLoading(false);
    }
  };

  const loadMocksForCurrentExam = async (examId: string) => {
    if (!examId) return;
    setLoadingMocks(true);
    try {
      const papers = await fetchMockPapersForExam(examId);
      setMockPapers(papers);
    } catch (err) {
      console.error("Error loading mock papers:", err);
    } finally {
      setLoadingMocks(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const openNewModal = () => {
    setIsNew(true);
    setActiveTab("specs");
    setMockPapers([]);
    setCurrentExam({
      id: "",
      authority: "DGCA",
      license: "CPL",
      title: "",
      pass_mark: 70,
      total_questions: 50,
      question_count: 50,
      duration_min: 60,
      neg_marking_percent: 0,
      negative_marking: false,
      subject_ids: [],
      status: "draft",
    });
    setErrorStatus("");
    setIsEditing(true);
  };

  const openEditModal = (exam: ExamInfo) => {
    setIsNew(false);
    setActiveTab("specs");
    setCurrentExam(exam);
    setErrorStatus("");
    setIsEditing(true);
    loadMocksForCurrentExam(exam.id);
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
      const totalQ = Number(currentExam.total_questions) || Number(currentExam.question_count) || 50;
      const negP = Number(currentExam.neg_marking_percent) || 0;
      
      const payload: ExamInfo = {
        id: targetId,
        authority: currentExam.authority || "DGCA",
        license: currentExam.license || "CPL",
        title: currentExam.title.trim(),
        pass_mark: Number(currentExam.pass_mark) || 70,
        total_questions: totalQ,
        question_count: totalQ,
        duration_min: Number(currentExam.duration_min) || 60,
        neg_marking_percent: negP,
        negative_marking: negP > 0,
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
        <div className="h-[160px] sm:h-[200px] md:h-[250px] flex flex-col items-center justify-center bg-paper border border-rule rounded-xl">
          <div className="w-10 h-10 border-4 border-ink border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="font-mono text-xs text-muted tracking-widest uppercase">Synchronizing exams index...</p>
        </div>
      ) : exams.length === 0 ? (
        <div className="text-center py-20 bg-paper border border-dashed border-rule rounded-xl">
          <AlertCircle className="mx-auto text-muted mb-3" size={32} />
          <h3 className="font-serif text-lg font-medium text-ink mb-1">No Custom Exams Defined</h3>
          <p className="text-xs text-muted max-w-sm mx-auto mb-6">Create exam definitions mapping to syllabus templates.</p>
          <Button variant="primary" onClick={openNewModal}>Configure Exam</Button>
        </div>
      ) : (
        <div className="bg-paper border border-rule rounded-xl overflow-x-auto shadow-sm">
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
                    {exam.total_questions || exam.question_count} items
                  </td>
                  <td className="py-3 px-4 text-center font-mono text-xs font-semibold text-muted-2">
                    {exam.duration_min} min
                  </td>
                  <td className="py-3 px-4 text-center font-mono text-xs font-bold text-navy">
                    {exam.pass_mark}%
                  </td>
                  <td className="py-3 px-4 text-center font-mono text-xs">
                    {(exam.neg_marking_percent && exam.neg_marking_percent > 0) ? (
                      <span className="text-signal font-semibold">Yes (-{exam.neg_marking_percent}%)</span>
                    ) : exam.negative_marking ? (
                      <span className="text-signal font-semibold">Yes (-25%)</span>
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
          <div className="bg-paper border border-rule-strong rounded-2xl w-full max-w-2xl shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
            
            {/* Modal Header */}
            <div className="p-6 border-b border-rule flex justify-between items-center bg-bg-2/30">
              <h3 className="font-serif text-lg font-medium text-ink flex items-center gap-2">
                <Award size={18} className="text-navy" /> {isNew ? "Configure Exam blueprint" : "Update Exam Details"}
              </h3>
              <button onClick={() => setIsEditing(false)} className="text-muted hover:text-ink cursor-pointer p-1">
                <X size={18} />
              </button>
            </div>

            {/* Modal Navigation Tabs */}
            {!isNew && (
              <div className="flex bg-bg-2 border-b border-rule px-6 font-mono text-[10px] uppercase font-bold tracking-wider">
                <button
                  type="button"
                  onClick={() => setActiveTab("specs")}
                  className={`py-3 px-4 border-b-2 transition-all cursor-pointer ${
                    activeTab === "specs" 
                      ? "border-navy text-navy font-bold" 
                      : "border-transparent text-muted hover:text-ink"
                  }`}
                >
                  <span className="flex items-center gap-1.5"><Settings size={12} /> General Specs</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("mocks")}
                  className={`py-3 px-4 border-b-2 transition-all cursor-pointer ${
                    activeTab === "mocks" 
                      ? "border-navy text-navy font-bold" 
                      : "border-transparent text-muted hover:text-ink"
                  }`}
                >
                  <span className="flex items-center gap-1.5"><Sliders size={12} /> Mock Papers Generator</span>
                </button>
              </div>
            )}

            {/* Active Workspace */}
            {activeTab === "specs" ? (
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
                      <option value="AIRLINE">AIRLINE</option>
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
                      <option value="RECRUITMENT">RECRUITMENT (Airline Selection)</option>
                      <option value="OTHER">OTHER</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block font-mono text-[9px] uppercase text-muted tracking-widest mb-1.5 font-bold">Total Questions Count</label>
                    <input
                      type="number"
                      value={currentExam.total_questions ?? currentExam.question_count ?? 50}
                      onChange={(e) => setCurrentExam((p) => ({ ...p, total_questions: Number(e.target.value), question_count: Number(e.target.value) }))}
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

                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <label className="block font-mono text-[9px] uppercase text-muted tracking-widest mb-1.5 font-bold">Negative Marking Percentage (e.g. 25.00 for -0.25 mark)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={currentExam.neg_marking_percent ?? 0}
                      onChange={(e) => setCurrentExam((p) => ({ ...p, neg_marking_percent: Number(e.target.value), negative_marking: Number(e.target.value) > 0 }))}
                      className="w-full font-mono text-xs p-2.5 bg-bg-2 border border-rule rounded-lg focus:outline-none focus:border-rule-strong font-semibold h-[38px]"
                      placeholder="e.g. 25"
                    />
                    <p className="font-mono text-[8.5px] text-muted-2 block mt-1 uppercase">Enter 0 for no negative marking. Negative marking and pass scores are read and computed dynamically on exam loads.</p>
                  </div>
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
                  <Button variant="ghost" type="button" onClick={() => setIsEditing(false)} className="h-10 py-1 text-xs">
                    Discard
                  </Button>
                  <Button variant="primary" type="submit" className="h-10 py-1 text-xs gap-1.5">
                    <Save size={14} /> Commit Specs
                  </Button>
                </div>
              </form>
            ) : (
              // Generator / configuration panel for customizable mock papers
              <div className="p-6 flex-1 overflow-y-auto flex flex-col h-full space-y-5 text-xs">
                {editingMock ? (
                  /* Create / Edit Form for Mock Paper */
                  <div className="border border-rule/80 rounded-xl p-4 bg-bg-2/30 space-y-4">
                    <div className="flex justify-between items-center border-b border-rule pb-2">
                      <h4 className="font-serif text-sm font-semibold text-ink">
                        {editingMock.id ? "Edit Mock Paper Rules" : "Add New Mock Paper Configuration"}
                      </h4>
                      <button
                        type="button"
                        onClick={() => setEditingMock(null)}
                        className="p-1 text-muted hover:text-ink cursor-pointer"
                      >
                        <X size={14} />
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block font-mono text-[9px] uppercase text-muted tracking-widest mb-1 font-bold">Mock Paper Title</label>
                        <input
                          type="text"
                          value={editingMock.title || ""}
                          onChange={(e) => setEditingMock(p => p ? ({ ...p, title: e.target.value }) : null)}
                          className="w-full text-xs p-2 bg-paper border border-rule rounded focus:outline-none focus:border-rule-strong text-ink font-semibold"
                          placeholder="e.g. Mock Study Paper One"
                          required
                        />
                      </div>
                      <div>
                        <label className="block font-mono text-[9px] uppercase text-muted tracking-widest mb-1 font-bold">Passing score (%)</label>
                        <input
                          type="number"
                          value={editingMock.pass_mark ?? 75}
                          onChange={(e) => setEditingMock(p => p ? ({ ...p, pass_mark: Number(e.target.value) }) : null)}
                          className="w-full font-mono text-xs p-2 bg-paper border border-rule rounded focus:outline-none/strong font-semibold"
                          required
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="block font-mono text-[9px] uppercase text-muted tracking-widest mb-1 font-bold">Total Questions</label>
                        <input
                          type="number"
                          value={editingMock.total_questions ?? 100}
                          onChange={(e) => setEditingMock(p => p ? ({ ...p, total_questions: Number(e.target.value) }) : null)}
                          className="w-full font-mono text-xs p-2 bg-paper border border-rule rounded font-semibold"
                          required
                        />
                      </div>
                      <div>
                        <label className="block font-mono text-[9px] uppercase text-muted tracking-widest mb-1 font-bold">Duration (Mins)</label>
                        <input
                          type="number"
                          value={editingMock.duration_min ?? 120}
                          onChange={(e) => setEditingMock(p => p ? ({ ...p, duration_min: Number(e.target.value) }) : null)}
                          className="w-full font-mono text-xs p-2 bg-paper border border-rule rounded font-semibold"
                          required
                        />
                      </div>
                      <div>
                        <label className="block font-mono text-[9px] uppercase text-muted tracking-widest mb-1 font-bold">Neg. marking (%)</label>
                        <input
                          type="number"
                          value={editingMock.neg_marking_percent ?? 0}
                          onChange={(e) => setEditingMock(p => p ? ({ ...p, neg_marking_percent: Number(e.target.value) }) : null)}
                          className="w-full font-mono text-xs p-2 bg-paper border border-rule rounded font-semibold"
                        />
                      </div>
                    </div>

                    {/* Weighting rules editor section */}
                    <div className="space-y-2">
                      <div className="flex justify-between items-center bg-bg-2 px-2.5 py-1.5 border border-rule rounded-md">
                        <span className="font-mono text-[9px] font-bold text-muted uppercase tracking-wider flex items-center gap-1">
                          <Sliders size={11} /> Weighting & Draw Rules
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            if (!editingMock) return;
                            const newRule = { subject_id: currentExam.subject_ids?.[0] || "", count: 10 };
                            setEditingMock(p => p ? ({ ...p, rules: [...(p.rules || []), newRule] }) : null);
                          }}
                          className="font-mono text-[8px] uppercase tracking-wider text-navy bg-paper hover:bg-bg-2 border border-blue/20 rounded px-2 py-0.5 cursor-pointer flex items-center gap-1 font-bold"
                        >
                          <Plus size={10} /> Add draw rule
                        </button>
                      </div>

                      <div className="space-y-2 max-h-[140px] overflow-y-auto">
                        {(editingMock.rules || []).map((rule, idx) => {
                          const subcats = subcategoriesList.filter(sc => sc.subject_id === rule.subject_id);
                          return (
                            <div key={idx} className="flex gap-2 items-center bg-paper p-2 border border-rule/50 rounded-lg">
                              <select
                                value={rule.subject_id}
                                onChange={(e) => {
                                  const updatedRules = [...(editingMock.rules || [])];
                                  updatedRules[idx] = { ...rule, subject_id: e.target.value, subcategory_id: undefined };
                                  setEditingMock(p => p ? ({ ...p, rules: updatedRules }) : null);
                                }}
                                className="w-1/3 text-xs p-1 bg-bg-2 border border-rule rounded text-ink focus:outline-none"
                              >
                                {(currentExam.subject_ids || []).map(sid => {
                                  const sMatch = subjectsList.find(s => s.id === sid);
                                  return (
                                    <option key={sid} value={sid}>
                                      {sMatch?.title || sid}
                                    </option>
                                  );
                                })}
                              </select>

                              <select
                                value={rule.subcategory_id || ""}
                                onChange={(e) => {
                                  const updatedRules = [...(editingMock.rules || [])];
                                  updatedRules[idx] = { ...rule, subcategory_id: e.target.value || undefined };
                                  setEditingMock(p => p ? ({ ...p, rules: updatedRules }) : null);
                                }}
                                className="w-1/3 text-xs p-1 bg-bg-2 border border-rule rounded text-ink focus:outline-none"
                              >
                                <option value="">-- All Subcategories --</option>
                                {subcats.map(subc => (
                                  <option key={subc.id} value={subc.id}>
                                    {subc.code ? `[${subc.code}] ` : ""}{subc.title}
                                  </option>
                                ))}
                              </select>

                              <span className="font-mono text-[10px] text-muted-2">Draw:</span>
                              <input
                                type="number"
                                value={rule.count}
                                onChange={(e) => {
                                  const updatedRules = [...(editingMock.rules || [])];
                                  updatedRules[idx] = { ...rule, count: Number(e.target.value) };
                                  setEditingMock(p => p ? ({ ...p, rules: updatedRules }) : null);
                                }}
                                className="w-12 text-xs font-mono p-1 border border-rule rounded text-center"
                                required
                              />

                              <button
                                type="button"
                                onClick={() => {
                                  const updatedRules = (editingMock.rules || []).filter((_, ri) => ri !== idx);
                                  setEditingMock(p => p ? ({ ...p, rules: updatedRules }) : null);
                                }}
                                className="p-1 border border-rose-100/50 hover:bg-rose-50 text-rose-500 rounded.sm"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          );
                        })}
                        {(editingMock.rules || []).length === 0 && (
                          <div className="text-center py-4 bg-paper rounded border border-rule border-dashed">
                            <Sliders size={18} className="mx-auto text-muted opacity-50 mb-1" />
                            <p className="font-mono text-[9px] text-muted uppercase tracking-wider select-none">No active draw rules defined. Draws will fall back to general exam weights.</p>
                          </div>
                        )}
                      </div>

                      {/* Display warning if item sum doesn't match total */}
                      {(() => {
                        const sum = (editingMock.rules || []).reduce((acc, r) => acc + r.count, 0);
                        if (sum !== editingMock.total_questions) {
                          return (
                            <div className="font-mono text-[8.5px] uppercase tracking-wider text-amber-600 bg-amber-500/10 p-2 rounded-md border border-amber-300/30">
                              Warning: Drawn rules add up to {sum} items, but mock total questions is {editingMock.total_questions}. Leftover items will draw proportionally.
                            </div>
                          );
                        }
                        return null;
                      })()}
                    </div>

                    <div className="grid grid-cols-2 gap-3 pt-2">
                      <div>
                        <label className="block font-mono text-[9px] uppercase text-muted tracking-widest mb-1 font-bold">Published State</label>
                        <select
                          value={editingMock.status || "draft"}
                          onChange={(e) => setEditingMock(p => p ? ({ ...p, status: e.target.value as any }) : null)}
                          className="w-full font-mono text-xs p-1.5 bg-paper border border-rule rounded"
                        >
                          <option value="draft">DRAFT</option>
                          <option value="published">PUBLISHED</option>
                        </select>
                      </div>

                      <div className="flex items-end justify-end gap-2">
                        <Button
                          variant="ghost"
                          type="button"
                          onClick={() => setEditingMock(null)}
                          className="py-1 h-8 text-[10px]"
                        >
                          Cancel
                        </Button>
                        <Button
                          variant="primary"
                          type="button"
                          onClick={async () => {
                            if (!editingMock.title) return;
                            try {
                              setErrorStatus("");
                              await saveMockPaper({
                                id: editingMock.id,
                                exam_id: currentExam.id!,
                                title: editingMock.title,
                                duration_min: Number(editingMock.duration_min) || 120,
                                pass_mark: Number(editingMock.pass_mark) || 75,
                                neg_marking_percent: Number(editingMock.neg_marking_percent) || 0,
                                total_questions: Number(editingMock.total_questions) || 100,
                                rules: editingMock.rules || [],
                                status: editingMock.status || "draft",
                              });
                              setEditingMock(null);
                              loadMocksForCurrentExam(currentExam.id!);
                            } catch (savErr: any) {
                              setErrorStatus(savErr.message || "Failed to commit mock configuration rules.");
                            }
                          }}
                          className="py-1 h-8 text-[10px] bg-navy text-white hover:bg-navy/90"
                        >
                          Save Mock Config
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* Standard List view of Mock Papers configurations */
                  <div className="space-y-4">
                    <div className="flex justify-between items-center bg-bg-2 p-3 border border-rule rounded-xl">
                      <div>
                        <h4 className="font-serif text-sm font-semibold text-ink">Mock Papers Blueprint</h4>
                        <p className="font-mono text-[8.5px] uppercase text-muted-2 block">Set specific weightings, draw amounts, and target tags for this simulation track.</p>
                      </div>
                      <Button
                        variant="primary"
                        onClick={() => {
                          setEditingMock({
                            title: `Mock Paper ${mockPapers.length + 1}`,
                            duration_min: currentExam.duration_min || 120,
                            pass_mark: currentExam.pass_mark || 75,
                            neg_marking_percent: currentExam.neg_marking_percent || 0,
                            total_questions: currentExam.total_questions || 100,
                            rules: [],
                            status: "draft"
                          });
                        }}
                        className="h-8 py-0 px-3 font-mono text-[8.5px] uppercase tracking-wider shrink-0 bg-navy hover:bg-navy/90"
                      >
                        <Plus size={12} /> add mock scheme
                      </Button>
                    </div>

                    {loadingMocks ? (
                      <div className="text-center py-6">
                        <div className="w-5 h-5 border-2 border-muted border-t-transparent rounded-full animate-spin mx-auto"></div>
                      </div>
                    ) : mockPapers.length === 0 ? (
                      <div className="text-center py-10 bg-bg-2/50 border border-dashed border-rule rounded-xl">
                        <Sliders className="mx-auto text-muted-2 opacity-50 mb-2" size={24} />
                        <h5 className="font-serif text-xs font-semibold text-ink mb-1">No Custom Mock Blueprints Generated</h5>
                        <p className="font-mono text-[8.5px] text-muted uppercase tracking-wider max-w-xs mx-auto mb-3">Create configurable mock structures with specific draws for student exams.</p>
                      </div>
                    ) : (
                      <div className="space-y-2.5">
                        {mockPapers.map((mock) => (
                          <div key={mock.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between border border-rule/80 hover:border-rule rounded-xl p-3.5 bg-paper shadow-sm transition-all gap-3">
                            <div>
                              <div className="font-serif font-semibold text-xs text-ink">{mock.title}</div>
                              <div className="font-mono text-[8.5px] text-muted uppercase tracking-wider mt-0.5 space-x-2">
                                <span className="text-navy font-bold">{mock.total_questions} Questions</span>
                                <span className="opacity-60">·</span>
                                <span className="text-muted-2">{mock.duration_min} Mins</span>
                                <span className="opacity-60">·</span>
                                <span className="text-navy font-bold">Pass: {mock.pass_mark}%</span>
                                {mock.neg_marking_percent > 0 && (
                                  <>
                                    <span className="opacity-60">·</span>
                                    <span className="text-signal font-semibold">Neg: -{mock.neg_marking_percent}%</span>
                                  </>
                                )}
                              </div>
                              {mock.rules && mock.rules.length > 0 && (
                                <div className="mt-2 flex flex-wrap gap-1.5 font-mono text-[8px] uppercase tracking-wider text-muted-2">
                                  {mock.rules.map((r, ri) => {
                                    const sMatch = subjectsList.find(s => s.id === r.subject_id);
                                    return (
                                      <span key={ri} className="bg-bg-2 px-1.5 py-0.5 border border-rule rounded">
                                        {sMatch?.title?.substring(0, 15) || r.subject_id}: {r.count}
                                      </span>
                                    );
                                  })}
                                </div>
                              )}
                            </div>

                            <div className="flex items-center gap-1.5 justify-end shrink-0">
                              <span className={`px-2 py-0.5 border font-mono text-[8.5px] rounded-md font-bold uppercase tracking-wider ${
                                mock.status === "published" 
                                  ? "bg-mint/15 text-emerald-705 border-mint/20" 
                                  : "bg-amber-100 text-amber-700/80 border-amber-200/50"
                              }`}>
                                {mock.status}
                              </span>
                              <button
                                type="button"
                                onClick={() => setEditingMock(mock)}
                                className="p-1 border border-rule hover:bg-bg-2 rounded text-ink cursor-pointer transition-colors"
                              >
                                <Edit2 size={11} />
                              </button>
                              <button
                                type="button"
                                onClick={async () => {
                                  if (!window.confirm(`Permanently delete mock paper blueprint '${mock.title}'?`)) return;
                                  try {
                                    await deleteMockPaper(mock.id);
                                    loadMocksForCurrentExam(currentExam.id!);
                                  } catch (err: any) {
                                    alert(err.message || "Failed to remove mock paper.");
                                  }
                                }}
                                className="p-1 border border-rose-200 hover:bg-rose-50 rounded text-rose-600 cursor-pointer transition-colors"
                              >
                                <Trash2 size={11} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
