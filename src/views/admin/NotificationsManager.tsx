import {
    AlertCircle,
    Bell,
    BellRing,
    Check,
    CheckCircle,
    Clock,
    Mail,
    Search,
    Send,
    Smartphone,
    User,
    Users,
    Zap,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Card } from "../../components/Atoms";
import { useAuth } from "../../contexts/AuthContext";
import { supabase } from "../../lib/supabase";

// ── Supabase Edge Function URL for push delivery ─────────────────────────────
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
const SEND_PUSH_URL = `${SUPABASE_URL}/functions/v1/send-push`;

interface PushNotificationParams {
  title: string;
  body: string;
  url?: string;
  icon?: string;
  badge?: string;
  tag?: string;
  renotify?: boolean;
  requireInteraction?: boolean;
  silent?: boolean;
  type?: string;
  actions?: { action: string; title: string; url?: string }[];
}

async function triggerPushDelivery(
  userIds: string[],
  notification: PushNotificationParams,
  token: string,
  opts?: { ttl?: number; notificationId?: string }
): Promise<{ sent: number; failed: number; pruned: number; total: number; error?: string }> {
  try {
    const res = await fetch(SEND_PUSH_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
        "apikey": SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({
        userIds,
        notification,
        ttl: opts?.ttl ?? 86400,
        notificationId: opts?.notificationId,
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { sent: 0, failed: 0, pruned: 0, total: 0, error: (err as any).error ?? `HTTP ${res.status}` };
    }
    return await res.json() as { sent: number; failed: number; pruned: number; total: number };
  } catch (e: unknown) {
    return { sent: 0, failed: 0, pruned: 0, total: 0, error: e instanceof Error ? e.message : "Network error" };
  }
}

interface ProfileLite {
  id: string;
  display_name: string | null;
  email: string | null;
}

interface AdminNotificationRow {
  id: string;
  admin_id: string | null;
  recipient_ids: string[];
  message: string;
  type: "personal" | "group";
  created_at: string;
}

const MESSAGE_MAX = 2000;

export default function NotificationsManager() {
  const { user } = useAuth();

  // Recipient roster.
  const [profiles, setProfiles] = useState<ProfileLite[]>([]);
  const [loadingProfiles, setLoadingProfiles] = useState(true);
  const [rosterError, setRosterError] = useState("");

  // Compose state.
  const [mode, setMode] = useState<"personal" | "group">("personal");
  const [search, setSearch] = useState("");
  const [selectedSingle, setSelectedSingle] = useState<string>("");
  const [selectedGroup, setSelectedGroup] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [pushStats, setPushStats] = useState<{ sent: number; pruned: number } | null>(null);

  // Push test panel state
  const [pushTestTitle, setPushTestTitle] = useState("Test from Heading Admin");
  const [pushTestBody, setPushTestBody] = useState("This is a test push notification.");
  const [pushTestUrl, setPushTestUrl] = useState("/today");
  const [pushTestTag, setPushTestTag] = useState("heading-test");
  const [pushTestRequireInteraction, setPushTestRequireInteraction] = useState(false);
  const [pushTestTtl, setPushTestTtl] = useState(86400);
  const [pushTestUsers, setPushTestUsers] = useState<"self" | "all">("self");
  const [pushTesting, setPushTesting] = useState(false);
  const [pushTestResult, setPushTestResult] = useState<string | null>(null);

  // History.
  const [history, setHistory] = useState<AdminNotificationRow[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);

  const fetchProfiles = async () => {
    setLoadingProfiles(true);
    setRosterError("");
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, display_name, email")
        .order("display_name", { ascending: true });
      if (error) throw error;
      setProfiles((data as ProfileLite[]) || []);
    } catch (err: any) {
      console.error("Failed to load recipient roster:", err);
      setRosterError(err.message || "Failed to load recipient roster.");
    } finally {
      setLoadingProfiles(false);
    }
  };

  const fetchHistory = async () => {
    setHistoryLoading(true);
    try {
      const { data, error } = await supabase
        .from("admin_notifications")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      setHistory((data as AdminNotificationRow[]) || []);
    } catch (err) {
      console.warn("Failed to load notification history:", err);
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    fetchProfiles();
    fetchHistory();
  }, []);

  const profileMap = useMemo(() => {
    const m = new Map<string, ProfileLite>();
    profiles.forEach((p) => m.set(p.id, p));
    return m;
  }, [profiles]);

  const filteredProfiles = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return profiles;
    return profiles.filter(
      (p) =>
        (p.display_name || "").toLowerCase().includes(q) ||
        (p.email || "").toLowerCase().includes(q)
    );
  }, [profiles, search]);

  const recipientIds = mode === "personal"
    ? (selectedSingle ? [selectedSingle] : [])
    : Array.from(selectedGroup);

  const canSend = recipientIds.length > 0 && message.trim().length > 0 && !sending;

  const labelFor = (p: ProfileLite) =>
    p.display_name || p.email || p.id.slice(0, 8);

  const toggleGroup = (id: string) => {
    setSuccessMsg("");
    setErrorMsg("");
    setSelectedGroup((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const switchMode = (next: "personal" | "group") => {
    setMode(next);
    setSuccessMsg("");
    setErrorMsg("");
  };

  const handleSend = async () => {
    if (!user || recipientIds.length === 0 || !message.trim()) return;
    setSending(true);
    setSuccessMsg("");
    setErrorMsg("");

    const trimmed = message.trim().slice(0, MESSAGE_MAX);

    try {
      // 1. Audit/history row (admin-only RLS).
      const { error: auditErr } = await supabase.from("admin_notifications").insert({
        admin_id: user.uid,
        recipient_ids: recipientIds,
        message: trimmed,
        type: mode,
      });
      if (auditErr) throw auditErr;

      // 2. Fan out one delivery row per recipient into the existing
      //    notifications table — this is what the user bell + realtime read.
      const rows = recipientIds.map((uid) => ({
        user_id: uid,
        title: "Message from Admin",
        message: trimmed,
        type: "system",
        read: false,
      }));
      const { error: deliverErr } = await supabase.from("notifications").insert(rows);
      if (deliverErr) throw deliverErr;

      // 3. Fire web push to subscribed devices (best-effort — fails silently on error).
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;
      if (token) {
        const notificationId = `admin-${Date.now()}`;
        const pushResult = await triggerPushDelivery(
          recipientIds,
          {
            title: "Message from Admin",
            body: trimmed,
            url: "/today",
            tag: "heading-admin",
            type: "broadcast",
          },
          token,
          { ttl: 86400, notificationId }
        );
        setPushStats({ sent: pushResult.sent, pruned: pushResult.pruned ?? 0 });
      }

      setSuccessMsg(
        mode === "personal"
          ? "Notification sent to the selected user."
          : `Notification sent to ${recipientIds.length} user(s).`
      );
      setMessage("");
      setSelectedSingle("");
      setSelectedGroup(new Set());
      await fetchHistory();
    } catch (err: any) {
      console.error("Failed to send notification:", err);
      setErrorMsg(err.message || "Failed to send notification.");
    } finally {
      setSending(false);
    }
  };

  const renderRecipientSummary = (row: AdminNotificationRow) => {
    if (row.type === "personal") {
      const p = row.recipient_ids[0] ? profileMap.get(row.recipient_ids[0]) : undefined;
      return p ? labelFor(p) : (row.recipient_ids[0]?.slice(0, 8) || "—");
    }
    return `${row.recipient_ids.length} recipients`;
  };

  const senderLabel = (row: AdminNotificationRow) => {
    if (row.admin_id && row.admin_id === user?.uid) return user?.email || "You";
    const p = row.admin_id ? profileMap.get(row.admin_id) : undefined;
    return p?.email || p?.display_name || (row.admin_id ? row.admin_id.slice(0, 8) : "—");
  };

  const handlePushTest = async () => {
    if (!user) return;
    setPushTesting(true);
    setPushTestResult(null);
    try {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;
      if (!token) { setPushTestResult("Not authenticated."); return; }

      const targetIds = pushTestUsers === "self"
        ? [user.uid ?? (user as any).id]
        : ["*"];

      const notificationId = `test-${Date.now()}`;
      const result = await triggerPushDelivery(
        targetIds,
        {
          title: pushTestTitle,
          body: pushTestBody,
          url: pushTestUrl || "/today",
          tag: pushTestTag || "heading-test",
          requireInteraction: pushTestRequireInteraction,
          type: "test",
          actions: [
            { action: "open", title: "Open App", url: pushTestUrl || "/today" },
            { action: "dismiss", title: "Dismiss" },
          ],
        },
        token,
        { ttl: pushTestTtl, notificationId }
      );
      if (result.error) {
        setPushTestResult(`Error: ${result.error}`);
      } else {
        setPushTestResult(
          `Delivered: ${result.sent}/${result.total} device(s). Failed: ${result.failed}. Pruned: ${result.pruned} expired.`
        );
      }
    } finally {
      setPushTesting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto py-2">
      {/* Header */}
      <div className="border-b border-rule pb-6">
        <div className="font-mono text-[9px] tracking-widest text-muted uppercase mb-1">Administrative deck</div>
        <h1 className="font-serif text-3xl font-medium tracking-tight text-ink leading-none flex items-center gap-2.5">
          <Bell size={24} className="text-navy" />
          <span>Notifications Dispatch</span>
        </h1>
        <p className="font-sans text-xs text-muted mt-2">
          Send a direct message to a single student or a selected group. Delivered instantly to their notification bell.
        </p>
      </div>

      {/* Compose */}
      <Card className="bg-paper border border-rule shadow-sm overflow-hidden">
        <div className="p-5 border-b border-rule bg-bg-2/20">
          <h3 className="font-serif text-lg font-medium text-ink">Compose notification</h3>
        </div>

        <div className="p-5 space-y-5">
          {/* Type toggle */}
          <div>
            <label className="block font-mono text-[9px] uppercase tracking-wider text-muted-2 mb-1.5 font-bold">Recipient type</label>
            <div className="inline-flex rounded-lg border border-rule overflow-hidden">
              <button
                type="button"
                onClick={() => switchMode("personal")}
                className={`flex items-center gap-1.5 px-4 py-2 font-mono text-[10px] uppercase font-bold tracking-wider transition-colors cursor-pointer ${
                  mode === "personal" ? "bg-navy text-bg" : "bg-paper text-muted hover:bg-bg-2"
                }`}
              >
                <User size={13} /> Personal
              </button>
              <button
                type="button"
                onClick={() => switchMode("group")}
                className={`flex items-center gap-1.5 px-4 py-2 font-mono text-[10px] uppercase font-bold tracking-wider transition-colors cursor-pointer border-l border-rule ${
                  mode === "group" ? "bg-navy text-bg" : "bg-paper text-muted hover:bg-bg-2"
                }`}
              >
                <Users size={13} /> Group
              </button>
            </div>
          </div>

          {/* Recipient selector */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block font-mono text-[9px] uppercase tracking-wider text-muted-2 font-bold">
                {mode === "personal" ? "Select a user" : "Select users"}
              </label>
              <span className="font-mono text-[9px] text-muted">
                {mode === "personal"
                  ? (selectedSingle ? "1 selected" : "none selected")
                  : `${selectedGroup.size} selected`}
              </span>
            </div>

            <div className="relative mb-2">
              <Search className="absolute left-3.5 top-[50%] -translate-y-[50%] text-muted" size={14} />
              <input
                type="text"
                placeholder="Search by name or email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-panel border border-rule rounded-md text-xs px-10 py-2.5 outline-none focus-visible:ring-2 focus-visible:ring-sky/60"
              />
            </div>

            {rosterError && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/30 text-rose-800 rounded-lg text-xs flex items-center gap-2 mb-2">
                <AlertCircle size={14} className="shrink-0" /> {rosterError}
              </div>
            )}

            <div className="border border-rule rounded-lg max-h-64 overflow-y-auto divide-y divide-rule/60 bg-paper">
              {loadingProfiles ? (
                <div className="py-8 text-center font-mono text-[10px] uppercase tracking-wider text-muted">Loading roster…</div>
              ) : filteredProfiles.length === 0 ? (
                <div className="py-8 text-center font-mono text-[10px] uppercase tracking-wider text-muted">No users match.</div>
              ) : (
                filteredProfiles.map((p) => {
                  const selected = mode === "personal" ? selectedSingle === p.id : selectedGroup.has(p.id);
                  return (
                    <div
                      key={p.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => {
                        if (mode === "personal") {
                          setSelectedSingle(p.id);
                          setSuccessMsg("");
                          setErrorMsg("");
                        } else {
                          toggleGroup(p.id);
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); (e.currentTarget as HTMLElement).click(); }
                      }}
                      className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors hover:bg-bg-2/50 ${selected ? "bg-navy/5" : ""}`}
                    >
                      <span className={`w-4 h-4 shrink-0 border flex items-center justify-center ${mode === "personal" ? "rounded-full" : "rounded"} ${selected ? "bg-navy border-navy text-white" : "border-rule bg-paper"}`}>
                        {selected && <Check size={11} />}
                      </span>
                      <div className="w-7 h-7 rounded-full bg-ink/5 border border-rule/65 text-ink flex items-center justify-center font-serif text-[11px] font-bold uppercase shrink-0">
                        {labelFor(p).charAt(0)}
                      </div>
                      <div className="min-w-0">
                        <div className="font-sans font-semibold text-xs text-ink truncate">{p.display_name || "Aviation student"}</div>
                        <div className="font-mono text-[9px] text-muted-2 flex items-center gap-1 truncate">
                          <Mail size={8} /> {p.email || "no email"}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Message */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block font-mono text-[9px] uppercase tracking-wider text-muted-2 font-bold">Message</label>
              <span className={`font-mono text-[9px] ${message.length > MESSAGE_MAX ? "text-rose-600" : "text-muted"}`}>
                {message.length}/{MESSAGE_MAX}
              </span>
            </div>
            <textarea
              value={message}
              onChange={(e) => { setMessage(e.target.value); setSuccessMsg(""); setErrorMsg(""); }}
              maxLength={MESSAGE_MAX}
              rows={4}
              placeholder="Write the notification message…"
              className="w-full bg-panel border border-rule rounded-md text-xs px-3.5 py-2.5 outline-none focus-visible:ring-2 focus-visible:ring-sky/60 resize-y leading-relaxed"
            />
          </div>

          {successMsg && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-xs flex items-start gap-2">
              <CheckCircle size={14} className="shrink-0 mt-0.5" />
              <div>
                {successMsg}
                {pushStats !== null && (
                  <span className="block font-mono text-[9px] mt-0.5 text-emerald-700">
                    Push: {pushStats.sent} device(s) reached · {pushStats.pruned} expired subscription(s) pruned
                  </span>
                )}
              </div>
            </div>
          )}
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg text-xs flex items-center gap-2">
              <AlertCircle size={14} className="shrink-0" /> {errorMsg}
            </div>
          )}

          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleSend}
              disabled={!canSend}
              className="flex items-center gap-2 px-5 py-2.5 bg-navy text-white hover:bg-navy-dark font-mono text-[10px] uppercase font-bold rounded-lg tracking-wider transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Send size={14} />
              <span>{sending ? "Sending…" : `Send${recipientIds.length ? ` to ${recipientIds.length}` : ""}`}</span>
            </button>
          </div>
        </div>
      </Card>

      {/* Push Test Panel */}
      <Card className="bg-paper border border-rule shadow-sm overflow-hidden">
        <div className="p-5 border-b border-rule bg-bg-2/20 flex items-center gap-2">
          <Smartphone size={16} className="text-navy" />
          <h3 className="font-serif text-lg font-medium text-ink">Push Notification Test</h3>
          <span className="ml-auto font-mono text-[9px] uppercase tracking-wide text-muted-2 bg-bg-2 border border-rule px-2 py-0.5 rounded">Admin only</span>
        </div>
        <div className="p-5 space-y-4">
          <p className="font-sans text-xs text-muted-2">
            Send a real Web Push notification to subscribed devices. Requires <code className="font-mono bg-bg-2 px-1 rounded">pushNotifications</code> flag ON and VAPID keys configured.
          </p>

          {/* Title */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-mono text-[9px] uppercase tracking-wider text-muted-2 mb-1.5 font-bold">Notification title</label>
              <input type="text" value={pushTestTitle} onChange={e => setPushTestTitle(e.target.value)}
                className="w-full bg-panel border border-rule rounded-md text-xs px-3.5 py-2 outline-none focus-visible:ring-2 focus-visible:ring-sky/60" />
            </div>
            <div>
              <label className="block font-mono text-[9px] uppercase tracking-wider text-muted-2 mb-1.5 font-bold">Tag (grouping)</label>
              <input type="text" value={pushTestTag} onChange={e => setPushTestTag(e.target.value)}
                className="w-full bg-panel border border-rule rounded-md text-xs px-3.5 py-2 outline-none focus-visible:ring-2 focus-visible:ring-sky/60" />
            </div>
          </div>

          {/* Body */}
          <div>
            <label className="block font-mono text-[9px] uppercase tracking-wider text-muted-2 mb-1.5 font-bold">Body</label>
            <input type="text" value={pushTestBody} onChange={e => setPushTestBody(e.target.value)}
              className="w-full bg-panel border border-rule rounded-md text-xs px-3.5 py-2 outline-none focus-visible:ring-2 focus-visible:ring-sky/60" />
          </div>

          {/* URL + TTL */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-mono text-[9px] uppercase tracking-wider text-muted-2 mb-1.5 font-bold">Click URL</label>
              <input type="text" value={pushTestUrl} onChange={e => setPushTestUrl(e.target.value)}
                className="w-full bg-panel border border-rule rounded-md text-xs px-3.5 py-2 outline-none focus-visible:ring-2 focus-visible:ring-sky/60" />
            </div>
            <div>
              <label className="block font-mono text-[9px] uppercase tracking-wider text-muted-2 mb-1.5 font-bold">TTL (seconds)</label>
              <select value={pushTestTtl} onChange={e => setPushTestTtl(Number(e.target.value))}
                className="w-full bg-panel border border-rule rounded-md text-xs px-3.5 py-2 outline-none focus-visible:ring-2 focus-visible:ring-sky/60">
                <option value={0}>0 — instant or drop</option>
                <option value={3600}>3,600 — 1 hour</option>
                <option value={86400}>86,400 — 24 hours (default)</option>
                <option value={604800}>604,800 — 7 days</option>
              </select>
            </div>
          </div>

          {/* requireInteraction toggle */}
          <div className="flex items-center justify-between p-3 rounded-xl border border-rule bg-bg-2/30">
            <div>
              <p className="font-sans text-[12px] text-ink font-medium">Require Interaction</p>
              <p className="font-mono text-[8px] text-muted-2">Keep notification on screen until user acts (important alerts only)</p>
            </div>
            <button
              onClick={() => setPushTestRequireInteraction(v => !v)}
              className={`w-9 h-5 rounded-full transition-colors flex-shrink-0 relative ${pushTestRequireInteraction ? "bg-amber" : "bg-bg-2 border border-rule"}`}
              role="switch" aria-checked={pushTestRequireInteraction}
            >
              <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-paper shadow transition-transform ${pushTestRequireInteraction ? "translate-x-4" : "translate-x-0.5"}`} />
            </button>
          </div>

          {/* Target */}
          <div>
            <label className="block font-mono text-[9px] uppercase tracking-wider text-muted-2 mb-1.5 font-bold">Target</label>
            <div className="inline-flex rounded-lg border border-rule overflow-hidden">
              {(["self", "all"] as const).map(opt => (
                <button key={opt} type="button" onClick={() => setPushTestUsers(opt)}
                  className={`flex items-center gap-1.5 px-4 py-2 font-mono text-[10px] uppercase font-bold tracking-wider transition-colors cursor-pointer ${
                    pushTestUsers === opt ? "bg-navy text-bg" : "bg-paper text-muted hover:bg-bg-2"
                  } ${opt === "all" ? "border-l border-rule" : ""}`}
                >
                  {opt === "self" ? <><User size={11} /> Just me</> : <><Users size={11} /> All subscribers</>}
                </button>
              ))}
            </div>
          </div>

          {/* Preview */}
          <div className="p-3 bg-ink rounded-xl flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-paper/10 flex items-center justify-center flex-shrink-0">
              <BellRing size={14} className="text-paper" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-sans text-[12px] text-paper font-semibold leading-none mb-0.5">{pushTestTitle || "No title"}</p>
              <p className="font-sans text-[10px] text-paper/60">{pushTestBody || "No body"}</p>
              <div className="flex items-center gap-3 mt-1.5">
                <p className="font-mono text-[8px] text-paper/40">heading.app · {pushTestTag}</p>
                {pushTestRequireInteraction && (
                  <span className="font-mono text-[7px] text-amber/80 bg-amber/10 px-1.5 py-0.5 rounded">Persistent</span>
                )}
              </div>
              <div className="flex gap-2 mt-2">
                <span className="font-mono text-[8px] text-paper/50 bg-paper/10 px-2 py-0.5 rounded">Open App</span>
                <span className="font-mono text-[8px] text-paper/50 bg-paper/10 px-2 py-0.5 rounded">Dismiss</span>
              </div>
            </div>
          </div>

          {pushTestResult && (
            <div className={`p-3 rounded-lg text-xs flex items-start gap-2 ${
              pushTestResult.startsWith("Error")
                ? "bg-rose-50 border border-rose-200 text-rose-800"
                : "bg-emerald-50 border border-emerald-200 text-emerald-800"
            }`}>
              {pushTestResult.startsWith("Error")
                ? <AlertCircle size={14} className="shrink-0 mt-0.5" />
                : <Check size={14} className="shrink-0 mt-0.5" />}
              {pushTestResult}
            </div>
          )}

          <div className="flex justify-end">
            <button
              type="button"
              onClick={handlePushTest}
              disabled={pushTesting || !pushTestTitle.trim()}
              className="flex items-center gap-2 px-5 py-2.5 bg-amber text-white hover:opacity-90 font-mono text-[10px] uppercase font-bold rounded-lg tracking-wider transition-opacity cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Zap size={14} />
              {pushTesting ? "Sending push…" : "Send test push"}
            </button>
          </div>
        </div>
      </Card>

      {/* History */}
      <div className="bg-paper border border-rule rounded-xl overflow-hidden shadow-sm">
        <div className="p-5 border-b border-rule bg-bg-2/20 flex justify-between items-center flex-wrap gap-2">
          <h3 className="font-serif text-lg font-medium text-ink">Sent history ({history.length})</h3>
          <span className="font-mono text-[9px] text-muted uppercase tracking-wider">Most recent 50 dispatches</span>
        </div>

        {historyLoading ? (
          <div className="py-12 text-center font-mono text-[10px] uppercase tracking-wider text-muted">Loading history…</div>
        ) : history.length === 0 ? (
          <div className="text-center py-16">
            <Bell className="mx-auto text-muted mb-3" size={28} />
            <h3 className="font-serif text-base font-medium text-ink mb-1">No notifications sent yet</h3>
            <p className="text-xs text-muted">Compose one above to get started.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse font-sans text-xs">
              <thead>
                <tr className="border-b border-rule font-mono uppercase tracking-wide text-muted text-[10px] bg-bg-2/30">
                  <th className="py-3.5 px-4 font-semibold w-44">Sent by</th>
                  <th className="py-3.5 px-3 font-semibold w-24 text-center">Type</th>
                  <th className="py-3.5 px-3 font-semibold w-44">To</th>
                  <th className="py-3.5 px-3 font-semibold">Message</th>
                  <th className="py-3.5 px-3 font-semibold w-40 text-right">Sent</th>
                </tr>
              </thead>
              <tbody>
                {history.map((row) => (
                  <tr key={row.id} className="border-b border-rule/50 hover:bg-bg-2/40 transition-colors align-top">
                    <td className="py-3 px-4 font-mono text-[10px] text-muted-2 truncate">
                      <div className="flex items-center gap-1.5">
                        <Mail size={9} className="shrink-0" /> <span className="truncate">{senderLabel(row)}</span>
                      </div>
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span className={`inline-flex items-center gap-1 font-mono text-[9px] px-2 py-0.5 rounded-full border font-bold ${
                        row.type === "group"
                          ? "bg-sky-50 text-sky-700 border-sky-100"
                          : "bg-indigo-50 text-indigo-700 border-indigo-100"
                      }`}>
                        {row.type === "group" ? <Users size={9} /> : <User size={9} />}
                        {row.type}
                      </span>
                    </td>
                    <td className="py-3 px-3 font-sans text-[11px] text-ink">{renderRecipientSummary(row)}</td>
                    <td className="py-3 px-3 font-sans text-[11px] text-muted-2 leading-relaxed max-w-md">
                      <span className="line-clamp-2">{row.message}</span>
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-[10px] text-muted-2 whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        <Clock size={10} className="shrink-0" />
                        {new Date(row.created_at).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
