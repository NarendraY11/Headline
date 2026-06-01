import React from "react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from "recharts";

interface Props {
  usageBySubject: any[];
  heatmapData: any[];
}

export function SubjectHeatmapCharts({ usageBySubject, heatmapData }: Props) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

      {/* Usage by Subject */}
      <div className="bg-white border border-rule rounded-xl p-6 flex flex-col min-h-[360px] shadow-sm">
        <div className="mb-4">
          <h3 className="font-serif text-lg font-medium text-ink">Most Popular Subjects</h3>
          <p className="font-mono text-[9px] text-muted uppercase tracking-wider">Total quiz simulation requests (top 10 subjects)</p>
        </div>
        <div className="flex-1 w-full min-h-0" role="img" aria-label="Vertical bar chart displaying quiz simulation usage count across subjects">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              layout="vertical"
              data={usageBySubject}
              margin={{ top: 5, right: 10, left: 15, bottom: 5 }}
            >
              <XAxis type="number" stroke="var(--muted)" fontSize={9} strokeWidth={1} tickLine={false} />
              <YAxis 
                type="category" 
                dataKey="subject_title" 
                stroke="var(--muted)" 
                fontSize={9} 
                strokeWidth={1} 
                tickLine={false}
                width={110}
              />
              <Tooltip
                contentStyle={{ background: "#222", border: "0", borderRadius: "8px", color: "#fbfaf6", fontFamily: "monospace", fontSize: "10px" }}
              />
              <Bar dataKey="usage_count" fill="#E5A93C" radius={[0, 3, 3, 0]} barSize={12} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Sub-category Heatmap */}
      <div className="bg-white border border-rule rounded-xl p-6 flex flex-col min-h-[360px] shadow-sm justify-between">
        <div>
          <h3 className="font-serif text-lg font-medium text-ink">Sub-category Activity Intensity</h3>
          <p className="font-mono text-[9px] text-muted uppercase tracking-wider mb-4">Focus intensity heatmap based on question answers count</p>
        </div>
        
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 my-2 max-h-[200px] overflow-y-auto pr-1">
          {heatmapData.map((item, idx) => {
            let intensityClass = "bg-slate-50 border-slate-100 text-slate-700";
            if (item.answer_count > 50) {
              intensityClass = "bg-[#0F1E3C] text-amber-100 border-[#0F1E3C] font-semibold";
            } else if (item.answer_count > 25) {
              intensityClass = "bg-navy/70 text-white border-navy/70";
            } else if (item.answer_count > 10) {
              intensityClass = "bg-[#557B96]/20 border-[#557B96]/30 text-ink";
            } else if (item.answer_count > 0) {
              intensityClass = "bg-bg-2 text-muted-2 border-rule";
            }
            
            return (
              <div 
                key={idx} 
                className={`p-3 rounded-lg border flex flex-col justify-between transition-all hover:scale-[1.01] ${intensityClass}`}
              >
                <div className="flex justify-between items-start gap-1 w-full">
                  <span className="font-mono text-[9px] uppercase tracking-wide opacity-80 truncate max-w-[80px]">{item.subject_title}</span>
                  <span className="font-mono text-[8.5px] border px-1 rounded-sm border-transparent bg-white/10">{item.subcategory_code}</span>
                </div>
                <div className="text-[11px] font-sans truncate font-medium mt-1 w-full" title={item.subcategory_title}>
                  {item.subcategory_title}
                </div>
                <div className="flex justify-between items-center text-[10px] font-mono mt-2 pt-1 border-t border-white/10">
                  <span>ANSWERS:</span>
                  <span className="font-bold">{item.answer_count}</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Heatmap Legend */}
        <div className="border-t border-rule/60 pt-3 flex flex-wrap gap-4 text-[9px] font-mono uppercase tracking-wider text-muted-2 mt-2">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 bg-slate-50 border border-slate-100 rounded" />
            <span>0 Answers</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 bg-bg-2 border border-rule rounded" />
            <span>1-10 Answers</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 bg-[#557B96]/20 border border-[#557B96]/35 rounded" />
            <span>11-25 Answers</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 bg-[#557B96]/80 rounded" />
            <span>26-50 Answers</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 bg-[#0F1E3C] rounded" />
            <span>51+ Answers</span>
          </div>
        </div>

      </div>

    </div>
  );
}
