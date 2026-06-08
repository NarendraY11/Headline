import {
    Area,
    CartesianGrid,
    ComposedChart,
    Line,
    ResponsiveContainer,
    Tooltip as RechartsTooltip,
    XAxis,
    YAxis,
} from "recharts";
import { useChartTokens } from "./useChartTokens";

interface PacingChartProps {
    data: any[];
}

// Lazy-loaded so the heavy recharts bundle is only fetched when the
// study pacing chart actually renders (logbook has data).
export default function PacingChart({ data }: PacingChartProps) {
    const t = useChartTokens();
    return (
        <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                    <linearGradient id="colorActual" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={t.navy} stopOpacity={0.15} />
                        <stop offset="95%" stopColor={t.navy} stopOpacity={0.0} />
                    </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={t.rule} vertical={false} />
                <XAxis
                    dataKey="day"
                    tick={{ fill: t.muted, fontSize: 9, fontFamily: "JetBrains Mono" }}
                    axisLine={{ stroke: t.rule }}
                />
                <YAxis
                    tick={{ fill: t.muted2, fontSize: 9, fontFamily: "JetBrains Mono" }}
                    axisLine={{ stroke: t.rule }}
                />
                <RechartsTooltip
                    contentStyle={{
                        backgroundColor: t.ink,
                        borderRadius: "8px",
                        color: t.paper,
                        fontFamily: "Space Grotesk",
                        fontSize: "12px",
                        border: "none",
                        padding: "8px 12px",
                    }}
                />
                <Area
                    type="monotone"
                    dataKey="actual"
                    name="Logged Hours"
                    stroke={t.navy}
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorActual)"
                />
                <Line
                    type="monotone"
                    dataKey="target"
                    name="Target Pace"
                    stroke={t.signal}
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    dot={false}
                />
            </ComposedChart>
        </ResponsiveContainer>
    );
}
