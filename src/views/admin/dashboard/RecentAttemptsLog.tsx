import { AlertCircle } from "lucide-react";

interface Props {
  recentAttempts: any[];
}

export function RecentAttemptsLog({ recentAttempts }: Props) {
  return (
    <div className="bg-paper border border-rule rounded-xl p-6 shadow-sm">
      <div className="flex justify-between items-center border-b border-rule pb-4 mb-4">
        <div>
          <h3 className="font-serif text-lg font-medium text-ink">Logbook Stream Live Feed</h3>
          <p className="font-mono text-[9px] text-muted uppercase tracking-wider">Recent pilot examination logs captured in database</p>
        </div>
        <span className="font-mono text-[9px] px-2.5 py-1 bg-bg-1 border border-rule text-ink uppercase tracking-wider rounded-md">
          COCKPIT TELEMETRY
        </span>
      </div>

      {recentAttempts.length === 0 ? (
        <div className="text-center py-10 border border-dashed border-rule rounded-lg">
          <AlertCircle className="mx-auto text-muted mb-2 animate-bounce" size={24} />
          <p className="font-mono text-xs text-muted uppercase tracking-widest">No mock exam attempts logged in database yet.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse font-sans text-xs">
            <thead>
              <tr className="border-b border-rule font-mono uppercase tracking-wide text-muted text-[10px] bg-bg-2/30">
                <th className="py-2.5 px-4 font-semibold">Active Pilot</th>
                <th className="py-2.5 px-4 font-semibold w-28">Simulation Mode</th>
                <th className="py-2.5 px-4 font-semibold text-center w-28">Score Accuracy</th>
                <th className="py-2.5 px-4 font-semibold text-right w-36">Result Status</th>
                <th className="py-2.5 px-4 font-semibold text-right w-44">Log Timestamp</th>
              </tr>
            </thead>
            <tbody>
              {recentAttempts.map((attempt) => {
                const userProfile = attempt.profiles || {};
                const displayName = userProfile.display_name || userProfile.email || "Aviation Student";
                const dateDisplay = new Date(attempt.created_at).toLocaleString("en-GB", {
                  day: "2-digit",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                });
                const passStatus = attempt.percentage >= 70;

                return (
                  <tr key={attempt.id} className="border-b border-rule/50 hover:bg-bg-2/20 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-sans font-medium text-ink">{displayName}</div>
                      <div className="font-mono text-[9.5px] text-muted mt-0.5">{userProfile.email || "anonymous pilot"}</div>
                    </td>
                    <td className="py-3 px-4 uppercase font-mono text-[10px]">
                      <span className={`px-2 py-0.5 rounded font-bold ${attempt.mode === "timed" ? "bg-amber-100 text-amber-800" : "bg-teal-100 text-teal-800"}`}>
                        {attempt.mode}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center font-mono">
                      <span className="font-semibold">{attempt.score}</span>{" "}
                      <span className="text-muted-2">/</span>{" "}
                      <span className="text-muted">{attempt.total}</span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 font-mono text-[10px] font-bold ${passStatus ? "bg-emerald-50 text-emerald-700 border border-emerald-100" : "bg-rose-50 text-rose-700 border border-rose-100"}`}>
                        {attempt.percentage}% · {passStatus ? "PASS" : "FAIL"}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-[10px] text-muted-2">
                      {dateDisplay}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
