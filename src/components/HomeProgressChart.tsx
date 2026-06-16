import { Bar, BarChart, Cell, ResponsiveContainer, XAxis, YAxis } from "recharts";
import { ChartContainer } from "./ChartContainer";

export default function HomeProgressChart() {
  return (
    <ChartContainer className="w-full h-[200px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={[
          { name: 'S1', score: 62 },
          { name: 'S2', score: 71 },
          { name: 'S3', score: 68 },
          { name: 'S4', score: 79 },
          { name: 'S5', score: 74 },
          { name: 'S6', score: 83 },
          { name: 'S7', score: 88 }
        ]} margin={{ top: 10, right: 0, left: -25, bottom: 0 }}>
          <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'var(--muted-2)', fontFamily: 'var(--font-mono)' }} dy={10} />
          <YAxis axisLine={false} tickLine={false} ticks={[0, 50, 100]} tick={{ fontSize: 10, fill: 'var(--muted-2)', fontFamily: 'var(--font-mono)' }} />
          <Bar dataKey="score" radius={[4, 4, 4, 4]} barSize={24}>
            {
              [62, 71, 68, 79, 74, 83, 88].map((score, index) => (
                <Cell key={`cell-${index}`} fill={score >= 70 ? '#2E7D52' : '#C0392B'} />
              ))
            }
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartContainer>
  );
}
