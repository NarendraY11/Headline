// M8E: Mastery Heatmap — subject × week accuracy grid (pro only)
// 4 columns (last 4 weeks), one row per subject with recorded answers.
// Color-coded by mastery band; empty cells shown as neutral.

import type { MasteryHistoryPoint } from "../../hooks/useMasteryHistory";

interface Props {
  weeks: MasteryHistoryPoint[];
  subjects: string[];
  subjectTitles: Record<string, string>;
  loading?: boolean;
}

function bandCls(value: number | string | undefined): string {
  if (value === undefined || value === null) return "bg-bg-2 text-muted-2/40";
  const n = Number(value);
  if (n >= 80) return "bg-mint/20 text-mint";
  if (n >= 65) return "bg-sky/15 text-sky";
  if (n >= 50) return "bg-amber/15 text-amber";
  return "bg-signal/10 text-signal";
}

export function MasteryHeatmap({ weeks, subjects, subjectTitles, loading }: Props) {
  // Show last 4 weeks for heatmap (keep it compact)
  const displayWeeks = weeks.slice(-4);

  if (loading) {
    return (
      <div className="bg-paper border border-rule rounded-2xl p-5">
        <span className="font-mono text-[9px] uppercase tracking-widest text-muted-2 block mb-4">§ MASTERY HEATMAP</span>
        <div className="animate-pulse space-y-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-7 bg-bg-2 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (subjects.length === 0) {
    return (
      <div className="bg-paper border border-rule rounded-2xl p-5">
        <span className="font-mono text-[9px] uppercase tracking-widest text-muted-2 block mb-3">§ MASTERY HEATMAP</span>
        <p className="font-sans text-sm text-muted-2 text-center py-4">
          Complete quizzes to populate heatmap.
        </p>
      </div>
    );
  }

  const title = (id: string) =>
    (subjectTitles[id] ?? id.replace(/-/g, " "))
      .split(" ")
      .slice(0, 2)
      .join(" ");

  return (
    <div className="bg-paper border border-rule rounded-2xl p-5">
      <span className="font-mono text-[9px] uppercase tracking-widest text-muted-2 block mb-4">
        § MASTERY HEATMAP
      </span>

      <div className="overflow-x-auto">
        <table className="w-full border-separate border-spacing-1 min-w-[280px]">
          <thead>
            <tr>
              <th className="w-[100px]" />
              {displayWeeks.map((w) => (
                <th
                  key={w.weekStart}
                  className="font-mono text-[8px] uppercase tracking-wide text-muted-2 text-center pb-1 font-normal"
                >
                  {w.weekLabel}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {subjects.map((subjectId) => (
              <tr key={subjectId}>
                <td className="font-sans text-[11px] text-ink pr-2 truncate max-w-[100px]">
                  {title(subjectId)}
                </td>
                {displayWeeks.map((w) => {
                  const val = w[subjectId];
                  return (
                    <td key={w.weekStart} className="text-center">
                      <div
                        className={`h-7 rounded-md flex items-center justify-center font-mono text-[9px] ${bandCls(val)}`}
                        title={val !== undefined ? `${val}% — ${w.weekLabel}` : "No data"}
                      >
                        {val !== undefined ? `${val}%` : "·"}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-3 mt-3 flex-wrap">
        {[
          { label: "≥80%", cls: "bg-mint/20" },
          { label: "65–79%", cls: "bg-sky/15" },
          { label: "50–64%", cls: "bg-amber/15" },
          { label: "<50%",  cls: "bg-signal/10" },
          { label: "None",  cls: "bg-bg-2" },
        ].map(({ label, cls }) => (
          <div key={label} className="flex items-center gap-1">
            <div className={`w-3 h-3 rounded-sm ${cls}`} />
            <span className="font-mono text-[8px] text-muted-2">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
