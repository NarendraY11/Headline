import {
    PolarAngleAxis,
    PolarGrid,
    PolarRadiusAxis,
    Radar,
    RadarChart,
    ResponsiveContainer,
    Tooltip as RechartsTooltip,
} from "recharts";
import { CustomTooltip } from "./CustomTooltip";
import { useChartTokens } from "./useChartTokens";

interface MasteryRadarProps {
    data: any[];
    isMobile: boolean;
}

// Lazy-loaded so the heavy recharts bundle is only fetched when the
// mastery radar actually renders (logbook has data).
export default function MasteryRadar({ data, isMobile }: MasteryRadarProps) {
    const t = useChartTokens();
    return (
        <ResponsiveContainer width="100%" height={320}>
            <RadarChart cx="50%" cy="50%" outerRadius={isMobile ? "55%" : "75%"} data={data}>
                <PolarGrid stroke={t.rule} />
                <PolarAngleAxis
                    dataKey="subject"
                    tick={{
                        fill: t.muted,
                        fontSize: isMobile ? 8 : 10,
                        fontFamily: "JetBrains Mono",
                    }}
                />
                <PolarRadiusAxis
                    angle={30}
                    domain={[0, 100]}
                    tick={{ fill: t.muted2, fontSize: 9 }}
                    tickCount={5}
                />
                <RechartsTooltip content={<CustomTooltip />} cursor={{ fill: t.rule }} />
                <Radar
                    name="Mastery %"
                    dataKey="score"
                    stroke={t.navy}
                    fill={t.navy}
                    fillOpacity={0.15}
                    activeDot={{ r: 4, fill: t.navy }}
                />
            </RadarChart>
        </ResponsiveContainer>
    );
}
