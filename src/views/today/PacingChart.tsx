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

interface PacingChartProps {
    data: any[];
}

// Lazy-loaded so the heavy recharts bundle is only fetched when the
// study pacing chart actually renders (logbook has data).
export default function PacingChart({ data }: PacingChartProps) {
    return (
        <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                    <linearGradient id="colorActual" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#002B5B" stopOpacity={0.15} />
                        <stop offset="95%" stopColor="#002B5B" stopOpacity={0.0} />
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
                        padding: "8px 12px",
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
    );
}
