import {
    Activity,
    AlertCircle,
    Award,
    Ban,
    BookOpen,
    Calendar,
    ChevronLeft,
    ChevronRight,
    Clock,
    GraduationCap,
    Mail,
    RefreshCw,
    Search,
    ShieldCheck,
    ShieldOff,
    Target,
    TrendingUp,
    UserCheck,
    UserX,
    Users,
    X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Card } from "../../components/Atoms";
import { supabase } from "../../lib/supabase";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Profile {
  id: string;
  email: string | null;
  display_name: string | null;
  target_exam: string;
  next_exam: string | null;
  plan: "free" | "trial" | "pro" | "lifetime";
  plan_started_at: string;
  plan_expires_at?: string | null;
  trial_started_at?: string | null;
  trial_used?: boolean;
  streak_count: number;
  last_activity_date: string;
  is_disabled: boolean;
  created_at: string;
}

interface EnrichedUser extends Profile {
  totalQuestionsAnswered: number;
  avgScore: number;
  sessionsCount: number;
  lastActive: string;
  attemptsHistory: any[];
  subjectsPracticed: string[];
  isAdmin: boolean;
  plansGenerated: number;
  avgMastery: number; // 0-100, or -1 when no snapshot data
}

type PlanFilter = "all" | "free" | "trial" | "pro" | "lifetime" | "admin" | "disabled";

// ── Helpers ───────────────────────────────────────────────────────────────────

