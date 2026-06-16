// M11B: Readiness Timeline Chart — Recharts AreaChart with confidence band

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";
import type { ReadinessTimelinePoint } from "../../lib/forecastEngine";
import { ChartContainer } from "../../components/ChartContainer";

interface Props {
  timeline: ReadinessTimelinePoint[];
  currentScore: number;
  loading?: boolean;
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload as ReadinessTimelinePoint;
  return (
    <div className="bg-paper border border-rule rounded-lg px-3 py-2 shadow-md">
      <p className="font-mono text-[9px] uppercase tracking-wide text-muted-2 mb-1">{label}</p>
      <p className="font-serif text-lg text-ink">{d.projected}<span className="font-mono text-xs text-muted-2">/100</span></p>
      {!d.isHistory && (
        <p className="font-mono text-[8px] text-muted-2">
          {d.pessimistic}–{d.optimistic} range
        </p>
      )}
    </div>
  );
}

export function ReadinessTimelineChart({ timeline, currentScore, loading }: Props) {
  if (loading) {
    return <div className="h-[220px] bg-bg-2 rounded-xl animate-pulse" />;
  }

  return (
    <div className="bg-paper border border-rule rounded-2xl p-5">
      <div className="flex items-center gap-2 mb-1">
        <span className="font-mono text-[9px] uppercase tracking-widest text-muted-2">
          § READINESS FORECAST
        </span>
        <span className="ml-auto font-mono text-[9px] text-ink">Now: {currentScore}/100</span>
      </div>
      <p className="font-mono text-[8px] text-muted-2 mb-4">Projected 8-week readiness trajectory</p>

      <ChartContainer className="w-full h-[200px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={timeline} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="readinessGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#557B96" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#557B96" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="bandGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#557B96" stopOpacity={0.08} />
                <stop offset="95%" stopColor="#557B96" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-rule, #e5e7eb)" strokeOpacity={0.5} />
            <XAxis dataKey="weekLabel" tick={{ fontFamily: "monospace", fontSize: 9, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
            <YAxis domain={[0, 100]} tick={{ fontFamily: "monospace", fontSize: 9, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
            <Tooltip content={<CustomTooltip />} />
            <ReferenceLine y={80} stroke="#16a34a" strokeDasharray="4 4" strokeOpacity={0.6}
              label={{ value: "Exam ready", fill: "#16a34a", fontFamily: "monospace", fontSize: 8, position: "insideTopRight" }} />
            {/* Confidence band */}
            <Area type="monotone" dataKey="optimistic" stroke="none" fill="url(#bandGrad)" stackId="band" />
            <Area type="monotone" dataKey="pessimistic" stroke="none" fill="#ffffff" fillOpacity={1} stackId="band" />
            {/* Projected line */}
            <Area
              type="monotone"
              dataKey="projected"
              stroke="#557B96"
              strokeWidth={2}
              fill="url(#readinessGrad)"
              dot={(props: any) => {
                const { cx, cy, payload } = props;
                if (payload.isHistory) return <circle key={`dot-${cx}`} cx={cx} cy={cy} r={3} fill="#557B96" />;
                return <circle key={`dot-${cx}`} cx={cx} cy={cy} r={3} fill="#557B96" stroke="#ffffff" strokeWidth={1.5} strokeDasharray="2 2" />;
              }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </ChartContainer>

      <div className="flex items-center gap-4 mt-2">
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-0.5 bg-navy rounded" />
          <span className="font-mono text-[8px] text-muted-2">History</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-0.5 border-t border-dashed border-navy rounded" />
          <span className="font-mono text-[8px] text-muted-2">Projection</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-navy/10" />
          <span className="font-mono text-[8px] text-muted-2">Confidence range</span>
        </div>
      </div>
    </div>
  );
}
