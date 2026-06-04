import { Activity, Award, Calendar, DollarSign, FileText, HelpCircle, ShieldCheck, Users } from "lucide-react";
import { Card } from "../../../components/Atoms";
import { AdminTrend } from "./AdminTrend";
import { AllTimeStats, KpiStats, TimeRangeType } from "./types";

interface KpiCardsProps {
  allTimeStats: AllTimeStats;
  kpiStats: KpiStats;
  timeRange: TimeRangeType;
}

export function KpiCards({ allTimeStats, kpiStats, timeRange }: KpiCardsProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Total Users */}
      <Card className="p-5 flex flex-col justify-between h-[150px] bg-paper border border-rule hover:shadow-sm transition-all">
        <div className="flex justify-between items-start">
          <span className="font-mono text-[9px] uppercase tracking-wider text-muted font-bold">Total Enregistered</span>
          <div className="p-2 bg-bg-2 rounded-full text-ink"><Users size={15} /></div>
        </div>
        <div>
          <div className="font-serif text-3.5xl font-semibold text-ink leading-none">{allTimeStats.totalUsers}</div>
          <div className="font-sans text-[10px] text-muted-2 mt-1">
            {kpiStats.currentSignups} new signups this range
          </div>
        </div>
        <div className="border-t border-rule/55 pt-2">
          <AdminTrend current={kpiStats.currentSignups} previous={kpiStats.prevSignups} timeRange={timeRange} />
        </div>
      </Card>

      {/* Pro Users */}
      <Card className="p-5 flex flex-col justify-between h-[150px] bg-paper border border-rule hover:shadow-sm transition-all">
        <div className="flex justify-between items-start">
          <span className="font-mono text-[9px] uppercase tracking-wider text-muted font-bold">Pro Active Tier</span>
          <div className="p-2 bg-teal-50 rounded-full text-teal-800"><Award size={15} /></div>
        </div>
        <div>
          <div className="font-serif text-3.5xl font-semibold text-teal-850 leading-none">{allTimeStats.totalProUsers}</div>
          <div className="font-sans text-[10px] text-muted-2 mt-1">
            Active paid pilot licenses
          </div>
        </div>
        <div className="border-t border-rule/55 pt-2">
          <AdminTrend current={kpiStats.currentUpgrades} previous={kpiStats.prevUpgrades} timeRange={timeRange} />
        </div>
      </Card>

      {/* Conversion Rate */}
      <Card className="p-5 flex flex-col justify-between h-[150px] bg-paper border border-rule hover:shadow-sm transition-all">
        <div className="flex justify-between items-start">
          <span className="font-mono text-[9px] uppercase tracking-wider text-muted font-bold">Conversions Ratio</span>
          <div className="p-2 bg-bg-2 rounded-full text-ink"><DollarSign size={15} /></div>
        </div>
        <div>
          <div className="font-serif text-3.5xl font-semibold text-ink leading-none">{kpiStats.conversionRate}%</div>
          <div className="font-sans text-[10px] text-muted-2 mt-1">
            Pro / Total Registration Rate
          </div>
        </div>
        <div className="border-t border-rule/55 pt-2">
          <span className="font-mono text-[10px] text-muted">Baseline total active cohort stats</span>
        </div>
      </Card>

      {/* Active Today */}
      <Card className="p-5 flex flex-col justify-between h-[150px] bg-paper border border-rule hover:shadow-sm transition-all">
        <div className="flex justify-between items-start">
          <span className="font-mono text-[9px] uppercase tracking-wider text-muted font-bold">Daily Active (DAU)</span>
          <div className="p-2 bg-bg-2 rounded-full text-ink"><Activity size={15} /></div>
        </div>
        <div>
          <div className="font-serif text-3.5xl font-semibold text-ink leading-none">{kpiStats.activeCount}</div>
          <div className="font-sans text-[10px] text-muted-2 mt-1">
            Active cockpit sessions (24h)
          </div>
        </div>
        <div className="border-t border-rule/55 pt-2">
          <AdminTrend current={kpiStats.activeCount} previous={kpiStats.prevActiveCount} timeRange={timeRange} />
        </div>
      </Card>

      {/* Active This Week */}
      <Card className="p-5 flex flex-col justify-between h-[150px] bg-paper border border-rule hover:shadow-sm transition-all">
        <div className="flex justify-between items-start">
          <span className="font-mono text-[9px] uppercase tracking-wider text-muted font-bold">Weekly Active (WAU)</span>
          <div className="p-2 bg-bg-2 rounded-full text-ink"><Calendar size={15} /></div>
        </div>
        <div>
          <div className="font-serif text-3.5xl font-semibold text-ink leading-none">{kpiStats.weeklyActive}</div>
          <div className="font-sans text-[10px] text-muted-2 mt-1">
            Active cockpit sessions (7d)
          </div>
        </div>
        <div className="border-t border-rule/55 pt-2">
          <AdminTrend current={kpiStats.weeklyActive} previous={kpiStats.prevWeeklyActive} timeRange={timeRange} />
        </div>
      </Card>

      {/* Total Questions Answered */}
      <Card className="p-5 flex flex-col justify-between h-[150px] bg-paper border border-rule hover:shadow-sm transition-all">
        <div className="flex justify-between items-start">
          <span className="font-mono text-[9px] uppercase tracking-wider text-muted font-bold">Questions Evaluated</span>
          <div className="p-2 bg-bg-2 rounded-full text-ink"><FileText size={15} /></div>
        </div>
        <div>
          <div className="font-serif text-3.5xl font-semibold text-ink leading-none">
            {kpiStats.totalQuestionsAnswered.toLocaleString()}
          </div>
          <div className="font-sans text-[10px] text-muted-2 mt-1">
            Aggregate dynamic responses
          </div>
        </div>
        <div className="border-t border-rule/55 pt-2">
          <AdminTrend current={kpiStats.totalQuestionsAnswered} previous={kpiStats.prevTotalQuestionsAnswered} timeRange={timeRange} />
        </div>
      </Card>

      {/* Total Quiz Sessions */}
      <Card className="p-5 flex flex-col justify-between h-[150px] bg-paper border border-rule hover:shadow-sm transition-all">
        <div className="flex justify-between items-start">
          <span className="font-mono text-[9px] uppercase tracking-wider text-muted font-bold">Simulations Logged</span>
          <div className="p-2 bg-bg-2 rounded-full text-ink"><ShieldCheck size={15} /></div>
        </div>
        <div>
          <div className="font-serif text-3.5xl font-semibold text-ink leading-none">{kpiStats.totalQuizSessions}</div>
          <div className="font-sans text-[10px] text-muted-2 mt-1">
            Full module exam attempts
          </div>
        </div>
        <div className="border-t border-rule/55 pt-2">
          <AdminTrend current={kpiStats.totalQuizSessions} previous={kpiStats.prevTotalQuizSessions} timeRange={timeRange} />
        </div>
      </Card>

      {/* Avg Score */}
      <Card className="p-5 flex flex-col justify-between h-[150px] bg-paper border border-rule hover:shadow-sm transition-all">
        <div className="flex justify-between items-start">
          <span className="font-mono text-[9px] uppercase tracking-wider text-muted font-bold">Cohort Avg Accuracy</span>
          <div className="p-2 bg-bg-2 rounded-full text-ink"><HelpCircle size={15} /></div>
        </div>
        <div>
          <div className="font-serif text-3.5xl font-semibold text-ink leading-none">{kpiStats.avgScore}%</div>
          <div className="font-sans text-[10px] text-muted-2 mt-1">
            Simulation pass benchmark: 70%
          </div>
        </div>
        <div className="border-t border-rule/55 pt-2">
          <AdminTrend current={kpiStats.avgScore} previous={kpiStats.prevAvgScore} isPercent={true} timeRange={timeRange} />
        </div>
      </Card>

    </div>
  );
}