function getRelativeTime(dateStr: string) {
  if (!dateStr) return "Never";
  const d = new Date(dateStr);
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(mins / 60);
  const days = Math.floor(hours / 24);
  if (isNaN(d.getTime())) return "Unknown";
  if (diff < 60000) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function PlanBadge({ plan }: { plan: string }) {
  const cls =
    plan === "pro"      ? "bg-teal-50 text-teal-700 border-teal-100" :
    plan === "lifetime" ? "bg-indigo-50 text-indigo-700 border-indigo-100" :
    plan === "trial"    ? "bg-amber-50 text-amber-700 border-amber-200" :
                          "bg-bg-1 text-muted border-rule/50";
  return (
    <span className={`inline-block font-mono text-[9px] px-2.5 py-0.5 rounded-full border font-bold uppercase ${cls}`}>
      {plan}
    </span>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function UsersAnalytics() {
  const [loading, setLoading] = useState(true);
  const [errorStatus, setErrorStatus] = useState("");
  const [rawUsers, setRawUsers] = useState<EnrichedUser[]>([]);

  // Filter / sort
  const [searchInput, setSearchInput] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [planFilter, setPlanFilter] = useState<PlanFilter>("all");
  const [sortField, setSortField] = useState<
    "lastActive" | "created_at" | "created_at_asc" | "totalQuestionsAnswered" | "avgScore"
  >("lastActive");

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;

  // Detail drawer
  const [selectedUser, setSelectedUser] = useState<EnrichedUser | null>(null);
  const [planHistory, setPlanHistory] = useState<any[]>([]);
  const [planHistoryLoading, setPlanHistoryLoading] = useState(false);
  const [drawerMastery, setDrawerMastery] = useState<any[]>([]);
  const [drawerMasteryLoading, setDrawerMasteryLoading] = useState(false);
  const [drawerMissions, setDrawerMissions] = useState<{ total: number; completed: number } | null>(null);
  const [drawerMissionsLoading, setDrawerMissionsLoading] = useState(false);

  // Admin action feedback
  const [actionMsg, setActionMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [adminActionLoading, setAdminActionLoading] = useState(false);

  // Plan modal
  const [isPlanModalOpen, setIsPlanModalOpen] = useState(false);
  const [modalUser, setModalUser] = useState<EnrichedUser | null>(null);
  const [modalPlan, setModalPlan] = useState<"free" | "trial" | "pro" | "lifetime">("free");
  const [modalExpiresAt, setModalExpiresAt] = useState("");
  const [isModalSaving, setIsModalSaving] = useState(false);
  const [modalSuccessMsg, setModalSuccessMsg] = useState("");
  const [modalErrorMsg, setModalErrorMsg] = useState("");

  // ── Search debounce ─────────────────────────────────────────────────────────

  useEffect(() => {
    const t = setTimeout(() => { setSearchTerm(searchInput); setCurrentPage(1); }, 250);
    return () => clearTimeout(t);
  }, [searchInput]);

  // ── Fetch ────────────────────────────────────────────────────────────────────

  const fetchData = async () => {
    setLoading(true);
    setErrorStatus("");
    try {
      const [
        { data: profiles, error: pErr },
        { data: attempts },
        { data: adminsRows },
        { data: plansRows },
        { data: snapshotRows },
      ] = await Promise.all([
        supabase.from("profiles").select("*").order("created_at", { ascending: false }),
        supabase.from("attempts").select("user_id,score,total,percentage,mode,topic_id,created_at").order("created_at", { ascending: false }),
        supabase.from("admins").select("email"),
        supabase.from("study_plans").select("user_id"),
        supabase.from("mastery_snapshots").select("user_id,mastery"),
      ]);

      if (pErr) throw pErr;

      // Build lookup maps
      const adminEmailSet = new Set((adminsRows ?? []).map((r: any) => r.email as string));

      const plansCountMap: Record<string, number> = {};
      for (const row of plansRows ?? []) {
        plansCountMap[row.user_id] = (plansCountMap[row.user_id] ?? 0) + 1;
      }

      const masteryMap: Record<string, { sum: number; count: number }> = {};
      for (const row of snapshotRows ?? []) {
        if (!masteryMap[row.user_id]) masteryMap[row.user_id] = { sum: 0, count: 0 };
        masteryMap[row.user_id].sum += row.mastery;
        masteryMap[row.user_id].count += 1;
      }

      const allAttempts = attempts ?? [];

      const enriched: EnrichedUser[] = (profiles ?? []).map((prof: Profile) => {
        const userAttempts = allAttempts.filter((a: any) => a.user_id === prof.id);
        const totalAnswers = userAttempts.reduce((s: number, a: any) => s + (a.total ?? 0), 0);
        const scoreSum = userAttempts.reduce((s: number, a: any) => s + (a.percentage ?? 0), 0);
        const avgScore = userAttempts.length > 0 ? Math.round(scoreSum / userAttempts.length) : 0;

        let lastActive = prof.created_at;
        if (userAttempts.length > 0 && new Date(userAttempts[0].created_at) > new Date(lastActive)) {
          lastActive = userAttempts[0].created_at;
        }

        const subjectsSet = new Set<string>();
        userAttempts.forEach((a: any) => {
          if (a.topic_id) {
            const part = a.topic_id.split("-")[0];
            if (part && part.length < 15) subjectsSet.add(part.toUpperCase());
          }
        });

        const mEntry = masteryMap[prof.id];
        const avgMastery = mEntry && mEntry.count > 0 ? Math.round(mEntry.sum / mEntry.count) : -1;

        return {
          ...prof,
          totalQuestionsAnswered: totalAnswers,
          avgScore,
          sessionsCount: userAttempts.length,
          lastActive,
          attemptsHistory: userAttempts,
          subjectsPracticed: Array.from(subjectsSet),
          isAdmin: adminEmailSet.has(prof.email ?? ""),
          plansGenerated: plansCountMap[prof.id] ?? 0,
          avgMastery,
        };
      });

      setRawUsers(enriched);

      if (selectedUser) {
        const updated = enriched.find((u) => u.id === selectedUser.id);
        if (updated) setSelectedUser(updated);
      }
    } catch (err: any) {
      setErrorStatus(err.message ?? "Failed to load user roster.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Drawer lazy-data ────────────────────────────────────────────────────────

  useEffect(() => {
    if (!selectedUser) {
      setPlanHistory([]);
      setDrawerMastery([]);
      setDrawerMissions(null);
      setActionMsg(null);
      return;
    }
    const uid = selectedUser.id;
    let cancelled = false;

    // plan history
    (async () => {
      setPlanHistoryLoading(true);
      const { data } = await supabase.from("plan_changes").select("*").eq("user_id", uid).order("created_at", { ascending: false }).limit(25);
      if (!cancelled) { setPlanHistory(data ?? []); setPlanHistoryLoading(false); }
    })();

    // mastery snapshots
    (async () => {
      setDrawerMasteryLoading(true);
      const { data } = await supabase.from("mastery_snapshots").select("subject_id,mastery,total_7d,correct_7d,trend").eq("user_id", uid).order("mastery", { ascending: true });
      if (!cancelled) { setDrawerMastery(data ?? []); setDrawerMasteryLoading(false); }
    })();

    // missions
    (async () => {
      setDrawerMissionsLoading(true);
      const { data } = await supabase.from("study_missions").select("status").eq("user_id", uid);
      if (!cancelled) {
        const total = (data ?? []).length;
        const completed = (data ?? []).filter((m: any) => m.status === "completed").length;
        setDrawerMissions({ total, completed });
        setDrawerMissionsLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [selectedUser?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Admin actions ───────────────────────────────────────────────────────────

  const handlePromoteAdmin = async (user: EnrichedUser) => {
    if (!user.email) return;
    setAdminActionLoading(true);
    setActionMsg(null);
    const { error } = await supabase.from("admins").insert({ email: user.email, added_at: new Date().toISOString() });
    setAdminActionLoading(false);
    if (error) {
      setActionMsg({ type: "error", text: error.message });
    } else {
      setActionMsg({ type: "success", text: `${user.email} promoted to admin.` });
      await fetchData();
    }
  };

  const handleDemoteAdmin = async (user: EnrichedUser) => {
    if (!user.email) return;
    if (user.email === "narendray112050@gmail.com") {
      setActionMsg({ type: "error", text: "Primary owner cannot be removed from admin." });
      return;
    }
    if (!window.confirm(`Remove admin access for ${user.email}?`)) return;
    setAdminActionLoading(true);
    setActionMsg(null);
    const { error } = await supabase.from("admins").delete().eq("email", user.email);
    setAdminActionLoading(false);
    if (error) {
      setActionMsg({ type: "error", text: error.message });
    } else {
      setActionMsg({ type: "success", text: `Admin access removed for ${user.email}.` });
      await fetchData();
    }
  };

  const handleToggleDisabled = async (user: EnrichedUser, disable: boolean) => {
    if (user.email === "narendray112050@gmail.com") {
      setActionMsg({ type: "error", text: "Primary owner account cannot be disabled." });
      return;
    }
    if (disable && !window.confirm(`Disable account for ${user.email ?? user.id}? They will not be able to access the app.`)) return;
    setAdminActionLoading(true);
    setActionMsg(null);
    const { error } = await supabase.from("profiles").update({ is_disabled: disable }).eq("id", user.id);
    setAdminActionLoading(false);
    if (error) {
      setActionMsg({ type: "error", text: error.message });
    } else {
      setActionMsg({ type: "success", text: disable ? "Account disabled." : "Account re-enabled." });
      await fetchData();
    }
  };

  // ── Plan modal ──────────────────────────────────────────────────────────────

  const handleModalPlanSelector = (plan: "free" | "trial" | "pro" | "lifetime") => {
    setModalPlan(plan);
    setModalSuccessMsg("");
    setModalErrorMsg("");
    const today = new Date();
    if (plan === "trial") {
      setModalExpiresAt(new Date(today.getTime() + 7 * 86400000).toISOString().split("T")[0]);
    } else if (plan === "pro") {
      setModalExpiresAt(new Date(today.getTime() + 30 * 86400000).toISOString().split("T")[0]);
    } else {
      setModalExpiresAt("");
    }
  };

  const handleSaveModalPlan = async () => {
    if (!modalUser || !modalPlan) return;
    setIsModalSaving(true);
    setModalSuccessMsg("");
    setModalErrorMsg("");
    try {
      const expiresAt = modalExpiresAt ? new Date(modalExpiresAt).toISOString() : null;
      const updateData: any = { plan: modalPlan, plan_expires_at: expiresAt, updated_at: new Date().toISOString() };
      if (modalPlan === "trial") { updateData.trial_started_at = new Date().toISOString(); updateData.trial_used = true; }
      if (modalPlan === "free" || modalPlan === "lifetime") updateData.plan_expires_at = null;

      const { error } = await supabase.from("profiles").update(updateData).eq("id", modalUser.id);
      if (error) throw error;

      try {
        const adminUser = (await supabase.auth.getUser()).data.user;
        await supabase.from("plan_changes").insert({ user_id: modalUser.id, old_plan: modalUser.plan, new_plan: modalPlan, expires_at: expiresAt, changed_by_email: adminUser?.email ?? null, note: "admin manual override" });
      } catch { /* non-fatal audit */ }

      try {
        const isUpgrade = modalPlan === "pro" || modalPlan === "lifetime" || modalPlan === "trial";
        await supabase.from("notifications").insert({ user_id: modalUser.id, title: isUpgrade ? "🎉 Your plan was upgraded" : "Your plan was updated", message: isUpgrade ? `An administrator activated the ${modalPlan.toUpperCase()} plan on your account.` : `Your plan was changed to ${modalPlan.toUpperCase()}.`, type: "system", read: false });
      } catch { /* non-fatal notify */ }

      setModalSuccessMsg(`Plan updated to ${modalPlan}!`);
      await fetchData();
      setTimeout(() => { setIsPlanModalOpen(false); setModalUser(null); setModalSuccessMsg(""); }, 1500);
    } catch (err: any) {
      setModalErrorMsg(err.message ?? "Failed to update plan.");
    } finally {
      setIsModalSaving(false);
    }
  };

  // ── Filter / sort ────────────────────────────────────────────────────────────

  const filteredUsers = rawUsers
    .filter((u) => {
      const q = searchTerm.toLowerCase();
      const matchSearch = (u.email ?? "").toLowerCase().includes(q) || (u.display_name ?? "").toLowerCase().includes(q);
      const matchPlan =
        planFilter === "all"      ? true :
        planFilter === "admin"    ? u.isAdmin :
        planFilter === "disabled" ? u.is_disabled :
        (u.plan ?? "free") === planFilter;
      return matchSearch && matchPlan;
    })
    .sort((a, b) => {
      if (sortField === "lastActive")              return new Date(b.lastActive).getTime() - new Date(a.lastActive).getTime();
      if (sortField === "created_at")              return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      if (sortField === "created_at_asc")          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      if (sortField === "totalQuestionsAnswered")  return b.totalQuestionsAnswered - a.totalQuestionsAnswered;
      if (sortField === "avgScore")                return b.avgScore - a.avgScore;
      return 0;
    });

  const totalItems = filteredUsers.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedUsers = filteredUsers.slice(startIndex, startIndex + itemsPerPage);

  // KPIs
  const totalCount = rawUsers.length;
  const proCount   = rawUsers.filter((u) => u.plan === "pro" || u.plan === "lifetime").length;
  const adminCount = rawUsers.filter((u) => u.isAdmin).length;
  const disabledCount = rawUsers.filter((u) => u.is_disabled).length;

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 max-w-7xl mx-auto py-2">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-rule pb-6">
        <div>
          <div className="font-mono text-[9px] tracking-widest text-muted uppercase mb-1">Administrative deck</div>
          <h1 className="font-serif text-3xl font-medium tracking-tight text-ink leading-none">User Management</h1>
        </div>
        <button
          onClick={fetchData}
          disabled={loading}
          className="flex items-center justify-center gap-1.5 px-4 py-2 border border-rule hover:bg-bg-2 rounded-full font-sans text-xs text-ink transition-colors disabled:opacity-50 cursor-pointer h-10 shrink-0 select-none"
        >
          <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
          <span>Refresh</span>
        </button>
      </div>

      {errorStatus && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/30 text-rose-800 rounded-lg text-xs flex items-center gap-3">
          <AlertCircle size={16} className="shrink-0" />
          <span>{errorStatus}</span>
        </div>
      )}

      {loading ? (
        <div className="h-[300px] flex flex-col items-center justify-center bg-paper border border-rule rounded-xl shadow-sm">
          <div className="w-8 h-8 border-4 border-ink border-t-transparent rounded-full animate-spin mb-4" />
          <p className="font-mono text-xs text-muted tracking-widest uppercase">Loading users...</p>
        </div>
      ) : (
        <>
          {/* KPI cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Card className="p-5 flex items-center gap-4 bg-paper border border-rule shadow-sm">
              <div className="p-3 bg-ink/5 rounded-full text-ink"><Users size={18} /></div>
              <div>
                <div className="font-mono text-[9px] uppercase tracking-wider text-muted">Total Users</div>
                <div className="font-serif text-2xl font-bold text-ink">{totalCount}</div>
              </div>
            </Card>
            <Card className="p-5 flex items-center gap-4 bg-paper border border-rule shadow-sm">
              <div className="p-3 bg-teal-50 text-teal-800 rounded-full"><Award size={18} /></div>
              <div>
                <div className="font-mono text-[9px] uppercase tracking-wider text-muted">Pro / Lifetime</div>
                <div className="font-serif text-2xl font-bold text-teal-800">{proCount}</div>
              </div>
            </Card>
            <Card className="p-5 flex items-center gap-4 bg-paper border border-rule shadow-sm">
              <div className="p-3 bg-purple-50 text-purple-800 rounded-full"><ShieldCheck size={18} /></div>
              <div>
                <div className="font-mono text-[9px] uppercase tracking-wider text-muted">Admins</div>
                <div className="font-serif text-2xl font-bold text-purple-800">{adminCount}</div>
              </div>
            </Card>
            <Card className="p-5 flex items-center gap-4 bg-paper border border-rule shadow-sm">
              <div className="p-3 bg-rose-50 text-rose-800 rounded-full"><Ban size={18} /></div>
              <div>
                <div className="font-mono text-[9px] uppercase tracking-wider text-muted">Disabled</div>
                <div className="font-serif text-2xl font-bold text-rose-800">{disabledCount}</div>
              </div>
            </Card>
          </div>

          {/* Filter bar */}
          <div className="bg-paper border border-rule rounded-xl p-5 shadow-sm">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" size={14} />
                <input
                  type="text"
                  placeholder="Search name or email..."
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  className="w-full bg-panel border border-rule rounded-md text-xs px-10 py-2.5 outline-none focus-visible:ring-2 focus-visible:ring-sky/60"
                />
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[9px] text-muted uppercase">Filter:</span>
                  <select
                    value={planFilter}
                    onChange={(e) => { setPlanFilter(e.target.value as PlanFilter); setCurrentPage(1); }}
                    className="bg-paper border border-rule text-xs px-3 py-1.5 rounded-lg outline-none cursor-pointer focus:ring-1 focus:ring-sky/50"
                  >
                    <option value="all">All Users</option>
                    <option value="free">Free</option>
                    <option value="trial">Trial</option>
                    <option value="pro">Pro</option>
                    <option value="lifetime">Lifetime</option>
                    <option value="admin">Admins only</option>
                    <option value="disabled">Disabled accounts</option>
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[9px] text-muted uppercase">Sort:</span>
                  <select
                    value={sortField}
                    onChange={(e) => { setSortField(e.target.value as any); setCurrentPage(1); }}
                    className="bg-paper border border-rule text-xs px-3 py-1.5 rounded-lg outline-none cursor-pointer focus:ring-1 focus:ring-sky/50"
                  >
                    <option value="lastActive">Last Active</option>
                    <option value="created_at">Newest signup</option>
                    <option value="created_at_asc">Oldest signup</option>
                    <option value="totalQuestionsAnswered">Most questions</option>
                    <option value="avgScore">Highest accuracy</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="bg-paper border border-rule rounded-xl overflow-hidden shadow-sm">
            <div className="p-5 border-b border-rule bg-bg-2/20 flex justify-between items-center flex-wrap gap-2">
              <h3 className="font-serif text-lg font-medium text-ink">Users ({filteredUsers.length})</h3>
              <span className="font-mono text-[9px] text-muted uppercase tracking-wider">Click a row to inspect</span>
            </div>

            {paginatedUsers.length === 0 ? (
              <div className="text-center py-20 bg-paper">
                <Users className="mx-auto text-muted mb-3" size={32} />
                <p className="text-xs text-muted">No users match the current filter.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse font-sans text-xs">
                  <thead>
                    <tr className="border-b border-rule font-mono uppercase tracking-wide text-muted text-[10px] bg-bg-2/30">
                      <th className="py-3.5 px-4 font-semibold">User</th>
                      <th className="py-3.5 px-3 font-semibold text-center w-20">Role</th>
                      <th className="py-3.5 px-3 font-semibold text-center w-24">Plan</th>
                      <th className="py-3.5 px-3 font-semibold text-center w-20">Streak</th>
                      <th className="py-3.5 px-3 font-semibold text-center w-24">Readiness</th>
                      <th className="py-3.5 px-3 font-semibold text-center w-20">Plans</th>
                      <th className="py-3.5 px-3 font-semibold text-center w-20">Quizzes</th>
                      <th className="py-3.5 px-3 font-semibold text-right w-32">Last Active</th>
                      <th className="py-3.5 px-3 font-semibold w-8" />
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedUsers.map((u) => (
                      <tr
                        key={u.id}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSelectedUser(u); } }}
                        onClick={() => setSelectedUser(u)}
                        className={`border-b border-rule/50 hover:bg-bg-2/40 transition-colors cursor-pointer select-none ${selectedUser?.id === u.id ? "bg-bg-2/50" : ""} ${u.is_disabled ? "opacity-60" : ""}`}
                      >
                        {/* User */}
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-ink/5 border border-rule/65 text-ink flex items-center justify-center font-serif text-xs font-bold uppercase shrink-0">
                              {(u.display_name ?? u.email ?? "?").charAt(0)}
                            </div>
                            <div className="min-w-0">
                              <div className="font-sans font-semibold text-ink line-clamp-1 flex items-center gap-1.5">
                                {u.display_name || "—"}
                                {u.is_disabled && (
                                  <span className="font-mono text-[8px] px-1.5 py-0.5 bg-rose-50 text-rose-700 border border-rose-200 rounded uppercase font-bold">Disabled</span>
                                )}
                              </div>
                              <div className="font-mono text-[9px] text-muted-2 flex items-center gap-1 mt-0.5 truncate">
                                <Mail size={8} /> {u.email ?? "—"}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Role */}
                        <td className="py-3 px-3 text-center">
                          {u.isAdmin ? (
                            <span className="inline-flex items-center gap-1 font-mono text-[9px] px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-100 font-bold">
                              <ShieldCheck size={9} /> Admin
                            </span>
                          ) : (
                            <span className="font-mono text-[9px] text-muted-2">User</span>
                          )}
                        </td>

                        {/* Plan */}
                        <td className="py-3 px-3 text-center">
                          <PlanBadge plan={u.plan ?? "free"} />
                        </td>

                        {/* Streak */}
                        <td className="py-3 px-3 text-center">
                          <span className="font-mono text-[10px] text-ink font-semibold">
                            {u.streak_count > 0 ? `🔥 ${u.streak_count}d` : <span className="text-muted-2">—</span>}
                          </span>
                        </td>

                        {/* Readiness (avg mastery) */}
                        <td className="py-3 px-3 text-center">
                          {u.avgMastery >= 0 ? (
                            <span className={`font-mono text-[10px] font-bold px-1.5 py-0.5 rounded ${u.avgMastery >= 65 ? "text-emerald-700 bg-emerald-50" : u.avgMastery >= 40 ? "text-amber-700 bg-amber-50" : "text-rose-700 bg-rose-50"}`}>
                              {u.avgMastery}%
                            </span>
                          ) : (
                            <span className="font-mono text-[9px] text-muted-2">—</span>
                          )}
                        </td>

                        {/* Plans generated */}
                        <td className="py-3 px-3 text-center font-mono text-[10px] text-ink">
                          {u.plansGenerated > 0 ? u.plansGenerated : <span className="text-muted-2">—</span>}
                        </td>

                        {/* Quizzes completed */}
                        <td className="py-3 px-3 text-center font-mono text-[10px] text-ink">
                          {u.sessionsCount > 0 ? u.sessionsCount : <span className="text-muted-2">—</span>}
                        </td>

                        {/* Last active */}
                        <td className="py-3 px-3 text-right font-mono text-[10px] text-muted-2">
                          <div className="flex items-center justify-end gap-1.5">
                            <Clock size={11} className="text-muted shrink-0" />
                            <span>{getRelativeTime(u.lastActive)}</span>
                          </div>
                        </td>

                        <td className="py-3 px-3 text-center text-muted"><ChevronRight size={14} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="p-4 border-t border-rule bg-bg-2/10 flex justify-between items-center text-xs font-mono text-muted">
                <span>Showing {startIndex + 1}–{Math.min(startIndex + itemsPerPage, totalItems)} of {totalItems}</span>
                <div className="flex gap-2">
                  <button onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))} disabled={currentPage === 1} className="p-1 px-3 border border-rule hover:bg-bg-2 rounded-md transition-colors disabled:opacity-50 cursor-pointer flex items-center gap-1">
                    <ChevronLeft size={12} /> Previous
                  </button>
                  <span className="py-1 px-2.5 font-bold text-ink">{currentPage} / {totalPages}</span>
                  <button onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))} disabled={currentPage === totalPages} className="p-1 px-3 border border-rule hover:bg-bg-2 rounded-md transition-colors disabled:opacity-50 cursor-pointer flex items-center gap-1">
                    Next <ChevronRight size={12} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* ── Detail drawer ── */}
      {selectedUser && (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-black/30 backdrop-blur-xs animate-fadeIn"
          onClick={() => setSelectedUser(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg bg-paper border-l border-rule h-screen flex flex-col shadow-2xl animate-slideLeft overflow-hidden"
          >
            {/* Drawer header */}
            <div className="p-6 border-b border-rule bg-bg-2/30 flex justify-between items-start shrink-0">
              <div className="flex gap-4">
                <div className="w-12 h-12 rounded-full bg-ink text-white font-serif font-semibold text-lg flex items-center justify-center shrink-0 uppercase shadow-inner">
                  {(selectedUser.display_name ?? selectedUser.email ?? "?").charAt(0)}
                </div>
                <div className="min-w-0">
                  <h2 className="font-serif text-xl font-medium tracking-tight text-ink leading-tight truncate flex items-center gap-2">
                    {selectedUser.display_name || "Unknown"}
                    {selectedUser.isAdmin && <span className="font-mono text-[9px] px-1.5 py-0.5 bg-purple-50 text-purple-700 border border-purple-200 rounded uppercase font-bold">Admin</span>}
                    {selectedUser.is_disabled && <span className="font-mono text-[9px] px-1.5 py-0.5 bg-rose-50 text-rose-700 border border-rose-200 rounded uppercase font-bold">Disabled</span>}
                  </h2>
                  <div className="font-mono text-[10px] text-muted-2 flex items-center gap-1 mt-0.5 truncate">
                    <Mail size={10} /> {selectedUser.email ?? "—"}
                  </div>
                </div>
              </div>
              <button onClick={() => setSelectedUser(null)} className="p-1.5 hover:bg-bg-2 border border-transparent hover:border-rule rounded-full text-muted hover:text-ink transition-colors cursor-pointer shrink-0">
                <X size={18} />
              </button>
            </div>

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">

              {/* Profile info */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-bg-2/40 border border-rule/75 rounded-lg">
                  <span className="font-mono text-[8.5px] uppercase text-muted tracking-wide block">Plan</span>
                  <div className="mt-1.5"><PlanBadge plan={selectedUser.plan ?? "free"} /></div>
                  {selectedUser.plan_started_at && <p className="font-mono text-[8px] text-muted mt-1">Since {new Date(selectedUser.plan_started_at).toLocaleDateString()}</p>}
                  {selectedUser.plan_expires_at && <p className="font-mono text-[8px] text-rose-600 font-bold mt-0.5">Expires {new Date(selectedUser.plan_expires_at).toLocaleDateString()}</p>}
                </div>
                <div className="p-3 bg-bg-2/40 border border-rule/75 rounded-lg">
                  <span className="font-mono text-[8.5px] uppercase text-muted tracking-wide block">Target Exam</span>
                  <div className="font-sans font-bold text-ink text-[12px] mt-1.5 flex items-center gap-1">
                    <GraduationCap size={12} className="text-muted shrink-0" />
                    {selectedUser.target_exam || "General Study"}
                  </div>
                  {selectedUser.next_exam && <p className="font-mono text-[8px] text-muted mt-1">Goal: {selectedUser.next_exam}</p>}
                </div>
                <div className="p-3 bg-bg-2/40 border border-rule/75 rounded-lg">
                  <span className="font-mono text-[8.5px] uppercase text-muted tracking-wide block">Streak</span>
                  <div className="font-sans font-bold text-ink text-sm mt-1.5">
                    {selectedUser.streak_count > 0 ? `🔥 ${selectedUser.streak_count} days` : <span className="text-muted text-xs">No streak</span>}
                  </div>
                  {selectedUser.last_activity_date && <p className="font-mono text-[8px] text-muted mt-1">Last: {selectedUser.last_activity_date}</p>}
                </div>
                <div className="p-3 bg-bg-2/40 border border-rule/75 rounded-lg">
                  <span className="font-mono text-[8.5px] uppercase text-muted tracking-wide block">Joined</span>
                  <div className="font-sans font-bold text-ink text-sm mt-1.5 flex items-center gap-1">
                    <Calendar size={12} className="text-muted shrink-0" />
                    {new Date(selectedUser.created_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                  </div>
                </div>
              </div>

              {/* Study metrics */}
              <div className="space-y-2">
                <h3 className="font-serif text-sm font-medium text-ink flex items-center gap-1.5">
                  <TrendingUp size={13} className="text-muted" /> Study Metrics
                </h3>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: "Plans",    value: selectedUser.plansGenerated > 0 ? selectedUser.plansGenerated : "—" },
                    { label: "Quizzes",  value: selectedUser.sessionsCount > 0 ? selectedUser.sessionsCount : "—" },
                    { label: "Missions", value: drawerMissionsLoading ? "…" : drawerMissions ? `${drawerMissions.completed}/${drawerMissions.total}` : "—" },
                  ].map(({ label, value }) => (
                    <div key={label} className="p-3 bg-bg-2/40 border border-rule/75 rounded-lg text-center">
                      <div className="font-mono text-[8.5px] uppercase text-muted tracking-wide">{label}</div>
                      <div className="font-serif text-lg font-bold text-ink mt-1">{value}</div>
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  <div className="p-3 bg-bg-2/40 border border-rule/75 rounded-lg text-center">
                    <div className="font-mono text-[8.5px] uppercase text-muted tracking-wide">Questions</div>
                    <div className="font-serif text-lg font-bold text-ink mt-1">{selectedUser.totalQuestionsAnswered.toLocaleString()}</div>
                  </div>
                  <div className="p-3 bg-bg-2/40 border border-rule/75 rounded-lg text-center">
                    <div className="font-mono text-[8.5px] uppercase text-muted tracking-wide">Avg Score</div>
                    <div className={`font-serif text-lg font-bold mt-1 ${selectedUser.avgScore >= 70 ? "text-emerald-700" : "text-rose-700"}`}>{selectedUser.avgScore}%</div>
                  </div>
                </div>
              </div>

              {/* Mastery summary */}
              <div className="space-y-2">
                <h3 className="font-serif text-sm font-medium text-ink flex items-center gap-1.5">
                  <Target size={13} className="text-muted" /> Mastery Summary
                  {selectedUser.avgMastery >= 0 && (
                    <span className={`ml-auto font-mono text-[9px] font-bold px-2 py-0.5 rounded ${selectedUser.avgMastery >= 65 ? "bg-emerald-50 text-emerald-700" : selectedUser.avgMastery >= 40 ? "bg-amber-50 text-amber-700" : "bg-rose-50 text-rose-700"}`}>
                      Avg {selectedUser.avgMastery}%
                    </span>
                  )}
                </h3>
                {drawerMasteryLoading ? (
                  <p className="font-mono text-[9px] uppercase text-muted py-2">Loading…</p>
                ) : drawerMastery.length === 0 ? (
                  <div className="text-center py-5 border border-dashed border-rule rounded-lg">
                    <p className="font-mono text-[9px] uppercase text-muted">No mastery data yet.</p>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {drawerMastery.map((s) => (
                      <div key={s.subject_id} className="flex items-center gap-3 px-3 py-2 bg-bg-2/30 border border-rule/60 rounded-lg">
                        <span className="font-mono text-[9px] text-muted-2 w-28 shrink-0 truncate">{s.subject_id}</span>
                        <div className="flex-1 h-1.5 bg-bg-2 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${s.mastery >= 65 ? "bg-emerald-500" : s.mastery >= 40 ? "bg-amber-500" : "bg-rose-500"}`} style={{ width: `${s.mastery}%` }} />
                        </div>
                        <span className="font-mono text-[9px] text-ink font-semibold w-8 text-right shrink-0">{s.mastery}%</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Admin actions */}
              <div className="bg-bg-2/40 border border-rule rounded-xl p-4 space-y-3">
                <h3 className="font-serif text-sm font-medium text-ink flex items-center gap-1.5 border-b border-rule pb-2">
                  <Activity size={13} className="text-muted" /> Admin Actions
                </h3>

                {actionMsg && (
                  <div className={`p-2.5 rounded-lg text-[11px] font-sans border ${actionMsg.type === "success" ? "bg-emerald-50 border-emerald-200 text-emerald-800" : "bg-rose-50 border-rose-200 text-rose-800"}`}>
                    {actionMsg.text}
                  </div>
                )}

                {/* Manage Plan */}
                <button
                  type="button"
                  onClick={() => { setModalUser(selectedUser); setModalPlan(selectedUser.plan ?? "free"); setModalExpiresAt(selectedUser.plan_expires_at?.split("T")[0] ?? ""); setIsPlanModalOpen(true); }}
                  className="w-full py-2 bg-navy text-bg hover:bg-navy-dark font-mono text-[10px] uppercase font-bold rounded-lg tracking-wider transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Award size={13} /> Manage Plan
                </button>

                {/* Admin role */}
                {selectedUser.isAdmin ? (
                  <button
                    type="button"
                    disabled={adminActionLoading || selectedUser.email === "narendray112050@gmail.com"}
                    onClick={() => handleDemoteAdmin(selectedUser)}
                    className="w-full py-2 bg-bg border border-rule hover:bg-bg-2 font-mono text-[10px] uppercase font-bold rounded-lg tracking-wider transition-colors cursor-pointer flex items-center justify-center gap-1.5 text-muted disabled:opacity-40"
                  >
                    <ShieldOff size={13} /> Remove Admin
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={adminActionLoading}
                    onClick={() => handlePromoteAdmin(selectedUser)}
                    className="w-full py-2 bg-bg border border-rule hover:bg-purple-50 hover:border-purple-200 font-mono text-[10px] uppercase font-bold rounded-lg tracking-wider transition-colors cursor-pointer flex items-center justify-center gap-1.5 text-purple-700 disabled:opacity-40"
                  >
                    <ShieldCheck size={13} /> Promote to Admin
                  </button>
                )}

                {/* Disable / Enable */}
                {selectedUser.is_disabled ? (
                  <button
                    type="button"
                    disabled={adminActionLoading}
                    onClick={() => handleToggleDisabled(selectedUser, false)}
                    className="w-full py-2 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 font-mono text-[10px] uppercase font-bold rounded-lg tracking-wider transition-colors cursor-pointer flex items-center justify-center gap-1.5 text-emerald-700 disabled:opacity-40"
                  >
                    <UserCheck size={13} /> Enable Account
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={adminActionLoading || selectedUser.email === "narendray112050@gmail.com"}
                    onClick={() => handleToggleDisabled(selectedUser, true)}
                    className="w-full py-2 bg-rose-50 border border-rose-200 hover:bg-rose-100 font-mono text-[10px] uppercase font-bold rounded-lg tracking-wider transition-colors cursor-pointer flex items-center justify-center gap-1.5 text-rose-700 disabled:opacity-40"
                  >
                    <UserX size={13} /> Disable Account
                  </button>
                )}

                <p className="font-mono text-[8px] text-muted-2 text-center leading-relaxed">
                  Disable is a soft block enforced by the app. For full auth revocation, use the Supabase Auth dashboard.
                </p>
              </div>

              {/* Plan history */}
              <div className="space-y-2">
                <h3 className="font-serif text-sm font-medium text-ink flex items-center gap-1.5">
                  <Award size={13} className="text-muted" /> Plan History ({planHistory.length})
                </h3>
                {planHistoryLoading ? (
                  <p className="font-mono text-[9px] uppercase text-muted py-2">Loading…</p>
                ) : planHistory.length === 0 ? (
                  <div className="text-center py-5 border border-dashed border-rule rounded-lg">
                    <p className="font-mono text-[9px] uppercase text-muted">No plan changes recorded.</p>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {planHistory.map((h) => (
                      <div key={h.id} className="flex items-start justify-between gap-2 border border-rule/60 rounded-lg px-3 py-2 bg-bg-2/40">
                        <div className="min-w-0">
                          <div className="font-mono text-[10px] text-ink">
                            <span className="text-muted">{(h.old_plan ?? "—").toUpperCase()}</span>{" → "}
                            <span className="font-bold">{(h.new_plan ?? "—").toUpperCase()}</span>
                          </div>
                          {h.note && <div className="font-sans text-[10px] text-muted truncate">{h.note}</div>}
                          {h.changed_by_email && <div className="font-mono text-[8.5px] text-muted-2 truncate">by {h.changed_by_email}</div>}
                          {h.expires_at && <div className="font-mono text-[8.5px] text-rose-600">expires {new Date(h.expires_at).toLocaleDateString()}</div>}
                        </div>
                        <span className="shrink-0 font-mono text-[8.5px] text-muted-2">{new Date(h.created_at).toLocaleDateString()}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Activity summary */}
              <div className="space-y-2">
                <h3 className="font-serif text-sm font-medium text-ink flex items-center gap-1.5">
                  <Clock size={13} className="text-muted" /> Quiz Attempts ({selectedUser.attemptsHistory.length})
                </h3>
                {selectedUser.attemptsHistory.length === 0 ? (
                  <div className="text-center py-6 border border-dashed border-rule rounded-lg">
                    <p className="font-mono text-[9px] uppercase text-muted">No quiz attempts yet.</p>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {selectedUser.attemptsHistory.slice(0, 20).map((a) => {
                      const pass = a.percentage >= 70;
                      return (
                        <div key={a.id ?? a.created_at} className="p-3 bg-bg-2/30 border border-rule/55 rounded-lg flex justify-between items-center">
                          <div>
                            <span className="font-semibold text-xs text-ink capitalize">{a.mode || "Practice"}</span>
                            <span className="font-mono text-[9px] text-muted-2 block mt-0.5">
                              {new Date(a.created_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 text-right">
                            <div className="font-mono text-[11px] text-ink">{a.score}/{a.total}</div>
                            <span className={`font-mono text-[9px] font-bold rounded px-1.5 py-0.5 ${pass ? "bg-emerald-50 text-emerald-800" : "bg-rose-50 text-rose-800"}`}>
                              {a.percentage}% · {pass ? "PASS" : "FAIL"}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                    {selectedUser.attemptsHistory.length > 20 && (
                      <p className="font-mono text-[9px] text-center text-muted-2 pt-1">+{selectedUser.attemptsHistory.length - 20} more</p>
                    )}
                  </div>
                )}
              </div>

              {/* Subjects practiced */}
              {selectedUser.subjectsPracticed.length > 0 && (
                <div className="space-y-2">
                  <h3 className="font-serif text-sm font-medium text-ink flex items-center gap-1.5">
                    <BookOpen size={13} className="text-muted" /> Subjects Practiced
                  </h3>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedUser.subjectsPracticed.map((s, i) => (
                      <span key={i} className="font-mono text-[9px] border border-rule bg-bg-2 text-ink rounded-lg px-2.5 py-0.5 tracking-wide">{s}</span>
                    ))}
                  </div>
                </div>
              )}

            </div>

            {/* Footer */}
            <div className="p-4 border-t border-rule bg-bg-2/20 flex gap-2 justify-end shrink-0">
              <button onClick={() => setSelectedUser(null)} className="px-4 py-2 bg-ink text-white font-mono text-[10px] uppercase font-bold rounded-lg hover:bg-ink-2 tracking-wide transition-colors cursor-pointer">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Plan modal ── */}
      {isPlanModalOpen && modalUser && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-[2px] z-50 flex items-center justify-center p-4">
          <div className="bg-paper rounded-2xl max-w-sm w-full border border-rule overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="p-5 border-b border-rule bg-bg-2/30 flex items-center justify-between">
              <div>
                <h2 className="font-serif text-base font-bold text-ink">Manage User Plan</h2>
                <p className="font-mono text-[9px] text-muted-2 uppercase tracking-wider mt-0.5">Admin Override</p>
              </div>
              <button onClick={() => { setIsPlanModalOpen(false); setModalUser(null); }} className="w-7 h-7 rounded-full bg-bg-1 border border-rule/60 flex items-center justify-center hover:bg-bg-2 text-muted hover:text-ink transition-colors cursor-pointer">
                <X size={14} />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="bg-panel/50 border border-rule rounded-xl p-3.5 space-y-1">
                <div className="font-sans font-bold text-sm text-ink">{modalUser.display_name || "User"}</div>
                <div className="font-mono text-[10px] text-muted flex items-center gap-1"><Mail size={10} />{modalUser.email ?? "—"}</div>
                <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-rule/40 font-mono text-[10px]">
                  <span className="text-muted">Current:</span>
                  <span className="text-amber-600 font-bold uppercase">{modalUser.plan ?? "free"}</span>
                </div>
              </div>
              {modalSuccessMsg && <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs">{modalSuccessMsg}</div>}
              {modalErrorMsg && <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs">{modalErrorMsg}</div>}
              <div>
                <label className="block font-mono text-[9px] uppercase tracking-wider text-muted-2 mb-1.5 font-bold">Plan Tier</label>
                <select value={modalPlan} onChange={(e) => handleModalPlanSelector(e.target.value as any)} className="w-full bg-paper border border-rule text-xs p-2.5 rounded-xl outline-none cursor-pointer focus:ring-1 focus:ring-navy/30">
                  <option value="free">Free</option>
                  <option value="trial">Trial (7 Days)</option>
                  <option value="pro">Pro (Captain)</option>
                  <option value="lifetime">Lifetime</option>
                </select>
              </div>
              {(modalPlan === "pro" || modalPlan === "trial") && (
                <div>
                  <label className="block font-mono text-[9px] uppercase tracking-wider text-muted-2 mb-1.5 font-bold">Expiration Date</label>
                  <input type="date" value={modalExpiresAt} onChange={(e) => setModalExpiresAt(e.target.value)} className="w-full bg-paper border border-rule text-xs p-2.5 rounded-xl outline-none focus:ring-1 focus:ring-navy/30" />
                </div>
              )}
            </div>
            <div className="p-4 border-t border-rule bg-bg-2/30 flex gap-2 justify-end">
              <button type="button" onClick={() => { setIsPlanModalOpen(false); setModalUser(null); }} disabled={isModalSaving} className="px-4 py-2 bg-neutral-100 text-muted hover:bg-neutral-200 font-mono text-[10px] uppercase font-bold rounded-lg tracking-wide cursor-pointer transition-colors">Cancel</button>
              <button type="button" onClick={handleSaveModalPlan} disabled={isModalSaving} className="px-4 py-2 bg-navy text-white hover:bg-navy-dark font-mono text-[10px] uppercase font-bold rounded-lg tracking-wide cursor-pointer transition-colors disabled:opacity-50 flex items-center gap-1.5">
                {isModalSaving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
