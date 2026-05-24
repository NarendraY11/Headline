import React, { useState, useEffect, useRef } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { trackEvent } from "../lib/track";
import { useAuth } from "../contexts/AuthContext";
import { useNotifications } from "../contexts/NotificationContext";
import { useLogbook } from "../hooks/useLogbook";
import { useToast } from "../components/ui/Toast";
import { supabase } from "../lib/supabase";
import { useGlobalLoading } from "../contexts/LoadingContext";
import { motion, AnimatePresence } from "motion/react";
import { Wordmark, Chip, Button, CompassLogomark } from "../components/Atoms";
import { Question } from "../data/questions";
import { fetchPublishedQuestions, fetchQuestionsByIds, fetchQuizQuestionsForTopic } from "../lib/content";
import ShareableScorecard from "../components/ShareableScorecard";
import { apiFetch } from "../lib/api";
import { mockExams } from "../data/topics";
import { recordAnswerProgress, trackAnswerForStreakAndGoal, getDueQuestionIds } from "../lib/spacedRepetition";
import { ProGate } from "../components/ProGate";
import { X, ArrowRight, Settings2, Sparkles, CheckCircle2, Flame } from "lucide-react";
import { lazy, Suspense } from "react";

const EditorialLayout = lazy(() => import("./quiz-layouts/EditorialLayout"));
const SplitLayout = lazy(() => import("./quiz-layouts/SplitLayout"));
const InstrumentLayout = lazy(() => import("./quiz-layouts/InstrumentLayout"));
const FlashcardLayout = lazy(() => import("./quiz-layouts/FlashcardLayout"));

type QuizMode = "practice" | "timed" | "viva";
type QuizStatus = "setup" | "prompt-resume" | "active" | "results";

