import { RefreshCw } from "lucide-react";
import { TimeRangeType } from "./types";

interface Props {
  rpcWorking: boolean | null;
  timeRange: TimeRangeType;
  setTimeRange: (range: TimeRangeType) => void;
  loading: boolean;
  fetchAllAnalytics: (range: TimeRangeType) => void;
}

export function AdminDashboardHeader({ rpcWorking, timeRange, setTimeRange, loading, fetchAllAnalytics }: Props) {
  return (
    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6 border-b border-rule pb-6">
      <div>
        <div className="font-mono text-[9px] tracking-widest text-muted uppercase mb-1 flex items-center gap-2">
          <span>AERO SYSTEMS CONTROL PANEL</span>
          {rpcWorking === false && (
            <span className="bg-amber-100 text-amber-800 text-[8px] px-1.5 py-0.2 rounded font-bold">CLIENT LOG ENGINE ACTIVE</span>
          )}
          {rpcWorking === true && (
            <span className="bg-emerald-100 text-emerald-800 text-[8px] px-1.5 py-0.2 rounded font-bold">SUPABASE RPC ENHANCED</span>
          )}
        </div>
        <h1 className="font-serif text-3.5xl tracking-tight text-ink font-medium leading-none">Administrative Command & Analytics</h1>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="inline-flex bg-bg-2 border border-rule p-1 rounded-lg">
          {(["Today", "7d", "30d", "All"] as TimeRangeType[]).map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={`px-4 py-1.5 text-xs font-mono rounded-md font-medium uppercase tracking-wide transition-colors ${
                timeRange === range
                  ? "bg-ink text-bg shadow-sm"
                  : "text-muted hover:text-ink hover:bg-bg-2"
              }`}
            >
              {range}
            </button>
          ))}
        </div>

        <button
          onClick={() => fetchAllAnalytics(timeRange)}
          disabled={loading}
          className="flex items-center justify-center gap-2 px-4 py-2 border border-rule-strong hover:bg-bg-2 rounded-full font-sans text-xs text-ink transition-colors disabled:opacity-50 h-10 select-none cursor-pointer"
        >
          <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
          <span>Sync Stats</span>
        </button>
      </div>
    </div>
  );
}
