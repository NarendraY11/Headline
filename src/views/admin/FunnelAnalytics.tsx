import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AlertCircle, RefreshCw, TrendingDown, TrendingUp, Users, Zap } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

// ── Types ─────────────────────────────────────────────────────────────────────

interface FunnelStep {
  label: string;
  description: string;
  count: number;
  convFromPrev: number | null; // % of previous step that reached this step
  dropOff: number | null;      // % lost from previous step
}

interface TrendPoint {
  day: string;
  Signups: number;
  Quizzes: number;
  Subscriptions: number;
}

interface FunnelData {
  steps: FunnelStep[];
  trend: TrendPoint[];
  totalActive: number;
  totalConversions: number;
  topDropOffIndex: number | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function shortDate(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function periodStart(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function distinctUsers(rows: { user_id: string | null }[]): number {
  const s = new Set(rows.map((r) => r.user_id).filter(Boolean));
  return s.size;
}

// ── Data fetcher ──────────────────────────────────────────────────────────────

async function fetchFunnelData(days: number): Promise<FunnelData> {
  const start = periodStart(days);
  const start30 = periodStart(30); // 7-day active always uses 30d window

  const [
    { data: pageViews },
    { data: newProfiles },
    { data: quizStarts },
    { data: quizCompletes },
    { data: plansRows },
    { data: missionsRows },
    { data: events30d },
    { data: subsRows },
  ] = await Promise.all([
    supabase.from("events").select("user_id").eq("event_type", "page_view").gte("created_at", start).limit(10000),
    supabase.from("profiles").select("id,created_at").gte("created_at", start).limit(10000),
    supabase.from("events").select("user_id").eq("event_type", "quiz_start").gte("created_at", start).limit(10000),
    supabase.from("events").select("user_id,created_at").eq("event_type", "quiz_complete").gte("created_at", start).limit(10000),
    supabase.from("study_plans").select("user_id").gte("created_at", start).limit(10000),
    supabase.from("study_missions").select("user_id").eq("status", "completed").gte("completed_at", start).limit(10000),
    supabase.from("events").select("user_id,created_at").gte("created_at", start30).limit(50000),
    supabase.from("events").select("user_id").eq("event_type", "upgrade_pro_success").gte("created_at", start).limit(10000),
  ]);

  // Step counts
  const visitorCount     = distinctUsers(pageViews ?? []);
  const signupCount      = (newProfiles ?? []).length;
  const quizStartCount   = distinctUsers(quizStarts ?? []);
  const quizCompleteCount = distinctUsers(quizCompletes ?? []);
  const planCount        = distinctUsers(plansRows ?? []);
  const missionCount     = distinctUsers(missionsRows ?? []);
  const subCount         = distinctUsers(subsRows ?? []);

  // 7-day active: users with events on 7+ distinct days within 30d window
  const userDays: Record<string, Set<string>> = {};
  for (const e of events30d ?? []) {
    if (!e.user_id) continue;
    const day = (e.created_at as string).slice(0, 10);
    if (!userDays[e.user_id]) userDays[e.user_id] = new Set();
    userDays[e.user_id].add(day);
  }
  const sevenDayActive = Object.values(userDays).filter((s) => s.size >= 7).length;

  // Total active = distinct users with any event in period
  const allEventRows = [...(pageViews ?? []), ...(quizStarts ?? []), ...(quizCompletes ?? []), ...(subsRows ?? [])];
  const totalActive = distinctUsers(allEventRows);

  // Build steps array
  const rawCounts = [
    { label: "Visitor",                description: "Authenticated users who loaded a page",    count: visitorCount },
    { label: "Signup",                 description: `New accounts created in last ${days} days`, count: signupCount },
    { label: "Quiz Started",           description: "Users who began at least one quiz",         count: quizStartCount },
    { label: "Quiz Completed",         description: "Users who finished at least one quiz",      count: quizCompleteCount },
    { label: "Study Plan Generated",   description: "Users with an AI-generated study plan",     count: planCount },
    { label: "Mission Completed",      description: "Users who completed a study mission",       count: missionCount },
    { label: "7-Day Active",           description: "Users active on 7+ days in last 30 days",  count: sevenDayActive },
    { label: "Subscription Started",   description: "Users who purchased a Pro or Lifetime plan",count: subCount },
  ];

  // Compute conversion rates (relative to previous step)
  const steps: FunnelStep[] = rawCounts.map((s, i) => {
    if (i === 0) return { ...s, convFromPrev: null, dropOff: null };
    const prev = rawCounts[i - 1].count;
    const convFromPrev = prev > 0 ? Math.round((s.count / prev) * 100) : 0;
    const dropOff = prev > 0 ? Math.round(((prev - s.count) / prev) * 100) : 0;
    return { ...s, convFromPrev, dropOff };
  });

  // Top drop-off = step with largest dropOff %
  let topDropOffIndex: number | null = null;
  let maxDrop = 0;
  steps.forEach((s, i) => {
    if (s.dropOff !== null && s.dropOff > maxDrop) { maxDrop = s.dropOff; topDropOffIndex = i; }
  });

  // Daily trend: signups + quiz completions + subscriptions grouped by day
  const daySlots: string[] = [];
  const start7or30 = new Date(start);
  const end = new Date();
  const cur = new Date(start7or30);
  while (isoDate(cur) <= isoDate(end)) {
    daySlots.push(isoDate(cur));
    cur.setDate(cur.getDate() + 1);
  }

  const signupByDay: Record<string, number> = {};
  for (const p of newProfiles ?? []) {
    const d = (p.created_at as string).slice(0, 10);
    signupByDay[d] = (signupByDay[d] ?? 0) + 1;
  }

  const quizByDay: Record<string, number> = {};
  // Use quizCompletes for "quiz completed per day" — deduplicate by (user, day)
  const quizCompleteUserDay = new Set<string>();
  for (const e of quizCompletes ?? []) {
    if (!e.user_id) continue;
    const d = (e as any).created_at?.slice(0, 10);
    if (d) {
      const k = `${e.user_id}:${d}`;
      if (!quizCompleteUserDay.has(k)) {
        quizCompleteUserDay.add(k);
        quizByDay[d] = (quizByDay[d] ?? 0) + 1;
      }
    }
  }

  const subByDay: Record<string, number> = {};
  for (const e of subsRows ?? []) {
    const d = (e as any).created_at?.slice(0, 10);
    if (d) subByDay[d] = (subByDay[d] ?? 0) + 1;
  }

  const trend: TrendPoint[] = daySlots.map((d) => ({
    day: shortDate(d),
    Signups: signupByDay[d] ?? 0,
    Quizzes: quizByDay[d] ?? 0,
    Subscriptions: subByDay[d] ?? 0,
  }));

  return {
    steps,
    trend,
    totalActive,
    totalConversions: subCount,
    topDropOffIndex,
  };
}

// ── FunnelBar component ────────────────────────────────────────────────────────

function FunnelBar({
  step,
  maxCount,
  isTopDropOff,
  index,
}: {
  step: FunnelStep;
  maxCount: number;
  isTopDropOff: boolean;
  index: number;
}) {
  const widthPct = maxCount > 0 ? Math.max(4, Math.round((step.count / maxCount) * 100)) : 4;

  const barColor =
    isTopDropOff                              ? "bg-signal/80" :
    step.convFromPrev === null                ? "bg-navy" :
    (step.convFromPrev ?? 100) >= 60          ? "bg-emerald-500" :
    (step.convFromPrev ?? 100) >= 30          ? "bg-amber-500" :
                                                "bg-rose-400";

  return (
    <div className="group relative">
      <div className="flex items-center gap-3 mb-1">
        <span className="font-mono text-[9px] text-muted-2 w-4 text-right shrink-0">{index + 1}</span>
        <span className="font-sans text-xs font-semibold text-ink w-44 shrink-0 truncate">{step.label}</span>
        <span className="font-mono text-[10px] text-ink font-bold w-14 text-right shrink-0">
          {step.count.toLocaleString()}
        </span>
        {step.convFromPrev !== null ? (
          <span className={`font-mono text-[9px] font-bold w-16 shrink-0 ${
            step.convFromPrev >= 60 ? "text-emerald-600" :
            step.convFromPrev >= 30 ? "text-amber-600" : "text-rose-600"
          }`}>
            {step.convFromPrev}% conv
          </span>
        ) : (
          <span className="w-16 shrink-0" />
        )}
        {isTopDropOff && (
          <span className="font-mono text-[8px] px-1.5 py-0.5 bg-rose-50 text-rose-700 border border-rose-200 rounded font-bold uppercase">
            Top drop-off
          </span>
        )}
      </div>
      <div className="ml-7 h-7 bg-bg-2 rounded-lg overflow-hidden relative">
        <div
          className={`h-full rounded-lg transition-all duration-700 ${barColor}`}
          style={{ width: `${widthPct}%` }}
        />
        {step.dropOff !== null && step.dropOff > 0 && (
          <div className="absolute right-2 top-1/2 -translate-y-1/2 font-mono text-[8px] text-muted-2 opacity-0 group-hover:opacity-100 transition-opacity">
            −{step.dropOff}% drop
          </div>
        )}
      </div>
      {step.description && (
        <p className="ml-7 font-mono text-[8px] text-muted-2 mt-0.5">{step.description}</p>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function FunnelAnalytics() {
  const [days, setDays] = useState<7 | 30>(30);
  const [data, setData] = useState<FunnelData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async (d: 7 | 30) => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchFunnelData(d);
      setData(result);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load funnel data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(days); }, [days]); // eslint-disable-line react-hooks/exhaustive-deps

  const maxCount = data ? Math.max(...data.steps.map((s) => s.count), 1) : 1;

  const convRate =
    data && data.totalConversions > 0 && data.steps[1]?.count > 0
      ? Math.round((data.totalConversions / data.steps[1].count) * 100)
      : 0;

  const topDropOffStep = data && data.topDropOffIndex !== null
    ? data.steps[data.topDropOffIndex]
    : null;

  return (
    <div className="space-y-6 max-w-7xl mx-auto py-2">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-rule pb-6">
        <div>
          <div className="font-mono text-[9px] tracking-widest text-muted uppercase mb-1">Administrative deck</div>
          <h1 className="font-serif text-3xl font-medium tracking-tight text-ink leading-none">Funnel Analytics</h1>
          <p className="text-sm text-muted font-sans mt-1">Conversion from visitor to subscriber.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center bg-bg-2 border border-rule rounded-lg overflow-hidden text-xs font-mono">
            {([7, 30] as const).map((d) => (
              <button
                key={d}
                onClick={() => setDays(d)}
                className={`px-4 py-2 transition-colors cursor-pointer ${days === d ? "bg-ink text-paper font-bold" : "text-muted hover:bg-bg-2"}`}
              >
                {d}d
              </button>
            ))}
          </div>
          <button
            onClick={() => load(days)}
            disabled={loading}
            className="flex items-center gap-1.5 px-4 py-2 border border-rule hover:bg-bg-2 rounded-full font-sans text-xs text-ink transition-colors disabled:opacity-50 cursor-pointer h-9 shrink-0"
          >
            <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/30 text-rose-800 rounded-lg text-xs flex items-center gap-3">
          <AlertCircle size={16} className="shrink-0" /> {error}
        </div>
      )}

      {/* KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          {
            label: "Total Active",
            value: loading ? "—" : (data?.totalActive ?? 0).toLocaleString(),
            icon: <Users size={18} />,
            iconBg: "bg-ink/5 text-ink",
          },
          {
            label: "Subscriptions",
            value: loading ? "—" : (data?.totalConversions ?? 0).toLocaleString(),
            icon: <Zap size={18} />,
            iconBg: "bg-teal-50 text-teal-800",
          },
          {
            label: "Signup → Sub",
            value: loading ? "—" : `${convRate}%`,
            icon: <TrendingUp size={18} />,
            iconBg: "bg-emerald-50 text-emerald-800",
          },
          {
            label: "Top Drop-off",
            value: loading ? "—" : (topDropOffStep ? topDropOffStep.label : "—"),
            sub: topDropOffStep?.dropOff != null ? `−${topDropOffStep.dropOff}%` : undefined,
            icon: <TrendingDown size={18} />,
            iconBg: "bg-rose-50 text-rose-800",
          },
        ].map(({ label, value, sub, icon, iconBg }) => (
          <div key={label} className="bg-paper border border-rule rounded-xl p-5 flex items-center gap-4 shadow-sm">
            <div className={`p-3 rounded-full shrink-0 ${iconBg}`}>{icon}</div>
            <div className="min-w-0">
              <div className="font-mono text-[9px] uppercase tracking-wider text-muted">{label}</div>
              <div className="font-serif text-xl font-bold text-ink truncate">{value}</div>
              {sub && <div className="font-mono text-[9px] text-rose-600 font-semibold">{sub}</div>}
            </div>
          </div>
        ))}
      </div>

      {/* Main panels */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Funnel bars — 2/3 width */}
        <div className="lg:col-span-2 bg-paper border border-rule rounded-xl p-6 shadow-sm">
          <div className="mb-5">
            <h2 className="font-serif text-lg font-medium text-ink">Conversion Funnel</h2>
            <p className="font-mono text-[9px] text-muted uppercase tracking-wider">Last {days} days · bar width = relative count</p>
          </div>

          {loading ? (
            <div className="flex flex-col gap-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="ml-7 h-7 bg-bg-2 rounded-lg animate-pulse" style={{ width: `${90 - i * 10}%` }} />
              ))}
            </div>
          ) : !data || data.steps.every((s) => s.count === 0) ? (
            <div className="text-center py-16 border border-dashed border-rule rounded-xl">
              <p className="font-mono text-[9px] uppercase text-muted">No events in this period.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {data.steps.map((step, i) => (
                <FunnelBar
                  key={step.label}
                  step={step}
                  maxCount={maxCount}
                  isTopDropOff={data.topDropOffIndex === i}
                  index={i}
                />
              ))}
            </div>
          )}
        </div>

        {/* Conversion table — 1/3 width */}
        <div className="bg-paper border border-rule rounded-xl p-6 shadow-sm">
          <div className="mb-4">
            <h2 className="font-serif text-lg font-medium text-ink">Step Detail</h2>
            <p className="font-mono text-[9px] text-muted uppercase tracking-wider">Count + % from prior step</p>
          </div>

          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="h-8 bg-bg-2 rounded animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="space-y-1">
              {(data?.steps ?? []).map((step, i) => (
                <div
                  key={step.label}
                  className={`flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg ${data?.topDropOffIndex === i ? "bg-rose-50 border border-rose-100" : "bg-bg-2/30 border border-rule/40"}`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-mono text-[8px] text-muted-2 w-3 shrink-0">{i + 1}</span>
                    <span className="font-sans text-[11px] font-medium text-ink truncate">{step.label}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="font-mono text-[10px] font-bold text-ink">{step.count.toLocaleString()}</span>
                    {step.convFromPrev !== null && (
                      <span className={`font-mono text-[9px] font-bold min-w-[36px] text-right ${
                        step.convFromPrev >= 60 ? "text-emerald-600" :
                        step.convFromPrev >= 30 ? "text-amber-600" : "text-rose-600"
                      }`}>
                        {step.convFromPrev}%
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Daily trend chart */}
      <div className="bg-paper border border-rule rounded-xl p-6 shadow-sm">
        <div className="mb-4">
          <h2 className="font-serif text-lg font-medium text-ink">Daily Trend</h2>
          <p className="font-mono text-[9px] text-muted uppercase tracking-wider">Signups · quiz completions · subscriptions · last {days} days</p>
        </div>

        {loading ? (
          <div className="h-[220px] bg-bg-2 animate-pulse rounded-lg" />
        ) : !data || data.trend.every((p) => p.Signups === 0 && p.Quizzes === 0 && p.Subscriptions === 0) ? (
          <div className="h-[220px] flex items-center justify-center border border-dashed border-rule rounded-xl">
            <p className="font-mono text-[9px] uppercase text-muted">No trend data for this period.</p>
          </div>
        ) : (
          <div className="h-[220px]" role="img" aria-label="Daily trend area chart">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.trend} margin={{ top: 5, right: 10, left: -25, bottom: 5 }}>
                <defs>
                  <linearGradient id="gradSignups" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0F1E3C" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#0F1E3C" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradQuizzes" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#E5A93C" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#E5A93C" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradSubs" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#16a34a" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#16a34a" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="day" stroke="var(--muted)" fontSize={9} strokeWidth={1} tickLine={false} interval="preserveStartEnd" />
                <YAxis stroke="var(--muted)" fontSize={9} strokeWidth={1} tickLine={false} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ background: "#222", border: "0", borderRadius: "8px", color: "#fbfaf6", fontFamily: "monospace", fontSize: "10px" }}
                />
                <Area type="monotone" dataKey="Signups"       stroke="#0F1E3C" strokeWidth={2} fill="url(#gradSignups)" dot={false} />
                <Area type="monotone" dataKey="Quizzes"       stroke="#E5A93C" strokeWidth={2} fill="url(#gradQuizzes)" dot={false} />
                <Area type="monotone" dataKey="Subscriptions" stroke="#16a34a" strokeWidth={2} fill="url(#gradSubs)"    dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Legend */}
        <div className="flex items-center gap-5 mt-3 justify-center">
          {[
            { color: "#0F1E3C", label: "Signups" },
            { color: "#E5A93C", label: "Quizzes" },
            { color: "#16a34a", label: "Subscriptions" },
          ].map(({ color, label }) => (
            <div key={label} className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: color }} />
              <span className="font-mono text-[9px] text-muted-2">{label}</span>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
