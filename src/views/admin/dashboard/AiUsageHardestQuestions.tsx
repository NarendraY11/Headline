import { Bot } from "lucide-react";
import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { ChartContainer } from "../../../components/ChartContainer.js";

interface Props {
  aiUsageData: any[];
  hardestQuestions: any[];
  COLORS: string[];
}

export function AiUsageHardestQuestions({ aiUsageData, hardestQuestions, COLORS }: Props) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

      {/* AI Feature Usage Donut */}
      <div className="bg-paper border border-rule rounded-xl p-6 flex flex-col h-[340px] shadow-sm lg:col-span-1 justify-between">
        <div>
          <h3 className="font-serif text-lg font-medium text-ink flex items-center gap-2">
            <Bot size={18} className="text-emerald-600" />
            <span>AI Copilot Diagnostics</span>
          </h3>
          <p className="font-mono text-[9px] text-muted uppercase tracking-wider">Metrics representing smart service execution rates</p>
        </div>
        <ChartContainer className="flex-1 w-full min-h-0 py-2" role="img" aria-label="Donut pie chart showing AI Copilot diagnostics usage rates">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={aiUsageData}
                cx="50%"
                cy="48%"
                innerRadius={55}
                outerRadius={75}
                paddingAngle={4}
                dataKey="value"
              >
                {aiUsageData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ background: "#222", border: "0", borderRadius: "8px", color: "#fbfaf6", fontFamily: "monospace", fontSize: "10px" }}
              />
              <Legend 
                verticalAlign="bottom" 
                iconSize={8}
                iconType="circle"
                formatter={(v) => <span className="font-mono text-[8.5px] uppercase tracking-wide text-muted-2">{v}</span>}
              />
            </PieChart>
          </ResponsiveContainer>
        </ChartContainer>
      </div>

      {/* Hardest Questions table */}
      <div className="bg-paper border border-rule rounded-xl p-6 flex flex-col h-[260px] sm:h-[300px] lg:h-[340px] shadow-sm lg:col-span-2 overflow-hidden">
        <div className="mb-4">
          <h3 className="font-serif text-lg font-medium text-ink">Lowest Accuracy Questions</h3>
          <p className="font-mono text-[9px] text-muted uppercase tracking-wider">Statistically hardest questions based on user fail-rates</p>
        </div>
        <div className="flex-1 overflow-y-auto">
          <table className="w-full text-left border-collapse font-sans text-xs">
            <thead>
              <tr className="border-b border-rule font-mono uppercase tracking-wide text-muted text-[10px] bg-bg-2/40">
                <th className="py-2.5 px-3 font-semibold">Syllabus Prompt</th>
                <th className="py-2.5 px-2 font-semibold text-center w-20">Mistakes</th>
                <th className="py-2.5 px-2 font-semibold text-center w-24">Accuracy Rate</th>
              </tr>
            </thead>
            <tbody>
              {hardestQuestions.map((q, idx) => (
                <tr key={q.question_id || idx} className="border-b border-rule/50 hover:bg-bg-2/10 transition-colors">
                  <td className="py-3 px-3">
                    <div className="font-sans font-medium text-ink line-clamp-2" title={q.prompt}>
                      {q.prompt}
                    </div>
                    <div className="font-mono text-[8.5px] text-muted mt-0.5">ID: {q.question_id}</div>
                  </td>
                  <td className="py-3 px-2 text-center font-mono font-medium text-rose-600">
                    {q.incorrect_count} <span className="text-[10px] text-muted font-normal">/ {q.total_count}</span>
                  </td>
                  <td className="py-3 px-2 text-center">
                    <span className="font-mono text-xs font-bold text-rose-700 bg-rose-50 border border-rose-100 rounded px-2 py-0.5 inline-block">
                      {q.correct_rate}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
