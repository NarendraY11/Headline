import {
    Activity,
    AlertCircle,
    Calendar,
    ChevronLeft,
    ChevronRight,
    Download,
    Edit2,
    FileText,
    Plus,
    RefreshCw,
    Search,
    SlidersHorizontal,
    Trash2,
    UserPlus
} from "lucide-react";
import { useEffect, useState } from "react";
import { Card } from "../../components/Atoms";
import { supabase } from "../../lib/supabase";

interface EventRecord {
  id: number;
  user_id: string | null;
  event_type: string;
  subject_id: string | null;
  subcategory_id: string | null;
  question_id: string | null;
  metadata: Record<string, any>;
  created_at: string;
}

interface ProfileRecord {
  id: string;
  email: string | null;
  display_name: string | null;
}

// DEDICATED TABLE COMPONENT
// Fetches & displays the last 50 events showing email, action, affected entity id, and timestamp with type filtering.
interface RecentEventsAuditTableProps {
  profiles: Record<string, ProfileRecord>;
}

export function RecentEventsAuditTable({ profiles }: RecentEventsAuditTableProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [events, setEvents] = useState<EventRecord[]>([]);
  const [filterType, setFilterType] = useState<string>("all");

  const fetchRecentEvents = async () => {
    setLoading(true);
    setError("");
    try {
      const { data, error: fetchErr } = await supabase
        .from("events")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);

      if (fetchErr) throw fetchErr;
      setEvents(data || []);
    } catch (err: any) {
      console.error("Error fetching last 50 events:", err);
      setError(err.message || "Failed to load recent events.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecentEvents();
  }, []);

  const uniqueEventTypes: string[] = Array.from(new Set(events.map(e => e.event_type)));

  const filteredEvents = filterType === "all" 
    ? events 
    : events.filter(e => e.event_type === filterType);

  const getBadgeClass = (type: string) => {
    const t = type.toLowerCase();
    if (t.includes("delete") || t.includes("revoke")) {
      return "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20";
    }
    if (t.includes("create") || t.includes("enroll")) {
      return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20";
    }
    if (t.includes("update") || t.includes("edit")) {
      return "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20";
    }
    return "bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20";
  };

  const cleanName = (type: string) => {
    return type.replace("admin_", "").replace("_", " ").toUpperCase();
  };

  return (
    <Card className="p-5 bg-paper border border-rule shadow-sm space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-rule pb-4">
        <div>
          <h2 className="font-serif text-lg font-medium tracking-tight text-ink flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
            Real-time Systems Activity Table (Last 50 events)
          </h2>
          <p className="text-[11px] text-muted-2 mt-0.5">
            Synchronized system pipeline tracking the latest administrative activity updates instantly.
          </p>
        </div>
        
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="text-xs p-2 bg-bg border border-rule-strong rounded-lg focus:outline-none focus:border-ink font-mono font-bold text-ink-2 appearance-none pr-8 relative cursor-pointer min-w-[170px]"
          >
            <option value="all">⚡ All event types</option>
            {uniqueEventTypes.map((t) => (
              <option key={t} value={t}>
                {cleanName(t)}
              </option>
            ))}
          </select>
          
          <button
            onClick={fetchRecentEvents}
            disabled={loading}
            className="p-2 border border-rule hover:bg-bg-2 rounded-lg text-ink hover:text-ink-2 transition-colors disabled:opacity-50 cursor-pointer h-9 w-9 flex items-center justify-center shrink-0"
            aria-label="Reload last 50 events" title="Reload last 50 events"
          >
            <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="py-8 flex flex-col items-center justify-center">
          <div className="w-6 h-6 border-2 border-ink border-t-transparent rounded-full animate-spin mb-2"></div>
          <span className="font-mono text-[9px] text-muted tracking-widest uppercase">Syncing Live Ledger...</span>
        </div>
      ) : error ? (
        <div className="p-3 bg-rose-500/10 border border-rose-500/30 text-rose-800 rounded-lg text-xs">
          {error}
        </div>
      ) : filteredEvents.length === 0 ? (
        <p className="text-center text-xs text-muted-2 py-6">No recent events match this filter category.</p>
      ) : (
        <>
        <div className="overflow-x-auto hidden md:block">
          <table className="w-full text-left border-collapse font-sans text-xs">
            <thead>
              <tr className="border-b border-rule font-mono uppercase tracking-wide text-muted text-[10px] bg-bg-2/30">
                <th className="py-2.5 px-3 font-semibold w-[220px]">Admin Email</th>
                <th className="py-2.5 px-3 font-semibold w-[140px]">Action Type</th>
                <th className="py-2.5 px-3 font-semibold w-[120px]">Affected Entity ID</th>
                <th className="py-2.5 px-3 font-semibold">Incident Details</th>
                <th className="py-2.5 px-3 font-semibold w-[160px]">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-rule/30">
              {filteredEvents.map((ev) => {
                const userProfile = ev.user_id ? profiles[ev.user_id] : null;
                const email = ev.metadata?.user_email || userProfile?.email || "Unknown Agent";
                const createdTime = new Date(ev.created_at).toLocaleString("en-GB", {
                  day: "2-digit",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                  hour12: false
                });

                const affectedEntityId = ev.question_id || ev.subcategory_id || ev.subject_id || "None";
                const detailsStr = ev.metadata?.details || `Performed administrative action type configuration.`;

                return (
                  <tr key={ev.id} className="hover:bg-bg-2/10 transition-colors">
                    <td className="py-2.5 px-3 font-mono text-[11px] text-ink truncate max-w-[200px]" title={email}>
                      {email}
                    </td>
                    <td className="py-2.5 px-3">
                      <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-mono font-bold uppercase tracking-wider ${getBadgeClass(ev.event_type)}`}>
                        {cleanName(ev.event_type)}
                      </span>
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="font-mono text-[10px] font-semibold text-muted bg-bg-2 border border-rule px-1.5 py-0.5 rounded select-all whitespace-nowrap">
                        {affectedEntityId}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-ink-2 max-w-[300px] truncate" title={detailsStr}>
                      {detailsStr}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-[10px] text-muted whitespace-nowrap">
                      {createdTime}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {/* Mobile card fallback */}
        <div className="md:hidden divide-y divide-rule/30 font-sans text-xs">
          {filteredEvents.map((ev) => {
            const userProfile = ev.user_id ? profiles[ev.user_id] : null;
            const email = ev.metadata?.user_email || userProfile?.email || "Unknown Agent";
            const createdTime = new Date(ev.created_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
            return (
              <div key={ev.id} className="p-3 flex flex-col gap-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-[10px] text-ink truncate flex-1">{email}</span>
                  <span className={`shrink-0 inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-mono font-bold uppercase tracking-wider ${getBadgeClass(ev.event_type)}`}>
                    {cleanName(ev.event_type)}
                  </span>
                </div>
                <span className="font-mono text-[10px] text-muted">{createdTime}</span>
              </div>
            );
          })}
        </div>
        </>
      )}
    </Card>
  );
}

export default function AdminActivity() {
  const [loading, setLoading] = useState(true);
  const [errorStatus, setErrorStatus] = useState("");
  const [events, setEvents] = useState<EventRecord[]>([]);
  const [profiles, setProfiles] = useState<Record<string, ProfileRecord>>({});

  // Filtering Options
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<"all" | "admin_only" | "create" | "update" | "delete" | "auth">("all");
  const [datePageLimit, setDatePageLimit] = useState<"all" | "today" | "week" | "month">("all");

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 30;

  const fetchActivityData = async () => {
    setLoading(true);
    setErrorStatus("");
    try {
      // 1. Fetch Events
      let query = supabase
        .from("events")
        .select("*")
        .order("created_at", { ascending: false });

      // Apply date constraint helper
      if (datePageLimit !== "all") {
        const dateLimit = new Date();
        if (datePageLimit === "today") {
          dateLimit.setHours(0, 0, 0, 0);
        } else if (datePageLimit === "week") {
          dateLimit.setDate(dateLimit.getDate() - 7);
        } else if (datePageLimit === "month") {
          dateLimit.setMonth(dateLimit.getMonth() - 1);
        }
        query = query.gte("created_at", dateLimit.toISOString());
      }

      const { data: eventsData, error: eventsErr } = await query;
      if (eventsErr) throw eventsErr;

      setEvents(eventsData || []);

      // 2. Fetch User profiles to easily correlate user_ids to human-readable names and emails
      const { data: profilesData, error: profilesErr } = await supabase
        .from("profiles")
        .select("id, email, display_name");
      
      if (!profilesErr && profilesData) {
        const profMap: Record<string, ProfileRecord> = {};
        profilesData.forEach((p) => {
          profMap[p.id] = p;
        });
        setProfiles(profMap);
      }
    } catch (err: any) {
      console.error("Failed loading activity logs:", err);
      setErrorStatus(err.message || "Failed to retrieve system administrative logs.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchActivityData();
  }, [datePageLimit]);

  // Client-side filtration for quick and reliable search
  const filteredEvents = events.filter((ev) => {
    // 1. Filter by category
    const isCoreAdmin = ev.event_type.startsWith("admin_");
    
    if (categoryFilter === "admin_only" && !isCoreAdmin) return false;
    if (categoryFilter === "create" && !ev.event_type.includes("create")) return false;
    if (categoryFilter === "update" && !ev.event_type.includes("update")) return false;
    if (categoryFilter === "delete" && !ev.event_type.includes("delete")) return false;
    if (categoryFilter === "auth" && !(ev.event_type.includes("admin") && (ev.event_type.includes("enroll") || ev.event_type.includes("revoke")))) return false;

    // 2. Filter by search query (ID, email, name, details, paths, category)
    const userProfile = ev.user_id ? profiles[ev.user_id] : null;
    const emailMeta = ev.metadata?.user_email || userProfile?.email || "";
    const nameMeta = ev.metadata?.user_name || userProfile?.display_name || "";
    const details = ev.metadata?.details || "";
    const actionType = ev.event_type || "";
    
    const token = searchQuery.toLowerCase().trim();
    if (!token) return true;

    return (
      actionType.toLowerCase().includes(token) ||
      details.toLowerCase().includes(token) ||
      emailMeta.toLowerCase().includes(token) ||
      nameMeta.toLowerCase().includes(token) ||
      (ev.subject_id && ev.subject_id.toLowerCase().includes(token)) ||
      (ev.subcategory_id && ev.subcategory_id.toLowerCase().includes(token)) ||
      (ev.question_id && ev.question_id.toLowerCase().includes(token)) ||
      ev.id.toString().includes(token)
    );
  });

  // FUNCTION TO EXPORT CURRENTLY FILTERED EVENT LOG INTO A CSV FILE
  const handleExportToCSV = () => {
    if (filteredEvents.length === 0) return;

    // Headers with administrative correlations
    const headers = [
      "Trace ID",
      "Administrator Email",
      "Administrator Name",
      "Action Type",
      "Incident Description",
      "Subject ID",
      "Subcategory ID",
      "Question ID",
      "Timestamp"
    ];

    // Map through visible rows and ensure double-quote escaping for full CSV standard compatibility
    const csvRows = filteredEvents.map((ev) => {
      const userProfile = ev.user_id ? profiles[ev.user_id] : null;
      const email = ev.metadata?.user_email || userProfile?.email || "Unknown Agent";
      const name = ev.metadata?.user_name || userProfile?.display_name || "Anonymous Pilot";
      const details = ev.metadata?.details || "Operation on hierarchy tree.";

      return [
        ev.id,
        email,
        name,
        ev.event_type,
        details,
        ev.subject_id || "",
        ev.subcategory_id || "",
        ev.question_id || "",
        ev.created_at
      ].map((cellValue) => {
        const cleanedVal = cellValue === null || cellValue === undefined ? "" : String(cellValue);
        // Escape quotes to preserve cell breaks
        const escaped = cleanedVal.replace(/"/g, '""');
        // Wrap in quotes if it contains commas, quotes, or newlines
        if (escaped.includes(",") || escaped.includes("\n") || escaped.includes('"')) {
          return `"${escaped}"`;
        }
        return escaped;
      });
    });

    const outputCSV = [headers.join(","), ...csvRows.map((r) => r.join(","))].join("\r\n");
    const blob = new Blob([outputCSV], { type: "text/csv;charset=utf-8;" });
    const blobURL = URL.createObjectURL(blob);
    
    // Create link tag dynamically to force trigger direct download channel
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", blobURL);
    downloadAnchor.setAttribute("download", `heading_audit_activity_${new Date().toISOString().split("T")[0]}.csv`);
    downloadAnchor.style.visibility = "hidden";
    
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    document.body.removeChild(downloadAnchor);
  };

  // Pagination calculation
  const totalItems = filteredEvents.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
  const displayedEvents = filteredEvents.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Helper to identify type & style of events
  const getEventBadgeClass = (type: string) => {
    const t = type.toLowerCase();
    if (t.includes("delete") || t.includes("revoke")) {
      return "bg-rose-500/10 text-rose-600 border border-rose-500/20 dark:bg-rose-500/20 dark:text-rose-400";
    }
    if (t.includes("create") || t.includes("enroll")) {
      return "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 dark:bg-emerald-500/20 dark:text-emerald-400";
    }
    if (t.includes("update") || t.includes("edit")) {
      return "bg-amber-500/10 text-amber-600 border border-amber-500/20 dark:bg-amber-500/20 dark:text-amber-400";
    }
    return "bg-slate-500/10 text-slate-600 border border-slate-500/20 dark:bg-slate-500/20 dark:text-slate-400";
  };

  const getEventIcon = (type: string) => {
    if (type.includes("delete")) return <Trash2 size={13} className="text-rose-600 dark:text-rose-400" />;
    if (type.includes("create")) return <Plus size={13} className="text-emerald-600 dark:text-emerald-400" />;
    if (type.includes("update")) return <Edit2 size={13} className="text-amber-600 dark:text-amber-400" />;
    if (type.includes("enroll") || type.includes("revoke")) return <UserPlus size={13} className="text-indigo-600 dark:text-indigo-400" />;
    return <FileText size={13} className="text-muted" />;
  };

  const cleanEventName = (type: string) => {
    return type
      .replace("admin_", "")
      .replace("_", " ")
      .toUpperCase();
  };

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
    }
  };

  return (
    <div className="space-y-6 w-full max-w-7xl mx-auto py-2 font-sans text-ink">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-rule pb-6">
        <div>
          <div className="font-mono text-[9px] tracking-widest text-muted uppercase mb-1">Audit Logs ledger</div>
          <h1 className="font-serif text-3xl font-medium tracking-tight text-ink">Administrative Activity</h1>
        </div>
        
        <div className="flex items-center gap-2">
          {/* EXPORT TO CSV TRIGGER */}
          <button
            onClick={handleExportToCSV}
            disabled={filteredEvents.length === 0}
            className="flex items-center gap-1.5 px-4 py-2 border border-rule hover:bg-bg-2 rounded-full font-sans text-xs text-ink transition-colors disabled:opacity-50 cursor-pointer h-10 shrink-0 font-semibold bg-emerald-500/5 hover:bg-emerald-500/15 border-emerald-500/20 text-emerald-700 dark:text-emerald-400"
            aria-label="Export currently filtered audit logs to CSV format" title="Export currently filtered audit logs to CSV format"
          >
            <Download size={13} />
            <span>Export CSV</span>
          </button>

          <button
            onClick={fetchActivityData}
            disabled={loading}
            className="flex items-center gap-1.5 px-4 py-2 border border-rule hover:bg-bg-2 rounded-full font-sans text-xs text-ink transition-colors disabled:opacity-50 cursor-pointer h-10 shrink-0"
          >
            <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
            <span>Sync Audit Ledger</span>
          </button>
        </div>
      </div>

      {errorStatus && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/30 text-rose-800 rounded-lg text-xs flex items-center gap-3">
          <AlertCircle size={16} className="shrink-0" />
          <span>{errorStatus}</span>
        </div>
      )}

      {/* DEDICATED REAL-TIME LAST 50 EVENTS TABLE COMPONENT VIEW */}
      <RecentEventsAuditTable profiles={profiles} />

      {/* Control panel / Filters */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 mt-8">
        {/* Search input */}
        <div className="relative lg:col-span-2">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-2" size={14} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            placeholder="Search by catalog ID, administrator, details, action..."
            className="w-full text-xs p-3 pl-10 bg-paper border border-rule rounded-xl focus:outline-none focus:border-rule-strong text-ink font-semibold"
          />
        </div>

        {/* Category filters */}
        <div className="relative">
          <SlidersHorizontal className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-2" size={14} />
          <select
            value={categoryFilter}
            onChange={(e) => {
              setCategoryFilter(e.target.value as any);
              setCurrentPage(1);
            }}
            className="w-full text-xs p-3 pl-10 bg-paper border border-rule rounded-xl focus:outline-none focus:border-rule-strong text-ink font-semibold h-[42px] appearance-none cursor-pointer"
          >
            <option value="all">All Operations</option>
            <option value="admin_only">Admin Actions Only</option>
            <option value="create">Creations Only (New)</option>
            <option value="update">Updates (Edits)</option>
            <option value="delete">Deletions Only (Danger)</option>
            <option value="auth">Enroll & Revoke Logs</option>
          </select>
        </div>

        {/* Date scope */}
        <div className="relative">
          <Calendar className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-2" size={14} />
          <select
            value={datePageLimit}
            onChange={(e) => {
              setDatePageLimit(e.target.value as any);
              setCurrentPage(1);
            }}
            className="w-full text-xs p-3 pl-10 bg-paper border border-rule rounded-xl focus:outline-none focus:border-rule-strong text-ink font-semibold h-[42px] appearance-none cursor-pointer"
          >
            <option value="all">Total Cumulative Logs</option>
            <option value="today">Today Only</option>
            <option value="week">Past 7 days</option>
            <option value="month">Past 30 days</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="h-[300px] flex flex-col items-center justify-center bg-paper border border-rule rounded-2xl">
          <div className="w-10 h-10 border-4 border-ink border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="font-mono text-xs text-muted tracking-widest uppercase">Fetching audit trail registers...</p>
        </div>
      ) : events.length === 0 ? (
        <Card className="p-12 text-center flex flex-col items-center justify-center">
          <Activity className="text-muted-2 mb-3" size={36} />
          <h3 className="font-serif text-lg font-medium text-ink">No System Events Recorded</h3>
          <p className="text-xs text-muted max-w-sm mx-auto mt-1 leading-relaxed">
            The supabase ledger does not contain any audit occurrences within this selected scope parameters.
          </p>
        </Card>
      ) : displayedEvents.length === 0 ? (
        <Card className="p-12 text-center flex flex-col items-center justify-center">
          <Search className="text-muted-2 mb-3" size={36} />
          <h3 className="font-serif text-lg font-medium text-ink">No Matching Entries</h3>
          <p className="text-xs text-muted max-w-sm mx-auto mt-1 leading-relaxed">
            We found zero matching events align with your search string: "{searchQuery}". Try auditing with broader criteria.
          </p>
        </Card>
      ) : (
        <div className="space-y-4">
          <div className="bg-paper border border-rule rounded-2xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse font-sans text-xs">
                <thead>
                  <tr className="border-b border-rule font-mono uppercase tracking-wide text-muted text-[10px] bg-bg-2/50">
                    <th className="py-3.5 px-6 font-semibold w-24">Trace ID</th>
                    <th className="py-3.5 px-4 font-semibold w-56">Administrator Profile</th>
                    <th className="py-3.5 px-4 font-semibold w-40">Action Category</th>
                    <th className="py-3.5 px-4 font-semibold">Incident/Operations Log Description</th>
                    <th className="py-3.5 px-4 font-semibold w-44">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-rule/50">
                  {displayedEvents.map((ev) => {
                    const userProfile = ev.user_id ? profiles[ev.user_id] : null;
                    const email = ev.metadata?.user_email || userProfile?.email || "Unknown Agent";
                    const name = ev.metadata?.user_name || userProfile?.display_name || "Anonymous Pilot";
                    const formattedDate = new Date(ev.created_at).toLocaleString("en-GB", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                      hour12: false
                    });

                    const icon = getEventIcon(ev.event_type);
                    const label = cleanEventName(ev.event_type);
                    const detailsStr = ev.metadata?.details || `Operation on hierarchy type.`;

                    return (
                      <tr key={ev.id} className="hover:bg-bg-2/20 transition-colors">
                        <td className="py-4 px-6 font-mono text-[10px] text-muted-2">
                          #{ev.id}
                        </td>
                        <td className="py-4 px-4">
                          <div className="flex flex-col">
                            <span className="font-sans font-semibold text-ink text-xs truncate max-w-[200px]">
                              {name}
                            </span>
                            <span className="font-mono text-[9px] text-muted truncate max-w-[200px]" title={email}>
                              {email}
                            </span>
                          </div>
                        </td>
                        <td className="py-4 px-4">
                          <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded border text-[9px] font-mono font-bold uppercase tracking-wider ${getEventBadgeClass(ev.event_type)}`}>
                            {icon}
                            {label}
                          </span>
                        </td>
                        <td className="py-4 px-4 pr-6">
                          <div className="flex flex-col gap-1">
                            <p className="font-medium text-ink-2 text-xs leading-relaxed max-w-[500px] break-words">
                              {detailsStr}
                            </p>
                            
                            {/* Associated Catalog References */}
                            {(ev.subject_id || ev.subcategory_id || ev.question_id) && (
                              <div className="flex flex-wrap gap-1.5 mt-0.5 select-none">
                                {ev.subject_id && (
                                  <span className="font-mono text-[8px] px-1.5 bg-bg-2 border border-rule text-muted rounded uppercase font-bold">
                                    Subject: {ev.subject_id}
                                  </span>
                                )}
                                {ev.subcategory_id && (
                                  <span className="font-mono text-[8px] px-1.5 bg-bg-2 border border-rule text-muted rounded uppercase font-bold">
                                    Subcat: {ev.subcategory_id}
                                  </span>
                                )}
                                {ev.question_id && (
                                  <span className="font-mono text-[8px] px-1.5 bg-bg-2 border border-rule text-muted rounded uppercase font-bold">
                                    QID: {ev.question_id}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="py-4 px-4 font-mono text-[10px] text-muted whitespace-nowrap">
                          {formattedDate}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination Footer */}
          <div className="flex items-center justify-between border-t border-rule/60 pt-4 px-1">
            <span className="font-mono text-[10px] text-muted uppercase tracking-wider">
              Showing <strong>{displayedEvents.length}</strong> of <strong>{totalItems}</strong> traces
            </span>

            <div className="flex items-center gap-2">
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className="p-1 px-3 border border-rule hover:bg-bg-2 rounded text-xs text-ink transition-colors disabled:opacity-50 cursor-pointer flex items-center gap-1 font-mono uppercase font-bold"
              >
                <ChevronLeft size={12} />
                <span>Prev</span>
              </button>

              <span className="font-mono text-[10px] text-muted uppercase tracking-widest px-2">
                Page {currentPage} of {totalPages}
              </span>

              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="p-1 px-3 border border-rule hover:bg-bg-2 rounded text-xs text-ink transition-colors disabled:opacity-50 cursor-pointer flex items-center gap-1 font-mono uppercase font-bold"
              >
                <span>Next</span>
                <ChevronRight size={12} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
