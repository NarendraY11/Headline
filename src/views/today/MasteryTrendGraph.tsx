// M8E: Mastery Trend Graph — weekly accuracy for top 3 weakest subjects
// Uses recharts (already in vendor bundle). Lazy-loaded from TodayView.
// Shows 8-week rolling window; up to 3 subjects from CRITICAL/WEAK tier.

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { MasteryHistoryPoint } from "../../hooks/useMasteryHistory";
import type { MasterySnapshot } from "../../lib/masterySnapshot";

interface Props {
  weeks: MasteryHistoryPoint[];
  snapshots: MasterySnapshot[];
  subjectTitles: Record<string, string>;
  loading?: boolean;
}

// Tailwind design-token colours expressed as hex for recharts
const LINE_COLORS = ["#e33a2e", "#e5a93c", "#3b82f6"];

export default function MasteryTrendGraph({ weeks, snapshots, subjectTitles, loading }: Props) {
  // Pick top 3 weakest subjects (CRITICAL → WEAK → rest by ascending mastery)
  const focus = [...snapshots]
    .sort((a, b) => a.mastery - b.mastery)
    .slice(0, 3);

  const title = (id: string) =>
    (subjectTitles[id] ?? id.replace(/-/g, " "))
      .split(" ")
      .slice(0, 3)
      .join(" ");

  if (loading) {
    return (
      <div className="bg-paper border border-rule rounded-2xl p-5">
        <span className="font-mono text-[9px] uppercase tracking-widest text-muted-2 block mb-4">§ MASTERY TREND</span>
        <div className="h-[200px] animate-pulse bg-bg-2 rounded-xl" />
      </div>
    );
  }

  if (focus.length === 0 || weeks.length === 0) {
    return (
      <div className="bg-paper border border-rule rounded-2xl p-5">
        <span className="font-mono text-[9px] uppercase tracking-widest text-muted-2 block mb-3">§ MASTERY TREND</span>
        <p className="font-sans text-sm text-muted-2 text-center py-4">
          Complete quizzes to see trends.
        </p>
      </div>
    );
  }

  // Build chart data — only include weeks where at least one focus subject has data
  const chartData = weeks.map((w) => {
    const point: Record<string, string | number> = { week: w.weekLabel };
    for (const s of focus) {
      const val = w[s.subject_id];
      if (val !== undefined) point[s.subject_id] = Number(val);
    }
    return point;
  }).filter((p) => focus.some((s) => p[s.subject_id] !== undefined));

  return (
    <div className="bg-paper border border-rule rounded-2xl p-5">
      <span className="font-mono text-[9px] uppercase tracking-widest text-muted-2 block mb-4">
        § MASTERY TREND
      </span>

      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={chartData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-rule, #e5e7eb)" />
          <XAxis
            dataKey="week"
            tick={{ fontSize: 9, fontFamily: "var(--font-mono, monospace)", fill: "var(--color-muted-2, #9ca3af)" }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            domain={[0, 100]}
            tickFormatter={(v) => `${v}%`}
            tick={{ fontSize: 9, fontFamily: "var(--font-mono, monospace)", fill: "var(--color-muted-2, #9ca3af)" }}
            tickLine={false}
            axisLine={false}
            width={36}
          />
          <Tooltip
            formatter={(value, name) => [`${value ?? ""}%`, title(String(name ?? ""))]}
            contentStyle={{
              fontSize: 11,
              fontFamily: "var(--font-sans, system-ui)",
              border: "1px solid var(--color-rule, #e5e7eb)",
              borderRadius: 8,
              background: "var(--color-paper, #fff)",
            }}
          />
          <Legend
            formatter={(value) => (
              <span style={{ fontSize: 9, fontFamily: "var(--font-sans, system-ui)" }}>
                {title(value)}
              </span>
            )}
          />
          {focus.map((s, i) => (
            <Line
              key={s.subject_id}
              type="monotone"
              dataKey={s.subject_id}
              stroke={LINE_COLORS[i]}
              strokeWidth={2}
              dot={{ r: 3, strokeWidth: 0, fill: LINE_COLORS[i] }}
              activeDot={{ r: 5 }}
              connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
