
interface Props {
  reports: any[];
  handleResolveReport: (reportId: string, currentStatus: string) => void;
}

export function QualityAuditReports({ reports, handleResolveReport }: Props) {
  return (
    <div className="bg-paper border border-rule rounded-xl p-6 shadow-sm">
      <div className="flex justify-between items-center border-b border-rule pb-4 mb-4">
        <div>
          <h3 className="font-serif text-lg font-medium text-ink">Pilot Syllabus Quality Audit Roster</h3>
          <p className="font-mono text-[9px] text-muted uppercase tracking-wider">Targeted report feedback and question disputes from active trainees</p>
        </div>
        <span className="font-mono text-[9px] px-2.5 py-1 bg-amber-50 text-amber-850 border border-amber-200 uppercase tracking-wider rounded-md font-semibold">
          Syllabus Discrepancies
        </span>
      </div>

      {reports.length === 0 ? (
        <div className="text-center py-10 border border-dashed border-rule rounded-lg">
          <p className="font-mono text-xs text-muted uppercase tracking-widest">No syllabus quality disputes filed by pilots.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse font-sans text-xs">
            <thead>
              <tr className="border-b border-rule font-mono uppercase tracking-wide text-muted text-[10px] bg-bg-2/30">
                <th className="py-2.5 px-4 font-semibold w-40">Reporter Info</th>
                <th className="py-2.5 px-4 font-semibold w-52">Question & Category</th>
                <th className="py-2.5 px-4 font-semibold">Discrepancy Details / Arguments</th>
                <th className="py-2.5 px-4 font-semibold text-center w-28">Status</th>
                <th className="py-2.5 px-4 font-semibold text-right w-40">Filed Timestamp</th>
              </tr>
            </thead>
            <tbody>
              {reports.map((report) => {
                const userProfile = report.profiles || {};
                const displayName = userProfile.display_name || userProfile.email || "Anonymous Trainee";
                const dateDisplay = new Date(report.created_at).toLocaleString("en-GB", {
                  day: "2-digit",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                });

                const categoryLabels: Record<string, string> = {
                  typo: "Typographical Copy Error",
                  incorrect_answer: "Incorrect Answer Key",
                  outdated: "Outdated Regulation",
                  formatting: "Formatting Dispute",
                  other: "Other Syllabus Issue"
                };

                return (
                  <tr key={report.id} className="border-b border-rule/50 hover:bg-bg-2/20 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-sans font-medium text-ink">{displayName}</div>
                      <div className="font-mono text-[9px] text-muted mt-0.5">{userProfile.email || "anonymous pilot"}</div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-mono text-[9px] uppercase font-bold text-[#A66C23]">
                        {categoryLabels[report.category] || report.category}
                      </div>
                      <div className="font-mono text-[8.5px] text-muted mt-0.5">ID: {report.question_id.slice(0, 15)}...</div>
                    </td>
                    <td className="py-3 px-4 max-w-md">
                      <p className="font-sans text-xs text-ink-2 leading-relaxed break-words whitespace-pre-wrap">
                        {report.comment}
                      </p>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <button
                        onClick={() => handleResolveReport(report.id, report.status)}
                        className={`inline-flex items-center rounded px-2 py-0.5 font-mono text-[9.5px] font-bold border transition-colors cursor-pointer uppercase ${
                          report.status === "resolved" 
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100/50" 
                            : "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100/50"
                        }`}
                      >
                        {report.status}
                      </button>
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
