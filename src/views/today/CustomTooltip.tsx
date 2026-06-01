import React from "react";

export const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-ink text-bg font-sans p-3 rounded-lg shadow-xl border border-rule/20 min-w-[200px]">
        <div className="font-serif text-sm border-b border-rule/20 pb-2 mb-2">
          {data.fullTitle}
        </div>
        <div className="flex justify-between items-center mb-1">
          <span className="font-mono text-[9px] uppercase tracking-widest opacity-70">
            Mastery
          </span>
          <span className="font-mono text-sm text-mint">{data.score}%</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="font-mono text-[9px] uppercase tracking-widest opacity-70">
            Questions
          </span>
          <span className="font-mono text-[10px]">
            {data.correct} / {data.total}
          </span>
        </div>
      </div>
    );
  }
  return null;
};
