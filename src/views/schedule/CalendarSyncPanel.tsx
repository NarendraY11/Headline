// M13: CalendarSyncPanel — export/sync study missions to Google, Outlook, Apple

import { useState } from "react";
import { Calendar, Download, ExternalLink } from "lucide-react";
import {
  generateICS,
  downloadICS,
  getGoogleCalendarUrl,
  getOutlookCalendarUrl,
  downloadSingleMissionICS,
} from "../../lib/calendarExport";
import type { StudyMissionRow } from "../../types/studyScheduler";
import { useAuth } from "../../contexts/AuthContext";

interface Props {
  missions: StudyMissionRow[];
  planTitle?: string;
}

const PROVIDER = [
  {
    key: "google",
    label: "Google Calendar",
    color: "bg-[#4285F4] hover:bg-[#3367D6]",
    text: "text-white",
    icon: "G",
  },
  {
    key: "outlook",
    label: "Outlook",
    color: "bg-[#0078D4] hover:bg-[#005A9E]",
    text: "text-white",
    icon: "O",
  },
  {
    key: "apple",
    label: "Apple Calendar",
    color: "bg-bg-2 hover:bg-bg-2/70 border border-rule",
    text: "text-ink",
    icon: "🍎",
  },
] as const;

type Provider = (typeof PROVIDER)[number]["key"];

export function CalendarSyncPanel({ missions, planTitle = "Heading Study Plan" }: Props) {
  const { user } = useAuth();
  const [expanded, setExpanded] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<Provider>("google");

  function exportAll() {
    const ics = generateICS(missions, planTitle, user?.id ?? "heading");
    downloadICS(ics, "heading-study-plan.ics");
  }

  function syncSelected(mission: StudyMissionRow) {
    if (selectedProvider === "google") {
      window.open(getGoogleCalendarUrl(mission), "_blank", "noopener");
    } else if (selectedProvider === "outlook") {
      window.open(getOutlookCalendarUrl(mission), "_blank", "noopener");
    } else {
      downloadSingleMissionICS(mission, user?.id ?? "heading");
    }
  }

  function syncAll() {
    if (selectedProvider === "apple") {
      exportAll();
      return;
    }
    // Open first 5 in new tabs (browser may block >1 popup — warn user)
    for (const m of missions.slice(0, 5)) {
      const url = selectedProvider === "google"
        ? getGoogleCalendarUrl(m)
        : getOutlookCalendarUrl(m);
      window.open(url, "_blank", "noopener");
    }
  }

  const subject = (m: StudyMissionRow) =>
    (m.payload as any)?.subject ?? m.type;

  return (
    <div className="bg-paper border border-rule rounded-2xl p-5">
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center gap-2 mb-0"
      >
        <Calendar size={15} className="text-navy flex-shrink-0" />
        <span className="font-mono text-[9px] uppercase tracking-widest text-muted-2 flex-1 text-left">
          Calendar Sync
        </span>
        <span className="font-mono text-[8px] text-muted-2">{expanded ? "▲" : "▼"}</span>
      </button>

      {expanded && (
        <div className="mt-4 space-y-4">
          {/* Provider selector */}
          <div>
            <p className="font-mono text-[8px] uppercase tracking-widest text-muted-2 mb-2">Add to calendar</p>
            <div className="flex gap-2">
              {PROVIDER.map(p => (
                <button
                  key={p.key}
                  onClick={() => setSelectedProvider(p.key)}
                  className={`flex-1 py-2 px-2 rounded-xl font-mono text-[9px] uppercase tracking-wide transition-colors border ${
                    selectedProvider === p.key
                      ? "bg-navy/10 border-navy/30 text-navy"
                      : "border-rule text-muted-2 hover:border-navy/20 hover:text-ink"
                  }`}
                >
                  <span className="block text-base mb-0.5">{p.icon}</span>
                  {p.label.split(" ")[0]}
                </button>
              ))}
            </div>
          </div>

          {/* Export all button */}
          <div className="flex gap-2">
            <button
              onClick={exportAll}
              className="flex-1 flex items-center justify-center gap-1.5 h-9 rounded-xl bg-bg-2 border border-rule font-mono text-[9px] uppercase tracking-wide text-ink hover:border-navy/30 transition-colors"
            >
              <Download size={12} />
              Export All (.ics)
            </button>
            <button
              onClick={syncAll}
              className="flex-1 flex items-center justify-center gap-1.5 h-9 rounded-xl bg-navy text-paper font-mono text-[9px] uppercase tracking-wide hover:opacity-90 transition-opacity"
            >
              <ExternalLink size={12} />
              Sync All
            </button>
          </div>

          {/* Per-mission list */}
          {missions.length > 0 && (
            <div>
              <p className="font-mono text-[8px] uppercase tracking-widest text-muted-2 mb-2">
                Individual missions ({missions.length})
              </p>
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {missions.map(m => (
                  <div
                    key={m.id}
                    className="flex items-center gap-2 p-2 rounded-lg border border-rule/50 hover:bg-bg-2/40"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-sans text-[11px] text-ink truncate capitalize">
                        {m.type} — {subject(m)}
                      </p>
                      <p className="font-mono text-[7px] text-muted-2">{m.scheduled_date} · {m.estimated_min ?? 30}min</p>
                    </div>
                    <button
                      onClick={() => syncSelected(m)}
                      className="font-mono text-[8px] text-navy hover:opacity-70 flex-shrink-0 flex items-center gap-0.5"
                    >
                      Add <ExternalLink size={9} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <p className="font-mono text-[7px] text-muted-2 leading-snug">
            Google / Outlook: opens calendar in new tab. Apple: downloads .ics file — open with Calendar app.
          </p>
        </div>
      )}
    </div>
  );
}
