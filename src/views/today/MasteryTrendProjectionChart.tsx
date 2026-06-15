// M11B: Mastery Trend Projection — Recharts LineChart with history + projection

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";
import type { MasteryTrendProjectionPoint } from "../../lib/forecastEngine";

interface Props {
  projection: MasteryTrendProjectionPoint[];
  loading?: boolean;
}

function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload as MasteryTrendProjectionPoint;
  return (
    <div className="bg-paper border border-rule rounded-lg px-3 py-2 shadow-md">
      <p className="font-mono text-[9px] uppercase tracking-wide text-muted-2 mb-1">{d.weekLabel}</p>
      <p className="font-serif text-lg text-ink">{d.avgAccuracy}%</p>
      <p className="font-mono text-[8px] text-muted-2">{d.isProjection ? "Projected" : "Recorded"}</p>
    </div>
  );
}

export function MasteryTrendProjectionChart({ projection, loading }: Props) {
  if (loading) {
    return <div className="h-[200px] bg-bg-2 rounded-xl animate-pulse" />;
  }
  if (projection.length === 0) {
    return (
      <div className="bg-paper border border-rule rounded-2xl p-5">
        <p className="font-mono text-[9px] uppercase tracking-widest text-muted-2 mb-2">§ MASTERY TREND</p>
        <p className="font-mono text-[9px] text-muted-2">Enable masteryAnalytics flag to see trend data.</p>
      </div>
    );
  }

  return (
    <div className="bg-paper border border-rule rounded-2xl p-5">
      <div className="flex items-center gap-2 mb-1">
        <span className="font-mono text-[9px] uppercase tracking-widest text-muted-2">
          § MASTERY TREND PROJECTION
        </span>
      </div>
      <p className="font-mono text-[8px] text-muted-2 mb-4">Average accuracy — historical + linear extrapolation</p>

      <div style={{ width: "100%", height: 190 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={projection} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-rule, #e5e7eb)" strokeOpacity={0.5} />
            <XAxis dataKey="weekLabel" tick={{ fontFamily: "monospace", fontSize: 9, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
            <YAxis domain={[0, 100]} tick={{ fontFamily: "monospace", fontSize: 9, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
            <Tooltip content={<CustomTooltip />} />
            <ReferenceLine y={65} stroke="#e5a93c" strokeDasharray="3 3" strokeOpacity={0.6}
              label={{ value: "Passing", fill: "#e5a93c", fontFamily: "monospace", fontSize: 8, position: "insideTopRight" }} />
            <ReferenceLine y={80} stroke="#16a34a" strokeDasharray="4 4" strokeOpacity={0.6}
              label={{ value: "Strong", fill: "#16a34a", fontFamily: "monospace", fontSize: 8, position: "insideTopRight" }} />
            <Line
              type="monotone"
              dataKey="avgAccuracy"
              stroke="#0F1E3C"
              strokeWidth={2}
dot={(props: any) => {
                const { cx, cy, payload } = props;
                return (
                  <circle
                    key={`mtp-dot-${cx}`}
                    cx={cx} cy={cy} r={payload.isProjection ? 3 : 4}
                    fill={payload.isProjection ? "#557B96" : "#0F1E3C"}
                    stroke="#ffffff"
                    strokeWidth={1.5}
                    opacity={payload.isProjection ? 0.8 : 1}
                  />
                );
              }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="flex items-center gap-4 mt-2">
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-0.5 bg-ink rounded" />
          <span className="font-mono text-[8px] text-muted-2">Recorded</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-0.5 border-t border-dashed border-navy rounded" />
          <span className="font-mono text-[8px] text-muted-2">Projected (linear)</span>
        </div>
      </div>
    </div>
  );
}
