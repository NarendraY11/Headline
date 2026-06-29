import {
    Activity,
    ArrowLeft,
    ArrowUpRight,
    Clipboard,
    Clock,
    Layers,
    PlaneTakeoff,
    RefreshCw,
    Timer,
    TrendingUp
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button, Card } from "../components/Atoms";
import { ProGate } from "../components/ProGate";
import { useToast } from "../components/ui/Toast";
import { useAuth } from "../contexts/AuthContext";
import { Question } from "../data/questions";
import { SubjectItem } from "../data/topics";
import {
    ExamInfo,
    fetchExams,
    fetchMergedSubjects,
    fetchMockPapersForExam,
    fetchPublishedQuestions,
    MockPaperSpec
} from "../lib/content";
import { getEligibleExams, getEligibleQuestions } from "../lib/contentQueries";
import { quizStateKey } from "../lib/storageKeys";
import { PageBackground } from "../components/PageBackground";
import { useContentScope } from "../hooks/useContentScope";
import { useFeature } from "../hooks/useFeatureFlags";
import { supabase } from "../lib/supabase";

export default function MockExamsView() {
  const navigate = useNavigate();
  const location = useLocation();
  const webmcpHandledRef = useRef(false);
  const { showToast } = useToast();
  
  const { user } = useAuth();
  const contentDeliveryEnabled = useFeature("contentDeliveryEngine");
  const { scope } = useContentScope(contentDeliveryEnabled);
  const [attempts, setAttempts] = useState<any[]>([]);
  const [loadingAttempts, setLoadingAttempts] = useState(false);

  const fetchAttempts = async () => {
    if (!user) return;
    setLoadingAttempts(true);
    try {
      const { data, error } = await supabase
        .from("attempts")
        .select("*")
        .eq("user_id", user.uid)
        .order("created_at", { ascending: false });
      if (!error && data) {
        setAttempts(data);
      }
    } catch (err) {
      console.error("Error loading mock exam attempts:", err);
    } finally {
      setLoadingAttempts(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchAttempts();
    }
  }, [user]);
  
  const [selectedCompliance, setSelectedCompliance] = useState<string>("all");
  const [exams, setExams] = useState<ExamInfo[]>([]);
  const [subjects, setSubjects] = useState<SubjectItem[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);

  // Detail deck state
  const [selectedExamId, setSelectedExamId] = useState<string | null>(null);
  const [selectedExamMocks, setSelectedExamMocks] = useState<MockPaperSpec[]>([]);
  const [loadingMocks, setLoadingMocks] = useState(false);
  const [activeTab, setActiveTab] = useState<"practice" | "subject" | "full">("practice");

  useEffect(() => {
    async function initData() {
      try {
        const [examList, subjectList, questionList] = await Promise.all([
          fetchExams(),
          fetchMergedSubjects(),
          contentDeliveryEnabled
            ? getEligibleQuestions(scope)
            : fetchPublishedQuestions(),
        ]);
        const published = examList.filter((e) => e.status === "published");
        setExams(
          contentDeliveryEnabled ? getEligibleExams(scope, published) : published
        );
        setSubjects(subjectList);
        setQuestions(questionList);
      } catch (err) {
        console.error("Error loading mock simulation workspace:", err);
      } finally {
        setLoading(false);
      }
    }
    initData();
  }, [contentDeliveryEnabled, scope]);

  const handleSelectExam = async (examId: string) => {
    setSelectedExamId(examId);
    setActiveTab("practice");
    setLoadingMocks(true);
    try {
      const mocks = await fetchMockPapersForExam(examId);
      // Filter published or complete mock configurations
      setSelectedExamMocks(mocks.filter(m => m.status === "published" || m.status === "draft"));
    } catch (err) {
      console.error("Error fetching mock spec templates:", err);
    } finally {
      setLoadingMocks(false);
    }
  };

  const getExamQuestionsCount = (exam: ExamInfo) => {
    const examSubjects = subjects.filter(sub => exam.subject_ids?.includes(sub.id));
    return questions.filter(q => {
      return examSubjects.some(subject => q.topicId === subject.id || subject.subTopics?.some(st => st.id === q.topicId));
    }).length;
  };

  // MODE A: Start Subcategory Syllabus Practice
  const handleStartSubcategoryPractice = (subcategory_id: string) => {
    navigate(`/quiz/${subcategory_id}`);
  };

  // MODE B: Start Subject-Level Sampling Mock
  const handleStartSubjectMock = (subject: SubjectItem, exam: ExamInfo) => {
    const subjectQuests = questions.filter(q => q.topicId === subject.id || subject.subTopics?.some(st => st.id === q.topicId));
    
    // Draw 30 random sample questions of this subject
    const shuffled = [...subjectQuests].sort(() => 0.5 - Math.random());
    const sampleCount = Math.min(30, shuffled.length);
    const selectedQuests = shuffled.slice(0, sampleCount);
    
    if (selectedQuests.length === 0) {
      showToast({
        type: "error",
        title: "Syllabus Dry",
        message: "No published questions recorded in this subject yet.",
        duration: 5000,
      });
      return;
    }
    
    const sessionKey = `heading_subject_mock_${subject.id}_quests`;
    const sessionData = {
      expiresAt: Date.now() + 2 * 60 * 60 * 1000,
      questions: selectedQuests,
    };
    sessionStorage.setItem(sessionKey, JSON.stringify(sessionData));
    
    navigate(`/quiz/subject-${subject.id}`, {
      state: {
        sessionStorageKey: sessionKey,
        overridePassMark: exam.pass_mark,
        overrideTimeLimit: 30, // 30 minutes for single subject mocks
        overrideNegMark: exam.neg_marking_percent || 0,
        examTitle: `${subject.title} - Subject Mock`,
      }
    });
  };

  // MODE C1: Start Standard Automatic Full Mock
  const handleStartAutomaticExamMock = (exam: ExamInfo) => {
    const examSubjects = subjects.filter(sub => exam.subject_ids?.includes(sub.id));
    const examQuests = questions.filter(q => {
      return examSubjects.some(subject => q.topicId === subject.id || subject.subTopics?.some(st => st.id === q.topicId));
    });
    
    const shuffled = [...examQuests].sort(() => 0.5 - Math.random());
    const count = exam.total_questions || exam.question_count || 50;
    const selectedQuests = shuffled.slice(0, count);
    
    if (selectedQuests.length === 0) {
      showToast({
        type: "error",
        title: "Simulation Refused",
        message: "This exam syllabus has no published database questions yet.",
        duration: 5000,
      });
      return;
    }
    
    const sessionKey = `heading_auto_exam_${exam.id}_quests`;
    const sessionData = {
      expiresAt: Date.now() + 2 * 60 * 60 * 1000,
      questions: selectedQuests,
    };
    sessionStorage.setItem(sessionKey, JSON.stringify(sessionData));
    
    navigate(`/quiz/exam-${exam.id}`, {
      state: {
        sessionStorageKey: sessionKey,
        overridePassMark: exam.pass_mark,
        overrideTimeLimit: exam.duration_min,
        overrideNegMark: exam.neg_marking_percent || 0,
        examTitle: `${exam.title} - Simulator Trial`,
      }
    });
  };

  // MODE C2: Start Admin Configured Rules-Weighted Mock Paper
  const handleStartCustomMockPaper = (mock: MockPaperSpec, exam: ExamInfo) => {
    let selectedQuests: Question[] = [];
    
    // Sample based on weighting rules
    mock.rules.forEach(rule => {
      let filtered: Question[] = [];
      if (rule.subcategory_id) {
        filtered = questions.filter(q => q.topicId === rule.subcategory_id);
      } else if (rule.subject_id) {
        const matchingSubject = subjects.find(s => s.id === rule.subject_id);
        filtered = questions.filter(q => q.topicId === rule.subject_id || matchingSubject?.subTopics?.some(st => st.id === q.topicId));
      }
      
      const shuffledSub = [...filtered].sort(() => 0.5 - Math.random());
      selectedQuests.push(...shuffledSub.slice(0, rule.count));
    });
    
    // Backfill from the full exam pool if rules draw empty
    if (selectedQuests.length === 0) {
      const examSubjects = subjects.filter(sub => exam.subject_ids?.includes(sub.id));
      const examQuests = questions.filter(q => {
        return examSubjects.some(subject => q.topicId === subject.id || subject.subTopics?.some(st => st.id === q.topicId));
      });
      const shuffled = [...examQuests].sort(() => 0.5 - Math.random());
      selectedQuests = shuffled.slice(0, mock.total_questions);
    }
    
    if (selectedQuests.length === 0) {
      showToast({
        type: "error",
        title: "Assembling Failed",
        message: "Unable to assemble mock questions corresponding to these requirements.",
        duration: 5000,
      });
      return;
    }
    
    // Final shuffle so rules don't bunch answers in order of subjects
    selectedQuests = [...selectedQuests].sort(() => 0.5 - Math.random());
    
    const sessionKey = `heading_mock_paper_${mock.id}_quests`;
    const sessionData = {
      expiresAt: Date.now() + 2 * 60 * 60 * 1000,
      questions: selectedQuests,
    };
    sessionStorage.setItem(sessionKey, JSON.stringify(sessionData));
    
    navigate(`/quiz/mock-${mock.id}`, {
      state: {
        sessionStorageKey: sessionKey,
        overridePassMark: mock.pass_mark,
        overrideTimeLimit: mock.duration_min,
        overrideNegMark: mock.neg_marking_percent || 0,
        examTitle: `${mock.title}`,
      }
    });
  };

  // WebMCP deep-link: when the agent start_mock_test tool navigates here with an
  // exam type in router state, match it to a real published exam and run the
  // SAME flow as the "Launch Auto Simulator" button. Runs once, after data
  // loads; clears the state so back/refresh doesn't re-fire it.
  useEffect(() => {
    const target = (location.state as any)?.webmcpStartExam as
      | { authority?: string; license?: string; label?: string }
      | undefined;
    if (!target || webmcpHandledRef.current || loading) return;

    const match =
      exams.find((e) => e.authority === target.authority && e.license === target.license) ||
      exams.find((e) => e.authority === target.authority);

    webmcpHandledRef.current = true;
    navigate(".", { replace: true, state: {} });

    if (match) {
      handleStartAutomaticExamMock(match);
    } else {
      showToast({
        type: "error",
        title: "Mock Unavailable",
        message: `No published mock exam is configured for ${target.label || "this exam type"} yet.`,
        duration: 5000,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state, loading, exams]);

  // Filters mapping
  const filteredExams = selectedCompliance === "all"
    ? exams 
    : exams.filter(e => e.authority === selectedCompliance);

  const selectedExam = exams.find(e => e.id === selectedExamId);

  // Load subject/subtopic linkages for display
  const selectedExamSubjects = selectedExam 
    ? subjects.filter(sub => selectedExam.subject_ids?.includes(sub.id))
    : [];

  if (loading) {
    return (
      <div className="relative min-h-screen">
        <PageBackground />
        <div className="relative z-10 px-4 py-8 md:py-16 max-w-7xl mx-auto space-y-12 animate-pulse">
          <div className="max-w-xl space-y-4">
            <div className="h-4 bg-muted-2/25 w-40 rounded font-mono"></div>
            <div className="h-10 bg-ink/10 w-80 rounded-lg"></div>
            <div className="h-4 bg-muted/20 w-full rounded"></div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-paper border border-rule/50 rounded-2xl p-6 h-64 flex flex-col justify-between animate-pulse">
                <div className="space-y-3">
                  <div className="h-6 bg-ink/10 w-3/4 rounded"></div>
                  <div className="h-4 bg-muted/20 w-full rounded"></div>
                </div>
                <div className="flex justify-between items-end pt-4">
                  <div className="h-4 bg-muted-2/20 w-24 rounded"></div>
                  <div className="h-9 bg-ink/10 w-28 rounded-lg"></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen">
      <PageBackground />

      <div className="relative z-10 px-4 py-8 md:py-16 max-w-7xl mx-auto">
        
        {!selectedExam ? (
          <>
            {/* Index Grid of Available Exams */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
              <div className="max-w-2xl animate-in fade-in slide-in-from-bottom-2 duration-300">
                <span className="eyebrow block mb-3">AUTHORIZED SIMULATION FEED</span>
                <h1 className="h-section text-ink font-semibold">Mock Examinations</h1>
                <p className="mt-4 font-sans font-light text-muted text-md leading-relaxed">
                  Experience standard authority-aligned virtual testing. Heading administers fully certified 
                  simulators dynamically generated from our rich high-fidelity DB question banks.
                </p>
              </div>

              {/* Authority filter */}
              <div className="flex flex-wrap gap-2 font-mono text-xs">
                <button 
                  onClick={() => setSelectedCompliance("all")}
                  className={`px-4 py-2 rounded-full border transition-all ${
                    selectedCompliance === "all" 
                      ? "bg-ink text-paper border-ink" 
                      : "bg-paper text-ink border-rule hover:bg-bg-2"
                  }`}
                >
                  ALL COMPLIANCES
                </button>
                {["DGCA", "EASA", "FAA", "AIRLINE", "TYPE_RATING"].map((auth) => (
                  <button 
                    key={auth}
                    onClick={() => setSelectedCompliance(auth)}
                    className={`px-4 py-2 rounded-full border transition-all uppercase ${
                      selectedCompliance === auth 
                        ? "bg-ink text-paper border-ink" 
                        : "bg-paper text-ink border-rule hover:bg-bg-2"
                    }`}
                  >
                    {auth === "TYPE_RATING" ? "TYPE RATING" : auth}
                  </button>
                ))}
              </div>
            </div>

            {/* Exams Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {filteredExams.map((exam) => {
                const totalQuestionsCount = getExamQuestionsCount(exam);
                const isComingSoon = totalQuestionsCount === 0;
                
                return (
                  <ProGate key={exam.id} type="timed-mock" isUnlocked={true}>
                    <Card className={`relative hover:shadow-[0_12px_36px_rgba(13,26,45,0.06)] transition-all flex flex-col justify-between h-full ${
                      isComingSoon ? "opacity-75" : ""
                    }`} id={`exam-card-${exam.id}`}>
                      
                      {/* Accent Dot Indicator */}
                      <div className="absolute top-4 right-4 h-3 w-3 flex items-center justify-center">
                        <span className={`h-2.5 w-2.5 rounded-full ${
                          isComingSoon ? "bg-muted-2" :
                          exam.license === "ATPL" ? "bg-amber" :
                          exam.license === "CPL" ? "bg-sky" : "bg-mint"
                        }`} />
                      </div>

                      <div>
                        {/* Tags and Labels */}
                        <div className="flex items-center gap-2 mb-4 font-mono text-[9px] uppercase tracking-wider">
                          <span className="footnote px-2 py-0.5 rounded bg-bg border border-rule font-bold">
                            {exam.authority} · {exam.license}
                          </span>
                          <span className="text-rule-strong">|</span>
                          <span className="text-muted text-[10px] font-semibold">
                            PASS REQ: {exam.pass_mark}%
                          </span>
                        </div>

                        <h3 className="h-card-title text-ink font-semibold mb-4 leading-snug">
                          {exam.title}
                        </h3>

                        {/* Quick Spec list */}
                        <div className="grid grid-cols-3 gap-2 p-3.5 rounded-lg bg-panel border border-rule mb-6 text-center">
                          <div>
                            <span className="block font-mono text-[9px] text-muted-2 uppercase tracking-wide">TIME LIMIT</span>
                            <span className="text-xs font-sans font-medium text-ink flex items-center justify-center gap-1 mt-1">
                              <Timer size={12} className="text-sky" /> {exam.duration_min} min
                            </span>
                          </div>
                          <div className="border-x border-rule px-2">
                            <span className="block font-mono text-[9px] text-muted-2 uppercase tracking-wide">TOTAL POOL</span>
                            <span className="text-xs font-sans font-medium text-ink flex items-center justify-center gap-1 mt-1">
                              <Clipboard size={12} className="text-amber" /> {totalQuestionsCount} Qs
                            </span>
                          </div>
                          <div>
                            <span className="block font-mono text-[9px] text-muted-2 uppercase tracking-wide">NEG MARKING</span>
                            <span className="text-xs font-sans font-medium text-ink block mt-1">
                              {(exam.neg_marking_percent || 0) > 0 ? `${exam.neg_marking_percent}%` : "No"}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-4 border-t border-rule mt-auto">
                        <span className="font-mono text-[9.5px] font-bold text-muted uppercase tracking-wider">
                          {isComingSoon ? "UNDER DEVELOPMENT" : "COMPLIANT PREP FEED"}
                        </span>
                        {!isComingSoon ? (
                          <Button 
                            variant="primary" 
                            className="h-[36px] px-4.5 text-xs text-white"
                            onClick={() => handleSelectExam(exam.id)}
                          >
                            Explore Syllabus <ArrowUpRight size={13} className="ml-0.5" />
                          </Button>
                        ) : (
                          <Button variant="ghost" disabled className="h-[36px] px-4 text-xs text-muted-2 bg-transparent cursor-not-allowed border border-dashed border-rule">
                            Available Soon
                          </Button>
                        )}
                      </div>
                    </Card>
                  </ProGate>
                );
              })}
            </div>

            {/* Exam Mock History Section */}
            <div className="mt-16 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Activity size={18} className="text-sky" />
                  <h3 className="font-serif text-xl font-bold text-ink">Exam Mock History</h3>
                </div>
                {user && (
                  <button 
                    onClick={fetchAttempts}
                    disabled={loadingAttempts}
                    className="flex items-center gap-1.5 font-mono text-[10px] text-muted hover:text-ink transition-colors uppercase tracking-wider bg-transparent border-none outline-none cursor-pointer"
                  >
                    <RefreshCw size={11} className={`${loadingAttempts ? "animate-spin" : ""}`} />
                    Refresh Logs
                  </button>
                )}
              </div>

              {!user ? (
                <Card className="bg-panel border-rule p-8 text-center">
                  <Clock className="mx-auto text-muted mb-3" size={28} />
                  <h4 className="font-serif text-md text-ink font-semibold mb-1">Sign In to Access Mock History</h4>
                  <p className="font-sans text-xs text-muted-2 max-w-sm mx-auto leading-relaxed">
                    Previous mock attempts, passing status, and score breakdowns are synchronized with active pilot cloud profiles.
                  </p>
                </Card>
              ) : loadingAttempts && attempts.length === 0 ? (
                <div className="py-12 text-center text-xs font-mono text-muted-2">
                  Querying simulator database...
                </div>
              ) : attempts.length === 0 ? (
                <Card className="bg-panel/30 border border-dashed border-rule py-12 px-4 text-center">
                  <span className="font-mono text-[10px] text-muted-2 uppercase tracking-widest block mb-1">NO SIMULATED LOGS YET</span>
                  <p className="font-sans text-xs text-muted max-w-md mx-auto leading-relaxed">
                    Select an active compliance flight deck above to launch your first virtual training module.
                  </p>
                </Card>
              ) : (
                <Card className="bg-panel border-rule overflow-hidden p-0">
                  <div className="overflow-x-auto hidden md:block">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-rule font-mono uppercase text-[9px] tracking-widest text-muted-2 bg-bg-2/30">
                          <th className="py-3.5 px-4 font-bold">Date & Time</th>
                          <th className="py-3.5 px-4 font-bold">Simulation Paper</th>
                          <th className="py-3.5 px-4 font-bold">Mode</th>
                          <th className="py-3.5 px-4 font-bold">Duration</th>
                          <th className="py-3.5 px-4 text-center font-bold">Score</th>
                          <th className="py-3.5 px-4 text-center font-bold">Accuracy</th>
                          <th className="py-3.5 px-4 text-right font-bold">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-rule/40 font-sans">
                        {attempts.map((attempt) => {
                          const dateText = new Date(attempt.created_at).toLocaleDateString("en-GB", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit"
                          });
                          
                          const title = attempt.data?.topicTitle || (attempt.topic_id ? attempt.topic_id.replace(/-/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase()) : "Simulator Session");
                          const passThreshold = attempt.data?.overridePassMark || 70;
                          const scoreRatio = `${attempt.score} / ${attempt.total}`;
                          const pct = attempt.percentage !== undefined ? attempt.percentage : Math.round((attempt.score / attempt.total) * 100);
                          const isPass = pct >= passThreshold;
                          
                          const getModeLabel = (m: string) => {
                            switch (m) {
                              case "timed": return "Full Mock";
                              case "subject_mock": return "Subject Mock";
                              case "practice": return "Guided Practice";
                              default: return m ? m.charAt(0).toUpperCase() + m.slice(1) : "Session";
                            }
                          };

                          const formatDuration = (sec: number) => {
                            if (!sec) return "-";
                            const mins = Math.floor(sec / 60);
                            const remainingSecs = sec % 60;
                            return mins > 0 ? `${mins}m ${remainingSecs}s` : `${remainingSecs}s`;
                          };

                          return (
                            <tr key={attempt.id} className="hover:bg-bg-2/20 transition-colors">
                              <td className="py-3 px-4 font-mono text-[10px] text-muted-2 whitespace-nowrap">{dateText}</td>
                              <td className="py-3 px-4 text-ink font-medium">{title}</td>
                              <td className="py-3 px-4 text-muted whitespace-nowrap">
                                <span className="px-2 py-0.5 rounded bg-bg border border-rule font-mono text-[9px] uppercase font-semibold">
                                  {getModeLabel(attempt.mode)}
                                </span>
                              </td>
                              <td className="py-3 px-4 font-mono text-[10.5px] text-muted-2 whitespace-nowrap">{formatDuration(attempt.duration_sec)}</td>
                              <td className="py-3 px-4 text-center font-mono text-ink font-medium whitespace-nowrap">{scoreRatio}</td>
                              <td className="py-3 px-4 text-center font-mono text-ink whitespace-nowrap">{pct}%</td>
                              <td className="py-3 px-4 text-right whitespace-nowrap">
                                <span className={`inline-block font-mono text-[9px] font-bold rounded px-2 py-0.5 border ${
                                  isPass 
                                    ? "border-emerald-500/20 text-emerald-700 bg-emerald-500/5" 
                                    : "border-signal-soft text-signal bg-signal-soft"
                                }`}>
                                  {isPass ? "PASS" : "FAIL"}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  {/* Mobile card fallback */}
                  <div className="md:hidden divide-y divide-rule/40 font-sans text-xs">
                    {attempts.map((attempt) => {
                      const dateText = new Date(attempt.created_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
                      const title = attempt.data?.topicTitle || attempt.topic_id || "Simulator Session";
                      const passThreshold = attempt.data?.overridePassMark || 70;
                      const pct = attempt.percentage !== undefined ? attempt.percentage : Math.round((attempt.score / attempt.total) * 100);
                      const isPass = pct >= passThreshold;
                      const getModeLabel = (m: string) => { switch (m) { case "timed": return "Full Mock"; case "subject_mock": return "Subject Mock"; case "practice": return "Guided Practice"; default: return m ? m.charAt(0).toUpperCase() + m.slice(1) : "Session"; } };
                      return (
                        <div key={attempt.id} className="p-4 flex flex-col gap-2">
                          <div className="flex items-start justify-between gap-2">
                            <span className="font-medium text-ink leading-tight">{title}</span>
                            <span className={`shrink-0 inline-block font-mono text-[9px] font-bold rounded px-2 py-0.5 border ${isPass ? "border-emerald-500/20 text-emerald-700 bg-emerald-500/5" : "border-signal-soft text-signal bg-signal-soft"}`}>
                              {isPass ? "PASS" : "FAIL"}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 font-mono text-[10px] text-muted-2">
                            <span>{dateText}</span>
                            <span className="text-rule">·</span>
                            <span>{getModeLabel(attempt.mode)}</span>
                            <span className="text-rule">·</span>
                            <span className="font-medium text-ink">{pct}%</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </Card>
              )}
            </div>

            {/* Informative Pilot Card */}
            <div className="mt-16 bg-panel border-l-4 border-signal border-t border-r border-b border-rule rounded-r-lg p-6 flex flex-col md:flex-row items-start md:items-center gap-6">
              <PlaneTakeoff className="text-signal w-10 h-10 flex-shrink-0" />
              <div className="space-y-1">
                <h4 className="font-sans font-semibold text-ink text-sm uppercase tracking-wide">
                  MANDATORY PILOT REMINDER (SECTION 117 OVERVIEW)
                </h4>
                <p className="font-sans text-xs text-muted-2 leading-relaxed">
                  Simulated training mimics flight-deck strain metrics. High session fatigue degrades visual layout processing. 
                  Always align chart navigation formulas before deploying into full EASA/DGCA-weighted modules.
                </p>
              </div>
            </div>
          </>
        ) : (
          /* Detailed Exam Exploration Deck - 3 Practices Modes */
          <div className="space-y-8 animate-in fade-in duration-300">
            <button
              onClick={() => setSelectedExamId(null)}
              className="flex items-center gap-2 font-mono text-xs text-muted-2 hover:text-ink transition-colors tracking-widest uppercase mb-4"
            >
              <ArrowLeft size={14} /> Back to Simulation Decks
            </button>

            {/* Exam metadata billboard */}
            <div className="bg-panel border border-rule rounded-2xl p-6 md:p-8 shadow-sm">
              <div className="flex flex-wrap items-center gap-3 mb-4">
                <span className="font-mono text-xs bg-ink text-paper px-2.5 py-1 rounded tracking-wider uppercase">
                  {selectedExam.authority} Compliance System
                </span>
                <span className="footnote font-mono text-[10.5px] uppercase tracking-widest text-muted border border-rule px-2 py-0.5 rounded-full bg-paper">
                  License Prerequisite: {selectedExam.license}
                </span>
                <span className="flex items-center gap-1 text-mint text-xs font-mono ml-auto">
                  <span className="w-1.5 h-1.5 rounded-full bg-mint animate-pulse" /> SIMULATION SOURCE FEED ACTIVE
                </span>
              </div>

              <h1 className="font-serif text-3xl md:text-4xl text-ink font-semibold mt-2 leading-tight">
                {selectedExam.title}
              </h1>

              {/* Dynamic Metadata stats block */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4 mt-8 pt-6 border-t border-rule">
                <div>
                  <span className="block font-mono text-[9px] text-muted-2 uppercase tracking-wider">Duration Limit</span>
                  <span className="font-serif text-xl text-ink font-medium block mt-1">{selectedExam.duration_min} Minutes</span>
                </div>
                <div className="border-l border-rule pl-4">
                  <span className="block font-mono text-[9px] text-muted-2 uppercase tracking-wider">Pass Standard</span>
                  <span className="font-serif text-xl text-ink font-medium block mt-1">{selectedExam.pass_mark}% Score</span>
                </div>
                <div className="border-l border-rule pl-4">
                  <span className="block font-mono text-[9px] text-muted-2 uppercase tracking-wider">Simulator Payload</span>
                  <span className="font-serif text-xl text-ink font-medium block mt-1">{getExamQuestionsCount(selectedExam)} Items</span>
                </div>
                <div className="border-l border-rule pl-4 sm:border-l-0 sm:pl-0 md:border-l md:pl-4">
                  <span className="block font-mono text-[9px] text-muted-2 uppercase tracking-wider">Negative Marking</span>
                  <span className="font-serif text-xl text-ink font-medium block mt-1">
                    {(selectedExam.neg_marking_percent || 0) > 0 ? `${selectedExam.neg_marking_percent}% Penalty` : "None Applied"}
                  </span>
                </div>
                <div className="border-l border-rule pl-4">
                  <span className="block font-mono text-[9px] text-muted-2 uppercase tracking-wider">Validity</span>
                  <span className="font-serif text-xl text-ink font-medium block mt-1 text-mint">CURRENT V5.2</span>
                </div>
                <div className="border-l border-rule pl-4">
                  <span className="block font-mono text-[9px] text-muted-2 uppercase tracking-wider">Database Linkage</span>
                  <span className="font-serif text-xl text-ink font-medium block mt-1 text-sky">High-Fidelity</span>
                </div>
              </div>
            </div>

            {/* TAB SELECTOR FOR THE THREE PRACTICING MODES */}
            <div className="border-b border-rule flex gap-4 md:gap-8 font-mono text-xs overflow-x-auto no-scrollbar -mx-4 md:mx-0 px-4 md:px-0">
              <button 
                onClick={() => setActiveTab("practice")}
                className={`pb-4 px-1 border-b-2 font-bold tracking-widest uppercase flex items-center gap-1.5 transition-all outline-none whitespace-nowrap shrink-0 min-h-[44px] ${
                  activeTab === "practice"
                    ? "border-ink text-ink font-bold"
                    : "border-transparent text-muted hover:text-ink"
                }`}
              >
                <Layers size={13} />
                (A) Syllabus Topic Practice
              </button>
              <button 
                onClick={() => setActiveTab("subject")}
                className={`pb-4 px-1 border-b-2 font-bold tracking-widest uppercase flex items-center gap-1.5 transition-all outline-none whitespace-nowrap shrink-0 min-h-[44px] ${
                  activeTab === "subject"
                    ? "border-ink text-ink font-bold"
                    : "border-transparent text-muted hover:text-ink"
                }`}
              >
                <TrendingUp size={13} />
                (B) Subject Mocks
              </button>
              <button 
                onClick={() => setActiveTab("full")}
                className={`pb-4 px-1 border-b-2 font-bold tracking-widest uppercase flex items-center gap-1.5 transition-all outline-none whitespace-nowrap shrink-0 min-h-[44px] ${
                  activeTab === "full"
                    ? "border-ink text-ink font-bold"
                    : "border-transparent text-muted hover:text-ink"
                }`}
              >
                <Activity size={13} />
                (C) Full Exam Mock Sets
              </button>
            </div>

            {/* TAB CONTENT DESIGNS */}
            <div className="pt-2">
              
              {/* MODE A: SYLLABUS Topic Practice */}
              {activeTab === "practice" && (
                <div className="space-y-6">
                  <div className="bg-panel border border-rule p-4.5 rounded-xl space-y-1">
                    <p className="font-mono text-[10.5px] uppercase font-bold text-ink">CHAPTER INTEGRITY PREPARATION</p>
                    <p className="text-xs text-muted-2 leading-relaxed">
                      Initialize training directly from isolated syllabus segments. Spaced repetition telemetry records feedback parameters 
                      securely in your training log to prompt reviews of weak performance tags.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {selectedExamSubjects.flatMap(sub => (sub.subTopics || []).map(topic => {
                      const hasSavedState = !!localStorage.getItem(quizStateKey(topic.id));
                      const isDry = topic.questionCount === 0;

                      return (
                        <div 
                          key={topic.id} 
                          className={`bg-paper border border-rule rounded-xl p-4 flex flex-col justify-between transition-all relative group hover:border-ink hover:shadow-xs ${
                            isDry ? "opacity-60" : ""
                          }`}
                        >
                          <div className="space-y-1">
                            <div className="flex justify-between items-center text-[10px] font-mono text-muted uppercase">
                              <span>Code: {topic.code || "Syllabus"}</span>
                              {hasSavedState && (
                                <span className="text-mint font-bold flex items-center gap-1 animate-pulse">
                                  <span className="w-1.2 h-1.2 rounded-full bg-mint" /> IN PROGRESS
                                </span>
                              )}
                            </div>
                            <h4 className="font-serif text-lg text-ink font-medium pt-1.5 group-hover:text-navy transition-colors">
                              {topic.title}
                            </h4>
                            <p className="font-mono text-[11px] text-muted pt-1">
                              {isDry ? "No available database questions yet" : `${topic.questionCount} Certified Questions`}
                            </p>
                          </div>

                          <div className="border-t border-rule mt-5 pt-3 flex justify-between items-center">
                            {!isDry ? (
                              <button
                                onClick={() => handleStartSubcategoryPractice(topic.id)}
                                className={`h-9 px-4 rounded-full border text-[11px] font-mono font-semibold uppercase tracking-wider flex items-center gap-2 transition-all ${
                                  hasSavedState
                                    ? "border-mint text-mint bg-mint-soft hover:bg-mint hover:text-bg"
                                    : "border-ink text-ink bg-paper hover:bg-ink hover:text-bg"
                                }`}
                              >
                                {hasSavedState ? "Resume" : "Start"} <ArrowUpRight size={12} />
                              </button>
                            ) : (
                              <span className="text-xs text-muted-2 font-mono">Coming Soon</span>
                            )}
                          </div>
                        </div>
                      );
                    }))}
                  </div>
                </div>
              )}

              {/* MODE B: SUBJECT-SPECIFIC MOCKS */}
              {activeTab === "subject" && (
                <div className="space-y-6">
                  <div className="bg-panel border border-rule p-4.5 rounded-xl space-y-1">
                    <p className="font-mono text-[10.5px] uppercase font-bold text-ink">SUBJECT UNIFORM SAMPLING MOCKS</p>
                    <p className="text-xs text-muted-2 leading-relaxed">
                      Runs simulated mini-mocks (30 randomized questions) with continuous timed enforcement drawn uniformly across an entire subject pool. 
                      Perfect for testing end-to-end scope mastery on any individual certified course syllabus.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {selectedExamSubjects.map(sub => {
                      const subjectQuestsCount = questions.filter(q => q.topicId === sub.id || sub.subTopics?.some(st => st.id === q.topicId)).length;
                      const isDry = subjectQuestsCount === 0;

                      return (
                        <div 
                          key={sub.id} 
                          className={`bg-paper border border-rule rounded-xl p-5 flex flex-col justify-between transition-all group hover:border-ink hover:shadow-xs h-full ${
                            isDry ? "opacity-60" : ""
                          }`}
                        >
                          <div>
                            <div className="flex items-center gap-2 mb-3">
                              <span className={`h-2 w-2 rounded-full ${
                                sub.hue === "navy" ? "bg-navy" :
                                sub.hue === "amber" ? "bg-amber" : "bg-sky"
                              }`} />
                              <span className="font-mono text-[9px] text-muted uppercase tracking-widest">
                                MODULE {sub.num}
                              </span>
                            </div>
                            <h4 className="font-serif text-xl font-semibold text-ink leading-tight mb-2">
                              {sub.title}
                            </h4>
                            <p className="font-sans text-xs text-muted leading-relaxed line-clamp-2 mb-4">
                              {sub.blurb || "Simulate a dynamic block encompassing the whole curriculum."}
                            </p>
                          </div>

                          <div className="border-t border-rule pt-4 flex flex-wrap items-center justify-between gap-3 mt-4">
                            <div className="font-mono text-[10.5px] text-muted space-x-2">
                              <span>30 Qs Drafted</span>
                              <span>·</span>
                              <span>30 min Time</span>
                            </div>
                            {!isDry ? (
                              <Button 
                                variant="ghost" 
                                className="h-8.5 text-xs px-3.5 border border-rule hover:bg-neutral-50"
                                onClick={() => handleStartSubjectMock(sub, selectedExam)}
                              >
                                Test Subject Mock <ArrowUpRight size={12} className="ml-1" />
                              </Button>
                            ) : (
                              <span className="text-[10px] font-mono text-muted uppercase">Under Dev</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* MODE C: FULL RE-ASSEMBLED EXAM MOCK FEEDS */}
              {activeTab === "full" && (
                <div className="space-y-8 animate-in fade-in duration-300">
                  
                  {/* Explanatory notice */}
                  <div className="bg-panel border border-rule p-4.5 rounded-xl space-y-1">
                    <p className="font-mono text-[10.5px] uppercase font-bold text-ink">FULL COMPLIANT SIMULATOR ACCESS</p>
                    <p className="text-xs text-muted-2 leading-relaxed">
                      Deploy standard full-sized virtual exam mocks. Enforces real exam countdown clocks, negative scoring weights, 
                      and target pass cutoffs dynamically derived as set up in the active DB configuration files.
                    </p>
                  </div>

                  {/* Standard Auto mock launcher card */}
                  <Card className="border border-sky/30 bg-sky/5 p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                    <div className="space-y-1 max-w-xl">
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full border border-sky/30 text-sky bg-sky/10 font-bold tracking-widest uppercase">
                        STANDARD GENERATED SIMULATOR
                      </span>
                      <h4 className="font-serif text-xl font-bold text-ink pt-1.5">
                        Dynamic Automatic Flight Deck
                      </h4>
                      <p className="font-sans text-xs text-muted leading-relaxed">
                        Assembles a complete balanced draft of {selectedExam.total_questions || selectedExam.question_count || 50} random unique questions
                        spanning all linked subjects uniformly, simulating standard test pressures with high efficiency.
                      </p>
                    </div>
                    <Button
                      variant="primary"
                      className="h-11 px-6.5 shrink-0 shadow-md flex items-center text-xs text-white"
                      onClick={() => handleStartAutomaticExamMock(selectedExam)}
                    >
                      Launch Auto Simulator <ArrowUpRight size={13} className="ml-1" />
                    </Button>
                  </Card>

                  {/* Custom Configured mock papers section */}
                  <div className="space-y-4">
                    <h4 className="font-sans font-bold text-sm text-ink uppercase tracking-widest flex items-center gap-1.5 pt-4">
                      <Layers size={14} className="text-amber" />
                      ADMIN CONFIGURATED EXAM PAPERS
                    </h4>

                    {loadingMocks ? (
                      <div className="py-12 flex justify-center text-xs font-mono text-muted-2">
                        Querying paper templates...
                      </div>
                    ) : selectedExamMocks.length > 0 ? (
                      <div className="grid grid-cols-1 gap-4">
                        {selectedExamMocks.map((mock) => (
                          <div 
                            key={mock.id}
                            className="bg-paper border border-rule rounded-xl p-5 hover:border-amber hover:shadow-xs transition-all flex flex-col md:flex-row items-start md:items-center justify-between gap-6"
                          >
                            <div className="space-y-1">
                              <div className="flex flex-wrap items-center gap-2 mb-2">
                                <span className="font-mono text-[9px] uppercase font-bold tracking-widest px-2 py-0.5 rounded bg-amber/10 border border-amber/20 text-amber-700">
                                  CERTIFIED LAYOUT
                                </span>
                                <span className="text-rule-strong font-mono text-xs">|</span>
                                <span className="font-mono text-[10.5px] text-muted uppercase">
                                  Passreq: {mock.pass_mark}%
                                </span>
                              </div>
                              <h5 className="font-serif text-lg font-semibold text-ink leading-tight pt-1">
                                {mock.title}
                              </h5>
                              <p className="font-sans text-xs text-muted truncate max-w-xl">
                                Weighted Rules: {mock.rules.length} topic targets defined inside layout specs.
                              </p>
                            </div>

                            <div className="flex items-center gap-6 shrink-0 w-full md:w-auto justify-between border-t border-rule md:border-none pt-4 md:pt-0 mt-2 md:mt-0">
                              <div className="grid grid-cols-3 gap-6 text-center md:text-right text-xs pr-4">
                                <div>
                                  <span className="block font-mono text-[8.5px] text-muted uppercase tracking-wider">Payload</span>
                                  <span className="font-serif text-sm text-ink block mt-0.5">{mock.total_questions} Qs</span>
                                </div>
                                <div className="border-x border-rule px-4">
                                  <span className="block font-mono text-[8.5px] text-muted uppercase tracking-wider">Timer</span>
                                  <span className="font-serif text-sm text-ink block mt-0.5">{mock.duration_min} min</span>
                                </div>
                                <div>
                                  <span className="block font-mono text-[8.5px] text-muted uppercase tracking-wider">Penalty</span>
                                  <span className="font-serif text-sm text-ink block mt-0.5">
                                    {mock.neg_marking_percent > 0 ? `${mock.neg_marking_percent}%` : "No"}
                                  </span>
                                </div>
                              </div>

                              <Button 
                                variant="ghost"
                                className="h-9 px-4 hover:border-amber font-semibold text-xs shrink-0 border border-rule"
                                onClick={() => handleStartCustomMockPaper(mock, selectedExam)}
                              >
                                Pilot Trial <ArrowUpRight size={12} className="ml-0.5" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="border border-dashed border-rule rounded-xl py-12 px-4 text-center text-muted-2 text-xs font-mono bg-panel/30">
                        No custom weighted papers configured for this compliance feed yet. Use standard automatic simulator mode instead.
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
