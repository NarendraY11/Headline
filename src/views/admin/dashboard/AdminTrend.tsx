import React from "react";
import { TrendingUp, TrendingDown } from "lucide-react";
import { TimeRangeType } from "./types";

export function AdminTrend({ current, previous, isPercent = false, timeRange }: { current: number, previous: number, isPercent?: boolean, timeRange: TimeRangeType }) {
  const diff = current - previous;
  if (previous === 0) return <span className="text-muted font-sans text-[10px]">▬ Empty previous period</span>;
  const pct = Math.round((diff / previous) * 100);
  const positive = pct >= 0;

  return (
    <div className={`flex items-center gap-1 font-mono text-[10px] ${positive ? "text-emerald-600 dark:text-emerald-500" : "text-rose-600 dark:text-rose-500"}`}>
      {positive ? <TrendingUp size={11} className="shrink-0" /> : <TrendingDown size={11} className="shrink-0" />}
      <span>{positive ? "+" : ""}{pct}% {isPercent ? "rate" : ""} vs last {timeRange === "Today" ? "day" : timeRange}</span>
    </div>
  );
}
