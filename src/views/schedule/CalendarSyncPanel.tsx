// M13 + Phase 2: CalendarSyncPanel — compact, always-open card.
// Provider selection + export/sync inline, no accordion overhead.

import { Calendar, ChevronDown, Download, ExternalLink } from "lucide-react";
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

const PROVIDER = [
  { key: "google",  label: "Google",  activeClass: "bg-sky/10 border-sky/30 text-sky",   inactiveClass: "border-rule text-muted-2 hover:text-ink" },
  { key: "outlook", label: "Outlook", activeClass: "bg-navy/10 border-navy/30 text-navy", inactiveClass: "border-rule text-muted-2 hover:text-ink" },
  { key: "apple",   label: "Apple",   activeClass: "bg-mint/10 border-mint/30 text-mint", inactiveClass: "border-rule text-muted-2 hover:text-ink" },
] as const;

type Provider = (typeof PROVIDER)[number]["key"];

export function CalendarSyncPanel({ missions, planTitle = "Heading Study Plan" }: Props) {
  const { user } = useAuth();
  const [provider, setProvider] = useState<Provider>("google");
  const [showMissions, setShowMissions] = useState(false);
  const [popupWarning, setPopupWarning] = useState(false);

  const exportAll = () => {
    const ics = generateICS(missions, planTitle, user?.id ?? "heading");
    downloadICS(ics, "heading-study-plan.ics");
  };

  const syncAll = () => {
    if (provider === "apple") { exportAll(); return; }
    if (missions.length > 1) setPopupWarning(true);
    const first = missions[0];
    if (!first) return;
    window.open(
      provider === "google" ? getGoogleCalendarUrl(first) : getOutlookCalendarUrl(first),
      "_blank",
      "noopener",
    );
  };

  const syncOne = (m: StudyMissionRow) => {
    if (provider === "google") window.open(getGoogleCalendarUrl(m), "_blank", "noopener");
    else if (provider === "outlook") window.open(getOutlookCalendarUrl(m), "_blank", "noopener");
    else downloadSingleMissionICS(m, user?.id ?? "heading");
  };

  const missionSubject = (m: StudyMissionRow) => {
    const p = m.payload as unknown as Record<string, unknown>;
    return typeof p?.subjectId === "string" ? p.subjectId : m.type.replace(/_/g, " ");
  };

  return (
    <div className="bg-paper border border-rule rounded-2xl p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Calendar size={13} className="text-navy flex-shrink-0" aria-hidden="true" />
        <span className="font-mono text-[10px] uppercase tracking-widest text-muted-2 flex-1">
          Calendar Sync
        </span>
        <span className="font-mono text-[10px] text-muted-2">{missions.length} missions</span>
      </div>

      {/* Provider chips — horizontal */}
      <div className="flex gap-1.5">
        {PROVIDER.map((p) => (
          <button
            key={p.key}
            onClick={() => setProvider(p.key)}
            aria-pressed={provider === p.key}
            className={`flex-1 h-8 rounded-lg font-mono text-[9px] uppercase tracking-wide border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky/60 focus-visible:ring-offset-1 focus-visible:ring-offset-bg ${
              provider === p.key ? p.activeClass : p.inactiveClass
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Popup warning */}
      {popupWarning && (
        <p className="font-mono text-[10px] text-amber leading-snug bg-amber-soft/40 border border-amber/20 rounded-lg px-2.5 py-2">
          Browsers allow one popup at a time. Use Export All to sync everything.
        </p>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={exportAll}
          className="flex-1 flex items-center justify-center gap-1 h-8 rounded-lg bg-bg-2 border border-rule font-mono text-[9px] uppercase tracking-wide text-ink hover:border-navy/30 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky/60 focus-visible:ring-offset-1 focus-visible:ring-offset-bg"
        >
          <Download size={11} aria-hidden="true" />
          Export .ics
        </button>
        <button
          onClick={syncAll}
          disabled={missions.length === 0}
          className="flex-1 flex items-center justify-center gap-1 h-8 rounded-lg bg-navy text-paper font-mono text-[9px] uppercase tracking-wide hover:opacity-90 transition-opacity disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky/60 focus-visible:ring-offset-1 focus-visible:ring-offset-bg"
        >
          <ExternalLink size={11} aria-hidden="true" />
          Sync {PROVIDER.find((p) => p.key === provider)?.label}
        </button>
      </div>

      {/* Per-mission list — collapsed by default */}
      {missions.length > 0 && (
        <div>
          <button
            onClick={() => setShowMissions((s) => !s)}
            aria-expanded={showMissions}
            className="flex items-center gap-1 font-mono text-[10px] text-muted-2 hover:text-ink transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-sky/60 rounded"
          >
            <ChevronDown
              size={11}
              className={`transition-transform ${showMissions ? "rotate-180" : ""}`}
              aria-hidden="true"
            />
            {showMissions ? "Hide" : "Show"} {missions.length} missions
          </button>
          {showMissions && (
            <div className="mt-2 space-y-1 max-h-40 overflow-y-auto">
              {missions.map((m) => (
                <div
                  key={m.id}
                  className="flex items-center gap-2 p-2 rounded-lg border border-rule/50 hover:bg-bg-2/40"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-sans text-[11px] text-ink truncate capitalize">
                      {m.type.replace(/_/g, " ")} — {missionSubject(m)}
                    </p>
                    <p className="font-mono text-[10px] text-muted-2">
                      {m.scheduled_date} · {m.estimated_min ?? 30}min
                    </p>
                  </div>
                  <button
                    onClick={() => syncOne(m)}
                    aria-label={`Add ${m.type} to ${provider} calendar`}
                    className="font-mono text-[9px] text-navy hover:opacity-70 flex-shrink-0 flex items-center gap-0.5 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-sky/60 rounded"
                  >
                    Add <ExternalLink size={8} aria-hidden="true" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <p className="font-mono text-[10px] text-muted-2 leading-snug">
        Apple: downloads .ics — open with Calendar app. Google/Outlook: opens new tab.
      </p>
    </div>
  );
}
