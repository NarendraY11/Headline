import { CheckCircle2, Flame, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import React, { lazy, Suspense, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { Button, CompassLogomark } from "../components/Atoms";
import { ProGate } from "../components/ProGate";
import { useToast } from "../components/ui/Toast";
import { useAuth } from "../contexts/AuthContext";
import { useGlobalLoading } from "../contexts/LoadingContext";
import { useNotifications } from "../contexts/NotificationContext";
import { Question } from "../data/questions";
import { mockExams } from "../data/topics";
import { useFeature } from "../hooks/useFeatureFlags";
import { useLogbook } from "../hooks/useLogbook";
import { apiFetchRaw, readError } from "../lib/api";
import { fetchPublishedQuestions, fetchQuestionsByIds, fetchQuizQuestionsForTopic } from "../lib/content";
import { submitQuestionAttempt } from "../lib/progress";
import { getDueQuestionIds, recordAnswerProgress, trackAnswerForStreakAndGoal } from "../lib/spacedRepetition";
import { supabase } from "../lib/supabase";
import { trackEvent } from "../lib/track";

const EditorialLayout = lazy(() => import("./quiz-layouts/EditorialLayout"));
const SplitLayout = lazy(() => import("./quiz-layouts/SplitLayout"));
const InstrumentLayout = lazy(() => import("./quiz-layouts/InstrumentLayout"));
const FlashcardLayout = lazy(() => import("./quiz-layouts/FlashcardLayout"));

import { QuizLoading, QuizNoQuestions } from "./quiz/QuizLoaders";
import PaperSelector from "./quiz/PaperSelector";
import QuizResults from "./quiz/QuizResults";
import QuizResumePrompt from "./quiz/QuizResumePrompt";
import QuizSetup from "./quiz/QuizSetup";
import { QuizMode, QuizStatus } from "./quiz/types";
import { formatTime } from "./quiz/utils";

export default function QuizView() {
  const { topicId: routeTopicId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { showToast } = useToast();

  const overrideTimeLimit = location.state?.overrideTimeLimit as number | undefined;
  const overridePassMark = location.state?.overridePassMark as number | undefined;
  const overrideNegMark = location.state?.overrideNegMark as number | undefined;
  const examTitle = location.state?.examTitle as string | undefined;

  const isVivaRoute = routeTopicId === "viva";
  const isTimedRoute = routeTopicId === "timed";
  const isPracticeRoute = routeTopicId === "practice";
  const isModeRoute = isVivaRoute || isTimedRoute || isPracticeRoute;

  const topicId = isModeRoute ? "all" : routeTopicId;

  const { user, userData, updateUserData, openAuthModal } = useAuth();
  const { addNotification } = useNotifications();
  const { setLoading: setGlobalLoading } = useGlobalLoading();
  const { logbook } = useLogbook();
  const aiCoachEnabled = useFeature("aiCoach");
  const aiExplainEnabled = useFeature("aiExplain");
  const flashcardsEnabled = useFeature("flashcards");
  const cockpitEnabled = useFeature("cockpitLayouts");

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

        // Resume: if a saved session exists for this topic, reload the EXACT
        // same question set (and order) so currentIndex/answers stay aligned.
        // Without this the random re-fetch below would desync the resume.
        try {
          const savedRaw = localStorage.getItem(`heading_quiz_state_${topicId || "default"}`);
          if (savedRaw) {
            const st = JSON.parse(savedRaw);
            if (
              st?.status === "active" &&
              Array.isArray(st.questionIds) &&
              st.questionIds.length > 0
            ) {
              const fetched = await fetchQuestionsByIds(st.questionIds);
              const byId = new Map(fetched.map((q) => [q.id, q]));
              const ordered = st.questionIds
                .map((id: string) => byId.get(id))
                .filter(Boolean) as Question[];
              if (ordered.length > 0) {
                setQuestions(ordered);
                return;
              }
            }
          }
        } catch (e) {}

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

  const totalQuestions = questions ? questions.length : 0;

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

  // Paper selector: only shown for the /quiz/viva route, before quiz begins
  const [showPaperPicker, setShowPaperPicker] = useState(isVivaRoute);

  const handlePaperConfirm = (selectedIds: string[]) => {
    setShowPaperPicker(false);
    if (selectedIds.length > 0) {
      setQuestions((prev) =>
        prev.filter(
          (q) =>
            selectedIds.includes(q.subjectId || "") ||
            selectedIds.includes(q.topicId || "")
        )
      );
    }
  };

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
      if (curQ) {
        setSelectedOptionId(answers[curQ.id] || null);
      } else {
        setSelectedOptionId(null);
      }
    }
  }, [currentIndex, status, questions, answers]);

  // --- EFFECTS ---
  // Timer for active quiz
  const [timeLeft, setTimeLeft] = useState<number | null>(null);

  useEffect(() => {
    let timerId: NodeJS.Timeout;
    if (status === "active") {
      timerId = setInterval(() => {
        setTimeElapsed((prev: number) => prev + 1);
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
      const overrideSec = overrideTimeLimit ? overrideTimeLimit * 60 : undefined;
      const examConfig = mockExams.find((e) => e.id === topicId);
      const totalSec = overrideSec || (examConfig
        ? examConfig.minutes * 60
        : totalQuestions * 60);
      setTimeLeft(totalSec - timeElapsed > 0 ? totalSec - timeElapsed : 0);
    }
  }, [status, mode, topicId, totalQuestions, timeElapsed, timeLeft, overrideTimeLimit]);

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
      // Persist the exact question set so resume reloads the same questions
      // in the same order (random re-fetch would otherwise desync progress).
      questionIds: questions.map((q) => q.id),
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
    questions,
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
      if (!currentQ) return;
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
    const currentQuestion = questions[currentIndex];
    if (!currentQuestion) return;
    const qId = currentQuestion.id;
    if (mode === "practice" && submittedIds.has(qId)) return;

    setSelectedOptionId(choiceId);
    if (mode === "timed") {
      // In timed mode, selection implicitly saves
      setAnswers((prev) => ({ ...prev, [qId]: choiceId }));

      // Track question_answered telemetry for timed mode
      const isCorrect = choiceId === currentQuestion.correct;
      const timeSec = Math.max(0, timeElapsed - questionTimeStart);
      trackEvent("question_answered", {
        questionId: qId,
        metadata: { correct: isCorrect, timeSec }
      });
    }
  };

  const handleSubmitPractice = () => {
    const currentQ = questions[currentIndex];
    if (!currentQ || !selectedOptionId) return;
    const qId = currentQ.id;
    setAnswers((prev) => ({ ...prev, [qId]: selectedOptionId }));
    setSubmittedIds((prev) => new Set(prev).add(qId));

    // Track question_answered telemetry for practice mode
    const isCorrect = selectedOptionId === currentQ.correct;
    const timeSec = Math.max(0, timeElapsed - questionTimeStart);
    trackEvent("question_answered", {
      questionId: qId,
      metadata: { correct: isCorrect, timeSec }
    });

    // Record question performance for spacing/review
    recordAnswerProgress(user?.uid || null, qId, isCorrect, currentQ.topicId);
    
    // Single source of truth analytics
    if (user) {
      submitQuestionAttempt(user.uid, qId, isCorrect, currentQ.subjectId, currentQ.subcategoryId, currentQ.examId);
    }

    // Track daily goal & streak counters
    trackAnswerForStreakAndGoal(user, userData, updateUserData, 1);
  };

  const handleRevealViva = (qId: string) => {
    setRevealedIds((prev) => new Set(prev).add(qId));
  };

  const trackQuestionTime = () => {
    const q = questions[currentIndex];
    if (!q) return;
    const qId = q.id;
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
      setCurrentIndex((prev: number) => prev + 1);
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
      setCurrentIndex((prev: number) => prev - 1);
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

  const handleVivaKnew = (qId: string) => {
    const q = questions[currentIndex];
    recordAnswerProgress(user?.uid || null, qId, true, q.topicId);
    handleNext();
  };

  const handleVivaDidntKnow = (qId: string) => {
    const q = questions[currentIndex];
    recordAnswerProgress(user?.uid || null, qId, false, q.topicId);
    handleNext();
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
        
        if (user) {
          submitQuestionAttempt(user.uid, q.id, isCorrect, q.subjectId, q.subcategoryId, q.examId);
        }
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
    } else {
      const topicName = customTopic || questions[0]?.ata || "this module";
      addNotification(
        "Module Complete",
        `You scored ${Math.round(currentAccuracy)}% on ${topicName}. Keep the momentum going!`,
        "milestone"
      );
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


  const handleExplainDeeper = async () => {
    if (!currentQ) return;
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
      const response = await apiFetchRaw("/api/instructor/explain", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          prompt: currentQ.prompt,
          userAnswer: userAnswerLabel,
          correctAnswer: correctAnswerLabel,
        }),
      }, 60000); // streaming AI: allow up to 60s, don't truncate

      if (!response || !response.ok) {
        const msg = response
          ? await readError(response, "AI features are temporarily unavailable.")
          : "AI features are temporarily unavailable.";
        showToast({
          type: "error",
          title: response?.status === 429 ? "Slow down" : response?.status === 403 ? "Upgrade required" : "Service Offline",
          message: msg,
          duration: 5000,
        });
        setAiExplanations((prev) => ({ ...prev, [currentQ.id]: msg }));
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

      const response = await apiFetchRaw("/api/instructor/coach", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ scores }),
      }, 60000); // streaming AI: allow up to 60s

      if (!response || !response.ok) {
        const msg = response
          ? await readError(response, "AI features are temporarily unavailable.")
          : "AI features are temporarily unavailable.";
        showToast({
          type: "error",
          title: response?.status === 429 ? "Slow down" : response?.status === 403 ? "Upgrade required" : "Service Offline",
          message: msg,
          duration: 5000,
        });
        setStudyPlan(msg);
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
  if (showPaperPicker) {
    return (
      <PaperSelector
        mode="viva"
        onConfirm={handlePaperConfirm}
        onBack={() => navigate("/today")}
      />
    );
  }

  if (loadingContent || (!questions && (isVivaRoute || mode === "viva"))) {
    return <QuizLoading isVivaRoute={isVivaRoute} mode={mode} />;
  }

  if (totalQuestions === 0) {
    return (
      <QuizNoQuestions
        isVivaRoute={isVivaRoute}
        topicId={topicId}
        navigate={navigate}
      />
    );
  }

  const currentQ = (questions && questions.length > 0)
    ? (questions[currentIndex] || questions[0] || null)
    : null;

  if (status === "prompt-resume") {
    return (
      <QuizResumePrompt
        customTopic={customTopic}
        ata={questions[0]?.ata}
        setStatus={setStatus}
        startQuiz={startQuiz}
        savedModeSelection={savedModeSelection}
      />
    );
  }

  if (status === "setup") {
    return (
      <QuizSetup
        customTopic={customTopic}
        ata={currentQ?.ata}
        routeTopicId={routeTopicId}
        mockExams={mockExams}
        totalQuestions={questions.length}
        startQuiz={startQuiz}
        navigate={navigate}
      />
    );
  }

  if (status === "results") {
    return (
      <QuizResults 
        questions={questions}
        answers={answers}
        totalQuestions={totalQuestions}
        timeElapsed={timeElapsed}
        timePerQuestion={timePerQuestion}
        overridePassMark={overridePassMark}
        overrideNegMark={overrideNegMark}
        userData={userData}
        user={user}
        mode={mode}
        topicId={topicId}
        routeTopicId={routeTopicId}
        examTitle={examTitle}
        customTopic={customTopic}
        animatedScore={animatedScore}
        unlockedMilestone={unlockedMilestone}
        setUnlockedMilestone={setUnlockedMilestone}
        navigate={navigate}
        startQuiz={startQuiz}
        aiCoachEnabled={aiCoachEnabled}
        studyPlan={studyPlan}
        isCoachLoading={isCoachLoading}
        handleGetStudyPlan={handleGetStudyPlan}
        openAuthModal={openAuthModal}
      />
    );
  }

  if (!currentQ) {
    return (
      <div className="relative min-h-screen flex items-center justify-center p-4">
        <div className="absolute inset-0 blueprint pointer-events-none opacity-40 z-0" />
        <div className="relative z-10 text-center">
          <h2 className="font-serif text-3xl text-ink">
            {isVivaRoute ? "No VIVA questions available yet" : "No Questions Found"}
          </h2>
          <p className="font-sans text-muted mb-8 mt-2">
            {isVivaRoute 
              ? "We are currently preparing more oral board questions. Please check back soon!"
              : "There are no operational limits specified for this module yet."}
          </p>
          <Button variant="primary" onClick={() => navigate("/modules")}>
            Return to Base
          </Button>
        </div>
      </div>
    );
  }

  // --- ACTIVE QUIZ RENDER ---
  const isSubmittedPractice =
    mode === "practice" && currentQ && submittedIds.has(currentQ.id);
  const isRevealedViva = mode === "viva" && currentQ && revealedIds.has(currentQ.id);
  const isBookmarked = currentQ ? bookmarks.includes(currentQ.id) : false;

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
    handleVivaKnew,
    handleVivaDidntKnow,
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
    aiExplainEnabled,
  };

  let LayoutComponent: any;

  if (mode === "viva") {
    const override = userData?.settings?.vivaLayout || "auto";
    LayoutComponent =
      (override === "editorial" || !flashcardsEnabled) ? EditorialLayout : FlashcardLayout;
  } else if (mode === "timed") {
    const override = userData?.settings?.timedLayout || "auto";
    LayoutComponent =
      (override === "editorial" || !cockpitEnabled) ? EditorialLayout : InstrumentLayout;
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

  if (status === "active") {
    if (!currentQ) {
      return (
        <div className="flex flex-col min-h-screen items-center justify-center bg-bg relative">
           <div className="absolute inset-0 blueprint pointer-events-none opacity-40 z-0" />
           <div className="relative z-10 p-8 bg-paper border border-rule rounded-xl text-center shadow-sm">
             <div className="w-8 h-8 rounded-full border-2 border-navy border-t-transparent animate-spin mx-auto mb-4"></div>
             <p className="font-mono text-xs uppercase tracking-widest text-muted">Awaiting Flight Data...</p>
           </div>
        </div>
      );
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
            className="fixed top-4 right-4 z-[var(--z-toast)] bg-panel text-ink border border-rule px-4 py-2.5 rounded-full shadow-lg font-sans text-[13px] font-medium flex items-center gap-2"
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
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[var(--z-toast)] max-w-md w-[92%] bg-ink text-bg border border-white/10 rounded-2xl p-4 sm:p-5 shadow-2xl flex flex-col gap-3"
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
                className="text-white/70 hover:text-white transition-colors p-1"
                title="Continue as guest"
              >
                <X size={14} />
              </button>
            </div>
            <div className="flex gap-2.5 justify-end">
              <button
                onClick={() => setDismissedSavePrompt(true)}
                className="font-mono text-[9px] uppercase tracking-widest text-white/75 hover:text-white transition-colors px-3 py-1.5"
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
            className="fixed inset-0 z-[var(--z-modal)] flex items-center justify-center p-4 bg-ink/70 backdrop-blur-sm"
            onClick={() => setShowAbortPrompt(false)}
          >
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-labelledby="abort-dialog-title"
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.95 }}
              className="bg-paper p-8 rounded-2xl shadow-2xl max-w-sm w-full text-center border border-rule relative"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 id="abort-dialog-title" className="font-serif text-3xl text-ink mb-2">
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
}
