// M13: CalendarSyncPanel — export/sync study missions to Google, Outlook, Apple

import { Calendar, Download, ExternalLink, Globe } from "lucide-react";
import { useState } from "react";
import {
  downloadICS,
  downloadSingleMissionICS,
  generateICS,
  getGoogleCalendarUrl,
  getOutlookCalendarUrl,
} from "../../lib/calendarExport";
import type { StudyMissionRow } from "../../types/studyScheduler";
import { useAuth } from "../../contexts/AuthContext";

interface Props {
  missions: StudyMissionRow[];
  planTitle?: string;
}

// Lucide Globe used for Google (generic web), Calendar for Outlook, Download for Apple
const PROVIDER = [
  {
    key: "google",
    label: "Google",
    sublabel: "Calendar",
    icon: <Globe size={14} />,
    activeClass: "bg-sky/10 border-sky/30 text-sky",
    inactiveClass: "border-rule text-muted-2 hover:border-sky/20 hover:text-ink",
  },
  {
    key: "outlook",
    label: "Outlook",
    sublabel: "Microsoft",
    icon: <Globe size={14} />,
    activeClass: "bg-navy/10 border-navy/30 text-navy",
    inactiveClass: "border-rule text-muted-2 hover:border-navy/20 hover:text-ink",
  },
  {
    key: "apple",
    label: "Apple",
    sublabel: "Calendar",
    icon: <Download size={14} />,
    activeClass: "bg-mint/10 border-mint/30 text-mint",
    inactiveClass: "border-rule text-muted-2 hover:border-mint/20 hover:text-ink",
  },
] as const;

type Provider = (typeof PROVIDER)[number]["key"];

export function CalendarSyncPanel({ missions, planTitle = "Heading Study Plan" }: Props) {
  const { user } = useAuth();
  const [expanded, setExpanded] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<Provider>("google");
  const [popupWarning, setPopupWarning] = useState(false);

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
    // Browsers block popups after the first. Open only the first and warn.
    if (missions.length > 1) setPopupWarning(true);
    const first = missions[0];
    if (!first) return;
    const url = selectedProvider === "google"
      ? getGoogleCalendarUrl(first)
      : getOutlookCalendarUrl(first);
    window.open(url, "_blank", "noopener");
  }

  const missionSubject = (m: StudyMissionRow) => {
    const p = m.payload as unknown as Record<string, unknown>;
    return typeof p?.subjectId === "string" ? p.subjectId : m.type;
  };

  return (
    <div className="bg-paper border border-rule rounded-2xl p-5">
      <button
        onClick={() => setExpanded((e) => !e)}
        aria-expanded={expanded}
        aria-controls="calendar-sync-body"
        className="w-full flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky/60 focus-visible:ring-offset-2 focus-visible:ring-offset-bg rounded-lg"
      >
        <Calendar size={15} className="text-navy flex-shrink-0" aria-hidden="true" />
        <span className="font-mono text-[10px] uppercase tracking-widest text-muted-2 flex-1 text-left">
          Calendar Sync
        </span>
        <span className="font-mono text-[11px] text-muted-2" aria-hidden="true">
          {expanded ? "▲" : "▼"}
        </span>
      </button>

      {expanded && (
        <div id="calendar-sync-body" className="mt-4 space-y-4">
          {/* Provider selector */}
          <div>
            <p className="font-mono text-[10px] uppercase tracking-widest text-muted-2 mb-2">Add to calendar</p>
            <div className="flex gap-2">
              {PROVIDER.map((p) => (
                <button
                  key={p.key}
                  onClick={() => setSelectedProvider(p.key)}
                  aria-pressed={selectedProvider === p.key}
                  className={`flex-1 py-2.5 px-2 rounded-xl font-mono text-[10px] uppercase tracking-wide transition-colors border flex flex-col items-center gap-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky/60 focus-visible:ring-offset-2 focus-visible:ring-offset-bg ${
                    selectedProvider === p.key ? p.activeClass : p.inactiveClass
                  }`}
                >
                  {p.icon}
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Popup warning */}
          {popupWarning && (
            <p className="font-mono text-[11px] text-amber leading-snug bg-amber-soft/40 border border-amber/20 rounded-lg px-3 py-2">
              Browsers allow only one popup at a time. Use Export All (.ics) to sync all missions at once.
            </p>
          )}

          {/* Export + sync buttons */}
          <div className="flex gap-2">
            <button
              onClick={exportAll}
              className="flex-1 flex items-center justify-center gap-1.5 h-9 rounded-xl bg-bg-2 border border-rule font-mono text-[10px] uppercase tracking-wide text-ink hover:border-navy/30 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky/60 focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
            >
              <Download size={12} aria-hidden="true" />
              Export All (.ics)
            </button>
            <button
              onClick={syncAll}
              disabled={missions.length === 0}
              className="flex-1 flex items-center justify-center gap-1.5 h-9 rounded-xl bg-navy text-paper font-mono text-[10px] uppercase tracking-wide hover:opacity-90 transition-opacity disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky/60 focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
            >
              <ExternalLink size={12} aria-hidden="true" />
              Sync to {PROVIDER.find((p) => p.key === selectedProvider)?.label}
            </button>
          </div>

          {/* Per-mission list */}
          {missions.length > 0 && (
            <div>
              <p className="font-mono text-[10px] uppercase tracking-widest text-muted-2 mb-2">
                Individual missions ({missions.length})
              </p>
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {missions.map((m) => (
                  <div
                    key={m.id}
                    className="flex items-center gap-2 p-2 rounded-lg border border-rule/50 hover:bg-bg-2/40"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-sans text-[12px] text-ink truncate capitalize">
                        {m.type.replace(/_/g, " ")} — {missionSubject(m)}
                      </p>
                      <p className="font-mono text-[10px] text-muted-2">
                        {m.scheduled_date} · {m.estimated_min ?? 30}min
                      </p>
                    </div>
                    <button
                      onClick={() => syncSelected(m)}
                      className="font-mono text-[10px] text-navy hover:opacity-70 flex-shrink-0 flex items-center gap-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky/60 focus-visible:ring-offset-1 focus-visible:ring-offset-bg rounded"
                      aria-label={`Add ${m.type} mission to ${selectedProvider} calendar`}
                    >
                      Add <ExternalLink size={9} aria-hidden="true" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <p className="font-mono text-[11px] text-muted-2 leading-snug">
            Google / Outlook: opens calendar in new tab. Apple: downloads .ics — open with Calendar app.
          </p>
        </div>
      )}
    </div>
  );
}
