import { DollarSign, TrendingUp } from "lucide-react";
import { AllTimeStats, KpiStats, RevenueStats } from "./types";

interface Props {
  allTimeStats: AllTimeStats;
  kpiStats: KpiStats;
  revenueStats: RevenueStats;
}

const inr = (n: number) => `₹${(n || 0).toLocaleString("en-IN")}`;

export function RevenueSnapshot({ allTimeStats, revenueStats }: Props) {
  return (
    <div className="bg-white border-2 border-rule-strong rounded-xl p-6 shadow-sm">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 border-b border-rule pb-4 mb-4">
        <div>
          <h3 className="font-serif text-xl font-medium text-ink flex items-center gap-2">
            <DollarSign size={20} className="text-[#E5A93C]" />
            <span>Licensed Revenue Snapshot</span>
          </h3>
          <p className="font-mono text-[9px] text-muted uppercase tracking-wider">Derived from the plan_changes purchase audit trail</p>
        </div>
        <span className="font-mono text-[9.5px] px-3 py-1 bg-amber-50 text-amber-800 border border-amber-200 rounded-full font-bold uppercase tracking-wider self-start sm:self-center">
          {allTimeStats.totalProUsers} active Pro
        </span>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 bg-bg-2 rounded-lg border border-rule/80">
          <div className="font-mono text-[9px] uppercase tracking-wider text-muted-2">Monthly Recurring (MRR)</div>
          <div className="font-serif text-2xl font-bold mt-2 text-ink">{inr(revenueStats.mrrInr)}</div>
          <p className="font-sans text-[10px] text-muted-2 mt-1">{allTimeStats.totalProUsers} Pro × ₹499/mo</p>
        </div>

        <div className="p-4 bg-bg-2 rounded-lg border border-rule/80">
          <div className="font-mono text-[9px] uppercase tracking-wider text-muted-2">Collected (this range)</div>
          <div className="font-serif text-2xl font-bold mt-2 text-[#557B96]">{inr(revenueStats.periodCollectedInr)}</div>
          <p className="font-sans text-[10px] text-muted-2 mt-1 flex items-center gap-1">
            <TrendingUp size={10} className="text-emerald-600" /> {revenueStats.purchaseCount} total purchases
          </p>
        </div>

        <div className="p-4 bg-bg-2 rounded-lg border border-rule/80">
          <div className="font-mono text-[9px] uppercase tracking-wider text-muted-2">Total collected (all time)</div>
          <div className="font-serif text-2xl font-bold mt-2 text-ink">{inr(revenueStats.totalCollectedInr)}</div>
          <p className="font-sans text-[10px] text-muted-2 mt-1">Across all recorded payments</p>
        </div>

        <div className="p-4 bg-bg-2 rounded-lg border border-rule/80">
          <div className="font-mono text-[9px] uppercase tracking-wider text-muted-2">Churn</div>
          <div className="font-serif text-2xl font-bold mt-2 text-rose-700/80">{revenueStats.churnPercent.toFixed(1)}%</div>
          <p className="font-sans text-[10px] text-muted-2 mt-1">Downgrades vs active Pro</p>
        </div>
      </div>
    </div>
  );
}