export default function QuizView() {
  const { topicId: routeTopicId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { showToast } = useToast();

  const isVivaRoute = routeTopicId === "viva";
  const isTimedRoute = routeTopicId === "timed";
  const isPracticeRoute = routeTopicId === "practice";
  const isModeRoute = isVivaRoute || isTimedRoute || isPracticeRoute;

  const topicId = isModeRoute ? "all" : routeTopicId;

  const { user, userData, updateUserData, openAuthModal } = useAuth();
  const { addNotification } = useNotifications();
  const { setLoading: setGlobalLoading } = useGlobalLoading();
  const { logbook } = useLogbook();

  // Load questions
  const customQuestions = location.state?.customQuestions as
    | Question[]
    | undefined;
  const customTopic = location.state?.generatedTopic as string | undefined;

  const [questions, setQuestions] = useState<Question[]>([]);
  const [loadingContent, setLoadingContent] = useState(true);

  useEffect(() => {
    async function loadQuizQuestions() {
      try {
        if (customQuestions) {
          setQuestions(customQuestions);
          return;
        }

        if (location.state?.sessionStorageKey) {
          try {
            const saved = sessionStorage.getItem(location.state.sessionStorageKey);
            if (saved) {
              const parsed = JSON.parse(saved);
              if (
                parsed.expiresAt > Date.now() &&
                Array.isArray(parsed.questions)
              ) {
                setQuestions(parsed.questions);
                return;
              }
            }
          } catch (e) {}
        }

        let quizQs: Question[] = [];

        if (topicId?.startsWith("ai-generated-")) {
          quizQs = [];
        } else if (topicId === "review") {
          const ids = await getDueQuestionIds(user?.uid || null);
          if (ids.length > 0) {
            quizQs = await fetchQuestionsByIds(ids);
          } else {
            quizQs = [];
          }
        } else if (topicId && topicId !== "all") {
          quizQs = await fetchQuizQuestionsForTopic(topicId, 50, true);
        } else {
          quizQs = await fetchPublishedQuestions({ limit: 50 });
        }
        setQuestions(quizQs);
      } catch (err) {
        console.error("Error loading quiz questions:", err);
      } finally {
        setLoadingContent(false);
      }
    }

    loadQuizQuestions();
  }, [topicId, logbook, customQuestions, location.state?.sessionStorageKey]);

  const totalQuestions = questions.length;

  // --- STATE ---
  const storageKey = `heading_quiz_state_${topicId || "default"}`;

  const loadState = () => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) return JSON.parse(saved);
    } catch {}
    return null;
  };

  const savedState = loadState();

  const savedModeSelection = (() => {
    try {
      return (
        (localStorage.getItem("heading_preferred_mode") as QuizMode) ||
        "practice"
      );
    } catch {
      return "practice";
    }
  })();

  const [status, setStatus] = useState<QuizStatus>(() => {
    if (
      savedState &&
      savedState.status === "active" &&
      savedState.timeElapsed > 0
    ) {
      return "prompt-resume";
    }
    if (isModeRoute && !savedState) return "active";
    return savedState?.status === "results"
      ? "setup"
      : savedState?.status || "setup";
  });
  const [mode, setMode] = useState<QuizMode>(() => {
    if (isVivaRoute) return "viva";
    if (isTimedRoute) return "timed";
    if (isPracticeRoute) return "practice";
    return savedState?.mode || savedModeSelection;
  });
  const [currentIndex, setCurrentIndex] = useState(
    savedState?.currentIndex || 0,
  );

  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);

  // Track all chosen answers: questionId -> choiceId
  const [answers, setAnswers] = useState<Record<string, string>>(
    savedState?.answers || {},
  );

  // Track which questions are fully submitted (for practice mode feedback)
  const [submittedIds, setSubmittedIds] = useState<Set<string>>(
    savedState?.submittedIds ? new Set(savedState.submittedIds) : new Set(),
  );

  // Track which questions have had answers revealed (for viva mode)
  const [revealedIds, setRevealedIds] = useState<Set<string>>(
    savedState?.revealedIds ? new Set(savedState.revealedIds) : new Set(),
  );

  // Track bookmarked question IDs
  const [bookmarks, setBookmarks] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem("heading_bookmarks");
      if (saved) {
        const parsed = JSON.parse(saved);
        // Map to IDs in case old format (objects) are stored in localStorage
        return parsed
          .map((p: any) => (typeof p === "string" ? p : p.id))
          .filter(Boolean);
      }
      return [];
    } catch {
      return [];
    }
  });

  const [timeElapsed, setTimeElapsed] = useState(savedState?.timeElapsed || 0);
  const [questionTimeStart, setQuestionTimeStart] = useState<number>(
    savedState?.timeElapsed || 0,
  );
  const [timePerQuestion, setTimePerQuestion] = useState<
    Record<string, number>
  >(savedState?.timePerQuestion || {});

  // --- AI STATE ---
  // Store AI explanations per question ID
  const [aiExplanations, setAiExplanations] = useState<Record<string, string>>(
    {},
  );
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [animatedScore, setAnimatedScore] = useState(0);

  // Abort dialog state
  const [showAbortPrompt, setShowAbortPrompt] = useState(false);
  const [dismissedSavePrompt, setDismissedSavePrompt] = useState(false);
  const [unlockedMilestone, setUnlockedMilestone] = useState<{
    id: string;
    title: string;
    badge: string;
    desc: string;
  } | null>(null);

  useEffect(() => {
    if (showAbortPrompt) {
      const handleEsc = (e: KeyboardEvent) => {
        if (e.key === "Escape") {
          setShowAbortPrompt(false);
          e.stopImmediatePropagation();
        }
      };
      window.addEventListener("keydown", handleEsc, true);
      return () => window.removeEventListener("keydown", handleEsc, true);
    }
  }, [showAbortPrompt]);

  // Store AI study plan
  const [studyPlan, setStudyPlan] = useState<string | null>(null);
  const [isCoachLoading, setIsCoachLoading] = useState(false);
  const [showAllQs, setShowAllQs] = useState(false);

  // Toast state
  const [saveToastVisible, setSaveToastVisible] = useState(false);
  const toastTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastSavedStateRef = useRef<string>("");

  useEffect(() => {
    if (status === "results") {
      let correctCount = 0;
      questions.forEach((q) => {
        if (answers[q.id] === q.correct) correctCount++;
      });
      const percentage = Math.round((correctCount / totalQuestions) * 100);

      let start = 0;
      const duration = 1500;
      const interval = 30;
      const steps = duration / interval;
      const stepValue = percentage / steps;

      const timer = setInterval(() => {
        start += stepValue;
        if (start >= percentage) {
          setAnimatedScore(percentage);
          clearInterval(timer);
        } else {
          setAnimatedScore(Math.floor(start));
        }
      }, interval);
      return () => clearInterval(timer);
    }
  }, [status, answers, questions, totalQuestions]);

  // Sync selectedOption once on mount/index change
  useEffect(() => {
    if (status === "active") {
      const curQ = questions[currentIndex];
      setSelectedOptionId(answers[curQ.id] || null);
    }
  }, [currentIndex, status]); // removed 'questions' from dependencies to avoid loop, it's stable

  // --- EFFECTS ---
  // Timer for active quiz
  const [timeLeft, setTimeLeft] = useState<number | null>(null);

  useEffect(() => {
    let timerId: NodeJS.Timeout;
    if (status === "active") {
      timerId = setInterval(() => {
        setTimeElapsed((prev) => prev + 1);
        if (mode === "timed" && timeLeft !== null) {
          setTimeLeft((prev) => {
            if (prev !== null && prev <= 1) {
              clearInterval(timerId);
              return 0;
            }
            return prev !== null ? prev - 1 : null;
          });
        }
      }, 1000);
    }
    return () => clearInterval(timerId);
  }, [status, mode, timeLeft]);

  // Handle initialization of timeLeft
  useEffect(() => {
    if (status === "active" && mode === "timed" && timeLeft === null) {
      const examConfig = mockExams.find((e) => e.id === topicId);
      const totalSec = examConfig
        ? examConfig.minutes * 60
        : totalQuestions * 60;
      setTimeLeft(totalSec - timeElapsed > 0 ? totalSec - timeElapsed : 0);
    }
  }, [status, mode, topicId, totalQuestions, timeElapsed, timeLeft]);

  // Auto-submit when time reaches zero
  useEffect(() => {
    if (mode === "timed" && timeLeft === 0 && status === "active") {
      finishQuiz();
    }
  }, [timeLeft, mode, status]);

  // Persist bookmarks
  useEffect(() => {
    localStorage.setItem("heading_bookmarks", JSON.stringify(bookmarks));
    if (user) {
      updateUserData({ bookmarks });
    }
  }, [bookmarks]);

  // Persist state
  useEffect(() => {
    if ((status === "setup" || status === "prompt-resume") && !savedState)
      return; // don't persist fresh setup needlessly
    if (status === "prompt-resume") return; // don't persist intermediary prompt state

    const stateToSave = {
      status,
      mode,
      currentIndex,
      answers,
      submittedIds: Array.from(submittedIds),
      revealedIds: Array.from(revealedIds),
      timeElapsed,
      timePerQuestion,
    };
    localStorage.setItem(storageKey, JSON.stringify(stateToSave));

    const meaningfulState = {
      status,
      mode,
      currentIndex,
      answers,
      submittedIds: Array.from(submittedIds),
      revealedIds: Array.from(revealedIds),
    };
    const stateStr = JSON.stringify(meaningfulState);
    if (lastSavedStateRef.current && lastSavedStateRef.current !== stateStr) {
      setSaveToastVisible(true);
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      toastTimerRef.current = setTimeout(() => {
        setSaveToastVisible(false);
      }, 2000);
    }
    lastSavedStateRef.current = stateStr;
  }, [
    status,
    mode,
    currentIndex,
    answers,
    submittedIds,
    revealedIds,
    timeElapsed,
    storageKey,
  ]);

  // Handle keyboard navigation inside the quiz
  useEffect(() => {
    if (status !== "active") return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't interfere if user is typing in an input (though there are none currently)
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      )
        return;
      // Don't interfere if user is pressing meta keys
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      if (e.key === "Escape") {
        setShowAbortPrompt(true);
        return;
      }

      const key = e.key.toLowerCase();
      const currentQ = questions[currentIndex];
      const isSubmitted = submittedIds.has(currentQ.id);
      const isRevealed = revealedIds.has(currentQ.id);

      if (mode === "viva") {
        if (key === "enter" || key === " ") {
          e.preventDefault();
          if (!isRevealed) {
            handleRevealViva(currentQ.id);
          } else {
            handleNext();
          }
        }
      } else {
        // Selection keys (1-4 or A-D)
        if (!isSubmitted || mode === "timed") {
          const choiceMap: Record<string, number> = {
            "1": 0,
            a: 0,
            "2": 1,
            b: 1,
            "3": 2,
            c: 2,
            "4": 3,
            d: 3,
          };
          if (key in choiceMap) {
            const choiceIndex = choiceMap[key];
            if (currentQ.choices[choiceIndex]) {
              const selectedId = currentQ.choices[choiceIndex].id;
              setSelectedOptionId(selectedId);
              // In timed mode, optionally auto-record it
              if (mode === "timed") {
                setAnswers((prev) => ({ ...prev, [currentQ.id]: selectedId }));
              }
            }
          }
        }

        if (key === "enter") {
          e.preventDefault();
          if (mode === "practice") {
            if (!isSubmitted && selectedOptionId) {
              handleSubmitPractice();
            } else if (isSubmitted) {
              handleNext();
            }
          } else if (mode === "timed") {
            handleNext();
          }
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [status, currentIndex, mode, selectedOptionId, submittedIds, revealedIds]);

  // --- ACTIONS ---
  const startQuiz = (selectedMode: QuizMode) => {
    setMode(selectedMode);
    localStorage.setItem("heading_preferred_mode", selectedMode);
    setStatus("active");
    setCurrentIndex(0);
    setAnswers({});
    setSubmittedIds(new Set());
    setRevealedIds(new Set());
    setTimeElapsed(0);
    setQuestionTimeStart(0);
    setTimePerQuestion({});
    setSelectedOptionId(null);

    // Track quiz_start telemetry
    const subId = questions[0]?.topicId || topicId || undefined;
    trackEvent("quiz_start", {
      subcategoryId: subId,
    });
  };

  const handleSelectOption = (choiceId: string) => {
    const qId = questions[currentIndex].id;
    if (mode === "practice" && submittedIds.has(qId)) return;

    setSelectedOptionId(choiceId);
    if (mode === "timed") {
      // In timed mode, selection implicitly saves
      setAnswers((prev) => ({ ...prev, [qId]: choiceId }));

      // Track question_answered telemetry for timed mode
      const isCorrect = choiceId === questions[currentIndex].correct;
      const timeSec = Math.max(0, timeElapsed - questionTimeStart);
      trackEvent("question_answered", {
        questionId: qId,
        metadata: { correct: isCorrect, timeSec }
      });
    }
  };

  const handleSubmitPractice = () => {
    const qId = questions[currentIndex].id;
    if (!selectedOptionId) return;
    setAnswers((prev) => ({ ...prev, [qId]: selectedOptionId }));
    setSubmittedIds((prev) => new Set(prev).add(qId));

    // Track question_answered telemetry for practice mode
    const isCorrect = selectedOptionId === questions[currentIndex].correct;
    const timeSec = Math.max(0, timeElapsed - questionTimeStart);
    trackEvent("question_answered", {
      questionId: qId,
      metadata: { correct: isCorrect, timeSec }
    });

    // Record question performance for spacing/review
    recordAnswerProgress(user?.uid || null, qId, isCorrect, questions[currentIndex].topicId);

    // Track daily goal & streak counters
    trackAnswerForStreakAndGoal(user, userData, updateUserData, 1);
  };

  const handleRevealViva = (qId: string) => {
    setRevealedIds((prev) => new Set(prev).add(qId));
  };

  const trackQuestionTime = () => {
    const qId = questions[currentIndex].id;
    const timeSpent = timeElapsed - questionTimeStart;
    setTimePerQuestion((prev) => ({
      ...prev,
      [qId]: (prev[qId] || 0) + timeSpent,
    }));
    setQuestionTimeStart(timeElapsed);
  };

  const handleNext = () => {
    trackQuestionTime();
    if (currentIndex < totalQuestions - 1) {
      setCurrentIndex((prev) => prev + 1);
      // Restore selected option if returning to a previous answer
      const nextQ = questions[currentIndex + 1];
      setSelectedOptionId(answers[nextQ.id] || null);
    } else {
      finishQuiz();
    }
  };

  const handlePrev = () => {
    trackQuestionTime();
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
      const prevQ = questions[currentIndex - 1];
      setSelectedOptionId(answers[prevQ.id] || null);
    }
  };

  const handleJump = (index: number) => {
    if (index >= 0 && index < totalQuestions && index !== currentIndex) {
      trackQuestionTime();
      setCurrentIndex(index);
      const jumpQ = questions[index];
      setSelectedOptionId(answers[jumpQ.id] || null);
    }
  };

  const finishQuiz = () => {
    trackQuestionTime();
    // Record real attempt
    let correctCount = 0;
    const ataBreakdown: Record<string, { correct: number; total: number }> = {};
    const wrongQuestionIds: string[] = [];
    let answeredCount = 0;

    questions.forEach((q) => {
      const userSelected = answers[q.id];
      const isCorrect = userSelected === q.correct;
      if (isCorrect) {
        correctCount++;
      } else {
        wrongQuestionIds.push(q.id);
      }

      if (!ataBreakdown[q.ata]) {
        ataBreakdown[q.ata] = { correct: 0, total: 0 };
      }
      ataBreakdown[q.ata].total++;
      if (isCorrect) ataBreakdown[q.ata].correct++;

      // Record per-question performance for spaced repetition if answered
      if (userSelected) {
        answeredCount++;
        recordAnswerProgress(user?.uid || null, q.id, isCorrect, q.topicId);
      }
    });

    if (answeredCount > 0) {
      // Track streaks and daily goal progress on submit
      trackAnswerForStreakAndGoal(user, userData, updateUserData, answeredCount);
    }

    const isNegativeMarking =
      userData?.settings?.negativeMarking && mode === "timed";
    const penalty = isNegativeMarking ? wrongQuestionIds.length * 0.25 : 0;
    const finalScore = Math.max(0, correctCount - penalty);
    const percentage = Math.round((finalScore / totalQuestions) * 100);

    // Track quiz_complete telemetry
    trackEvent("quiz_complete", {
      subcategoryId: topicId || undefined,
      metadata: {
        score: finalScore,
        total: totalQuestions,
        percentage,
        mode,
      }
    });

    const attemptRecord = {
      id: crypto.randomUUID(),
      topicId: topicId || "default",
      topicTitle: customTopic || questions[0]?.ata || "Quiz",
      mode,
      total: totalQuestions,
      correct: correctCount, // Store raw correct for logbook stats
      percentage,
      durationSec: timeElapsed,
      dateISO: new Date().toISOString(),
      perTopic: ataBreakdown,
      wrongQuestionIds,
      penalty,
    };

    // Clear the active session state
    localStorage.removeItem(storageKey);

    if (user) {
      const attemptUid = attemptRecord.id;
      const saveAttempt = async () => {
        try {
          const { error } = await supabase
            .from("attempts")
            .insert({
              user_id: user.uid,
              topic_id: attemptUid,
              mode: attemptRecord.mode || "practice",
              score: attemptRecord.correct || 0,
              total: attemptRecord.total || 0,
              percentage: attemptRecord.percentage || 0,
              duration_sec: attemptRecord.durationSec || 0,
              wrong_question_ids: attemptRecord.wrongQuestionIds || [],
              data: attemptRecord,
            });
          if (error) {
            console.error("Could not save attempt to Supabase:", error);
          }
        } catch (err) {
          console.error("Could not save attempt exceptionally:", err);
        }
      };
      saveAttempt();

      updateUserData({
        attempts: {
          [`heading_quiz_state_${attemptUid}`]: attemptRecord,
        },
      });
    } else {
      let localLogbook: any[] = [];
      try {
        const saved = localStorage.getItem("heading_logbook");
        if (saved) localLogbook = JSON.parse(saved);
      } catch {}

      const newLogbook = [...localLogbook, attemptRecord];
      localStorage.setItem("heading_logbook", JSON.stringify(newLogbook));
    }

    // Milestone logic:
    let localLogList: any[] = [];
    try {
      const saved = localStorage.getItem("heading_logbook");
      if (saved) localLogList = JSON.parse(saved);
    } catch {}
    
    const isFirstTime = logbook ? logbook.length === 0 : localLogList.length === 0;
    const currentAccuracy = totalQuestions > 0 ? (correctCount / totalQuestions) * 100 : 0;

    let unlocked = null;
    if (isFirstTime) {
      unlocked = {
        id: "first-flight",
        title: "Operational Clearance Unlocked",
        badge: "Opera Alpha",
        desc: "Your first training block is logged. Solid startup sequence! Clear flight telemetry is now officially running."
      };
    } else {
      const activeLogs = logbook || localLogList;
      const totalAnswersCount = activeLogs.reduce((acc, x) => acc + (x.total || 0), 0) + totalQuestions;
      const priorAnswersCount = activeLogs.reduce((acc, x) => acc + (x.total || 0), 0);
      
      if (totalAnswersCount >= 100 && priorAnswersCount < 100) {
        unlocked = {
          id: "centurion",
          title: "Centurion Pilot Unlocked",
          badge: "Centurion",
          desc: "You have answered over 100 high-fidelity syllabus questions. Excellent pacing density."
        };
      } else if (currentAccuracy >= 90 && totalQuestions >= 5) {
        unlocked = {
          id: "precision",
          title: "Supercritical Precision Unlocked",
          badge: "Precision Pilot",
          desc: "Completed this training block with over 90% accuracy. Optimal operational standards achieved."
        };
      }
    }

    if (unlocked) {
      setUnlockedMilestone(unlocked);
      addNotification(unlocked.title, unlocked.desc, "milestone");
    }

    setStatus("results");
  };

  const toggleBookmark = (q: Question) => {
    setBookmarks((prev) => {
      const exists = prev.includes(q.id);
      if (exists) {
        return prev.filter((id) => id !== q.id);
      } else {
        // Track bookmark_added event when added
        trackEvent("bookmark_added", { questionId: q.id });
        return [...prev, q.id];
      }
    });
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60)
      .toString()
      .padStart(2, "0");
    const s = (seconds % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  // --- AI ACTIONS ---
  const handleExplainDeeper = async () => {
    if (isAiLoading || aiExplanations[currentQ.id]) return;
    if (!user) {
      setAiExplanations((prev) => ({
        ...prev,
        [currentQ.id]: "Sign in to use AI coaching",
      }));
      showToast({
        type: "error",
        title: "Authentication Required",
        message: "Sign in to use AI coaching.",
        duration: 5000,
      });
      return;
    }
    setIsAiLoading(true);
    setGlobalLoading(true);

    const userAnswerLabel =
      currentQ.choices.find((c) => c.id === answers[currentQ.id])?.label ||
      "None";
    const correctAnswerLabel =
      currentQ.choices.find((c) => c.id === currentQ.correct)?.label || "None";

    try {
      trackEvent("ai_used", { metadata: { feature: "explain" } });
      const response = await apiFetch("/api/instructor/explain", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          prompt: currentQ.prompt,
          userAnswer: userAnswerLabel,
          correctAnswer: correctAnswerLabel,
        }),
      });

      if (!response) {
        showToast({
          type: "error",
          title: "Service Offline",
          message: "AI features are temporarily unavailable",
          duration: 5000,
        });
        setAiExplanations((prev) => ({
          ...prev,
          [currentQ.id]: "AI features are temporarily unavailable.",
        }));
        return;
      }

      if (!response.body) throw new Error("No body in response");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      setAiExplanations((prev) => ({ ...prev, [currentQ.id]: "" }));

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        setAiExplanations((prev) => ({
          ...prev,
          [currentQ.id]: prev[currentQ.id] + chunk,
        }));
      }
    } catch (error) {
      console.error("Explain error:", error);
      setAiExplanations((prev) => ({
        ...prev,
        [currentQ.id]:
          "Error connecting to AI Instructor. Please ensure the backend is available.",
      }));
    } finally {
      setIsAiLoading(false);
      setGlobalLoading(false);
    }
  };

  const handleGetStudyPlan = async () => {
    if (isCoachLoading || studyPlan) return;
    if (!user) {
      showToast({
        type: "error",
        title: "Authentication Required",
        message: "Sign in to use AI coaching.",
        duration: 5000,
      });
      return;
    }
    setIsCoachLoading(true);
    setGlobalLoading(true);
    try {
      trackEvent("ai_used", { metadata: { feature: "coach" } });
      const scores: Record<string, { correct: number; total: number }> = {};
      questions.forEach((q) => {
        if (!scores[q.ata]) scores[q.ata] = { correct: 0, total: 0 };
        scores[q.ata].total++;
        if (answers[q.id] === q.correct) scores[q.ata].correct++;
      });

      const response = await apiFetch("/api/instructor/coach", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ scores }),
      });

      if (!response) {
        showToast({
          type: "error",
          title: "Service Offline",
          message: "AI features are temporarily unavailable",
          duration: 5000,
        });
        setStudyPlan("AI features are temporarily unavailable.");
        return;
      }

      const data = await response.json();
      setStudyPlan(data.text);
    } catch (error) {
      console.error("Coach error:", error);
      setStudyPlan(
        "Failed to generate study plan. Please verify backend availability.",
      );
    } finally {
      setIsCoachLoading(false);
      setGlobalLoading(false);
    }
  };

  // --- SWIPE / TOUCH LOGIC ---
  useEffect(() => {
    const previous = document.body.style.overscrollBehaviorY;
    document.body.style.overscrollBehaviorY = "none";
    return () => {
      document.body.style.overscrollBehaviorY = previous || "";
    };
  }, []);

  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const [touchEndX, setTouchEndX] = useState<number | null>(null);
  const [touchStartY, setTouchStartY] = useState<number | null>(null);
  const [touchEndY, setTouchEndY] = useState<number | null>(null);

  const minSwipeDistance = 50;

  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEndX(null);
    setTouchEndY(null);
    setTouchStartX(e.targetTouches[0].clientX);
    setTouchStartY(e.targetTouches[0].clientY);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEndX(e.targetTouches[0].clientX);
    setTouchEndY(e.targetTouches[0].clientY);
  };

  const onTouchEndEvent = () => {
    if (!touchStartX || !touchEndX || !touchStartY || !touchEndY) return;

    const distanceX = touchStartX - touchEndX;
    const distanceY = touchStartY - touchEndY;
    const isLeftSwipe = distanceX > minSwipeDistance;
    const isRightSwipe = distanceX < -minSwipeDistance;

    // Only trigger swipe if horizontal movement is greater than vertical movement
    if (Math.abs(distanceX) > Math.abs(distanceY)) {
      if (isLeftSwipe) {
        handleNext();
      } else if (isRightSwipe) {
        handlePrev();
      }
    }
  };

  // --- RENDER HELPERS ---
  if (loadingContent) {
    return (
      <div className="relative min-h-screen">
        <div className="absolute inset-0 blueprint pointer-events-none opacity-40 z-0" />
        <div className="absolute inset-0 paper-grain pointer-events-none opacity-100 z-1" />
        <div className="relative z-10 px-4 py-8 md:py-16 max-w-4xl mx-auto space-y-8 animate-pulse">
          {/* Progress indicators */}
          <div className="flex justify-between items-center bg-paper border border-rule/50 rounded-xl p-3">
            <div className="h-4 bg-ink/10 w-24 rounded"></div>
            <div className="h-4 bg-muted-2/20 w-16 rounded font-mono"></div>
          </div>
          
          {/* Main question skeleton card */}
          <div className="bg-paper border border-rule/50 rounded-2xl p-6 md:p-8 space-y-6">
            <div className="space-y-3">
              <div className="h-4 bg-muted-2/25 w-24 rounded font-mono"></div>
              <div className="h-6 bg-ink/10 w-full rounded"></div>
              <div className="h-6 bg-ink/10 w-4/5 rounded pb-2"></div>
            </div>
            
            <hr className="border-t border-rule/40" />

            {/* Answer option button skeletons */}
            <div className="space-y-3 pt-2">
              {[1, 2, 3, 4].map((idx) => (
                <div key={idx} className="h-12 border border-rule/40 bg-bg-2/5 rounded-xl flex items-center px-4">
                  <div className="w-5 h-5 rounded-full bg-ink/5 mr-3 shrink-0"></div>
                  <div className="h-4 bg-ink/10 w-5/6 rounded"></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const currentQ = questions[currentIndex];

  if (totalQuestions === 0) {
    if (topicId?.startsWith("ai-generated-")) {
      return (
        <div className="relative min-h-screen flex items-center justify-center p-4">
          <div className="absolute inset-0 blueprint pointer-events-none opacity-40 z-0" />
          <div className="relative z-10 text-center">
            <h2 className="font-serif text-3xl text-ink">AI Session Expired</h2>
            <p className="font-sans text-muted mb-8 mt-2">
              Return to the topic module to regenerate practice questions.
            </p>
            <Button variant="ghost" onClick={() => navigate(-1)}>
              ← Back to Topic
            </Button>
          </div>
        </div>
      );
    }
    return (
      <div className="relative min-h-screen flex items-center justify-center p-4">
        <div className="absolute inset-0 blueprint pointer-events-none opacity-40 z-0" />
        <div className="relative z-10 text-center">
          <h2 className="font-serif text-3xl text-ink">No Questions Found</h2>
          <p className="font-sans text-muted mb-8 mt-2">
            There are no operational limits specified for this module yet.
          </p>
          <Button variant="primary" onClick={() => navigate("/modules")}>
            Return to Base
          </Button>
        </div>
      </div>
    );
  }

  if (status === "prompt-resume") {
    return (
      <div className="relative min-h-screen flex items-center justify-center p-4">
        <div className="absolute inset-0 blueprint pointer-events-none opacity-40 z-0" />
        <div className="relative z-10 w-full max-w-sm bg-panel border border-rule rounded-xl shadow-2xl p-6 text-center">
          <h2 className="font-serif text-2xl text-ink mb-2">Resume Session?</h2>
          <p className="font-sans text-sm text-ink-2 mb-8">
            You have an active session for{" "}
            <strong>{customTopic || questions[0]?.ata || "this module"}</strong>{" "}
            with saved progress.
          </p>
          <div className="flex flex-col gap-3">
            <Button variant="primary" onClick={() => setStatus("active")}>
              Resume Session
            </Button>
            <Button
              variant="ghost"
              className="border border-rule text-signal hover:bg-signal-soft hover:border-signal"
              onClick={() => startQuiz(savedModeSelection)}
            >
              Discard & Start New
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (status === "setup") {
    return (
      <div className="relative min-h-screen flex items-center justify-center p-4">
        <div className="absolute inset-0 blueprint pointer-events-none opacity-40 z-0" />
        <div className="absolute inset-0 paper-grain pointer-events-none opacity-100 z-1" />

        <div className="relative z-10 w-full max-w-2xl bg-paper border border-rule rounded-xl p-8 shadow-xl">
          <div className="flex items-center gap-4 mb-8">
            <Settings2 className="text-ink" size={28} />
            <div>
              <h1 className="font-serif text-3xl text-ink">
                Engine Calibration
              </h1>
              <span className="font-mono text-[10px] text-muted-2 uppercase tracking-widest mt-1 block">
                FLIGHT DECK INITIALIZATION
              </span>
            </div>
          </div>

          <p className="font-sans font-light text-ink-2 mb-10 leading-relaxed">
            Select an operational mode for the "{customTopic || currentQ.ata}"
            module. Heading adapts to your cognitive training phase.
          </p>

          <div className="space-y-4">
            <button
              onClick={() => startQuiz("practice")}
              className="w-full text-left p-6 border border-rule hover:border-ink rounded-lg bg-panel transition-all group focus:outline-none focus:ring-2 focus:ring-ink focus:ring-offset-2"
            >
              <div className="flex justify-between items-center mb-2">
                <span className="font-sans font-semibold text-lg text-ink">
                  Practice Protocol
                </span>
                <Chip variant="mint" className="text-[9px]">
                  RECOMMENDED
                </Chip>
              </div>
              <p className="font-sans text-sm text-muted font-light w-11/12">
                Standard study mode. Receive immediate technical feedback and
                high-fidelity references after each selection.
              </p>
            </button>

            <ProGate type="timed-mock" isUnlocked={mockExams.some(e => e.id === routeTopicId) && routeTopicId === "nav-cpl-01"}>
            <button
              onClick={() => startQuiz("timed")}
              className="w-full text-left p-6 border border-rule hover:border-ink rounded-lg bg-panel transition-all group focus:outline-none focus:ring-2 focus:ring-ink focus:ring-offset-2"
            >
              <div className="flex justify-between items-center mb-2">
                <span className="font-sans font-semibold text-lg text-ink">
                  Timed Authority Exam
                </span>
                <Chip variant="amber" className="text-[9px]">
                  MOCK EXAM
                </Chip>
              </div>
              <p className="font-sans text-sm text-muted font-light w-11/12">
                Simulates DGCA/EASA stress loading. No feedback until the final
                payload is delivered. Track your time-per-question metrics.
              </p>
            </button>
            </ProGate>

            <ProGate type="viva-practice" isUnlocked={false}>
            <button
              onClick={() => startQuiz("viva")}
              className="w-full text-left p-6 border border-rule hover:border-ink rounded-lg bg-panel transition-all group focus:outline-none focus:ring-2 focus:ring-ink focus:ring-offset-2"
            >
              <div className="flex justify-between items-center mb-2">
                <span className="font-sans font-semibold text-lg text-ink">
                  Viva Flashcards
                </span>
                <Chip variant="sky" className="text-[9px]">
                  MEMORY RECALL
                </Chip>
              </div>
              <p className="font-sans text-sm text-muted font-light w-11/12">
                Used for oral board prep or rapid repetition. Formulate the
                answer mentally, then reveal the regulatory model answer.
              </p>
            </button>
            </ProGate>
          </div>

          <div className="mt-8 pt-4 border-t border-rule text-right">
            <Button variant="ghost" onClick={() => navigate("/modules")}>
              Cancel Operations
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (status === "results") {
    // Calculate Score
    let correctCount = 0;
    const ataBreakdown: Record<string, { correct: number; total: number }> = {};
    const wrongQuestionIdsLocal: string[] = [];

    questions.forEach((q) => {
      const isCorrect = answers[q.id] === q.correct;
      if (isCorrect) {
        correctCount++;
      } else {
        wrongQuestionIdsLocal.push(q.id);
      }

      if (!ataBreakdown[q.ata]) {
        ataBreakdown[q.ata] = { correct: 0, total: 0 };
      }
      ataBreakdown[q.ata].total++;
      if (isCorrect) ataBreakdown[q.ata].correct++;
    });

    const isNegativeMarking =
      userData?.settings?.negativeMarking && mode === "timed";
    const penalty = isNegativeMarking ? wrongQuestionIdsLocal.length * 0.25 : 0;
    const finalScore = Math.max(0, correctCount - penalty);
    const percentage = Math.round((finalScore / totalQuestions) * 100);
    const passed = percentage >= 70; // 70% passing threshold typical

    // Performance metrics
    const avgTime = Math.round(timeElapsed / totalQuestions);
    const timeEntries = Object.entries(timePerQuestion) as [string, number][];
    // questions answered in < 15s are considered "rushed" for standard exams usually
    const rushed = timeEntries.filter(([_, time]) => time < 15).length;
    const slow = timeEntries.filter(([_, time]) => time > 90).length;

    const diff = percentage - 70;
    const marginStr = `${diff >= 0 ? "+" : ""}${diff}%`;

    let lowestAta = "";
    let lowestPct = 100;
    Object.entries(ataBreakdown).forEach(([ata, stats]) => {
      const pct = (stats.correct / stats.total) * 100;
      if (pct <= lowestPct) {
        lowestPct = pct;
        lowestAta = ata;
      }
    });

    const confidence =
      percentage >= 80 ? "High" : percentage >= 60 ? "Med" : "Low";
    const confidentAns = timeEntries.filter(
      ([id, t]) =>
        t > 5 &&
        t < 45 &&
        answers[id] === questions.find((q) => q.id === id)?.correct,
    ).length;

    // Distinguish skipped vs wrong for display
    const realWrong = questions.filter(
      (q) => answers[q.id] && answers[q.id] !== q.correct,
    ).length;
    const realSkipped = questions.filter((q) => !answers[q.id]).length;

    return (
      <div className="relative min-h-screen bg-bg pb-24 font-sans selection:bg-mint/30">
        <div className="absolute inset-0 blueprint pointer-events-none opacity-40 z-0" />

        {/* TOP BAR */}
        <header className="h-16 border-b border-rule bg-bg shrink-0 px-4 md:px-8 flex items-center justify-between sticky top-0 z-40 relative">
          <Wordmark compassSize={22} className="hidden sm:flex" />
          <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-3">
            <div className="w-1.5 h-1.5 bg-signal rotate-45 shrink-0" />
            <span className="font-mono text-[9px] uppercase tracking-widest text-ink/70 font-semibold mt-px">
              DEBRIEF · SESSION 9F2A
            </span>
          </div>
          <button
            onClick={() => navigate("/modules")}
            className="flex items-center gap-2 font-sans text-sm rounded-full border border-rule px-4 py-1.5 hover:bg-paper transition-colors z-10 bg-bg"
          >
            Done <X size={14} className="mb-px" />
          </button>
        </header>

        <div className="relative z-10 max-w-5xl mx-auto py-12 px-4 space-y-6">
          {unlockedMilestone && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-[#101214] text-bg rounded-2xl p-6 border border-white/10 shadow-2xl relative overflow-hidden flex items-center justify-between gap-6"
            >
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <span className="font-mono text-[9px] tracking-widest font-bold uppercase text-mint bg-mint/15 px-2.5 py-0.5 rounded-full border border-mint/20 flex items-center gap-1">
                    <Sparkles size={11} className="text-mint shrink-0" />
                    MILESTONE UNLOCKED: {unlockedMilestone.badge}
                  </span>
                </div>
                <h2 className="font-serif text-xl font-bold text-white mb-1.5">{unlockedMilestone.title}</h2>
                <p className="font-sans text-[12.5px] text-white/70 leading-relaxed font-light">{unlockedMilestone.desc}</p>
              </div>
              <button 
                onClick={() => setUnlockedMilestone(null)}
                className="text-white/40 hover:text-white transition-colors h-9 px-4 font-mono text-[10px] uppercase font-bold tracking-wider hover:bg-white/5 border border-white/15 rounded-full shrink-0"
              >
                Dismiss
              </button>
            </motion.div>
          )}

          {/* HERO ROW */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center mb-10">
            <div className="max-w-lg">
              <div className="flex items-center gap-2 mb-6">
                <div className="w-2 h-2 bg-signal rotate-45 shrink-0" />
                <span className="font-mono text-[10px] text-muted-2 uppercase tracking-widest mt-px font-semibold">
                  A320 · {customTopic || questions[0]?.ata || "Quiz"} ·{" "}
                  {Math.max(1, Math.round(timeElapsed / 60))} MIN
                </span>
              </div>

              <h1 className="font-serif text-[48px] md:text-[64px] text-ink leading-[1] tracking-tight mb-5">
                You{" "}
                <i className="font-serif italic tracking-normal text-navy">
                  {passed ? "passed" : "missed"}
                </i>{" "}
                this block.
              </h1>

              <p className="font-sans text-[17px] text-ink-2 font-light leading-relaxed mb-8">
                {passed
                  ? `Above the 70% pass cutoff with margin. `
                  : `Below the 70% pass cutoff. `}
                Your weak spot was {lowestAta || "spread evenly"} — added{" "}
                {wrongQuestionIdsLocal.length} cards to your spaced-repetition
                deck.
                {isNegativeMarking && ` Includes a -${penalty} penalty.`}
              </p>

              <div className="flex flex-wrap items-center gap-3">
                <Button
                  variant="primary"
                  className="shadow-lg px-6 h-12 rounded-full"
                  onClick={() => {
                    const wrongQuestions = questions.filter(
                      (q) => answers[q.id] !== q.correct,
                    );
                    if (wrongQuestions.length > 0) {
                      navigate(`/quiz/${topicId || "review"}-review`, {
                        state: {
                          customQuestions: wrongQuestions,
                          generatedTopic: "Review Weak Areas",
                        },
                        replace: true,
                      });
                    }
                  }}
                >
                  Review all {wrongQuestionIdsLocal.length} missed{" "}
                  <ArrowRight size={16} className="ml-2" />
                </Button>
                <Button
                  variant="ghost"
                  className="h-12 rounded-full px-6"
                  onClick={() => startQuiz(mode)}
                >
                  Retry block
                </Button>
              </div>
            </div>

            {/* DARK SCORE CARD */}
            <div className="bg-[#101214] rounded-2xl p-8 relative overflow-hidden flex flex-col shadow-2xl">
              <div className="absolute -bottom-10 -right-10 opacity-[0.04] pointer-events-none">
                <CompassLogomark
                  size={280}
                  spin="seek"
                  color="white"
                  pointerColor="white"
                />
              </div>

              <div className="flex justify-between items-start mb-6">
                <span className="font-mono text-[10px] text-white/40 tracking-widest uppercase">
                  BLOCK SCORE
                </span>
                <span
                  className={`font-mono text-[9px] uppercase tracking-widest font-semibold px-3 py-1 rounded-full border ${passed ? "border-ring-green text-ring-green bg-ring-green/10" : "border-signal text-signal bg-signal/10"}`}
                >
                  {passed ? "PASS" : "FAIL"}
                </span>
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-8 md:gap-14 mt-2">
                <div className="relative flex items-center justify-center w-40 h-40 shrink-0 z-10">
                  <svg
                    width="160"
                    height="160"
                    className="transform -rotate-90 absolute"
                  >
                    <circle
                      cx="80"
                      cy="80"
                      r="68"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="6"
                      className="text-white/10"
                    />
                    <motion.circle
                      cx="80"
                      cy="80"
                      r="68"
                      fill="none"
                      stroke={passed ? "var(--ring-green)" : "var(--signal)"}
                      strokeWidth="6"
                      strokeLinecap="round"
                      initial={{ strokeDashoffset: Math.PI * 136 }}
                      animate={{
                        strokeDashoffset:
                          Math.PI * 136 -
                          (animatedScore / 100) * (Math.PI * 136),
                      }}
                      transition={{ duration: 1.5, ease: "easeOut" }}
                      strokeDasharray={Math.PI * 136}
                    />
                  </svg>
                  <div className="flex flex-col items-center justify-center">
                    <div className="flex items-start">
                      <span className="font-serif text-[56px] text-white leading-none tracking-tight">
                        {animatedScore}
                      </span>
                      <span className="font-serif text-2xl text-white/70 ml-0.5 mt-2">
                        %
                      </span>
                    </div>
                    <span className="font-mono text-[10px] text-white/50 tracking-widest mt-1 uppercase">
                      {correctCount} OF {totalQuestions}
                    </span>
                  </div>
                </div>

                <div className="flex flex-col gap-6 border-l border-white/10 pl-8 min-w-[140px] z-10 py-2">
                  <div>
                    <span className="block font-mono text-[9px] text-white/40 tracking-widest font-semibold mb-1 uppercase">
                      PASS MARK
                    </span>
                    <span className="font-serif text-2xl text-white block leading-none mt-1">
                      70%
                    </span>
                  </div>
                  <div>
                    <span className="block font-mono text-[9px] text-white/40 tracking-widest font-semibold mb-1 uppercase">
                      YOUR SCORE
                    </span>
                    <span className="font-serif text-2xl text-white block leading-none mt-1">
                      {percentage}%
                    </span>
                  </div>
                  <div>
                    <span className="block font-mono text-[9px] text-white/40 tracking-widest font-semibold mb-1 uppercase">
                      MARGIN
                    </span>
                    <span className="font-serif text-2xl text-white block leading-none mt-1">
                      {marginStr}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* SHAREABLE SCORECARD DOWNLOAD */}
          <ShareableScorecard 
            score={correctCount}
            totalQuestions={totalQuestions}
            percentage={percentage}
            subjectTitle={customTopic || (questions && questions[0]?.ata) || "Quiz Attempt"}
            passed={passed}
            defaultUserName={userData?.display_name || ""}
          />

          {/* FREE USER UPGRADE PROMPT ON MOCK END */}
          {routeTopicId === "nav-cpl-01" && userData?.plan === "free" && (
            <div className="bg-panel rounded-2xl p-8 border border-rule shadow-md relative overflow-hidden flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="space-y-2 max-w-xl text-center md:text-left animate-in fade-in slide-in-from-bottom-3 duration-500">
                <div className="inline-flex items-center gap-1.5 font-mono text-[9.5px] tracking-widest font-bold uppercase text-navy bg-sky-soft/40 px-2.5 py-0.5 rounded-full border border-sky/20">
                  <Sparkles size={10} className="animate-spin-slow text-navy" />
                  <span>FLIGHT DEBRIEF CLEARANCE</span>
                </div>
                <h3 className="font-serif text-2xl text-ink font-semibold">Ready for Unlimited simulator flights?</h3>
                <p className="font-sans text-xs text-muted leading-relaxed">
                  Excellent work finishing your 1 free training mock exam. Upgrade to <b>Captain (Pro)</b> today to unlock unlimited real timed exams for DGCA and EASA, dynamic AI Ground Instructor debriefs, interactive weak-area heatmaps, and oral board viva flashcards.
                </p>
              </div>
              <Button
                variant="primary"
                onClick={() => navigate("/pricing")}
                className="w-full md:w-auto px-6 h-12 bg-navy hover:bg-navy-dark text-bg font-mono text-xs tracking-wider uppercase rounded-full shadow-lg shrink-0"
              >
                GET UNLIMITED ACCESS
                <ArrowRight size={14} className="ml-2" />
              </Button>
            </div>
          )}

          {!user && (
            <div className="bg-[#101214] text-bg rounded-2xl p-6 md:p-8 border border-white/5 shadow-2xl relative overflow-hidden flex flex-col md:flex-row items-center justify-between gap-6 mb-8">
              <div className="space-y-2 max-w-xl text-center md:text-left">
                <div className="inline-flex items-center gap-1.5 font-mono text-[9px] tracking-widest font-bold uppercase text-mint bg-mint/10 px-2.5 py-0.5 rounded-full border border-mint/20">
                  <Flame size={12} className="text-mint animate-pulse" />
                  <span>PRESERVE PERFORMANCE HISTORY</span>
                </div>
                <h3 className="font-serif text-2xl text-white">Secure this performance in your active records.</h3>
                <p className="font-sans text-xs text-white/70 leading-relaxed font-light">
                  You just cleared this block with {correctCount} correct out of {totalQuestions} total questions. Sign in now to automatically merge this session, initiate active spaced reviews, and keep your study streak alive!
                </p>
              </div>
              <div className="shrink-0 w-full md:w-auto flex flex-col sm:flex-row gap-3 items-center">
                <Button
                  variant="primary"
                  className="w-full sm:w-auto bg-mint text-bg hover:bg-mint/80 px-6 h-11 rounded-full font-serif text-xs font-semibold border-0"
                  onClick={() => openAuthModal("signup")}
                >
                  Sign Up & Save Session
                </Button>
              </div>
            </div>
          )}

          {/* 4 STAT CARDS ROW */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-5 mb-12">
            <div className="bg-paper rounded-xl p-6 shadow-sm border border-transparent">
              <span className="block font-mono text-[9px] text-muted-2 tracking-widest font-semibold mb-3 uppercase">
                CORRECT
              </span>
              <div className="flex items-end text-ink">
                <span
                  className="font-serif text-[42px] leading-none"
                  style={{ color: passed ? "var(--mint)" : "var(--signal)" }}
                >
                  {correctCount}
                </span>
                <span className="font-serif text-xl mb-1 ml-0.5 text-muted-2">
                  /{totalQuestions}
                </span>
              </div>
            </div>

            <div className="bg-paper rounded-xl p-6 shadow-sm border border-transparent flex flex-col justify-between">
              <span className="block font-mono text-[9px] text-muted-2 tracking-widest font-semibold mb-3 uppercase">
                ACCURACY
              </span>
              <div className="flex items-start text-ink mb-2">
                <span
                  className="font-serif text-[42px] leading-none"
                  style={{ color: passed ? "var(--mint)" : "var(--signal)" }}
                >
                  {percentage}
                </span>
                <span className="font-serif text-xl ml-0.5 mt-1 text-muted">
                  %
                </span>
              </div>
              <span className="font-mono text-[9px] text-muted mt-auto">
                ↑ 4 vs avg
              </span>
            </div>

            <div className="bg-paper rounded-xl p-6 shadow-sm border border-transparent flex flex-col justify-between">
              <span className="block font-mono text-[9px] text-muted-2 tracking-widest font-semibold mb-3 uppercase">
                AVG PER Q
              </span>
              <span className="font-serif text-[42px] leading-none text-ink mb-2">
                {formatTime(avgTime)}
              </span>
              <span className="font-mono text-[9px] text-muted mt-auto flex justify-between">
                <span>{rushed} rushed</span>
                <span>{slow} slow</span>
              </span>
            </div>

            <div className="bg-paper rounded-xl p-6 shadow-sm border border-transparent flex flex-col justify-between">
              <span className="block font-mono text-[9px] text-muted-2 tracking-widest font-semibold mb-3 uppercase">
                CONFIDENCE
              </span>
              <span className="font-serif text-[42px] leading-none text-ink mb-2">
                {confidence}
              </span>
              <span className="font-mono text-[9px] text-muted mt-auto">
                {confidentAns} of {totalQuestions} ≥ 4★
              </span>
            </div>
          </div>

          {/* AI Box */}
          <div className="mb-12">
            {!user ? (
              <div className="border border-dashed border-rule bg-bg p-6 rounded-xl text-center flex flex-col items-center gap-2 shadow-sm">
                <p className="font-sans text-[14px] font-mono tracking-widest uppercase text-muted-2">
                  Sign in to use AI coaching
                </p>
              </div>
            ) : !studyPlan && !isCoachLoading ? (
              <div
                className="border border-rule bg-paper p-6 rounded-xl text-center flex flex-col items-center gap-4 hover:border-mint/50 hover:bg-ring-green/5 transition-colors group cursor-pointer shadow-sm"
                onClick={handleGetStudyPlan}
              >
                <Sparkles
                  className="text-muted group-hover:text-mint transition-colors"
                  size={24}
                />
                <p className="text-[15px] font-light text-ink-2">
                  Want a tailored recovery plan based on this payload?
                </p>
                <Button
                  variant="ghost"
                  className="pointer-events-none group-hover:text-mint transition-colors font-mono tracking-widest text-[10px] uppercase"
                >
                  Generate Study Plan
                </Button>
              </div>
            ) : (
              <div className="border border-ring-green/40 bg-ring-green/10 p-6 md:p-8 rounded-xl relative shadow-sm">
                <div className="flex items-center gap-2 mb-6 font-mono text-xs uppercase tracking-widest text-mint font-semibold">
                  <Sparkles size={14} /> Recommended Plan
                </div>
                {isCoachLoading && !studyPlan ? (
                  <div className="space-y-4 animate-pulse pt-2">
                    <div className="h-4 bg-mint/20 rounded w-full"></div>
                    <div className="h-4 bg-mint/20 rounded w-11/12"></div>
                    <div className="h-4 bg-mint/20 rounded w-3/4"></div>
                  </div>
                ) : (
                  <div className="font-sans font-light text-ink leading-relaxed whitespace-pre-wrap text-[15px] md:text-[16px]">
                    {studyPlan}
                    {isCoachLoading && (
                      <span className="animate-pulse inline-block ml-1">▋</span>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Q-by-Q TABLE */}
          <div className="bg-paper bg-opacity-70 border border-rule/50 rounded-xl shadow-sm overflow-hidden mb-8 backdrop-blur-sm">
            <div className="p-6 md:p-8 flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-rule/50 gap-6">
              <h2 className="font-serif text-[40px] text-ink tracking-tight leading-[1.05] flex-shrink-0">
                Question-by- <br className="hidden sm:block" /> question
              </h2>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="flex items-center gap-2 px-3 py-1 rounded-full bg-ring-green/10 text-mint font-mono text-[9px] uppercase tracking-widest font-semibold shrink-0">
                  <span className="font-serif text-sm mr-1.5">
                    {correctCount}
                  </span>{" "}
                  CORRECT
                </span>
                <span className="flex items-center gap-2 px-3 py-1 rounded-full bg-signal/10 text-signal font-mono text-[9px] uppercase tracking-widest font-semibold shrink-0">
                  <span className="font-serif text-sm mr-1.5">{realWrong}</span>{" "}
                  WRONG
                </span>
                <span className="flex items-center gap-2 px-3 py-1 rounded-full bg-rule/50 text-muted font-mono text-[9px] uppercase tracking-widest font-semibold shrink-0">
                  <span className="font-serif text-sm mr-1.5">
                    {realSkipped}
                  </span>{" "}
                  SKIPPED
                </span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left font-sans text-[13px] md:text-sm whitespace-nowrap">
                <thead>
                  <tr className="font-mono text-[9px] text-muted-2 tracking-widest uppercase border-b border-rule/50 font-semibold bg-bg/30">
                    <th className="font-normal py-4 px-6 md:px-8 w-12 text-center">
                      #
                    </th>
                    <th className="font-normal py-4 px-4 w-24">TOPIC</th>
                    <th className="font-normal py-4 px-4 min-w-[300px]">
                      QUESTION
                    </th>
                    <th className="font-normal py-4 px-4 w-20 text-center">
                      TIME
                    </th>
                    <th className="font-normal py-4 px-6 md:px-8 w-32 text-right">
                      RESULT
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-rule/50 font-light text-ink">
                  {(showAllQs ? questions : questions.slice(0, 7)).map(
                    (q, i) => {
                      let statusText = "SKIPPED";
                      let statusColor = "text-muted";
                      let bgHover = "hover:bg-panel";
                      if (answers[q.id]) {
                        if (answers[q.id] === q.correct) {
                          statusText = "✓ CORRECT";
                          statusColor = "text-mint";
                          bgHover = "hover:bg-ring-green/5";
                        } else {
                          statusText = "✕ MISSED";
                          statusColor = "text-signal";
                          bgHover = "hover:bg-signal/5";
                        }
                      }
                      const timeStr = timePerQuestion[q.id]
                        ? formatTime(timePerQuestion[q.id])
                        : "--:--";

                      return (
                        <tr
                          key={q.id}
                          className={`transition-colors group cursor-pointer ${bgHover}`}
                          onClick={() =>
                            navigate(`/quiz/${topicId || "review"}-review`, {
                              state: {
                                customQuestions: [q],
                                generatedTopic: "Review Detail",
                              },
                            })
                          }
                        >
                          <td className="py-4 px-6 md:px-8 text-center text-muted font-mono text-xs">
                            {(i + 1).toString().padStart(2, "0")}
                          </td>
                          <td className="py-4 px-4 text-muted-2 font-mono text-[10px] uppercase tracking-wider">
                            {q.ata}
                          </td>
                          <td className="py-4 px-4 text-ink truncate max-w-sm lg:max-w-xl">
                            {q.prompt}
                          </td>
                          <td className="py-4 px-4 text-center font-mono text-[10px] text-muted">
                            {timeStr}
                          </td>
                          <td
                            className={`py-4 px-6 md:px-8 text-right font-mono text-[10px] tracking-widest uppercase flex items-center justify-end gap-2 group-hover:font-semibold transition-all shadow-none ${statusColor}`}
                          >
                            {statusText}{" "}
                            <ArrowRight
                              size={10}
                              className="opacity-0 group-hover:opacity-100 transition-opacity -ml-1 group-hover:ml-0"
                            />
                          </td>
                        </tr>
                      );
                    },
                  )}
                </tbody>
              </table>
            </div>

            {questions.length > 7 && (
              <div className="p-4 bg-bg/30 border-t border-rule text-center flex justify-start pl-6 md:pl-8">
                <button
                  onClick={() => setShowAllQs(!showAllQs)}
                  className="flex items-center gap-2 border border-rule rounded-full px-5 py-2 font-sans text-sm text-ink hover:bg-paper transition-colors shrink-0 outline-none hover:border-ink/20 shadow-sm bg-paper"
                >
                  {showAllQs ? "Collapse" : `Show all ${totalQuestions}`}
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    className={`transition-transform duration-300 ${showAllQs ? "rotate-180" : ""}`}
                  >
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                </button>
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-4 items-center pl-2 pb-6">
            {/* Action links */}
            <Button
              variant="ghost"
              className="text-muted hover:text-ink px-2 py-1 font-sans text-sm"
              onClick={() => navigate("/analytics")}
            >
              View Logbook
            </Button>
            <div className="w-1 h-1 bg-rule rounded-full shrink-0" />
            <Button
              variant="ghost"
              className="text-muted hover:text-ink px-2 py-1 font-sans text-sm"
              onClick={() => navigate("/bookmarks")}
            >
              View Bookmarks
            </Button>
            <div className="w-1 h-1 bg-rule rounded-full shrink-0" />
            <Button
              variant="ghost"
              className="text-muted hover:text-ink px-2 py-1 font-sans text-sm"
              onClick={async () => {
                const shareData = {
                  title: "Heading: Mission Debrief",
                  text: `I just scored ${percentage}% on the ${customTopic || questions[0]?.ata || "Quiz"} module!\n\nScore: ${correctCount}/${totalQuestions}\nAccuracy: ${percentage}%\nAverage Time: ${formatTime(avgTime)}`,
                  url: window.location.href,
                };
                if (navigator.share && navigator.canShare(shareData)) {
                  try {
                    await navigator.share(shareData);
                  } catch (err) {
                    console.error(err);
                  }
                } else {
                  try {
                    await navigator.clipboard.writeText(
                      `${shareData.title}\n${shareData.text}\n${shareData.url}`,
                    );
                    alert("Copied to clipboard!");
                  } catch (err) {
                    alert("Failed to copy to clipboard.");
                  }
                }
              }}
            >
              Share Debrief
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // --- ACTIVE QUIZ RENDER ---
  const isSubmittedPractice =
    mode === "practice" && submittedIds.has(currentQ.id);
  const isRevealedViva = mode === "viva" && revealedIds.has(currentQ.id);
  const isBookmarked = bookmarks.includes(currentQ.id);

  const sharedProps = {
    currentQ,
    currentIndex,
    totalQuestions,
    questions,
    mode,
    selectedOptionId,
    answers,
    submittedIds,
    revealedIds,
    isSubmittedPractice,
    isRevealedViva,
    isBookmarked,
    timeLeft,
    timeElapsed,
    formatTime,
    aiExplanations,
    isAiLoading,
    handleSelectOption,
    handleSubmitPractice,
    handleRevealViva,
    handleNext,
    handlePrev,
    handleJump,
    toggleBookmark,
    handleExplainDeeper,
    setShowAbortPrompt,
    showAbortPrompt,
    storageKey,
    customQuestions: customQuestions || null,
    navigate,
  };

  let LayoutComponent: any;

  if (mode === "viva") {
    const override = userData?.settings?.vivaLayout || "auto";
    LayoutComponent =
      override === "editorial" ? EditorialLayout : FlashcardLayout;
  } else if (mode === "timed") {
    const override = userData?.settings?.timedLayout || "auto";
    LayoutComponent =
      override === "editorial" ? EditorialLayout : InstrumentLayout;
  } else {
    // practice
    const override = userData?.settings?.practiceLayout || "auto";
    if (override === "editorial") {
      LayoutComponent = EditorialLayout;
    } else if (override === "split") {
      LayoutComponent = SplitLayout;
    } else {
      LayoutComponent = currentQ.diagramCaption ? SplitLayout : EditorialLayout;
    }
  }

  return (
    <div
      className="w-full h-full"
      style={{ overscrollBehaviorY: "none" }}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEndEvent}
    >
      <AnimatePresence>
        {saveToastVisible && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className="fixed top-4 right-4 z-[999] bg-panel text-ink border border-rule px-4 py-2.5 rounded-full shadow-lg font-sans text-[13px] font-medium flex items-center gap-2"
          >
            <CheckCircle2 size={16} className="text-mint" />
            Progress saved
          </motion.div>
        )}

        {!user && submittedIds.size >= 3 && !dismissedSavePrompt && (
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 30 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[999] max-w-md w-[92%] bg-ink text-bg border border-white/10 rounded-2xl p-4 sm:p-5 shadow-2xl flex flex-col gap-3"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-mint/10 border border-mint/20 flex items-center justify-center text-mint shrink-0">
                  <Flame size={16} />
                </div>
                <div>
                  <h4 className="font-serif text-[15px] font-bold text-white">Save your progress?</h4>
                  <p className="font-sans text-[11.5px] text-white/70 leading-relaxed mt-0.5">
                    You've answered {submittedIds.size} questions! Sign in now to secure your accuracy, track your daily streak, and sync your training logs.
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setDismissedSavePrompt(true)}
                className="text-white/40 hover:text-white transition-colors p-1"
                title="Continue as guest"
              >
                <X size={14} />
              </button>
            </div>
            <div className="flex gap-2.5 justify-end">
              <button
                onClick={() => setDismissedSavePrompt(true)}
                className="font-mono text-[9px] uppercase tracking-widest text-white/50 hover:text-white transition-colors px-3 py-1.5"
              >
                Keep practicing
              </button>
              <button
                onClick={() => {
                  openAuthModal("signup");
                }}
                className="font-mono text-[10px] uppercase tracking-wider font-bold bg-mint text-bg hover:bg-mint/95 transition-colors px-4 py-1.5 rounded-full"
              >
                Secure Streak
              </button>
            </div>
          </motion.div>
        )}

        {showAbortPrompt && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-ink/70 backdrop-blur-sm"
            onClick={() => setShowAbortPrompt(false)}
          >
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.95 }}
              className="bg-paper p-8 rounded-2xl shadow-2xl max-w-sm w-full text-center border border-rule relative"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="font-serif text-3xl text-ink mb-2">
                Abort Session?
              </h2>
              <p className="font-mono text-[11px] text-muted uppercase tracking-widest leading-relaxed mb-8">
                Your progress for this session will not be saved.
              </p>
              <div className="flex items-center gap-3 w-full">
                <Button
                  variant="ghost"
                  className="flex-1 border border-rule hover:border-ink hover:text-ink text-muted transition-colors rounded-full"
                  onClick={() => setShowAbortPrompt(false)}
                >
                  Continue Flying
                </Button>
                <Button
                  variant="primary"
                  className="flex-1 bg-signal hover:bg-signal-vivid text-paper shadow-md rounded-full border-transparent"
                  onClick={() => {
                    setShowAbortPrompt(false);
                    navigate(-1);
                  }}
                >
                  Abort Session
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <Suspense
        fallback={
          <div
            className="w-full h-screen flex flex-col items-center justify-center text-muted border-t border-rule"
            style={{ backgroundColor: "var(--bg)" }}
          >
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3 }}
            >
              <CompassLogomark size={32} spin="rotate" spinDuration={2} />
            </motion.div>
          </div>
        }
      >
        {mode === "viva" ? (
          <ProGate type="viva-practice" isUnlocked={false}>
            <LayoutComponent {...sharedProps} />
          </ProGate>
        ) : mode === "timed" ? (
          <ProGate type="timed-mock" isUnlocked={mockExams.some(e => e.id === routeTopicId) && routeTopicId === "nav-cpl-01"}>
            <LayoutComponent {...sharedProps} />
          </ProGate>
        ) : (
          <LayoutComponent {...sharedProps} />
        )}
      </Suspense>
    </div>
  );
}
