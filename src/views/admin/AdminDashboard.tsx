import { RecentEventsAuditTable } from "./AdminActivity";
import { AdminDashboardHeader } from "./dashboard/AdminDashboardHeader";
import { AiUsageHardestQuestions } from "./dashboard/AiUsageHardestQuestions";
import { KpiCards } from "./dashboard/KpiCards";
import { MainCharts } from "./dashboard/MainCharts";
import { QualityAuditReports } from "./dashboard/QualityAuditReports";
import { InboxPanel } from "./dashboard/InboxPanel";
import { RecentAttemptsLog } from "./dashboard/RecentAttemptsLog";
import { RevenueSnapshot } from "./dashboard/RevenueSnapshot";
import { SubjectHeatmapCharts } from "./dashboard/SubjectHeatmapCharts";
import { useAdminAnalytics } from "./dashboard/useAdminAnalytics";

export default function AdminDashboard() {
  const {
    timeRange,
    setTimeRange,
    loading,
    rpcWorking,
    allTimeStats,
    kpiStats,
    revenueStats,
    signupsOverTime,
    conversionsOverTime,
    activeUsersOverTime,
    usageBySubject,
    heatmapData,
    hardestQuestions,
    aiUsageData,
    recentAttempts,
    reports,
    contactMessages,
    leads,
    profilesMap,
    fetchAllAnalytics,
    handleResolveReport,
    handleResolveContact,
  } = useAdminAnalytics();

  // Premium editorial color scheme (Ink, Slate, Amber-Gold)
  const COLORS = ["#0F1E3C", "#557B96", "#E5A93C", "#8D9EA5"];

  return (
    <div className="space-y-8 max-w-7xl mx-auto py-2">
      <AdminDashboardHeader
        rpcWorking={rpcWorking}
        timeRange={timeRange}
        setTimeRange={setTimeRange}
        loading={loading}
        fetchAllAnalytics={fetchAllAnalytics}
      />

      {loading ? (
        <div className="h-[450px] flex flex-col items-center justify-center p-8 bg-white border border-rule rounded-xl">
          <div className="w-10 h-10 border-4 border-ink border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="font-mono text-xs text-muted tracking-widest uppercase">Compiling telemetry parameters...</p>
        </div>
      ) : (
        <>
          <KpiCards
            allTimeStats={allTimeStats}
            kpiStats={kpiStats}
            timeRange={timeRange}
          />

          <MainCharts
            signupsOverTime={signupsOverTime}
            conversionsOverTime={conversionsOverTime}
            activeUsersOverTime={activeUsersOverTime}
          />

          <SubjectHeatmapCharts
            usageBySubject={usageBySubject}
            heatmapData={heatmapData}
          />

          <AiUsageHardestQuestions
            aiUsageData={aiUsageData}
            hardestQuestions={hardestQuestions}
            COLORS={COLORS}
          />

          <RevenueSnapshot
            allTimeStats={allTimeStats}
            kpiStats={kpiStats}
            revenueStats={revenueStats}
          />

          <RecentAttemptsLog
            recentAttempts={recentAttempts}
          />

          <QualityAuditReports
            reports={reports}
            handleResolveReport={handleResolveReport}
          />

          <InboxPanel
            contactMessages={contactMessages}
            leads={leads}
            handleResolveContact={handleResolveContact}
          />

          {/* Real-time System Activity Table */}
          <div className="mt-8">
            <RecentEventsAuditTable profiles={profilesMap} />
          </div>
        </>
      )}
    </div>
  );
}
