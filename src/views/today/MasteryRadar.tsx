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

interface MasteryRadarProps {
    data: any[];
    isMobile: boolean;
}

// Lazy-loaded so the heavy recharts bundle is only fetched when the
// mastery radar actually renders (logbook has data).
export default function MasteryRadar({ data, isMobile }: MasteryRadarProps) {
    return (
        <ResponsiveContainer width="100%" height={320}>
            <RadarChart cx="50%" cy="50%" outerRadius={isMobile ? "55%" : "75%"} data={data}>
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
                <RechartsTooltip content={<CustomTooltip />} cursor={{ fill: "rgba(0,43,91,0.05)" }} />
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
    );
}
