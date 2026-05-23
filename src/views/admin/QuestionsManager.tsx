import React, { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import { Button } from "../../components/Atoms";
import { 
  Plus, Edit2, Trash2, Save, RefreshCw, AlertCircle, Eye, EyeOff, 
  CheckCircle2, ChevronLeft, ChevronRight, Search, Sparkles 
} from "lucide-react";
import { FlightControlsDiagram } from "../../components/SystemDiagram";
import { trackEvent } from "../../lib/track";

interface Subject {
  id: string;
  title: string;
}

interface Subcategory {
  id: string;
  subject_id: string;
  title: string;
  code: string | null;
}

interface Question {
  id: string;
  subcategory_id: string | null;
  subject_id: string | null;
  ata: string | null;
  difficulty: "standard" | "complex" | "extreme";
  prompt: string;
  diagram_caption: string | null;
  choices: { id: string; label: string }[];
  correct: string;
  explanation: string;
  references: string[];
  status: "draft" | "published" | "archived";
}

export default function QuestionsManager() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isNew, setIsNew] = useState(false);

  // Search/Filters states
  const [filterSubject, setFilterSubject] = useState("all");
  const [filterSubcategory, setFilterSubcategory] = useState("all");
  const [filterDifficulty, setFilterDifficulty] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50; // Paginate 50/page

  // Current edit state
  const [currentQuestion, setCurrentQuestion] = useState<Partial<Question>>({
    id: "",
    subject_id: "",
    subcategory_id: "",
    ata: "",
    difficulty: "standard",
    prompt: "",
    diagram_caption: "",
    choices: [
      { id: "a", label: "" },
      { id: "b", label: "" },
      { id: "c", label: "" },
      { id: "d", label: "" },
    ],
    correct: "a",
    explanation: "",
    references: [],
    status: "draft",
  });

  const [referencesInput, setReferencesInput] = useState("");
  const [errorStatus, setErrorStatus] = useState("");
  const [successStatus, setSuccessStatus] = useState("");

  // Live preview interactive states (simulating student practice)
  const [previewSelectedOption, setPreviewSelectedOption] = useState<string | null>(null);
  const [previewSubmitted, setPreviewSubmitted] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    setErrorStatus("");
    try {
      // 1. Fetch Subjects
      const { data: subjData } = await supabase.from("subjects").select("id, title").order("title");
      setSubjects(subjData || []);

      // 2. Fetch Subcategories
      const { data: subData } = await supabase.from("subcategories").select("id, subject_id, title, code").order("title");
      setSubcategories(subData || []);

      // 3. Fetch Questions
      const { data: qData, error: qErr } = await supabase
        .from("questions")
        .select("*")
        .order("created_at", { ascending: false });

      if (qErr) throw qErr;
      
      // Parse database fields safely ensuring correct types
      const parsedQuestions: Question[] = (qData || []).map((q: any) => ({
        id: q.id,
        subject_id: q.subject_id,
        subcategory_id: q.subcategory_id,
        ata: q.ata,
        difficulty: q.difficulty || "standard",
        prompt: q.prompt || "",
        diagram_caption: q.diagram_caption,
        choices: Array.isArray(q.choices) ? q.choices : [],
        correct: q.correct || "a",
        explanation: q.explanation || "",
        references: Array.isArray(q.refs) ? q.refs : (Array.isArray(q.references) ? q.references : []),
        status: q.status || "draft"
      }));

      setQuestions(parsedQuestions);
    } catch (err: any) {
      console.error("Failed to load questions database metrics:", err);
      setErrorStatus(err.message || "Failed to retrieve flight records database.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const openNewQuiz = () => {
    setIsNew(true);
    setPreviewSelectedOption(null);
    setPreviewSubmitted(false);
    
    const initialSubjectId = filterSubject !== "all" ? filterSubject : (subjects[0]?.id || "");
    const filteredSubs = subcategories.filter(s => s.subject_id === initialSubjectId);
    const initialSubId = filterSubcategory !== "all" && subcategories.find(s=>s.id === filterSubcategory)?.subject_id === initialSubjectId 
      ? filterSubcategory 
      : (filteredSubs[0]?.id || "");

    const nextPrompt = {
      id: "",
      subject_id: initialSubjectId,
      subcategory_id: initialSubId,
      ata: "",
      difficulty: "standard",
      prompt: "",
      diagram_caption: "",
      choices: [
        { id: "a", label: "" },
        { id: "b", label: "" },
        { id: "c", label: "" },
        { id: "d", label: "" },
      ],
      correct: "a",
      explanation: "",
      references: [],
      status: "draft",
    };

    setCurrentQuestion(nextPrompt);
    setReferencesInput("");
    setErrorStatus("");
    setSuccessStatus("");
    setIsEditing(true);

    // Dynamic ID calculation
    if (initialSubId) {
      const numInSub = questions.filter(quest => quest.subcategory_id === initialSubId).length;
      nextPrompt.id = `q-${initialSubId}-${String(numInSub + 1).padStart(3, "0")}`;
    }
  };

  const openEditQuiz = (q: Question) => {
    setIsNew(false);
    setPreviewSelectedOption(null);
    setPreviewSubmitted(false);

    // Synthesize correct option mappings
    let normalizedChoices = q.choices;
    if (!normalizedChoices || normalizedChoices.length < 4) {
      normalizedChoices = [
        { id: "a", label: q.choices?.[0]?.label || "" },
        { id: "b", label: q.choices?.[1]?.label || "" },
        { id: "c", label: q.choices?.[2]?.label || "" },
        { id: "d", label: q.choices?.[3]?.label || "" },
      ];
    }

    setCurrentQuestion({
      ...q,
      choices: normalizedChoices,
    });
    setReferencesInput(q.references ? q.references.join(", ") : "");
    setErrorStatus("");
    setSuccessStatus("");
    setIsEditing(true);
  };

  const handleFormSubjectChange = (subjectId: string) => {
    const parentSubs = subcategories.filter(s => s.subject_id === subjectId);
    const firstSubId = parentSubs[0]?.id || "";
    
    // Attempt auto-slug generation
    let autoId = currentQuestion.id || "";
    if (isNew && firstSubId) {
      const numInSub = questions.filter(quest => quest.subcategory_id === firstSubId).length;
      autoId = `q-${firstSubId}-${String(numInSub + 1).padStart(3, "0")}`;
    }

    setCurrentQuestion(p => ({
      ...p,
      subject_id: subjectId,
      subcategory_id: firstSubId,
      id: autoId
    }));
  };

  const handleFormSubcategoryChange = (subId: string) => {
    let autoId = currentQuestion.id || "";
    if (isNew && subId) {
      const numInSub = questions.filter(quest => quest.subcategory_id === subId).length;
      autoId = `q-${subId}-${String(numInSub + 1).padStart(3, "0")}`;
    }

    setCurrentQuestion(p => ({
      ...p,
      subcategory_id: subId,
      id: autoId
    }));
  };

  const handleChoiceChange = (idx: number, text: string) => {
    if (!currentQuestion.choices) return;
    const copiedChoices = [...currentQuestion.choices];
    copiedChoices[idx] = { ...copiedChoices[idx], label: text };
    setCurrentQuestion(p => ({ ...p, choices: copiedChoices }));
  };

  const handleSaveQuestion = async (overrideStatus?: "draft" | "published") => {
    setErrorStatus("");
    setSuccessStatus("");

    const targetId = currentQuestion.id?.trim();
    if (!targetId) {
      setErrorStatus("Primary question ID is required.");
      return;
    }
    if (!currentQuestion.prompt?.trim()) {
      setErrorStatus("Question prompt text must be populated.");
      return;
    }

    // Verify choice labels are fully filled out
    const cleanChoices = currentQuestion.choices?.map(c => ({ id: c.id, label: c.label.trim() })) || [];
    if (cleanChoices.length < 4 || cleanChoices.some(c => !c.label)) {
      setErrorStatus("All choices A, B, C, D must have solid text labels defined.");
      return;
    }

    // Process references
    const cleanRefs = referencesInput
      .split(/[,;\n|]+/)
      .map(r => r.trim())
      .filter(Boolean);

    const activeStatus = overrideStatus || currentQuestion.status || "draft";

    try {
      const payload = {
        id: targetId,
        subject_id: currentQuestion.subject_id || null,
        subcategory_id: currentQuestion.subcategory_id || null,
        ata: currentQuestion.ata?.trim() || null,
        difficulty: currentQuestion.difficulty || "standard",
        prompt: currentQuestion.prompt.trim(),
        diagram_caption: currentQuestion.diagram_caption?.trim() || null,
        choices: cleanChoices,
        correct: currentQuestion.correct || "a",
        explanation: currentQuestion.explanation?.trim() || "",
        refs: cleanRefs,
        status: activeStatus,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase.from("questions").upsert(payload);
      if (error) throw error;

      trackEvent(isNew ? "admin_create_question" : "admin_update_question", {
        subjectId: payload.subject_id || undefined,
        subcategoryId: payload.subcategory_id || undefined,
        questionId: payload.id,
        metadata: {
          prompt: payload.prompt.slice(0, 100) + (payload.prompt.length > 100 ? "..." : ""),
          difficulty: payload.difficulty,
          status: payload.status,
          details: isNew
            ? `Successfully created exam question: #${payload.id}`
            : `Updated settings of exam question: #${payload.id}`,
        },
      });

      setSuccessStatus(`Successfully committed and stored question ID: ${payload.id}`);
      setIsEditing(false);
      fetchData();
    } catch (err: any) {
      console.error("Database upsert question error:", err);
      setErrorStatus(err.message || "Failed to write question metrics to Supabase.");
    }
  };

  const handleDeleteQuestion = async (id: string) => {
    if (!window.confirm(`Are you absolutely sure you want to delete question '${id}'? This process is permanent.`)) {
      return;
    }
    setErrorStatus("");
    setSuccessStatus("");
    try {
      const { error } = await supabase.from("questions").delete().eq("id", id);
      if (error) throw error;

      trackEvent("admin_delete_question", {
        questionId: id,
        metadata: {
          details: `Deleted exam question: #${id}`,
        },
      });

      setSuccessStatus(`Deleted question '${id}' successfully.`);
      fetchData();
    } catch (err: any) {
      console.error("Delete question database error:", err);
      setErrorStatus(err.message || "Failed to remove selected database row.");
    }
  };

  const toggleStatusState = async (q: Question) => {
    const nextStatus = q.status === "published" ? "draft" : "published";
    try {
      const { error } = await supabase
        .from("questions")
        .update({ status: nextStatus, updated_at: new Date().toISOString() })
        .eq("id", q.id);

      if (error) throw error;

      trackEvent("admin_update_question", {
        subjectId: q.subject_id || undefined,
        subcategoryId: q.subcategory_id || undefined,
        questionId: q.id,
        metadata: {
          prompt: q.prompt.slice(0, 100) + (q.prompt.length > 100 ? "..." : ""),
          status: nextStatus,
          details: `Set exam question: #${q.id} state to: ${nextStatus.toUpperCase()}`,
        },
      });

      fetchData();
    } catch (err: any) {
      console.error("Status state change failure:", err);
      setErrorStatus(err.message || "Failed to switch status states.");
    }
  };

  // Perform filtering cascade clientside for accurate matching
  const filteredQuestions = questions.filter((q) => {
    const matchesSubject = filterSubject === "all" || q.subject_id === filterSubject;
    const matchesSubcategory = filterSubcategory === "all" || q.subcategory_id === filterSubcategory;
    const matchesDifficulty = filterDifficulty === "all" || q.difficulty === filterDifficulty;
    const matchesStatus = filterStatus === "all" || q.status === filterStatus;
    const matchesQuery = !searchQuery.trim() || 
      q.prompt.toLowerCase().includes(searchQuery.toLowerCase()) || 
      q.id.toLowerCase().includes(searchQuery.toLowerCase()) || 
      (q.explanation && q.explanation.toLowerCase().includes(searchQuery.toLowerCase()));

    return matchesSubject && matchesSubcategory && matchesDifficulty && matchesStatus && matchesQuery;
  });

  // Calculate pagination properties
  const totalPages = Math.ceil(filteredQuestions.length / itemsPerPage) || 1;
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const paginatedQuestions = filteredQuestions.slice(indexOfFirstItem, indexOfLastItem);

  const prevPage = () => setCurrentPage((p) => Math.max(1, p - 1));
  const nextPage = () => setCurrentPage((p) => Math.min(totalPages, p + 1));

  useEffect(() => {
    setCurrentPage(1);
  }, [filterSubject, filterSubcategory, filterDifficulty, filterStatus, searchQuery]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto py-2 font-sans text-ink">
      {!isEditing ? (
        // DASHBOARD REPOSITORY LIST
        <>
          {/* Header section */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-rule pb-6">
            <div>
              <div className="font-mono text-[9px] tracking-widest text-muted uppercase mb-1">Catalog Leaf Nodes</div>
              <h1 className="font-serif text-3xl font-medium tracking-tight text-ink">Questions Repository</h1>
            </div>
            <div className="flex gap-2 shrink-0">
              <button
                onClick={fetchData}
                disabled={loading}
                className="p-2 border border-rule hover:bg-bg-2 rounded-full transition-colors inline-flex justify-center items-center text-ink disabled:opacity-50 h-10 w-10 shrink-0"
                title="Refresh database state"
              >
                <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
              </button>
              
              <Button variant="primary" onClick={openNewQuiz} className="gap-1.5 h-10 text-xs py-0">
                <Plus size={14} /> add question
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

          {/* Core Navigation Filters */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 bg-white p-4 border border-rule rounded-xl shadow-sm">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full text-xs p-2.5 pl-9 bg-bg-2 border border-rule rounded-lg focus:outline-none focus:border-rule-strong text-ink font-mono"
                placeholder="Search prompt or ID..."
              />
            </div>

            <div>
              <select
                value={filterSubject}
                onChange={(e) => {
                  setFilterSubject(e.target.value);
                  setFilterSubcategory("all");
                }}
                className="w-full text-xs p-2.5 bg-bg-2 border border-rule rounded-lg focus:outline-none focus:border-rule-strong h-[38px] text-ink font-semibold"
              >
                <option value="all">Every Subject Domain</option>
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.title}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <select
                value={filterSubcategory}
                onChange={(e) => setFilterSubcategory(e.target.value)}
                className="w-full text-xs p-2.5 bg-bg-2 border border-rule rounded-lg focus:outline-none focus:border-rule-strong h-[38px] text-ink font-semibold"
              >
                <option value="all">Every Subcategory</option>
                {subcategories
                  .filter(s => filterSubject === "all" || s.subject_id === filterSubject)
                  .map((sub) => (
                    <option key={sub.id} value={sub.id}>
                      {sub.code ? `[${sub.code}] ` : ""}{sub.title}
                    </option>
                  ))}
              </select>
            </div>

            <div>
              <select
                value={filterDifficulty}
                onChange={(e) => setFilterDifficulty(e.target.value)}
                className="w-full text-xs p-2.5 bg-bg-2 border border-rule rounded-lg focus:outline-none focus:border-rule-strong h-[38px] text-ink font-semibold"
              >
                <option value="all">Any Difficulty</option>
                <option value="standard">Standard</option>
                <option value="complex">Complex</option>
                <option value="extreme">Extreme</option>
              </select>
            </div>

            <div>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="w-full text-xs p-2.5 bg-bg-2 border border-rule rounded-lg focus:outline-none focus:border-rule-strong h-[38px] text-ink font-semibold"
              >
                <option value="all">Any Status</option>
                <option value="draft">Draft (Hidden)</option>
                <option value="published">Published (Live)</option>
                <option value="archived">Archived</option>
              </select>
            </div>
          </div>

          {loading ? (
            <div className="h-[250px] flex flex-col items-center justify-center bg-white border border-rule rounded-xl">
              <div className="w-10 h-10 border-4 border-ink border-t-transparent rounded-full animate-spin mb-4"></div>
              <p className="font-mono text-xs text-muted tracking-widest uppercase">Fetching Aviation Questions...</p>
            </div>
          ) : paginatedQuestions.length === 0 ? (
            <div className="text-center py-20 bg-white border border-dashed border-rule rounded-xl">
              <AlertCircle className="mx-auto text-muted mb-3" size={32} />
              <h3 className="font-serif text-lg font-medium text-ink mb-1">No Questions Found</h3>
              <p className="text-xs text-muted max-w-sm mx-auto mb-6">Modify spelling filters or compile a new flight question node.</p>
              <Button variant="primary" onClick={openNewQuiz}>Add Question</Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-white border border-rule rounded-xl overflow-x-auto shadow-sm">
                <table className="w-full text-left border-collapse font-sans text-xs">
                  <thead>
                    <tr className="border-b border-rule font-mono uppercase tracking-wide text-muted text-[10px] bg-bg-2/50">
                      <th className="py-3.5 px-4 font-semibold w-24">ID</th>
                      <th className="py-3.5 px-4 font-semibold">Prompt Text Description</th>
                      <th className="py-3.5 px-4 font-semibold w-40">Sub-category</th>
                      <th className="py-3.5 px-4 font-semibold w-24 text-center">Difficulty</th>
                      <th className="py-3.5 px-4 font-semibold w-16 text-center">Correct</th>
                      <th className="py-3.5 px-4 font-semibold w-28 text-center">Status</th>
                      <th className="py-3.5 px-4 font-semibold w-24 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedQuestions.map((q) => {
                      const subcat = subcategories.find(s => s.id === q.subcategory_id);
                      return (
                        <tr 
                          key={q.id} 
                          className="border-b border-rule/60 hover:bg-bg-2/30 transition-colors cursor-pointer group"
                        >
                          <td 
                            className="py-3.5 px-4 font-mono font-semibold text-ink text-[11px]"
                            onClick={() => openEditQuiz(q)}
                          >
                            {q.id}
                          </td>
                          <td 
                            className="py-3.5 px-4 max-w-md"
                            onClick={() => openEditQuiz(q)}
                          >
                            <div className="font-sans font-medium text-ink leading-relaxed line-clamp-2">
                              {q.prompt}
                            </div>
                            {q.diagram_caption && (
                              <div className="font-mono text-[9px] text-sky mt-0.5 font-semibold">
                                ◰ Contains diagram: "{q.diagram_caption}"
                              </div>
                            )}
                          </td>
                          <td 
                            className="py-3.5 px-4 text-muted-2"
                            onClick={() => openEditQuiz(q)}
                          >
                            <div className="font-sans font-medium text-ink truncate max-w-[150px]" title={subcat?.title || ""}>
                              {subcat?.title || q.subcategory_id || "Unlinked"}
                            </div>
                            {q.ata && (
                              <div className="font-mono text-[9px] text-muted uppercase font-semibold">{q.ata}</div>
                            )}
                          </td>
                          <td 
                            className="py-3.5 px-4 text-center"
                            onClick={() => openEditQuiz(q)}
                          >
                            <span className={`inline-flex rounded-full px-2 py-0.5 font-mono text-[9px] font-bold uppercase border ${
                              q.difficulty === "extreme" ? "bg-rose-50 text-rose-700 border-rose-200" :
                              q.difficulty === "complex" ? "bg-amber-50 text-amber-700 border-amber-200" :
                              "bg-emerald-50 text-emerald-700 border-emerald-200"
                            }`}>
                              {q.difficulty}
                            </span>
                          </td>
                          <td 
                            className="py-3.5 px-4 text-center font-mono font-bold text-ink uppercase"
                            onClick={() => openEditQuiz(q)}
                          >
                            {q.correct}
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            <button
                              onClick={() => toggleStatusState(q)}
                              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-mono text-[9px] font-semibold leading-relaxed transition-all cursor-pointer select-none border ${
                                q.status === "published"
                                  ? "bg-mint/15 text-emerald-700 border-mint/20 hover:bg-mint/20"
                                  : "bg-amber-100 text-amber-700 border-amber-200/50 hover:bg-amber-150"
                              }`}
                            >
                              {q.status === "published" ? <Eye size={10} /> : <EyeOff size={10} />}
                              {q.status.toUpperCase()}
                            </button>
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5 opacity-60 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={() => openEditQuiz(q)}
                                className="p-1 px-2 border border-rule hover:bg-bg-2 rounded text-ink cursor-pointer transition-colors"
                                title="Edit question details"
                              >
                                <Edit2 size={12} />
                              </button>
                              <button
                                onClick={() => handleDeleteQuestion(q.id)}
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

              {/* Pagination controls */}
              <div className="flex justify-between items-center bg-white border border-rule rounded-xl px-4 py-3 shadow-sm font-sans">
                <span className="font-mono text-[10px] text-muted-2 uppercase tracking-wider">
                  Showing {indexOfFirstItem + 1} to {Math.min(indexOfLastItem, filteredQuestions.length)} of {filteredQuestions.length} records · Page {currentPage}/{totalPages}
                </span>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={prevPage}
                    disabled={currentPage === 1}
                    className="p-1.5 border border-rule hover:bg-bg-2 rounded-lg text-ink cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <button
                    onClick={nextPage}
                    disabled={currentPage === totalPages}
                    className="p-1.5 border border-rule hover:bg-bg-2 rounded-lg text-ink cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      ) : (
        // EXPANSIVE SIDE-BY-SIDE EDITOR WORKSPACE WITH INTERACTIVE LIVE PREVIEW
        <div className="flex flex-col gap-6 h-auto min-h-[calc(100vh-140px)]">
          {/* Editor Header Workspace Bar */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-rule pb-5">
            <div>
              <div className="font-mono text-[9px] tracking-widest text-[#00a3ff] uppercase mb-1 font-semibold flex items-center gap-1.5">
                <Sparkles size={11} className="text-blue" />
                Syllabi Content Studio
              </div>
              <h1 className="font-serif text-2xl font-medium tracking-tight text-ink">
                {isNew ? "Create Question Resource" : `Configure Question ID: ${currentQuestion.id}`}
              </h1>
            </div>

            <div className="flex items-center gap-2">
              <Button 
                variant="ghost" 
                onClick={() => setIsEditing(false)} 
                className="h-10 text-xs text-ink font-semibold border border-rule hover:bg-bg-2 px-4"
              >
                Back to List
              </Button>
              <Button 
                variant="ghost" 
                onClick={() => handleSaveQuestion("draft")} 
                className="h-10 text-xs hover:bg-rule font-semibold text-ink border border-rule/80 px-4"
              >
                Save as Draft
              </Button>
              <Button 
                variant="primary" 
                onClick={() => handleSaveQuestion("published")} 
                className="h-10 text-xs font-semibold gap-1.5 px-4"
              >
                <Save size={14} /> Save & Publish
              </Button>
            </div>
          </div>

          {errorStatus && (
            <div className="p-4 bg-rose-500/10 border border-rose-500/30 text-rose-800 rounded-lg text-xs flex items-center gap-3">
              <AlertCircle size={16} className="shrink-0" />
              <span>{errorStatus}</span>
            </div>
          )}

          {/* Core Twin Layout Column Structure */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            
            {/* LEFT COLUMN: CRITICAL DATA ENTRY FORM (7 Cols wide) */}
            <form onSubmit={(e) => { e.preventDefault(); handleSaveQuestion(); }} className="lg:col-span-7 bg-white border border-rule rounded-2xl p-6 shadow-sm space-y-5">
              
              <div className="text-[11px] font-mono uppercase tracking-widest text-muted-2 font-bold border-b border-rule pb-2 mb-2">
                1. Domain Categorization
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-mono text-[9px] uppercase text-muted tracking-widest mb-1.5 font-bold">Parent Subject Link</label>
                  <select
                    value={currentQuestion.subject_id || ""}
                    onChange={(e) => handleFormSubjectChange(e.target.value)}
                    className="w-full text-xs p-2.5 bg-bg-2 border border-rule rounded-lg focus:outline-none focus:border-rule-strong h-[38px] text-ink font-semibold"
                    required
                  >
                    <option value="" disabled>-- Choose parent subject --</option>
                    {subjects.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.title}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-mono text-[9px] uppercase text-muted tracking-widest mb-1.5 font-bold">Subcategory Link</label>
                  <select
                    value={currentQuestion.subcategory_id || ""}
                    onChange={(e) => handleFormSubcategoryChange(e.target.value)}
                    className="w-full text-xs p-2.5 bg-bg-2 border border-rule rounded-lg focus:outline-none focus:border-rule-strong h-[38px] text-ink font-semibold"
                    required
                  >
                    <option value="" disabled>-- Pick subcategory node --</option>
                    {subcategories
                      .filter(s => s.subject_id === currentQuestion.subject_id)
                      .map((sub) => (
                        <option key={sub.id} value={sub.id}>
                          {sub.code ? `[${sub.code}] ` : ""}{sub.title}
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-1">
                  <label className="block font-mono text-[9px] uppercase text-muted tracking-widest mb-1.5 font-bold">ATA Chapter Code</label>
                  <input
                    type="text"
                    value={currentQuestion.ata || ""}
                    onChange={(e) => setCurrentQuestion(p => ({ ...p, ata: e.target.value.toUpperCase() }))}
                    className="w-full font-mono text-xs p-2.5 bg-bg-2 border border-rule rounded-lg focus:outline-none focus:border-rule-strong text-ink font-bold"
                    placeholder="e.g. ATA-34"
                  />
                </div>

                <div className="sm:col-span-1">
                  <label className="block font-mono text-[9px] uppercase text-muted tracking-widest mb-1.5 font-bold">Syllabus Difficulty</label>
                  <select
                    value={currentQuestion.difficulty || "standard"}
                    onChange={(e) => setCurrentQuestion(p => ({ ...p, difficulty: e.target.value as any }))}
                    className="w-full font-mono text-xs p-2.5 bg-bg-2 border border-rule rounded-lg focus:outline-none focus:border-rule-strong h-[38px] text-ink font-semibold"
                  >
                    <option value="standard">Standard Level</option>
                    <option value="complex">Complex Level</option>
                    <option value="extreme">Extreme Level</option>
                  </select>
                </div>

                <div className="sm:col-span-1">
                  <label className="block font-mono text-[9px] uppercase text-muted tracking-widest mb-1.5 font-bold">Question Unique ID</label>
                  <input
                    type="text"
                    value={currentQuestion.id || ""}
                    onChange={(e) => setCurrentQuestion(p => ({ ...p, id: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") }))}
                    className="w-full font-mono text-xs p-2.5 bg-bg-2 border border-rule rounded-lg focus:outline-none focus:border-rule-strong text-ink font-bold"
                    placeholder="e.g. q-ata-21-002"
                    required
                  />
                  {isNew && <span className="font-mono text-[8px] text-muted-2 block mt-1">Generated and fully editable</span>}
                </div>
              </div>

              <div className="text-[11px] font-mono uppercase tracking-widest text-muted-2 font-bold border-b border-rule pt-3 pb-2 mb-2">
                2. Interrogatory & Media Content
              </div>

              <div>
                <label className="block font-mono text-[9px] uppercase text-muted tracking-widest mb-1.5 font-bold">Target Question Prompt</label>
                <textarea
                  value={currentQuestion.prompt || ""}
                  onChange={(e) => setCurrentQuestion(p => ({ ...p, prompt: e.target.value }))}
                  className="w-full text-xs p-3 bg-bg-2 border border-rule rounded-xl focus:outline-none focus:border-rule-strong h-24 text-ink leading-relaxed font-sans"
                  placeholder="Insert core pilot interrogatory text prompt. Ensure perfect grammatic standards..."
                  required
                />
              </div>

              <div>
                <label className="block font-mono text-[9px] uppercase text-muted tracking-widest mb-1.5 font-bold">Aviation Diagram Caption (Optional)</label>
                <input
                  type="text"
                  value={currentQuestion.diagram_caption || ""}
                  onChange={(e) => setCurrentQuestion(p => ({ ...p, diagram_caption: e.target.value }))}
                  className="w-full text-xs p-2.5 bg-bg-2 border border-rule rounded-lg focus:outline-none focus:border-rule-strong text-ink"
                  placeholder="e.g. FIG 12.3: Sidestick Autoland Disconnect Sequence"
                />
                <span className="font-mono text-[8px] text-muted-2 block mt-1">
                  If filled out, a premium wireframe flight controls diagram preview automatically renders!
                </span>
              </div>

              <div className="text-[11px] font-mono uppercase tracking-widest text-muted-2 font-bold border-b border-rule pt-3 pb-2 mb-2">
                3. Multiple Choice Matrix (A / B / C / D)
              </div>

              <div className="space-y-3">
                {["a", "b", "c", "d"].map((letter, i) => {
                  const upperLetter = letter.toUpperCase();
                  const isChecked = currentQuestion.correct === letter;
                  return (
                    <div key={letter} className="flex items-center gap-3 bg-bg-2/30 p-3 rounded-lg border border-rule/50">
                      <div className="flex items-center justify-center shrink-0">
                        <input
                          type="radio"
                          id={`correct-${letter}`}
                          name="correctSelection"
                          checked={isChecked}
                          onChange={() => setCurrentQuestion(p => ({ ...p, correct: letter }))}
                          className="w-4 h-4 text-ink border-rule focus:ring-ink"
                        />
                      </div>
                      <span className="font-mono text-[11px] font-bold text-ink w-6 text-center bg-bg-2 border border-rule py-1 rounded">
                        {upperLetter}
                      </span>
                      <input
                        type="text"
                        value={currentQuestion.choices?.[i]?.label || ""}
                        onChange={(e) => handleChoiceChange(i, e.target.value)}
                        className="flex-1 text-xs p-2 bg-white border border-rule rounded-lg focus:outline-none focus:border-rule-strong text-ink"
                        placeholder={`Option ${upperLetter} answer option text label...`}
                        required
                      />
                    </div>
                  );
                })}
              </div>

              <div className="text-[11px] font-mono uppercase tracking-widest text-muted-2 font-bold border-b border-rule pt-3 pb-2 mb-2">
                4. Explanations & Sourced Citations
              </div>

              <div>
                <label className="block font-mono text-[9px] uppercase text-muted tracking-widest mb-1.5 font-bold">Model Rationale Explanation</label>
                <textarea
                  value={currentQuestion.explanation || ""}
                  onChange={(e) => setCurrentQuestion(p => ({ ...p, explanation: e.target.value }))}
                  className="w-full text-xs p-3 bg-bg-2 border border-rule rounded-xl focus:outline-none focus:border-rule-strong h-24 text-ink leading-relaxed font-sans"
                  placeholder="Provide precise aviation technical explanation for the correct answer rationale..."
                />
              </div>

              <div>
                <label className="block font-mono text-[9px] uppercase text-muted tracking-widest mb-1.5 font-bold">References & Citations</label>
                <input
                  type="text"
                  value={referencesInput}
                  onChange={(e) => setReferencesInput(e.target.value)}
                  className="w-full text-xs p-2.5 bg-bg-2 border border-rule rounded-lg focus:outline-none focus:border-rule-strong text-ink font-mono"
                  placeholder="e.g. FCOM 1.25.10, A320 FCTM NP-SF, CAR Section 8 (separate with commas)"
                />
                <span className="font-mono text-[8px] text-muted-2 block mt-1">Comma-separated system. Ex: "FCOM 1.27.20, FAA AC 120-74"</span>
              </div>

              <div>
                <label className="block font-mono text-[9px] uppercase text-muted tracking-widest mb-1.5 font-bold">Database Lifecycle Status</label>
                <select
                  value={currentQuestion.status || "draft"}
                  onChange={(e) => setCurrentQuestion(p => ({ ...p, status: e.target.value as any }))}
                  className="w-full font-mono text-xs p-2.5 bg-bg-2 border border-rule rounded-lg focus:outline-none focus:border-rule-strong h-[38px] text-ink font-semibold"
                >
                  <option value="draft">DRAFT (Saves content but hides from students)</option>
                  <option value="published">PUBLISHED (Live for student practice/simulation)</option>
                  <option value="archived">ARCHIVED</option>
                </select>
              </div>

              {/* Action Buttons */}
              <div className="border-t border-rule pt-4 flex gap-3 justify-end">
                <Button 
                  variant="ghost" 
                  onClick={() => setIsEditing(false)} 
                  className="h-10 text-xs px-4"
                >
                  Discard Changes
                </Button>
                <Button 
                  variant="primary" 
                  type="submit" 
                  className="h-10 text-xs gap-1.5 px-6 font-semibold"
                >
                  <Save size={14} /> Commit Question
                </Button>
              </div>
            </form>

            {/* RIGHT COLUMN: GORGEOUS EDITORIAL INTERACTIVE STUDENT PREVIEW (5 Cols wide) */}
            <div className="lg:col-span-5 space-y-4 lg:sticky lg:top-4">
              <div className="font-mono text-[10px] uppercase text-muted tracking-widest font-bold flex items-center justify-between px-1">
                <span>INTERACTIVE LIVE PREVIEW</span>
                <span className="text-mint text-[9px] lowercase font-semibold border border-mint/30 bg-mint/5 px-2 py-0.5 rounded-full">editorial client template</span>
              </div>

              {/* Replica Quiz Card Wrapper with real styling from EditorialLayout */}
              <div className="bg-white border-2 border-rule rounded-2xl overflow-hidden shadow-md flex flex-col p-6 min-h-[500px]">
                
                {/* Meta header labels */}
                <div className="flex items-center justify-between border-b border-rule pb-3.5 mb-5">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[10px] text-bg bg-ink tracking-widest uppercase font-bold px-2.5 py-0.5 rounded">
                      {currentQuestion.ata || "ATA-XX"}
                    </span>
                    <span className="font-mono text-[10px] text-muted-2 tracking-wide uppercase">
                      {subcategories.find(s=>s.id === currentQuestion.subcategory_id)?.code || "CHAPTER"}
                    </span>
                  </div>
                  
                  <span className={`font-mono text-[9px] uppercase tracking-wider font-bold border rounded-full px-2 py-0.5 ${
                    currentQuestion.difficulty === "extreme" ? "border-rose-200 text-rose-700 bg-rose-50" :
                    currentQuestion.difficulty === "complex" ? "border-amber-200 text-amber-700 bg-amber-50" :
                    "border-emerald-200 text-emerald-700 bg-emerald-50"
                  }`}>
                    {currentQuestion.difficulty || "standard"}
                  </span>
                </div>

                {/* Subcategory Name & ID */}
                <div className="mb-3">
                  <span className="font-mono text-[9px] uppercase tracking-widest text-muted-2 flex items-center gap-1">
                    <span className="text-signal text-[11px] leading-none mb-[1px]">♦</span> 
                    {currentQuestion.id || "q-temporary-000"}
                  </span>
                </div>

                {/* Interactive Question Prompt in elegant display serif fonts */}
                <h2 className="font-serif text-[24px] text-ink leading-tight tracking-tight mb-5 min-h-[40px]">
                  {currentQuestion.prompt || "Start writing prompt interrogatory parameters to populate interactive card mockup..."}
                </h2>

                {/* Simulated optional Flight controls diagram */}
                {currentQuestion.diagram_caption && (
                  <div className="w-full mb-6 border border-rule rounded-xl overflow-hidden relative" style={{ 
                    backgroundImage: 'linear-gradient(var(--rule) 1px, transparent 1px), linear-gradient(90deg, var(--rule) 1px, transparent 1px)', 
                    backgroundSize: '30px 30px',
                    backgroundColor: '#fafafa'
                  }}>
                     <div className="w-full h-36 flex items-center justify-center opacity-85 hover:opacity-100 transition-opacity">
                       <FlightControlsDiagram />
                     </div>
                     <div className="absolute bottom-0 right-0 font-mono text-[8px] uppercase tracking-wide text-muted bg-white border-t border-l border-rule px-2 py-1 rounded-tl-lg font-bold">
                       {currentQuestion.diagram_caption}
                     </div>
                  </div>
                )}

                {/* Choices stack standard dynamic client simulator styling */}
                <div className="space-y-2.5 mb-6">
                  {(currentQuestion.choices || []).map((choice, idx) => {
                    const charLetter = ["A", "B", "C", "D"][idx];
                    const isCorrect = choice.id === currentQuestion.correct;
                    const isSelected = previewSelectedOption === choice.id;

                    let choiceStyle = "bg-bg-2/20 border-rule text-ink hover:bg-bg-2/40 cursor-pointer";
                    let innerBadgeMarkup = <span className="font-mono text-[10px] text-muted-2 font-bold">{charLetter}</span>;

                    if (previewSubmitted) {
                      if (isCorrect) {
                        choiceStyle = "bg-mint/10 border-mint text-emerald-800 scale-[1.01] transition-transform";
                        innerBadgeMarkup = <span className="font-mono text-[10px] text-emerald-600 font-bold">✓</span>;
                      } else if (isSelected) {
                        choiceStyle = "bg-rose-50 border-rose-300 text-rose-800";
                        innerBadgeMarkup = <span className="font-mono text-[10px] text-rose-600 font-bold">✗</span>;
                      } else {
                        choiceStyle = "opacity-45 bg-transparent border-rule/50";
                      }
                    } else if (isSelected) {
                      choiceStyle = "border-ink bg-white ring-1 ring-ink font-semibold";
                    }

                    return (
                      <div
                        key={choice.id}
                        className={`p-3.5 rounded-xl border flex items-center gap-3.5 transition-all text-left outline-none ${choiceStyle}`}
                        onClick={() => {
                          if (!previewSubmitted) {
                            setPreviewSelectedOption(choice.id);
                          }
                        }}
                      >
                        <div className="w-6.5 h-6.5 rounded-full border border-current flex items-center justify-center shrink-0 bg-white shadow-sm">
                          {innerBadgeMarkup}
                        </div>
                        <span className="font-sans text-xs font-semibold leading-snug">{choice.label || `Choice value ${charLetter} is empty`}</span>
                      </div>
                    );
                  })}
                </div>

                {/* Live simulation control actions */}
                <div className="flex gap-2 mb-6 border-b border-dashed border-rule pb-4">
                  <button
                    type="button"
                    onClick={() => {
                      if (previewSelectedOption) {
                        setPreviewSubmitted(true);
                      }
                    }}
                    disabled={!previewSelectedOption || previewSubmitted}
                    className="flex-1 py-2 bg-ink text-bg text-[10px] font-mono tracking-wider font-bold uppercase rounded-lg disabled:opacity-30 disabled:cursor-not-allowed hover:bg-ink-2 transition-colors h-9"
                  >
                    Simulate Submit
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPreviewSelectedOption(null);
                      setPreviewSubmitted(false);
                    }}
                    className="px-3.5 py-2 border border-rule text-ink hover:bg-bg-2 text-[10px] font-mono uppercase font-bold rounded-lg h-9"
                    title="Reset choice simulations"
                  >
                    Reset
                  </button>
                </div>

                {/* Dynamic Explanation preview rendered instantly! */}
                {(!previewSubmitted && currentQuestion.explanation) && (
                  <div className="font-sans text-[10px] text-muted-2 text-center italic py-2">
                    Submit the simulated question above to reveal technical instructor rationale...
                  </div>
                )}

                {(previewSubmitted || currentQuestion.explanation) && (
                  <div className="border-l-4 border-mint bg-panel p-4 rounded-r-xl transition-all">
                    <span className="font-mono text-[8px] text-emerald-800 tracking-widest uppercase font-bold block mb-1">MODEL RATIONALE</span>
                    <p className="font-serif text-sm leading-relaxed text-ink mb-3.5 whitespace-pre-line min-h-[30px]">
                      {currentQuestion.explanation || "No TECHNICAL explanation text written yet. Compile some rationale context..."}
                    </p>
                    
                    {/* References dynamic tokens */}
                    <div className="flex flex-wrap gap-1.5 pt-1 border-t border-rule/50">
                      {referencesInput ? (
                        referencesInput.split(/[,;\n|]+/).map((ref, idx) => {
                          const trimRef = ref.trim();
                          if (!trimRef) return null;
                          return (
                            <span key={idx} className="font-mono text-[8px] text-muted-2 tracking-wide border border-rule bg-white py-0.5 px-2 rounded font-semibold uppercase">
                              {trimRef}
                            </span>
                          );
                        })
                      ) : (
                        <span className="font-mono text-[8px] text-muted-2 italic">No sourcing citations given</span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
