import React from "react";
import { DollarSign, AlertCircle } from "lucide-react";
import { AllTimeStats, KpiStats } from "./types";

interface Props {
  allTimeStats: AllTimeStats;
  kpiStats: KpiStats;
}

export function RevenueSnapshot({ allTimeStats, kpiStats }: Props) {
  return (
    <div className="bg-white border-2 border-rule-strong rounded-xl p-6 shadow-sm">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 border-b border-rule pb-4 mb-4">
        <div>
          <h3 className="font-serif text-xl font-medium text-ink flex items-center gap-2">
            <DollarSign size={20} className="text-[#E5A93C]" />
            <span>Licensed Revenue Snapshot</span>
          </h3>
          <p className="font-mono text-[9px] text-muted uppercase tracking-wider">Real-time commercialization telemetry indicators</p>
        </div>
        <span className="font-mono text-[9.5px] px-3 py-1 bg-amber-50 text-amber-800 border border-amber-200 rounded-full font-bold uppercase tracking-wider self-start sm:self-center">
          Pro Subscription Matrix
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        
        <div className="p-4 bg-bg-2 rounded-lg border border-rule/80">
          <div className="font-mono text-[9px] uppercase tracking-wider text-muted-2">Monthly Recurring Revenue (MRR)</div>
          <div className="font-serif text-3xl font-bold mt-2 text-ink">
            ${(allTimeStats.totalProUsers * 29).toLocaleString()}
          </div>
          <p className="font-sans text-[10px] text-muted-2 mt-1">Based on exact ${allTimeStats.totalProUsers} counts at $29/mo</p>
        </div>

        <div className="p-4 bg-bg-2 rounded-lg border border-rule/80">
          <div className="font-mono text-[9px] uppercase tracking-wider text-muted-2">Acquisitions (This Range)</div>
          <div className="font-serif text-3xl font-bold mt-2 text-[#557B96]">
            +{kpiStats.currentUpgrades}
          </div>
          <p className="font-sans text-[10px] text-muted-2 mt-1">New upgrade_pro conversions logged</p>
        </div>

        <div className="p-4 bg-bg-2 rounded-lg border border-rule/80 relative overflow-hidden group">
          <div className="font-mono text-[9px] uppercase tracking-wider text-muted-2 flex items-center gap-1">
            <span>Voluntary Attrition (Churn)</span>
          </div>
          <div className="font-serif text-3xl font-bold mt-2 text-rose-700/80">
            0.0%
          </div>
          <p className="font-sans text-[10px] text-muted-2 mt-1 flex items-center gap-1.5">
            <AlertCircle size={10} className="text-amber-600 shrink-0" />
            <span>Needs real-time payment webhook integration</span>
          </p>
        </div>

      </div>
    </div>
  );
}
