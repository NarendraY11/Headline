import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { animate, Reorder } from "motion/react";
import { Button } from "../components/Atoms";
import {
  Compass,
  Flame,
  ArrowUpRight,
  Clock,
  Award,
  BookOpen,
  TrendingUp,
  Sun,
  Cloud,
  CloudRain,
  CloudLightning,
  Snowflake,
  Wind,
  CloudFog,
  CloudOff,
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { useLogbook } from "../hooks/useLogbook";
import { useGlobalLoading } from "../contexts/LoadingContext";
import { SubjectItem } from "../data/topics";
import { fetchMergedSubjects } from "../lib/content";
import { apiFetch } from "../lib/api";
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  Area,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  ComposedChart,
} from "recharts";

function AnimatedCounter({
  value,
  duration = 1.5,
}: {
  value: number;
  duration?: number;
}) {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    const controls = animate(0, value, {
      duration: duration,
      ease: "easeOut",
      onUpdate: (v) => setDisplayValue(Math.round(v)),
    });
    return () => controls.stop();
  }, [value, duration]);

  return <span>{displayValue.toLocaleString()}</span>;
}

function WeatherWidget() {
  const { user } = useAuth();
  const [weatherData, setWeatherData] = useState<{
    briefing: string;
    condition: string;
    forecast?: any[];
    unavailable?: boolean;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const { setLoading: setGlobalLoading } = useGlobalLoading();

  const fetchWeather = async () => {
    if (!user) {
      setWeatherData({
        briefing: "Sign in to see weather briefing",
        condition: "CLOUDY",
        unavailable: true,
      });
      setLoading(false);
      setGlobalLoading(false);
      return;
    }
    setLoading(true);
    setGlobalLoading(true);

    try {
      const response = await apiFetch("/api/weather", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ location: "London Heathrow (LHR)" }),
      });

      if (!response) {
        setWeatherData((prev) => ({ 
          briefing: "Weather briefing is currently offline", 
          condition: "CLOUDY", 
          unavailable: true 
        }) as any);
        return;
      }

      const contentType = response.headers.get("content-type");
      if (contentType && contentType.indexOf("application/json") !== -1) {
        try {
          const d = await response.json();
          if (d && d.briefing) {
            setWeatherData({
              ...d,
              unavailable: false,
              forecast: Array.isArray(d.forecast) ? d.forecast : [],
            });
          } else {
            setWeatherData((prev) => ({ 
              briefing: "Weather briefing is currently offline", 
              condition: "CLOUDY", 
              unavailable: true 
            }) as any);
          }
        } catch (jsonError) {
          setWeatherData((prev) => ({ 
            briefing: "Weather briefing is currently offline", 
            condition: "CLOUDY", 
            unavailable: true 
          }) as any);
        }
      } else {
        setWeatherData((prev) => ({ 
          briefing: "Weather briefing is currently offline", 
          condition: "CLOUDY", 
          unavailable: true 
        }) as any);
      }
    } catch (error) {
      setWeatherData((prev) => ({ 
        briefing: "Weather briefing is currently offline", 
        condition: "CLOUDY", 
        unavailable: true 
      }) as any);
    } finally {
      setLoading(false);
      setGlobalLoading(false);
    }
  };

  useEffect(() => {
    fetchWeather();
  }, [user]);

  const getWeatherIcon = (condition: string, size: number = 24) => {
    switch (condition) {
      case "SUNNY":
        return <Sun size={size} className="text-amber" />;
      case "CLOUDY":
        return <Cloud size={size} className="text-muted" />;
      case "RAIN":
        return <CloudRain size={size} className="text-sky" />;
      case "STORM":
        return <CloudLightning size={size} className="text-signal" />;
      case "SNOW":
        return <Snowflake size={size} className="text-sky" />;
      case "WINDY":
        return <Wind size={size} className="text-muted" />;
      case "FOG":
        return <CloudFog size={size} className="text-muted" />;
      default:
        return <Sun size={size} className="text-amber" />;
    }
  };

  const isAlert =
    weatherData?.condition === "STORM" || weatherData?.condition === "RAIN";

  if (!user) {
    return (
      <div
        className="bg-paper border border-rule rounded-2xl md:rounded-lg shadow-sm col-span-2 flex items-center justify-between"
        style={{ padding: "14px 20px", minHeight: "52px" }}
      >
        <div className="flex items-center gap-2 md:gap-3 shrink-0 mr-2">
          <CloudOff size={16} className="text-muted shrink-0" />
          <span className="font-sans text-[14px] text-ink font-normal truncate">
            Sign in to use AI coaching
          </span>
          <span className="text-muted-2 shrink-0">·</span>
          <span className="font-mono text-[11px] text-muted-2 uppercase tracking-wide truncate hidden sm:inline">
            Aviation weather briefing requires active login
          </span>
        </div>
      </div>
    );
  }

  if (weatherData?.unavailable) {
    return (
      <div
        className="bg-paper border border-rule rounded-2xl md:rounded-lg shadow-sm col-span-2 flex items-center justify-between"
        style={{ padding: "14px 20px", minHeight: "52px" }}
      >
        <div className="flex items-center gap-2 md:gap-3 shrink-0 mr-2">
          <CloudOff size={16} className="text-muted shrink-0" />
          <span className="font-sans text-[14px] text-ink font-normal truncate">
            WX Data Offline
          </span>
          <span className="text-muted-2 shrink-0">·</span>
          <span className="font-mono text-[11px] text-muted-2 uppercase tracking-wide truncate hidden sm:inline">
            METAR feed unavailable
          </span>
        </div>
        <button
          onClick={fetchWeather}
          disabled={loading}
          className="flex items-center justify-center border border-rule rounded-full px-4 font-sans text-[11px] font-medium text-ink hover:bg-rule/30 transition-colors disabled:opacity-50 h-[32px] shrink-0"
        >
          {loading ? "Retrying..." : "Retry"}
        </button>
      </div>
    );
  }

  return (
    <div className="bg-paper border border-rule rounded-2xl md:rounded-lg p-5 md:p-4 shadow-sm col-span-2 flex flex-col justify-between transition-all duration-300">
      <div className="flex justify-between items-center mb-2">
        <div className="font-mono text-[9px] text-muted-2 tracking-widest uppercase flex items-center gap-2">
          <span>WX INFO</span>
          {isAlert && <span className="w-1.5 h-1.5 rounded-full bg-signal" />}
        </div>
        <div
          className={`w-1.5 h-1.5 rounded-sm transform rotate-45 ${loading && !weatherData?.unavailable ? "bg-signal animate-pulse" : "bg-signal"}`}
          title="Live WX Data"
        />
      </div>
      <div>
        {loading && !weatherData ? (
          <div className="h-6 flex items-center">
            <div className="w-4 h-4 rounded-full border-t-2 border-navy animate-spin" />
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="flex items-start gap-3">
              {weatherData?.condition && (
                <div
                  className="mt-1 cursor-pointer hover:opacity-80 transition-opacity"
                  onClick={() => setExpanded(!expanded)}
                  title="Click to toggle forecast"
                >
                  {getWeatherIcon(weatherData.condition)}
                </div>
              )}
              <p className="font-sans text-sm text-ink-2">
                {weatherData?.briefing}
              </p>
            </div>
            {expanded && weatherData?.forecast && (
              <div className="mt-2 pt-4 border-t border-rule grid grid-cols-6 gap-2">
                {weatherData.forecast.map((f: any, i: number) => (
                  <div key={i} className="flex flex-col items-center gap-1.5">
                    <span className="font-mono text-[9px] text-muted-2">
                      {f.hour}
                    </span>
                    {getWeatherIcon(f.condition, 16)}
                    <span className="font-sans text-[10px] text-ink">
                      {f.temp}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function TodayView() {
  const { userData, loading, updateUserData } = useAuth();
  const [notificationStatus, setNotificationStatus] = useState<
    NotificationPermission | "unsupported"
  >("default");
  const { logbook, loading: logbookLoading } = useLogbook();
  const [subjectsList, setSubjectsList] = useState<SubjectItem[]>([]);
  const [loadingSubjects, setLoadingSubjects] = useState(true);

  useEffect(() => {
    async function loadSubjects() {
      try {
        const merged = await fetchMergedSubjects();
        setSubjectsList(merged);
      } catch (err) {
        console.error("Failed loading subjects in TodayView:", err);
      } finally {
        setLoadingSubjects(false);
      }
    }
    loadSubjects();
  }, []);

  // User configurable tiles
  const [tileOrder, setTileOrder] = useState<string[]>(() => {
    if (userData?.settings?.dashboardTiles) {
      return userData.settings.dashboardTiles;
    }
    try {
      const saved = localStorage.getItem("heading_dashboard_tiles");
      if (saved) return JSON.parse(saved);
    } catch {}
    return ["streak", "answered", "score", "hours"];
  });

  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    if (!("Notification" in window)) {
      setNotificationStatus("unsupported");
    } else {
      setNotificationStatus(Notification.permission);
    }
  }, []);

  useEffect(() => {
    if (userData?.settings?.dashboardTiles) {
      setTileOrder(userData.settings.dashboardTiles);
    }
  }, [userData?.settings?.dashboardTiles]);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    handleResize(); // Initial check
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const hasAttempts = logbook.length > 0;

  // Daily Drill progress notification
  useEffect(() => {
    if (
      !loading &&
      !logbookLoading &&
      hasAttempts &&
      !userData?.settings?.doNotDisturb
    ) {
      const now = new Date();
      const todayStr = now.toISOString().split("T")[0];
      const hasStudiedToday = Array.isArray(logbook)
        ? logbook.some((att: any) => att.dateISO?.startsWith(todayStr))
        : false;

      if (
        !hasStudiedToday &&
        now.getHours() >= 12 &&
        notificationStatus !== "granted"
      ) {
        if (
          "Notification" in window &&
          Notification.permission !== "denied" &&
          notificationStatus === "default"
        ) {
          Notification.requestPermission().then((permission) => {
            setNotificationStatus(permission);
            if (permission === "granted") {
              new Notification("Daily Drill Pending", {
                body: "Captain, you haven't logged any progress today. Complete your daily drill now!",
                icon: "/favicon.svg",
              });
            }
          });
        }
      }
    }
  }, [
    loading,
    logbookLoading,
    hasAttempts,
    notificationStatus,
    userData?.settings?.doNotDisturb,
    logbook,
  ]);

  const savedDate =
    userData?.nextExam ?? localStorage.getItem("heading_next_exam") ?? "";

  let daysDiff: number | null = null;
  if (savedDate) {
    const d = new Date(savedDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    d.setHours(0, 0, 0, 0);
    const diffTime = d.getTime() - today.getTime();
    daysDiff = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  const hour = new Date().getHours();
  let greeting = "Good morning";
  let isLate = false;
  if (hour >= 6 && hour < 12) {
    greeting = "Good morning";
  } else if (hour >= 12 && hour < 17) {
    greeting = "Good afternoon";
  } else if (hour >= 17 && hour < 21) {
    greeting = "Good evening";
  } else {
    greeting = "Still flying";
    isLate = true;
  }

  const displayName = userData?.displayName || "Captain";

  if (loading || logbookLoading || loadingSubjects) {
    return (
      <div className="relative min-h-[70vh] flex flex-col items-center justify-center p-4">
        <div className="absolute inset-0 blueprint pointer-events-none opacity-20 z-0" />
        <div className="w-12 h-12 rounded-full border-t-2 border-navy animate-spin" />
      </div>
    );
  }

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
  const hoursStudied = Math.round(
    logbook.reduce((sum, att) => sum + (att.durationSec || 0), 0) / 3600,
  );

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

  const streakWeek = Array.from({ length: 7 }).map((_, i) => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - (6 - i));
    const dStr = d.toISOString().split("T")[0];
    return {
      dayStr: d.toLocaleDateString("en-US", { weekday: "narrow" }),
      isActive: uniqueDates.includes(dStr),
      isToday: i === 6,
    };
  });

  // Calculate Mastery for Radar Chart
  const topicAgg: Record<string, { correct: number; total: number }> = {};
  logbook.forEach((att: any) => {
    if (att.perTopic) {
      for (const [ata, stats] of Object.entries(att.perTopic) as [
        string,
        any,
      ][]) {
        if (!topicAgg[ata]) topicAgg[ata] = { correct: 0, total: 0 };
        topicAgg[ata].correct += stats.correct || 0;
        topicAgg[ata].total += stats.total || 0;
      }
    }
  });

  const masteries = subjectsList.map((sub: any) => {
    const stats = topicAgg[sub.title];
    const mappings: Record<string, string> = {
      "Air Regulation": "Air Reg.",
      Meteorology: "Meteo.",
      "Principles of Flight": "Principles",
      "Aircraft General": "Aircraft",
      "Airbus A320 Systems": "Airbus",
      "Air Navigation": "Air Nav.",
    };
    const title = sub.title;
    const label = mappings[title] || sub.shortName || title;

    return {
      subject: label,
      fullTitle: sub.title,
      score: stats ? Math.round((stats.correct / stats.total) * 100) : 0,
      correct: stats ? stats.correct : 0,
      total: stats ? stats.total : 0,
    };
  });

  // Calculate study pacing target timeline vs logged hours
  const getPacingData = () => {
    const today = new Date();
    // Default target exam date is savedDate or 30 days from now
    const targetDate = savedDate ? new Date(savedDate) : new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
    
    let cumulativeHours = 0;
    const historyData: { day: string; actual: number; target: number }[] = [];
    
    const totalTargetHours = 50; // recommend 50 hours of total logging to pass EASA/DGCA
    const daysToTarget = Math.max(1, Math.ceil((targetDate.getTime() - today.getTime()) / (24 * 60 * 60 * 1000)));
    
    // Generate dates for the last 7 days
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const dateStr = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      
      if (logbook.length > 0) {
        cumulativeHours = logbook
          .filter(l => l.dateISO && new Date(l.dateISO).getTime() <= d.getTime() + 24 * 3600 * 1000)
          .reduce((sum, l) => sum + ((l.durationSec || 0) / 3600), 0);
      } else {
        // Mock baseline pattern scaling up from 4 to 12 hours for beautiful visualization
        cumulativeHours = (6 - i) * 1.5 + 4;
      }
      
      const baselineStart = new Date(today.getTime() - 14 * 24 * 60 * 60 * 1000);
      const totalPeriod = (targetDate.getTime() - baselineStart.getTime()) || 1;
      const progressRatio = (d.getTime() - baselineStart.getTime()) / totalPeriod;
      const targetHours = Math.max(0, Math.round(totalTargetHours * Math.min(1, progressRatio) * 10) / 10);

      historyData.push({
        day: dateStr,
        actual: Math.round(cumulativeHours * 10) / 10,
        target: targetHours,
      });
    }

    // Add Future Target Milestone Projection point
    const projDate = new Date(today);
    projDate.setDate(today.getDate() + Math.min(daysToTarget, 5));
    const projDateStr = projDate.toLocaleDateString("en-US", { month: "short", day: "numeric" }) + " (Proj)";
    
    const baselineStart = new Date(today.getTime() - 14 * 24 * 60 * 60 * 1000);
    const totalPeriod = (targetDate.getTime() - baselineStart.getTime()) || 1;
    const progressRatio = (projDate.getTime() - baselineStart.getTime()) / totalPeriod;
    const projTargetHours = Math.max(0, Math.round(totalTargetHours * Math.min(1, progressRatio) * 10) / 10);

    historyData.push({
      day: projDateStr,
      actual: Math.round(cumulativeHours * 10) / 10, // assumes no extra study yet in future projection
      target: projTargetHours
    });

    return historyData;
  };

  const pacingData = getPacingData();

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-ink text-bg font-sans p-3 rounded-lg shadow-xl border border-rule/20 min-w-[200px]">
          <div className="font-serif text-sm border-b border-rule/20 pb-2 mb-2">
            {data.fullTitle}
          </div>
          <div className="flex justify-between items-center mb-1">
            <span className="font-mono text-[9px] uppercase tracking-widest opacity-70">
              Mastery
            </span>
            <span className="font-mono text-sm text-mint">{data.score}%</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="font-mono text-[9px] uppercase tracking-widest opacity-70">
              Questions
            </span>
            <span className="font-mono text-[10px]">
              {data.correct} / {data.total}
            </span>
          </div>
        </div>
      );
    }
    return null;
  };

  const handleReorder = (newOrder: string[]) => {
    setTileOrder(newOrder);
    localStorage.setItem("heading_dashboard_tiles", JSON.stringify(newOrder));
    if (userData) {
      updateUserData({
        settings: { ...userData.settings, dashboardTiles: newOrder },
      });
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 70) return "text-mint";
    if (score >= 40) return "text-amber";
    return "text-signal";
  };

  const renderTile = (tile: string) => {
    const tileBaseClasses =
      "bg-paper border border-rule rounded-xl p-4 shadow-sm col-span-1 flex flex-col justify-between cursor-grab active:cursor-grabbing";
    switch (tile) {
      case "streak":
        return (
          <Reorder.Item
            key="streak"
            value="streak"
            id="streak"
            className={tileBaseClasses}
          >
            <div className="flex items-center gap-1.5 mb-1 text-muted-2">
              <Flame size={14} className="text-signal md:text-muted" />
              <span className="font-mono text-[9px] uppercase tracking-widest text-ink-2">
                STREAK
              </span>
            </div>
            <div className="font-serif text-3xl text-ink leading-none mt-2">
              <AnimatedCounter value={currentStreak} />
              <span className="font-sans text-xl font-normal lowercase text-muted tracking-normal">
                d
              </span>
            </div>
            <div className="flex justify-between items-center mt-4 pointer-events-none w-full">
              {streakWeek.map((d, i) => (
                <div
                  key={i}
                  className="flex flex-col items-center gap-1.5 text-[10px]"
                >
                  <div
                    className={`w-3.5 h-3.5 sm:w-5 sm:h-5 rounded-full border flex items-center justify-center
                      ${d.isActive ? "bg-signal-soft border-signal/30 text-signal" : "bg-bg border-rule text-transparent"} 
                    `}
                  >
                    {d.isActive && (
                      <span className="w-1 h-1 sm:w-1.5 sm:h-1.5 bg-signal rounded-full"></span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Reorder.Item>
        );
      case "answered":
        return (
          <Reorder.Item
            key="answered"
            value="answered"
            id="answered"
            className={tileBaseClasses}
          >
            <div>
              <div className="flex items-center gap-1.5 mb-1 text-muted-2">
                <BookOpen size={14} />
                <span className="font-mono text-[9px] uppercase tracking-widest text-ink-2">
                  Q'S ANSWERED
                </span>
              </div>
              <div className="font-serif text-3xl text-ink leading-none mt-2">
                <AnimatedCounter value={totalQuestions} />
              </div>
            </div>
          </Reorder.Item>
        );
      case "score":
        return (
          <Reorder.Item
            key="score"
            value="score"
            id="score"
            className={tileBaseClasses}
          >
            <div>
              <div className="flex items-center gap-1.5 mb-1 text-muted-2">
                <Award size={14} />
                <span className="font-mono text-[9px] uppercase tracking-widest text-ink-2">
                  AVG SCORE
                </span>
              </div>
              <div
                className={`font-serif text-3xl leading-none mt-2 ${getScoreColor(avgScore)}`}
              >
                <AnimatedCounter value={avgScore} />
                <span className="font-sans text-xl text-muted font-normal tracking-normal">
                  %
                </span>
              </div>
            </div>
          </Reorder.Item>
        );
      case "hours":
        return (
          <Reorder.Item
            key="hours"
            value="hours"
            id="hours"
            className={tileBaseClasses}
          >
            <div>
              <div className="flex items-center gap-1.5 mb-1 text-muted-2">
                <Clock size={14} />
                <span className="font-mono text-[9px] uppercase tracking-widest text-ink-2">
                  HOURS (WK)
                </span>
              </div>
              <div className="font-serif text-3xl text-ink leading-none mt-2">
                {hasAttempts ? <AnimatedCounter value={hoursStudied} /> : 0}{" "}
                <span className="font-sans text-xl text-muted font-normal lowercase tracking-normal">
                  hrs
                </span>
              </div>
            </div>
          </Reorder.Item>
        );
      default:
        return null;
    }
  };

  return (
    <div className="relative min-h-screen pb-20">
      <div className="absolute inset-0 blueprint pointer-events-none opacity-40 z-0" />
      <div className="absolute inset-0 paper-grain pointer-events-none opacity-100 z-1" />

      <div className="relative z-10 px-4 pt-16 pb-8 max-w-[820px] mx-auto">
        <div className="relative mb-8 overflow-hidden">
          {/* Mobile header bit */}
          <div className="flex md:hidden items-center gap-2 mb-4">
            <span className="w-1.5 h-1.5 rounded-sm bg-signal transform rotate-45" />
            <span className="font-mono text-[10px] uppercase tracking-widest text-muted-2">
              BRIEFING ·{" "}
              {new Date()
                .toLocaleDateString("en-US", {
                  weekday: "short",
                  day: "numeric",
                  month: "short",
                })
                .toUpperCase()}
            </span>
          </div>

          <Compass
            size={180}
            className="absolute -right-8 -top-8 text-rule opacity-20 pointer-events-none hidden md:block"
            strokeWidth={1}
          />
          <span className="font-mono text-[10px] tracking-[0.2em] uppercase text-signal hidden md:block mb-4">
            § 01 · BRIEFING · LIVE
          </span>
          <h1 className="text-[42px] leading-[1.05] md:h-display text-ink font-serif tracking-tight md:leading-tight mb-2">
            {isLate ? (
              <>
                Still flying,
                <br className="md:hidden" />{" "}
                <span className="md:hidden"> </span>
                <span className="italic text-navy">{displayName}?</span>
              </>
            ) : (
              <>
                {greeting},<br className="md:hidden" />{" "}
                <span className="md:hidden"> </span>
                <span className="italic text-navy">{displayName}.</span>
              </>
            )}
          </h1>
        </div>

        {/* Readiness Card */}
        <div className="bg-ink rounded-[20px] p-5 md:p-8 w-full mb-8 relative overflow-hidden text-bg shadow-lg">
          <div className="absolute -right-6 -bottom-6 opacity-10 pointer-events-none">
            <Compass size={160} strokeWidth={1} />
          </div>

          <div className="flex justify-between items-start mb-2 relative z-10 w-full">
            <span className="font-mono text-[10px] tracking-widest uppercase opacity-80 text-bg">
              READINESS · LIVE
            </span>
          </div>
          <div className="font-serif text-[72px] leading-none tracking-tight mb-2 flex items-baseline relative z-10">
            {hasAttempts ? avgScore : "--"}
            <span className="text-[32px] opacity-70 ml-1">%</span>
          </div>
          <div className="font-mono text-[11px] text-bg/60 uppercase tracking-widest mb-6 relative z-10">
            {hasAttempts
              ? `OVERALL READINESS · BASED ON ${logbook.length} SESSIONS`
              : "COMPLETE YOUR FIRST SESSION TO TRACK PROGRESS"}
          </div>
          <div className="flex items-center gap-3 mb-6 relative z-10">
            {daysDiff !== null && daysDiff >= 0 ? (
              <>
                {hasAttempts && (
                  <div className="bg-mint text-bg font-mono text-[9px] px-2 py-1 rounded-full font-bold shadow-sm">
                    ↑ 4 WK
                  </div>
                )}
                <span
                  className={`font-mono text-[10px] tracking-widest uppercase ${daysDiff < 7 ? "text-signal" : daysDiff <= 30 ? "text-amber" : "opacity-80 text-bg"}`}
                >
                  EXAM IN {daysDiff}D
                </span>
              </>
            ) : daysDiff === null ? (
              <button
                onClick={() =>
                  window.dispatchEvent(new CustomEvent("open-next-check-modal"))
                }
                className="font-mono text-[10px] tracking-widest uppercase opacity-80 text-bg hover:opacity-100 transition-opacity flex items-center gap-1"
              >
                SET EXAM →
              </button>
            ) : null}
          </div>

          <Link to="/modules" className="block w-full relative z-10">
            <Button
              variant="primary"
              className="w-full bg-bg text-ink hover:bg-paper h-[48px] rounded-[14px] flex items-center justify-center border-0 shadow-none font-medium text-base"
            >
              {hasAttempts ? "▶ Resume · 14/20" : "▶ Start First Module"}
            </Button>
          </Link>
        </div>

        {/* TILES */}
        <div className="mb-10 w-full relative">
          <div className="absolute -top-6 right-0 font-mono text-[9px] text-muted-2 uppercase tracking-widest hidden md:flex items-center gap-1.5 opacity-50">
            <span>DRAG TO REORDER</span>
          </div>
          <Reorder.Group
            axis="y"
            values={tileOrder}
            onReorder={handleReorder}
            className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 w-full list-none"
          >
            {tileOrder.map((tile) => renderTile(tile))}
          </Reorder.Group>
        </div>

        {/* WEATHER & MASTERY HEATMAP ROW */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4 mb-10 w-full">
          <WeatherWidget />

          <div className="bg-paper border border-rule rounded-2xl md:rounded-lg shadow-sm col-span-1 md:col-span-2 flex flex-col justify-between overflow-hidden relative min-h-[220px]">
            <div className="p-4 flex items-center justify-between border-b border-rule/50 z-10 bg-paper/80 backdrop-blur-md absolute top-0 left-0 right-0">
              <div className="font-mono text-[9px] text-muted-2 tracking-widest uppercase flex items-center gap-1.5">
                <TrendingUp size={14} className="text-ink" />
                <span>MASTERY HEATMAP (RADAR)</span>
              </div>
              <span className="font-mono text-[9px] text-mint uppercase tracking-widest bg-mint/10 border border-mint/20 px-2 py-0.5 rounded-full">
                Telemetry Active
              </span>
            </div>
            <div className="flex-1 w-full pt-[30px] md:pt-[50px] pb-4 px-2 md:px-4 bg-bg-2/30" role="img" aria-label="Radar chart showing aviation topic mastery percentage telemetry">
              <div style={{ width: "100%", minHeight: 320, height: "100%" }}>
                {logbook.length > 0 ? (
                  <ResponsiveContainer width="100%" height={320}>
                    <RadarChart
                      cx="50%"
                      cy="50%"
                      outerRadius={isMobile ? "55%" : "75%"}
                      data={masteries}
                    >
                      <PolarGrid stroke="#e5e5e5" />
                      <PolarAngleAxis
                        dataKey="subject"
                        tick={{
                          fill: "#737373",
                          fontSize: isMobile ? 8 : 10,
                          fontFamily: "JetBrains Mono",
                        }}
                      />
                      <PolarRadiusAxis
                        angle={30}
                        domain={[0, 100]}
                        tick={{ fill: "#a3a3a3", fontSize: 9 }}
                        tickCount={5}
                      />
                      <RechartsTooltip
                        content={<CustomTooltip />}
                        cursor={{ fill: "rgba(0,43,91,0.05)" }}
                      />
                      <Radar
                        name="Mastery %"
                        dataKey="score"
                        stroke="#002B5B"
                        fill="#002B5B"
                        fillOpacity={0.15}
                        activeDot={{ r: 4, fill: "#002B5B" }}
                      />
                    </RadarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full min-h-[320px] text-center p-6 border border-dashed border-rule rounded-xl bg-white/40">
                    <span className="font-mono text-[9px] text-muted-2 uppercase tracking-widest mb-1.5 font-bold"> telemetry outline </span>
                    <p className="font-serif text-lg text-ink">Complete your first session to see analytics</p>
                    <p className="font-sans text-[11px] text-muted-2 max-w-sm mt-1">Navigate to modules or exams to build radar coverage stats.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* STUDY PACING BLUEPRINT (RECHARTS) */}
        <div className="bg-paper border border-rule rounded-2xl p-6 shadow-sm mb-10 w-full relative overflow-hidden min-h-[300px]">
          <div className="p-4 flex flex-col md:flex-row md:items-center justify-between border-b border-rule/50 z-10 bg-paper/80 backdrop-blur-md absolute top-0 left-0 right-0">
            <div className="font-mono text-[9px] text-muted-2 tracking-widest uppercase flex items-center gap-1.5 mb-2 md:mb-0">
              <Clock size={14} className="text-navy" />
              <span>STUDY PACING BLUEPRINT · HOURS VS TARGET EXAM</span>
            </div>
            <div className="flex items-center gap-4">
              {savedDate ? (
                <span className="font-mono text-[9px] text-navy uppercase tracking-widest bg-navy/5 border border-navy/10 px-2.5 py-0.5 rounded-full">
                  Exam Clear: {new Date(savedDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                </span>
              ) : (
                <button
                  onClick={() => window.dispatchEvent(new CustomEvent("open-next-check-modal"))}
                  className="font-mono text-[9px] text-signal uppercase tracking-widest bg-signal-soft border border-signal-soft/30 px-2.5 py-0.5 rounded-full hover:opacity-80 transition"
                >
                  Configure Target Exam Date →
                </button>
              )}
            </div>
          </div>
          
          <div className="pt-16 pb-2">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8 px-2">
              <div className="border-r border-rule/50 pr-4">
                <div className="font-mono text-[9px] text-muted-2 uppercase tracking-wide">Actual Study Depth</div>
                <div className="font-serif text-2xl text-ink mt-1 flex items-baseline gap-1">
                  {hoursStudied} <span className="font-sans text-xs text-muted font-normal lowercase">hrs</span>
                </div>
              </div>
              <div className="border-r border-rule/50 pr-4">
                <div className="font-mono text-[9px] text-muted-2 uppercase tracking-wide">Target Pace Rate</div>
                <div className="font-serif text-2xl text-ink mt-1 flex items-baseline gap-1">
                  {pacingData[pacingData.length - 1]?.target || 50} <span className="font-sans text-xs text-muted font-normal lowercase">hrs</span>
                </div>
              </div>
              <div>
                <div className="font-mono text-[9px] text-muted-2 uppercase tracking-wide">Pacing Status</div>
                <div className="font-sans text-xs font-semibold mt-2.5 flex items-center gap-1.5 leading-none font-mono uppercase">
                  {hoursStudied >= (pacingData[pacingData.length - 2]?.target || 0) ? (
                    <span className="text-mint tracking-wider flex items-center gap-1">
                      <span className="w-1.5 h-1.5 bg-mint rounded-full inline-block animate-pulse" /> On Track / Optimal
                    </span>
                  ) : (
                    <span className="text-amber tracking-wider flex items-center gap-1">
                      <span className="w-1.5 h-1.5 bg-amber rounded-full inline-block" /> Increase Study Depth
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div style={{ width: "100%", height: 260 }} role="img" aria-label="Study pacing timeline chart comparing weekly logged hours against target exam pace">
              {logbook.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={pacingData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorActual" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#002B5B" stopOpacity={0.15}/>
                        <stop offset="95%" stopColor="#002B5B" stopOpacity={0.0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                    <XAxis 
                      dataKey="day" 
                      tick={{ fill: "#737373", fontSize: 9, fontFamily: "JetBrains Mono" }}
                      axisLine={{ stroke: "#e5e5e5" }}
                    />
                    <YAxis 
                      tick={{ fill: "#a3a3a3", fontSize: 9, fontFamily: "JetBrains Mono" }}
                      axisLine={{ stroke: "#e5e5e5" }}
                    />
                    <RechartsTooltip 
                      contentStyle={{ 
                        backgroundColor: "#002b5b", 
                        borderRadius: "8px", 
                        color: "#fff", 
                        fontFamily: "Space Grotesk",
                        fontSize: "12px",
                        border: "none",
                        padding: "8px 12px"
                      }}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="actual" 
                      name="Logged Hours"
                      stroke="#002B5B" 
                      strokeWidth={2}
                      fillOpacity={1} 
                      fill="url(#colorActual)" 
                    />
                    <Line 
                      type="monotone" 
                      dataKey="target" 
                      name="Target Pace"
                      stroke="#ff4d4d" 
                      strokeWidth={2}
                      strokeDasharray="5 5"
                      dot={false}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex flex-col items-center justify-center h-full min-h-[220px] text-center p-6 rounded-xl border border-dashed border-rule bg-white/40">
                  <span className="font-mono text-[9px] text-muted-2 uppercase tracking-widest mb-1.5 font-bold"> timeline blank </span>
                  <p className="font-serif text-base text-ink">Complete your first session to see analytics</p>
                  <p className="font-sans text-[11px] text-muted-2 max-w-sm mt-1">A target timeline against actual study hours will populate here.</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* TODAY'S STOPS */}
        <div className="font-mono text-[10px] text-muted-2 tracking-widest uppercase mb-4 mt-8">
          TODAY · 5 STOPS
        </div>
        <div className="border-t border-rule" />

        <Link
          to="/quiz/mock-exam"
          className="group block border-b border-rule py-4 transition-colors hover:bg-bg-2 active:bg-rule -mx-4 px-4 md:mx-0 md:px-2 rounded-md"
        >
          <div className="flex items-center gap-4">
            <span className="font-mono text-[9px] font-bold tracking-widest uppercase px-2.5 py-1 rounded-full text-signal border border-signal/30 bg-signal/10">
              MOCK
            </span>
            <span className="font-serif text-lg text-ink font-medium">
              EASA Paper VI
            </span>
            <span className="ml-auto font-mono text-[10px] text-muted-2 uppercase">
              90m
            </span>
            <ArrowUpRight
              size={16}
              className="text-muted ml-2 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
            />
          </div>
        </Link>
        <Link
          to="/quiz/drill"
          className="group block border-b border-rule py-4 transition-colors hover:bg-bg-2 active:bg-rule -mx-4 px-4 md:mx-0 md:px-2 rounded-md"
        >
          <div className="flex items-center gap-4">
            <span className="font-mono text-[9px] font-bold tracking-widest uppercase px-2.5 py-1 rounded-full text-amber border border-amber/30 bg-amber/10">
              DRILL
            </span>
            <span className="font-serif text-lg text-ink font-medium">
              Met · Icing & TS
            </span>
            <span className="ml-auto font-mono text-[10px] text-muted-2 uppercase">
              22m
            </span>
            <ArrowUpRight
              size={16}
              className="text-muted ml-2 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
            />
          </div>
        </Link>
        <Link
          to="/topic/a320-systems"
          className="group block border-b border-rule py-4 transition-colors hover:bg-bg-2 active:bg-rule -mx-4 px-4 md:mx-0 md:px-2 rounded-md"
        >
          <div className="flex items-center gap-4">
            <span className="font-mono text-[9px] font-bold tracking-widest uppercase px-2.5 py-1 rounded-full text-navy border border-navy/30 bg-navy/5">
              ATA
            </span>
            <span className="font-serif text-lg text-ink font-medium">
              A320 · 36 Pneu
            </span>
            <span className="ml-auto font-mono text-[10px] text-muted-2 uppercase">
              18m
            </span>
            <ArrowUpRight
              size={16}
              className="text-muted ml-2 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
            />
          </div>
        </Link>
        <Link
          to="/quiz/viva"
          className="group block border-b border-rule py-4 transition-colors hover:bg-bg-2 active:bg-rule -mx-4 px-4 md:mx-0 md:px-2 rounded-md"
        >
          <div className="flex items-center gap-4">
            <span className="font-mono text-[9px] font-bold tracking-widest uppercase px-2.5 py-1 rounded-full text-mint border border-mint/30 bg-mint/10">
              VIVA
            </span>
            <span className="font-serif text-lg text-ink font-medium">
              Type · Evac
            </span>
            <span className="ml-auto font-mono text-[10px] text-muted-2 uppercase">
              12m
            </span>
            <ArrowUpRight
              size={16}
              className="text-muted ml-2 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
            />
          </div>
        </Link>
      </div>
    </div>
  );
}
