import React, { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { trackEvent } from "../lib/track";
import { SubjectItem, rawSubjects } from "../data/topics";
import { fetchMergedSubjects } from "../lib/content";
import { apiFetch } from "../lib/api";
import { Chip, Card, Button } from "../components/Atoms";
import {
  ArrowLeft,
  ArrowUpRight,
  BookOpen,
  Sparkles,
  Search,
  Lock,
} from "lucide-react";
import { FlightControlsDiagram } from "../components/SystemDiagram";
import { useGlobalLoading } from "../contexts/LoadingContext";
import { useToast } from "../components/ui/Toast";
import { useAuth } from "../contexts/AuthContext";
import { ProGate } from "../components/ProGate";
import ReadingProgress from "../components/ReadingProgress";

export default function TopicView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { setLoading: setGlobalLoading } = useGlobalLoading();
  const { showToast } = useToast();
  const { user } = useAuth();

  const [subjectsList, setSubjectsList] = useState<SubjectItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadSubjects() {
      try {
        const merged = await fetchMergedSubjects();
        setSubjectsList(merged);
      } catch (err) {
        console.error("Failed loading subjects in TopicView:", err);
      } finally {
        setLoading(false);
      }
    }
    loadSubjects();
  }, []);

  let subject = subjectsList.find((s) => s.id === id);
  if (id === "a320-systems") {
    const staticA320 = rawSubjects.find((s) => s.id === "a320-systems");
    if (staticA320) {
      if (!subject) {
        subject = staticA320;
      } else {
        const mergedSubTopics = [...(subject.subTopics || [])];
        staticA320.subTopics?.forEach((staticST) => {
          const existingIdx = mergedSubTopics.findIndex((st) => st.id === staticST.id);
          if (existingIdx === -1) {
            mergedSubTopics.push(staticST);
          } else {
            const existing = mergedSubTopics[existingIdx];
            mergedSubTopics[existingIdx] = {
              ...staticST,
              ...existing,
              questionCount: existing.questionCount || staticST.questionCount || 0,
              spec: existing.spec || staticST.spec,
              figure: existing.figure || staticST.figure,
              sections: existing.sections || staticST.sections,
            };
          }
        });
        subject = {
          ...staticA320,
          ...subject,
          subTopics: mergedSubTopics,
        };
      }
    }
  }

  const [isGenerating, setIsGenerating] = useState(false);

  // For A320 systems viewer
  const [filterText, setFilterText] = useState("");
  const defaultSubTopicId =
    subject?.subTopics?.find((s) => s.id === "ata-27")?.id ||
    subject?.subTopics?.[0]?.id ||
    null;
  const [selectedSubId, setSelectedSubId] = useState<string | null>(null);

  useEffect(() => {
    if (subject && !selectedSubId) {
      setSelectedSubId(defaultSubTopicId);
    }
  }, [subject, defaultSubTopicId, selectedSubId]);

  if (loading) {
    return (
      <div className="relative min-h-screen">
        <div className="absolute inset-0 blueprint pointer-events-none opacity-40 z-0" />
        <div className="absolute inset-0 paper-grain pointer-events-none opacity-100 z-1" />
        <div className="relative z-10 px-4 py-8 md:py-16 max-w-7xl mx-auto space-y-12 animate-pulse">
          {/* Header area skeleton */}
          <div className="max-w-xl space-y-4">
            <div className="h-4 bg-muted-2/25 w-32 rounded font-mono"></div>
            <div className="h-10 bg-ink/10 w-2/3 rounded-lg"></div>
            <div className="h-4 bg-muted/20 w-full rounded"></div>
          </div>
          
          {/* Main layout grid skeleton */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 pt-4">
            {/* Sidebar list skeletal elements */}
            <div className="lg:col-span-4 space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-12 bg-paper border border-rule/40 rounded-xl p-3 flex items-center justify-between">
                  <div className="h-4 bg-ink/10 w-2/3 rounded"></div>
                  <div className="h-4 bg-muted-2/20 w-8 rounded"></div>
                </div>
              ))}
            </div>
            
            {/* Core details area skeleton */}
            <div className="lg:col-span-8 bg-paper border border-rule/50 rounded-2xl p-6 md:p-8 h-96 space-y-6">
              <div className="flex justify-between items-center border-b border-rule/40 pb-4">
                <div className="h-6 bg-ink/10 w-1/3 rounded"></div>
                <div className="h-8 bg-ink/10 w-24 rounded-lg"></div>
              </div>
              <div className="space-y-3 pt-2">
                <div className="h-4 bg-muted/20 w-full rounded"></div>
                <div className="h-4 bg-muted/20 w-4/5 rounded"></div>
                <div className="h-4 bg-muted/20 w-5/6 rounded"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!subject) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg relative">
        <div className="absolute inset-0 blueprint pointer-events-none opacity-40 z-0" />
        <div className="p-8 bg-paper border border-rule rounded-lg text-center z-10 relative shadow-sm">
          <h2 className="font-serif text-2xl mb-4">Module not found</h2>
          <button
            onClick={() => navigate("/modules")}
            className="font-mono text-sm text-ink underline"
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const handleGeneratePractice = async () => {
    if (isGenerating) return;
    if (!user) {
      showToast({
        type: "error",
        title: "Authentication Required",
        message: "Sign in to use AI coaching features.",
        duration: 5000,
      });
      return;
    }
    setIsGenerating(true);
    setGlobalLoading(true);
    try {
      trackEvent("ai_used", { metadata: { feature: "practice" } });
      const response = await apiFetch("/api/instructor/practice", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ topic: subject?.title, code: subject?.num }),
      });

      if (!response) {
        showToast({
          type: "error",
          title: "Service Offline",
          message: "AI features are temporarily unavailable",
          duration: 5000,
        });
        return;
      }

      const questions = await response.json();

      // Basic validation
      if (
        !Array.isArray(questions) ||
        questions.length === 0 ||
        !questions[0].prompt
      ) {
        throw new Error("Invalid payload generated by AI.");
      }

      // Navigate to quiz with custom data
      const sessionKey = "heading_ai_quiz_" + Date.now();
      sessionStorage.setItem(
        sessionKey,
        JSON.stringify({
          questions,
          generatedAt: Date.now(),
          topicId: subject?.id,
          expiresAt: Date.now() + 2 * 60 * 60 * 1000, // 2 hour TTL
        }),
      );

      navigate(`/quiz/ai-generated-${subject?.id}`, {
        state: {
          customQuestions: questions,
          generatedTopic: subject?.title,
          sessionStorageKey: sessionKey,
        },
      });
    } catch (error) {
      console.error(error);
      showToast({
        type: "error",
        title: "Engine Fault",
        message:
          "Unable to synthesize practice questions. Please verify engine linkage.",
        duration: 5000,
      });
    } finally {
      setIsGenerating(false);
      setGlobalLoading(false);
    }
  };

  const hueColor = (() => {
    switch (subject.hue) {
      case "navy":
        return "var(--navy)";
      case "signal":
        return "var(--signal)";
      case "amber":
        return "var(--amber)";
      case "sky":
        return "var(--sky)";
      case "mint":
        return "var(--mint)";
      default:
        return "var(--ink)";
    }
  })();

  const renderStatus = (
    status: "reviewed" | "in-progress" | "new",
    qCount?: number,
  ) => {
    if (qCount === 0) {
      return (
        <Chip
          variant="solid"
          className="bg-signal/15 text-signal border border-signal/15 text-[9px] animate-pulse"
        >
          COMING SOON
        </Chip>
      );
    }
    switch (status) {
      case "reviewed":
        return (
          <Chip variant="mint" className="text-[9px]">
            REVIEWED
          </Chip>
        );
      case "in-progress":
        return (
          <Chip variant="amber" className="text-[9px]">
            IN-PROGRESS
          </Chip>
        );
      case "new":
        return (
          <Chip variant="sky" className="text-[9px]">
            NEW
          </Chip>
        );
    }
  };

  const renderStatusDot = (
    status: "reviewed" | "in-progress" | "new",
    qCount?: number,
  ) => {
    if (qCount === 0) {
      return (
        <span
          className="w-2 h-2 rounded-full bg-signal/30"
          title="Coming Soon"
        />
      );
    }
    switch (status) {
      case "reviewed":
        return (
          <span
            className="w-2 h-2 rounded-full bg-mint shadow-[0_0_8px] shadow-mint/60"
            title="Reviewed"
          />
        );
      case "in-progress":
        return (
          <span
            className="w-2 h-2 rounded-full bg-amber shadow-[0_0_8px] shadow-amber/60"
            title="In Progress"
          />
        );
      case "new":
        return (
          <span className="w-2 h-2 rounded-full bg-rule-strong" title="New" />
        );
    }
  };

  if (subject.id === "a320-systems") {
    const filteredSubs =
      subject.subTopics?.filter(
        (s) =>
          s.title.toLowerCase().includes(filterText.toLowerCase()) ||
          (s.code && s.code.toLowerCase().includes(filterText.toLowerCase())),
      ) || [];

    const selectedSub =
      subject.subTopics?.find((s) => s.id === selectedSubId) || null;

    const isSubUnlocked = subject.is_free || (subject.subTopics && selectedSub && selectedSub.id === subject.subTopics[0]?.id);

    return (
      <div className="flex flex-col lg:flex-row w-full h-auto min-h-[calc(100vh-64px)] lg:h-[calc(100vh-64px)]">
        {/* LEFT PANE - SubTopic List */}
        <div className="w-full lg:w-[340px] flex-shrink-0 border-b lg:border-b-0 lg:border-r border-rule bg-paper lg:overflow-y-auto max-h-[45vh] overflow-y-auto lg:max-h-none lg:h-full">
          <div className="p-6 sticky top-0 bg-paper/95 backdrop-blur z-10 border-b border-rule">
            <h2 className="font-mono text-[10px] text-muted-2 uppercase tracking-widest mb-4">
              ATA CHAPTERS
            </h2>
            <div className="relative">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-2"
              />
              <input
                type="text"
                placeholder="Filter chapter..."
                value={filterText}
                onChange={(e) => setFilterText(e.target.value)}
                className="w-full bg-bg-2 border border-rule rounded-lg pl-9 pr-4 py-2 text-[13px] font-sans text-ink placeholder-muted outline-none focus:border-rule-strong transition-colors"
              />
            </div>
          </div>
          <div className="divide-y divide-rule font-sans">
            {filteredSubs.map((sub) => {
              const isSelected = sub.id === selectedSubId;
              // strip "ATA " from code to just get "27", etc
              const shortCode = sub.code?.replace("ATA ", "") || "";

              return (
                <button
                  key={sub.id}
                  onClick={() => setSelectedSubId(sub.id)}
                  className={`w-full text-left px-6 py-4 flex items-center group transition-colors relative outline-none ${isSelected ? "bg-panel" : "hover:bg-bg-2"}`}
                >
                  {/* Left Accent Bar */}
                  {isSelected && (
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-ink" />
                  )}

                  <div className="w-10 font-mono text-sm text-muted-2 font-medium shrink-0">
                    {shortCode}
                  </div>
                  <div className="flex-1 min-w-0 pr-4">
                    <div className="flex flex-wrap items-center gap-2 mb-0.5">
                      <div
                        className={`text-[15px] truncate transition-colors ${isSelected ? "font-semibold text-ink" : "font-medium text-ink-2 group-hover:text-ink"}`}
                      >
                        {sub.title}
                      </div>
                    </div>
                    <div className="font-mono text-[9px] text-muted-2 mt-0.5 lowercase tracking-wider flex items-center gap-2">
                      {sub.questionCount > 0
                        ? `${sub.questionCount} QUESTIONS`
                        : "NO QUESTIONS"}{" "}
                      {renderStatus(sub.status, sub.questionCount)}
                    </div>
                  </div>
                  <div className="shrink-0 flex items-center justify-center pl-2">
                    {renderStatusDot(sub.status, sub.questionCount)}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* RIGHT PANE - Reader Content */}
        <div className="flex-1 flex flex-col bg-bg overflow-y-auto relative h-auto min-h-[60vh] lg:h-full">
          <div className="absolute inset-0 paper-grain pointer-events-none opacity-100 z-1" />
          {selectedSub ? (
            <div className="relative z-10 px-6 sm:px-10 py-10 md:py-16 max-w-4xl mx-auto w-full">
              {/* Breadcrumb / Top Info */}
              <div className="flex justify-between items-start mb-8 border-b border-rule pb-2">
                <span className="font-mono text-[10px] text-muted-2 uppercase tracking-widest">
                  {selectedSub.code} · A320 · CFM56-5B
                </span>

                {/* AI Action */}
                <div className="flex items-center gap-2">
                  {!user ? (
                    <div className="font-mono text-[9px] uppercase tracking-widest text-muted-2 px-3 py-1.5 border border-dashed border-rule rounded">
                      Sign in to use AI coaching
                    </div>
                  ) : (
                    <button
                      onClick={handleGeneratePractice}
                      disabled={isGenerating || selectedSub.questionCount === 0}
                      className={`flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-widest px-3 py-1.5 rounded border border-mint text-mint hover:bg-mint-soft transition-colors shadow-sm ${isGenerating || selectedSub.questionCount === 0 ? "opacity-50 cursor-not-allowed" : ""}`}
                      title="Generate intelligent practice questions for this chapter"
                    >
                      <Sparkles size={12} />
                      {isGenerating ? "Synthesizing..." : "AI Practice Set"}
                    </button>
                  )}
                </div>
              </div>

              {/* Title */}
              <h1 className="font-serif text-[44px] md:text-[64px] text-ink leading-none tracking-tight mb-8 max-w-3xl">
                {/* Make last word italic for style as requested */}
                {selectedSub.title.split(" ").map((word, i, arr) => (
                  <span
                    key={i}
                    className={i === arr.length - 1 ? "italic" : ""}
                    style={i === arr.length - 1 ? { color: hueColor } : {}}
                  >
                    {word}{" "}
                  </span>
                ))}
              </h1>

              {/* Description */}
              {selectedSub.description ? (
                <p className="font-sans text-lg font-light text-ink leading-relaxed mb-12 max-w-2xl">
                  {selectedSub.description}
                </p>
              ) : (
                <p className="font-sans text-lg font-light text-ink-2 leading-relaxed mb-12 max-w-2xl">
                  Overview of the {selectedSub.title} system, standard operating
                  procedures, and associated ECAM logic. Select a module below
                  to start practice.
                </p>
              )}

              {/* SPEC STRIP */}
              {selectedSub.spec && (
                <div className="border-y border-rule py-4 md:py-5 mb-12 grid grid-cols-2 md:grid-cols-4 gap-6 bg-paper/50">
                  {selectedSub.spec.map((item, idx) => (
                    <div key={idx}>
                      <div className="font-mono text-[9px] text-muted-2 uppercase tracking-widest mb-2">
                        {item.label}
                      </div>
                      <div className="font-mono text-[13px] font-medium text-ink">
                        {item.value}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* FIGURE */}
              {selectedSub.figure && (
                <div className="mb-16">
                  <div className="font-mono text-[10px] text-muted-2 uppercase tracking-widest mb-4">
                    {selectedSub.figure.caption}
                  </div>
                  <div className="bg-paper border border-rule rounded-2xl overflow-hidden shadow-[0_2px_12px_rgba(0,0,0,0.02)] mb-4 p-1">
                    {selectedSub.figure.type === "a320-flight-controls" ? (
                      <FlightControlsDiagram />
                    ) : (
                      <div className="h-64 flex items-center justify-center bg-panel font-mono text-xs text-muted">
                        Diagram Placeholder
                      </div>
                    )}
                  </div>
                  <div className="font-mono text-[9px] text-muted-2 uppercase tracking-widest text-right">
                    {selectedSub.figure.source}
                  </div>
                </div>
              )}

              {/* SUB-SECTIONS (Cards linking to quiz) */}
              {selectedSub.questionCount === 0 ? (
                <div className="bg-panel border border-dashed border-rule rounded-2xl p-8 text-center max-w-lg mb-24">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-signal/15 border border-signal/20 text-signal font-mono text-[10px] uppercase tracking-widest mb-4">
                    Content Under Development
                  </span>
                  <h3 className="font-serif text-2xl text-ink mb-2">
                    Coming Soon
                  </h3>
                  <p className="font-sans text-sm text-muted-2 leading-relaxed">
                    This syllabus segment is currently being populated with
                    original questions verified by flight instructors. Join our
                    notifications to be alerted when it goes live!
                  </p>
                </div>
              ) : selectedSub.sections && selectedSub.sections.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-6 pb-24">
                  {selectedSub.sections.map((sec, idx) => {
                    // Find if there is an existing quiz ID mapping to this section, or just use selectedSub.id
                    // Given the prompt, clicking should start quiz/practice for that chapter. We can pass the section ID or just the sub topic ID.
                    const targetId = selectedSub.id;
                    return (
                      <ProGate key={idx} type="chapter" isUnlocked={isSubUnlocked}>
                        <Link
                          to={`/quiz/${targetId}`}
                          className="block outline-none group"
                        >
                          <div className="bg-paper border border-rule rounded-2xl p-6 h-full flex flex-col transition-all duration-300 hover:border-ink/40 hover:shadow-sm">
                            <div className="font-mono text-[10px] text-muted-2 tracking-widest mb-3">
                              {sec.id}
                            </div>
                            <h4 className="font-serif text-2xl text-ink mb-3 group-hover:text-navy transition-colors">
                              {sec.title}
                            </h4>
                            <p className="font-sans font-light text-[13px] text-muted leading-relaxed line-clamp-3">
                              {sec.description}
                            </p>
                          </div>
                        </Link>
                      </ProGate>
                    );
                  })}
                </div>
              ) : (
                <div className="pb-24">
                  <ProGate type="chapter" isUnlocked={isSubUnlocked}>
                    <Link to={`/quiz/${selectedSub.id}`} className="block">
                      <Button variant="primary" className="h-12 px-6">
                        Start Chapter Practice Set
                        <ArrowUpRight size={16} className="ml-2" />
                      </Button>
                    </Link>
                  </ProGate>
                </div>
              )}
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center font-mono text-sm text-muted">
              Select a chapter from the index to begin.
            </div>
          )}
        </div>
      </div>
    );
  }

  // STANDARD LAYOUT (For other modules)
  return (
    <div className="relative min-h-screen">
      <ReadingProgress />
      <div className="absolute inset-0 blueprint pointer-events-none opacity-40 z-0" />
      <div className="absolute inset-0 paper-grain pointer-events-none opacity-100 z-1" />

      <div className="relative z-10 px-4 py-8 md:py-16 max-w-5xl mx-auto">
        <button
          onClick={() => navigate("/modules")}
          className="flex items-center gap-2 font-mono text-xs text-muted-2 hover:text-ink transition-colors mb-10 tracking-widest uppercase"
        >
          <ArrowLeft size={14} /> Back to Modules
        </button>

        {/* Topic Header */}
        <div className="mb-12 border-b border-rule pb-10">
          <div className="flex items-center gap-3 mb-6">
            <span className="font-mono text-xs bg-ink text-paper px-2 py-1 rounded tracking-widest">
              MODULE · {subject.num}
            </span>
            {subject.tags.map((t) => (
              <Chip key={t.label} variant={t.variant} className="text-[9px]">
                {t.label}
              </Chip>
            ))}
          </div>

          <h1 className="font-serif text-[48px] md:text-[72px] text-ink leading-none tracking-tight mb-6">
            {subject.title}
          </h1>

          <div className="flex flex-col md:flex-row md:items-center gap-8 justify-between">
            <div>
              <p className="font-sans text-xl font-light text-ink-2 max-w-2xl leading-relaxed mb-6">
                {subject.blurb}
              </p>

              {/* AI Action */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                <button
                  onClick={handleGeneratePractice}
                  disabled={isGenerating}
                  className={`flex items-center gap-2 font-mono text-xs uppercase tracking-widest px-4 py-2 rounded-full border border-mint text-mint hover:bg-mint-soft transition-colors ${isGenerating ? "opacity-50 cursor-not-allowed" : ""}`}
                >
                  <Sparkles size={14} />
                  {isGenerating ? "Synthesizing AI Set..." : "AI Practice Set"}
                </button>
                <Chip variant="solid" className="bg-mint text-bg text-[9px]">
                  EXPERIMENTAL
                </Chip>
              </div>
            </div>

            <div className="text-right shrink-0">
              <div className="flex items-baseline justify-end gap-1 mb-1">
                <span className="font-serif text-5xl text-ink">
                  {subject.questionCount}
                </span>
                <span className="font-mono text-[10px] text-muted-2 uppercase tracking-widest">
                  Payload
                </span>
              </div>
              <div className="font-mono text-[10px] text-muted-2 text-right">
                MASTERY: {Math.round(subject.mastery * 100)}%
              </div>
            </div>
          </div>
        </div>

        {/* Content Listing based on type of subject */}
        <div className="bg-paper border border-rule rounded-xl shadow-sm overflow-hidden">
          <div className="p-6 border-b border-rule bg-panel flex justify-between items-center">
            <h3 className="font-sans font-semibold text-sm uppercase tracking-widest text-ink">
              Available Syllabus Segments
            </h3>
            <BookOpen size={16} className="text-muted" />
          </div>

          <div className="p-6 md:p-8 grid grid-cols-1 sm:grid-cols-2 gap-6">
            {subject.subTopics?.map((sub, idx) => {
              const hasSavedState = !!localStorage.getItem(
                `heading_quiz_state_${sub.id}`,
              );
              const isComingSoon = sub.questionCount === 0;
              const isUnlocked = subject.is_free || sub.free_chapter || idx === 0;

              return (
                <ProGate key={sub.id} type="chapter" isUnlocked={isUnlocked}>
                  <Card
                    className={`transition-all duration-300 group relative ${
                    isComingSoon
                      ? "opacity-60 bg-bg-2 border-rule border-dashed cursor-not-allowed"
                      : `hover:border-ink hover:-translate-y-1 hover:shadow-md ${hasSavedState ? "border-mint" : "border-rule"}`
                  }`}
                >
                  <div className="mb-4 flex items-center justify-between">
                    {renderStatus(sub.status, sub.questionCount)}
                    {hasSavedState && !isComingSoon && (
                      <span className="font-mono text-[9px] uppercase tracking-widest text-mint flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-mint shadow-[0_0_8px] shadow-mint/60" />{" "}
                        In Progress
                      </span>
                    )}
                  </div>
                  <h4 className="font-serif text-2xl text-ink mb-2">
                    {sub.title}
                  </h4>
                  <div className="font-mono text-xs text-muted mb-6">
                    {isComingSoon
                      ? "Coming Soon"
                      : `${sub.questionCount} Questions In Segment`}
                  </div>
                  <div className="pt-4 border-t border-rule mt-auto flex justify-between items-center">
                    <span className="font-mono text-[10px] text-muted-2 uppercase tracking-widest">
                      {isComingSoon
                        ? "UNDER DEVELOPMENT"
                        : hasSavedState
                          ? "RESUME SESSION"
                          : "Initialize Test"}
                    </span>
                    {!isComingSoon ? (
                      <>
                        <Link
                          to={`/quiz/${sub.id}`}
                          className="absolute inset-0 z-10"
                        >
                          <span className="sr-only">Start Engine</span>
                        </Link>
                        <div className="w-8 h-8 rounded-full border border-rule group-hover:border-ink group-hover:bg-ink group-hover:text-paper flex items-center justify-center transition-all z-20">
                          <ArrowUpRight size={14} />
                        </div>
                      </>
                    ) : (
                      <div className="w-8 h-8 rounded-full border border-rule/50 text-muted flex items-center justify-center cursor-not-allowed z-20">
                        <Lock size={12} />
                      </div>
                    )}
                  </div>
                </Card>
              </ProGate>
            );
            })}
            {!subject.subTopics?.length && (
              <div className="col-span-full py-12 text-center text-muted font-mono text-sm">
                NO SEGMENTS RECORDED IN DATABASE
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
