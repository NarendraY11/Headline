// M11B: Success Probability Timeline — Recharts LineChart

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
import type { SuccessProbabilityPoint } from "../../lib/forecastEngine";

interface Props {
  timeline: SuccessProbabilityPoint[];
  loading?: boolean;
}

const BAND_COLOR = {
  strong:   "#16a34a",
  moderate: "#e5a93c",
  marginal: "#f97316",
  at_risk:  "#e33a2e",
};

function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload as SuccessProbabilityPoint;
  const color = BAND_COLOR[d.band];
  return (
    <div className="bg-paper border border-rule rounded-lg px-3 py-2 shadow-md">
      <p className="font-mono text-[9px] uppercase tracking-wide text-muted-2 mb-1">{d.weekLabel}</p>
      <p className="font-serif text-lg" style={{ color }}>{d.probability}%</p>
      <p className="font-mono text-[8px] text-muted-2 capitalize">{d.band.replace("_", " ")}</p>
    </div>
  );
}

export function SuccessProbabilityTimeline({ timeline, loading }: Props) {
  if (loading) {
    return <div className="h-[220px] bg-bg-2 rounded-xl animate-pulse" />;
  }

  // Determine stroke color per segment based on final band
  const finalBand = timeline[timeline.length - 1]?.band ?? "at_risk";
  const strokeColor = BAND_COLOR[finalBand];

  const chartData = timeline.map(p => ({ ...p, fill: BAND_COLOR[p.band] }));

  return (
    <div className="bg-paper border border-rule rounded-2xl p-5">
      <div className="flex items-center gap-2 mb-1">
        <span className="font-mono text-[9px] uppercase tracking-widest text-muted-2">
          § SUCCESS PROBABILITY TIMELINE
        </span>
      </div>
      <p className="font-mono text-[8px] text-muted-2 mb-4">Pass probability projection over 8 weeks</p>

      <div style={{ width: "100%", height: 200 }}>
        <ResponsiveContainer>
          <LineChart data={chartData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-rule, #e5e7eb)" strokeOpacity={0.5} />
            <XAxis dataKey="weekLabel" tick={{ fontFamily: "monospace", fontSize: 9, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
            <YAxis domain={[0, 100]} tick={{ fontFamily: "monospace", fontSize: 9, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
            <Tooltip content={<CustomTooltip />} />
            <ReferenceLine y={75} stroke="#16a34a" strokeDasharray="4 4" strokeOpacity={0.6}
              label={{ value: "Pass zone", fill: "#16a34a", fontFamily: "monospace", fontSize: 8, position: "insideTopRight" }} />
            <Line
              type="monotone"
              dataKey="probability"
              stroke={strokeColor}
              strokeWidth={2.5}
              dot={(props: any) => {
                const { cx, cy, payload } = props;
                return (
                  <circle
                    key={`spt-dot-${cx}`}
                    cx={cx} cy={cy} r={4}
                    fill={BAND_COLOR[payload.band as SuccessProbabilityPoint["band"]] ?? "#9ca3af"}
                    stroke="#ffffff"
                    strokeWidth={1.5}
                  />
                );
              }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="flex items-center gap-3 mt-2 flex-wrap">
        {(Object.entries(BAND_COLOR) as [SuccessProbabilityPoint["band"], string][]).map(([band, color]) => (
          <div key={band} className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
            <span className="font-mono text-[8px] text-muted-2 capitalize">{band.replace("_", " ")}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
