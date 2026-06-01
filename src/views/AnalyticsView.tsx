import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { trackEvent } from "../lib/track";
import { Card, Chip, Button } from "../components/Atoms";
import { TrendingUp, Sparkles } from "lucide-react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  ResponsiveContainer,
  YAxis,
  Tooltip,
  CartesianGrid,
  XAxis,
} from "recharts";
import { SubjectItem } from "../data/topics";
import { fetchMergedSubjects } from "../lib/content";
import { apiFetch } from "../lib/api";
import { useAuth } from "../contexts/AuthContext";
import { useLogbook } from "../hooks/useLogbook";
import { useUserProgress } from "../lib/progress";
import { useGlobalLoading } from "../contexts/LoadingContext";
import { useToast } from "../components/ui/Toast";
import { useFeature } from "../hooks/useFeatureFlags";
import { ProGate } from "../components/ProGate";
import { MasterySunburst } from "../components/MasterySunburst";

export default function AnalyticsView() {
  const { loading, user } = useAuth();
  const { showToast } = useToast();
  const [insight, setInsight] = useState<string | null>(null);
  const [isInsightLoading, setIsInsightLoading] = useState(false);
  const aiDiagnosisEnabled = useFeature("aiDiagnosis");

  const { logbook, loading: logbookLoading } = useLogbook();
  const { stats: progressStats } = useUserProgress();
  const [subjectsList, setSubjectsList] = useState<SubjectItem[]>([]);
  const [loadingSubjects, setLoadingSubjects] = useState(true);

  useEffect(() => {
    async function loadSubjects() {
      try {
        const merged = await fetchMergedSubjects();
        setSubjectsList(merged);
      } catch (err) {
        console.error("Failed loading subjects in AnalyticsView:", err);
      } finally {
        setLoadingSubjects(false);
      }
    }
    loadSubjects();
  }, []);

  // Loading state
  if (loading || logbookLoading || loadingSubjects) {
    return (
      <div className="relative min-h-screen">
        <div className="absolute inset-0 blueprint pointer-events-none opacity-40 z-0" />
        <div className="absolute inset-0 paper-grain pointer-events-none opacity-100 z-1" />
        <div className="relative z-10 px-4 py-8 md:py-16 max-w-[820px] mx-auto space-y-12 animate-pulse">
          {/* Header area */}
          <div className="space-y-3">
            <span className="h-4 bg-muted-2/25 w-32 rounded font-mono inline-block"></span>
            <div className="h-10 bg-ink/10 w-[280px] md:w-[400px] rounded-lg"></div>
            <div className="h-4 bg-muted/20 w-80 rounded"></div>
          </div>
          
          {/* Diagnostic AI panel layout skeleton */}
          <div className="bg-paper border border-rule/50 rounded-2xl p-6 h-40 flex flex-col justify-between">
            <div className="space-y-2">
              <div className="h-5 bg-ink/10 w-44 rounded"></div>
              <div className="h-3 bg-muted/20 w-full rounded"></div>
              <div className="h-3 bg-muted/20 w-5/6 rounded"></div>
            </div>
            <div className="h-8 bg-ink/10 w-32 rounded-lg"></div>
          </div>

          {/* Interactive Sunburst area placeholder */}
          <div className="bg-paper border border-rule/50 rounded-2xl p-6 h-96 flex flex-col md:flex-row items-center justify-between gap-8">
            <div className="w-56 h-56 rounded-full bg-ink/5 border-2 border-rule/30 flex items-center justify-center relative">
              <div className="w-32 h-32 rounded-full bg-paper border border-rule/40"></div>
            </div>
            <div className="flex-1 space-y-4 w-full">
              <div className="h-6 bg-ink/10 w-2/3 rounded"></div>
              <div className="h-4 bg-muted/20 w-full rounded"></div>
              <div className="h-4 bg-muted/20 w-4/5 rounded"></div>
              <div className="grid grid-cols-2 gap-4 pt-4">
                <div className="h-12 bg-muted/10 rounded"></div>
                <div className="h-12 bg-muted/10 rounded"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const hasAttempts = logbook.length > 0;

  if (!hasAttempts) {
    return (
      <div className="relative min-h-[80vh] flex flex-col items-center justify-center p-4">
        <div className="absolute inset-0 blueprint pointer-events-none opacity-20 z-0" />
        <div className="relative z-10 w-full max-w-md text-center space-y-6 flex flex-col items-center">
          <div className="w-16 h-16 rounded-full bg-rule flex items-center justify-center text-muted mb-4 opacity-50">
            <TrendingUp size={32} />
          </div>
          <h1 className="font-serif text-4xl text-ink leading-tight">
            No telemetry recorded.
          </h1>
          <p className="font-sans text-ink-2 font-light leading-relaxed max-w-sm">
            You haven't completed any interrogatories yet. Complete a practice
            sequence or mock exam to populate your analytics.
          </p>
          <div className="pt-6 flex gap-4">
            <Link to="/modules">
              <Button variant="primary" className="h-[44px] shadow-sm">
                Start Studying
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Calculate real metrics from logbook
  const totalQuestions = logbook.reduce(
    (sum, att) => sum + (att.total || 0),
    0,
  );
  const avgScore = logbook.length
    ? Math.round(
        logbook.reduce((sum, att) => sum + (att.percentage || 0), 0) /
          logbook.length,
      )
    : 0;

  // Calculate Streak
  const uniqueDates = [
    ...new Set(
      logbook.map((att) => att.dateISO?.split("T")[0]).filter(Boolean),
    ),
  ]
    .sort()
    .reverse();
  let currentStreak = 0;
  if (uniqueDates.length > 0) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    // Start streak count if today or yesterday has data
    const todayStr = today.toISOString().split("T")[0];
    const yesterdayStr = yesterday.toISOString().split("T")[0];

    if (uniqueDates[0] === todayStr || uniqueDates[0] === yesterdayStr) {
      let expectedDate = new Date(uniqueDates[0]);
      for (const dStr of uniqueDates) {
        if (dStr === expectedDate.toISOString().split("T")[0]) {
          currentStreak++;
          expectedDate.setDate(expectedDate.getDate() - 1);
        } else {
          break;
        }
      }
    }
  }

  // Calculate Mastery
  const masteries = subjectsList
    .map((sub) => {
      const score = progressStats.subjectMastery[sub.id];
      return {
        title: sub.title,
        code: sub.num,
        score: score !== undefined ? score : null,
        hue: sub.hue,
      };
    })
    .sort((a, b) => {
      // Sort weakest first
      if (a.score === null && b.score === null) return 0;
      if (a.score === null) return 1;
      if (b.score === null) return -1;
      return a.score - b.score;
    });

  const { setLoading: setGlobalLoading } = useGlobalLoading();

  const handleGetDiagnosis = async () => {
    if (isInsightLoading || insight) return;
    if (!user) {
      showToast({
        type: 'error',
        title: 'Authentication Required',
        message: 'Sign in to use AI study coaching.',
        duration: 5000
      });
      return;
    }
    setIsInsightLoading(true);
    setGlobalLoading(true);

    const summaryData = {
      overallAverage: avgScore,
      totalQuestions: totalQuestions,
      weakestTopics: masteries
        .filter((m) => m.score !== null)
        .slice(0, 3)
        .map((m) => m.title),
      recentMocks: MOCK_EXAM_HISTORY.slice(0, 3).map(
        (m) => `${m.name}: ${m.score}%`,
      ),
    };

    try {
      trackEvent("ai_used", { metadata: { feature: "diagnosis" } });
      const response = await apiFetch("/api/instructor/diagnosis", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ summary: JSON.stringify(summaryData) }),
      });

      if (!response) {
        showToast({
          type: "error",
          title: "Service Offline",
          message: "AI features are temporarily unavailable",
          duration: 5000,
        });
        setInsight("AI features are temporarily unavailable.");
        return;
      }

      if (!response.body) throw new Error("No body in response");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      setInsight("");

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        setInsight((prev) => (prev || "") + chunk);
      }
    } catch (error) {
      console.error("Diagnosis error:", error);
      setInsight(
        "Failed to synthesize flight examiner insight. Verify connection.",
      );
    } finally {
      setIsInsightLoading(false);
      setGlobalLoading(false);
    }
  };

  // Generate 28-day heatmap based on real question counts
  const heatmapDays = Array.from({ length: 28 }).map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (27 - i));
    const dStr = d.toISOString().split("T")[0];
    const count = logbook
      .filter((att) => att.dateISO?.startsWith(dStr))
      .reduce((s, att) => s + (att.total || 0), 0);
    return count === 0
      ? 0
      : count < 20
        ? 1
        : count < 50
          ? 2
          : count < 100
            ? 3
            : 4;
  });

  // Derived mock exam history
  const allMocks = logbook
    .filter(
      (att) =>
        att.mode === "timed" || att.topicTitle?.toLowerCase().includes("mock"),
    )
    .reverse();
  const MOCK_EXAM_HISTORY = allMocks.map((att) => ({
    id: att.id,
    name: att.topicTitle || "Mock Exam",
    date: att.dateISO ? att.dateISO.split("T")[0] : "Unknown",
    score: att.percentage || 0,
    passMark: 70,
    duration: Math.round((att.durationSec || 0) / 60) + "m",
    passed: (att.percentage || 0) >= 70,
  }));

  const mockChartData = [...MOCK_EXAM_HISTORY]
    .reverse()
    .slice(-10)
    .map((m, i) => ({
      name: `A${i + 1}`,
      score: m.score,
      passMark: m.passMark,
    }));

  return (
    <ProGate type="analytics">
      <div className="relative min-h-screen pb-20">
      <div className="absolute inset-0 blueprint pointer-events-none opacity-40 z-0" />
      <div className="absolute inset-0 paper-grain pointer-events-none opacity-100 z-1" />

      <div className="relative z-10 px-4 pt-16 pb-8 max-w-[820px] mx-auto">
        <div className="mb-12">
          <span className="font-mono text-[10px] tracking-[0.2em] uppercase text-signal mb-4 block">
            § 03 · PROGRESS & MASTERY
          </span>
          <div className="flex items-center gap-3">
            <h1 className="text-[48px] md:text-[64px] text-ink leading-[1.0] tracking-tight mb-2 font-serif flex items-center gap-3">
              Detailed Analytics.
              <div
                className="relative group inline-flex items-center justify-center w-6 h-6 rounded-full bg-rule/50 text-muted hover:bg-rule transition-colors cursor-help"
                title="Mastery percentage is calculated by dividing your total correct answers by the total questions attempted for each specific ATA subject area over all time."
              >
                <div className="font-sans text-[12px] font-bold">?</div>
                <div className="absolute top-full mt-2 w-64 p-3 bg-ink text-bg font-sans text-xs rounded-lg opacity-0 -translate-y-2 pointer-events-none group-hover:opacity-100 group-hover:translate-y-0 transition-all z-50 shadow-xl">
                  Mastery percentage is calculated by dividing your total
                  correct answers by the total questions attempted for each
                  specific ATA subject area over all time.
                </div>
              </div>
            </h1>
          </div>
          <h2 className="text-xl text-ink-2 font-serif mb-4">
            Mastery Heatmap & Telemetry
          </h2>
          <p className="font-sans text-muted max-w-lg mb-6 leading-relaxed">
            Dive deep into your performance telemetry, key subjects, and mock
            exam history. The Mastery Heatmap visualizes your competency across
            different ATA chapters and subjects. Focus your efforts on the red
            and orange zones.
          </p>
        </div>

        {/* WEAK AREA COACH */}
        {aiDiagnosisEnabled && (
        <section className="flex flex-col h-full mb-16">
          <h2 className="font-mono text-sm tracking-widest text-ink uppercase mb-6 flex items-center gap-2">
            <Sparkles size={16} className="text-mint" /> Pacing & Alignment Coach
          </h2>
          <Card className="bg-mint-soft border border-mint h-full flex flex-col items-start min-h-[160px]">
            <Chip
              variant="solid"
              className="bg-mint text-bg text-[9px] mb-4 uppercase"
            >
              AI Study Plan
            </Chip>

            {!user ? (
              <div className="my-auto w-full flex items-center justify-between gap-6">
                <p className="font-sans text-sm text-ink-2 leading-relaxed max-w-xl font-mono text-[9px] uppercase tracking-widest text-muted-2">
                  Sign in to use AI coaching
                </p>
              </div>
            ) : !insight && !isInsightLoading ? (
              <div className="my-auto w-full flex items-center justify-between gap-6">
                <p className="font-sans text-sm text-ink-2 leading-relaxed max-w-xl">
                  Generate a targeted study plan directly based on your
                  performance over the last 28 days. The coach analyzes your
                  priority topics and mock exams to provide optimal revision
                  strategy.
                </p>
                <Button
                  variant="ghost"
                  onClick={handleGetDiagnosis}
                  className="shrink-0 bg-paper"
                >
                  Generate Study Plan
                </Button>
              </div>
            ) : isInsightLoading && !insight ? (
              <div className="mt-4 space-y-3 animate-pulse w-full">
                <div className="h-5 bg-mint/20 rounded w-full"></div>
                <div className="h-5 bg-mint/20 rounded w-11/12"></div>
                <div className="h-5 bg-mint/20 rounded w-3/4"></div>
              </div>
            ) : (
              <div className="mt-2 font-serif text-[19px] leading-relaxed text-ink animate-[fadeIn_0.4s_ease-out]">
                {insight}
                {isInsightLoading && (
                  <span className="animate-pulse inline-block ml-1">▋</span>
                )}
              </div>
            )}
          </Card>
        </section>
        )}

        {/* INTERACTIVE MASTERY SUNBURST */}
        <section className="mb-16">
          <div className="mb-6">
            <h2 className="font-mono text-sm tracking-widest text-ink uppercase flex items-center gap-2">
              <Sparkles size={16} className="text-amber" /> Interactive Hierarchy Sunburst
            </h2>
            <p className="font-sans text-xs text-muted mt-1">
              Interactive radial layout visualizing ATA chapters, subjects, and performance distributions. Explore depths seamlessly.
            </p>
          </div>
          <MasterySunburst subjectsList={subjectsList} logbook={logbook} />
        </section>

        {/* MASTERY HEATMAP & INTENSITY */}
        <section className="mb-16 grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <div className="flex justify-between items-end mb-6">
              <h2 className="font-mono text-sm tracking-widest text-ink uppercase flex items-center gap-2">
                <TrendingUp size={16} /> ATA Mastery
              </h2>
            </div>
            <div className="h-[300px] w-full border border-rule rounded-lg p-2 sm:p-4 bg-paper">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={masteries.map(m => ({
                    name: m.code.replace("ATA ", ""),
                    title: m.title,
                    score: m.score || 0,
                    fill: m.score !== null && m.score < 50 ? "var(--color-signal)" : "var(--color-navy)"
                  }))}
                  margin={{ top: 5, right: 0, left: -20, bottom: 20 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-rule)" />
                  <XAxis
                    dataKey="name"
                    tick={{
                      fontSize: 10,
                      fill: "var(--color-muted-2)",
                      fontFamily: "ui-monospace, monospace",
                    }}
                    axisLine={false}
                    tickLine={false}
                    tickMargin={10}
                  />
                  <YAxis
                    domain={[0, 100]}
                    tick={{ fontSize: 10, fill: "var(--color-muted-2)" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    cursor={{ fill: 'var(--color-rule)', opacity: 0.4 }}
                    contentStyle={{
                      backgroundColor: "var(--color-ink)",
                      color: "var(--color-bg)",
                      border: "none",
                      borderRadius: "8px",
                      fontSize: "12px",
                      fontFamily: "ui-monospace, monospace",
                    }}
                    formatter={(value: any) => [`${value}%`, "Mastery"]}
                    labelFormatter={(label) => `ATA ${label}`}
                  />
                  <Bar dataKey="score" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div>
            <h2 className="font-mono text-sm tracking-widest text-ink uppercase mb-6 flex items-center gap-2">
              Intensity Grid
            </h2>
            <Card className="bg-paper border border-rule p-5 sm:p-6 h-[calc(100%-48px)] flex flex-col items-center justify-center">
              <div className="grid grid-cols-7 gap-1 sm:gap-2 w-full max-w-sm">
                {["S", "M", "T", "W", "T", "F", "S"].map((d, idx) => (
                  <div
                    key={`day-${idx}`}
                    className="font-mono text-[9px] text-center text-muted-2 uppercase mb-1"
                  >
                    {d}
                  </div>
                ))}
                {heatmapDays.map((val, i) => {
                  const colors = [
                    "bg-rule/30",
                    "bg-navy/20",
                    "bg-navy/50",
                    "bg-navy/80",
                    "bg-navy text-bg font-bold",
                  ];
                  return (
                    <div
                      key={i}
                      className={`aspect-square rounded-sm sm:rounded-md flex items-center justify-center ${colors[val]}`}
                    ></div>
                  );
                })}
              </div>
              <div className="mt-6 flex justify-between items-center w-full max-w-sm px-2">
                <span className="font-mono text-[9px] text-muted-2 uppercase tracking-widest">
                  Less
                </span>
                <div className="flex gap-1">
                  {[0, 1, 2, 3, 4].map((v) => (
                    <div
                      key={v}
                      className={`w-3 h-3 rounded-sm ${["bg-rule/30", "bg-navy/20", "bg-navy/50", "bg-navy/80", "bg-navy"][v]}`}
                    ></div>
                  ))}
                </div>
                <span className="font-mono text-[9px] text-muted-2 uppercase tracking-widest">
                  More
                </span>
              </div>
            </Card>
          </div>
        </section>

        <div className="grid grid-cols-1 mb-16">
          {/* MOCK EXAM TREND */}
          <section>
            <h2 className="font-mono text-sm tracking-widest text-ink uppercase mb-6 flex items-center gap-2">
              <TrendingUp size={16} /> Mock Exam Trends
            </h2>
            <Card className="bg-paper border border-rule py-6 px-4 h-[300px]">
              {mockChartData.length > 0 ? (
                <div style={{ width: "100%", minHeight: 250, height: "100%" }} role="img" aria-label="Mock exam trends chart tracing score progress over time">
                  <ResponsiveContainer width="100%" height={250}>
                    <LineChart
                      data={mockChartData}
                      margin={{ top: 5, right: 10, left: -20, bottom: 0 }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        vertical={false}
                        stroke="var(--color-rule)"
                      />
                      <XAxis
                        dataKey="name"
                        tick={{
                          fontSize: 10,
                          fill: "var(--color-muted-2)",
                          fontFamily:
                            "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                        }}
                        axisLine={false}
                        tickLine={false}
                        tickMargin={10}
                      />
                      <YAxis
                        domain={[0, 100]}
                        tick={{ fontSize: 10, fill: "var(--color-muted-2)" }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "var(--color-ink)",
                          color: "var(--color-bg)",
                          border: "none",
                          borderRadius: "8px",
                          fontSize: "12px",
                          fontFamily:
                            "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                        }}
                        itemStyle={{ color: "var(--color-bg)" }}
                      />
                      <Line
                        type="monotone"
                        dataKey="passMark"
                        stroke="var(--color-muted-2)"
                        strokeDasharray="4 4"
                        strokeWidth={1}
                        dot={false}
                        isAnimationActive={false}
                      />
                      <Line
                        type="monotone"
                        dataKey="score"
                        stroke="var(--color-signal)"
                        strokeWidth={2}
                        dot={{
                          r: 4,
                          strokeWidth: 2,
                          fill: "var(--color-paper)",
                        }}
                        activeDot={{ r: 6 }}
                        animationDuration={1500}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-full flex items-center justify-center text-muted-2 font-mono text-[10px] uppercase tracking-widest text-center">
                  Insufficient mock exam data.
                  <br />
                  Complete at least one exam.
                </div>
              )}
            </Card>
          </section>
        </div>

        {/* MOCK EXAM HISTORY */}
        <section>
          <h2 className="font-mono text-sm tracking-widest text-ink uppercase mb-6">
            Archive Logs
          </h2>
          <Card className="bg-paper border border-rule p-0 overflow-x-auto">
            <table className="w-full text-left border-collapse whitespace-nowrap min-w-[600px] hidden md:table">
              <thead>
                <tr className="border-b border-rule">
                  <th className="font-mono text-[10px] text-muted-2 tracking-widest uppercase py-4 pl-6 font-normal">
                    Flight Plan / Exam
                  </th>
                  <th className="font-mono text-[10px] text-muted-2 tracking-widest uppercase py-4 font-normal">
                    Date logged
                  </th>
                  <th className="font-mono text-[10px] text-muted-2 tracking-widest uppercase py-4 font-normal">
                    Duration
                  </th>
                  <th className="font-mono text-[10px] text-muted-2 tracking-widest uppercase py-4 pr-6 text-right font-normal">
                    Threshold
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-rule font-sans text-sm">
                {MOCK_EXAM_HISTORY.map((exam) => (
                  <tr key={exam.id} className="hover:bg-bg-2 transition-colors">
                    <td className="py-4 pl-6 text-ink font-medium">
                      {exam.name}
                    </td>
                    <td className="py-4 text-ink-2 font-mono text-xs">
                      {exam.date}
                    </td>
                    <td className="py-4 text-ink-2">{exam.duration}</td>
                    <td className="py-4 pr-6 text-right flex items-center justify-end gap-3">
                      <span className="font-mono text-xs text-muted-2">
                        {exam.score}% / {exam.passMark}%
                      </span>
                      <Chip
                        variant="solid"
                        className={`text-[9px] w-12 text-center inline-block ${exam.passed ? "bg-mint text-bg" : "bg-signal text-bg"}`}
                      >
                        {exam.passed ? "PASS" : "FAIL"}
                      </Chip>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="md:hidden divide-y divide-rule font-sans text-sm">
              {MOCK_EXAM_HISTORY.map((exam) => (
                <div
                  key={exam.id}
                  className="p-4 hover:bg-bg-2 transition-colors flex flex-col gap-2"
                >
                  <div className="flex justify-between items-start">
                    <span className="text-ink font-medium">{exam.name}</span>
                    <Chip
                      variant="solid"
                      className={`text-[9px] min-w-[3rem] text-center ${exam.passed ? "bg-mint text-bg" : "bg-signal text-bg"}`}
                    >
                      {exam.passed ? "PASS" : "FAIL"}
                    </Chip>
                  </div>
                  <div className="flex justify-between items-center text-ink-2 font-mono text-xs">
                    <div className="flex gap-4 border-l-2 border-rule pl-2">
                      <span>{exam.date}</span>
                      <span>{exam.duration}</span>
                    </div>
                    <span className="text-muted-2 flex shrink-0">
                      Score: {exam.score}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </section>
      </div>
    </div>
  </ProGate>
);
}
