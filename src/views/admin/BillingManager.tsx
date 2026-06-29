import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Award,
  Ban,
  CheckCircle2,
  CreditCard,
  Gift,
  IndianRupee,
  Plus,
  RefreshCw,
  Search,
  Tag,
  TrendingUp,
  Users,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { AdminBreadcrumb } from "../../components/AdminBreadcrumb";
import { useToast } from "../../components/ui/Toast";
import { supabase } from "../../lib/supabase";

// ── Helpers ───────────────────────────────────────────────────────────────────

const inr = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;
const paise2inr = (p: number) => p / 100;

function isoDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function shortDate(iso: string) {
  return new Date(iso + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function shortMonth(iso: string) {
  const [y, m] = iso.split("-");
  return new Date(Number(y), Number(m) - 1).toLocaleDateString("en-GB", { month: "short", year: "2-digit" });
}

function daysAgoISO(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

// Plan badge
function PlanBadge({ plan }: { plan: string }) {
  const cls =
    plan === "pro"      ? "bg-teal-50 text-teal-700 border-teal-100" :
    plan === "lifetime" ? "bg-indigo-50 text-indigo-700 border-indigo-100" :
    plan === "trial"    ? "bg-amber-50 text-amber-700 border-amber-200" :
                          "bg-bg-1 text-muted border-rule/50";
  return <span className={`inline-block font-mono text-[9px] px-2.5 py-0.5 rounded-full border font-bold uppercase ${cls}`}>{plan}</span>;
}

// Audit + notify helpers (same pattern as UsersAnalytics)
async function applyPlanChange(
  userId: string,
  oldPlan: string,
  newPlan: string,
  expiresAt: string | null,
  note: string
) {
  const { error } = await supabase
    .from("profiles")
    .update({ plan: newPlan, plan_expires_at: expiresAt, updated_at: new Date().toISOString() })
    .eq("id", userId);
  if (error) throw error;

  try {
    const adminUser = (await supabase.auth.getUser()).data.user;
    await supabase.from("plan_changes").insert({
      user_id: userId,
      old_plan: oldPlan,
      new_plan: newPlan,
      expires_at: expiresAt,
      changed_by_email: adminUser?.email ?? null,
      note,
    });
  } catch { /* non-fatal audit */ }

  try {
    const isUpgrade = newPlan === "pro" || newPlan === "lifetime" || newPlan === "trial";
    await supabase.from("notifications").insert({
      user_id: userId,
      title: isUpgrade ? "Your plan was upgraded" : "Your plan was updated",
      message: `Your plan was changed to ${newPlan.toUpperCase()} by an admin.`,
      type: "system",
      read: false,
    });
  } catch { /* non-fatal notify */ }
}

// ── Tab types ─────────────────────────────────────────────────────────────────

type Tab = "overview" | "subscriptions" | "payments" | "revenue" | "coupons";

// ── Overview ─────────────────────────────────────────────────────────────────

interface OverviewData {
  free: number;
  pro: number;
  lifetime: number;
  trial: number;
  expiredTrial: number;
  totalPayments: number; // paise
  mrr: number;           // INR
  arr: number;           // INR
  purchaseCount: number;
}

async function fetchOverview(): Promise<OverviewData> {
  const [{ data: profiles }, { data: payments }] = await Promise.all([
    supabase.from("profiles").select("plan,trial_used,plan_expires_at").limit(10000),
    supabase.from("payments").select("amount,status").eq("status", "captured").limit(10000),
  ]);

  const now = new Date();
  let free = 0, pro = 0, lifetime = 0, trial = 0, expiredTrial = 0;
  for (const p of profiles ?? []) {
    if (p.plan === "free") free++;
    else if (p.plan === "pro") pro++;
    else if (p.plan === "lifetime") lifetime++;
    else if (p.plan === "trial") {
      if (p.plan_expires_at && new Date(p.plan_expires_at) < now) expiredTrial++;
      else trial++;
    }
    if (p.trial_used && p.plan === "free") expiredTrial++;
  }

  const totalPayments = (payments ?? []).reduce((s, p) => s + (p.amount ?? 0), 0);
  const purchaseCount = (payments ?? []).length;
  const mrr = (pro + trial) * 499; // approximate: active paid users × monthly price
  const arr = mrr * 12;

  return { free, pro, lifetime, trial, expiredTrial, totalPayments, mrr, arr, purchaseCount };
}

// ── Payments ─────────────────────────────────────────────────────────────────

interface PaymentRow {
  id: number;
  user_id: string | null;
  razorpay_payment_id: string;
  razorpay_order_id: string | null;
  amount: number;
  currency: string;
  status: string;
  interval: string | null;
  source: string;
  created_at: string;
  display_name?: string;
  email?: string;
}

async function fetchPayments(): Promise<PaymentRow[]> {
  const { data: pays } = await supabase
    .from("payments")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);

  if (!pays || pays.length === 0) return [];

  const userIds = [...new Set(pays.map((p: any) => p.user_id).filter(Boolean))];
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id,display_name,email")
    .in("id", userIds);

  const profileMap: Record<string, { display_name: string | null; email: string | null }> = {};
  for (const p of profiles ?? []) profileMap[p.id] = p;

  return (pays as any[]).map((p) => ({
    ...p,
    display_name: profileMap[p.user_id]?.display_name ?? null,
    email: profileMap[p.user_id]?.email ?? null,
  }));
}

// ── Revenue charts ────────────────────────────────────────────────────────────

interface RevenueChartData {
  daily: { day: string; Revenue: number }[];
  monthly: { month: string; Revenue: number }[];
  planDist: { plan: string; count: number }[];
  trialConvRate: number; // 0-100
}

async function fetchRevenueData(): Promise<RevenueChartData> {
  const start30 = daysAgoISO(30);
  const [{ data: pays }, { data: profiles }] = await Promise.all([
    supabase.from("payments").select("amount,created_at").eq("status", "captured").gte("created_at", start30).limit(5000),
    supabase.from("profiles").select("plan,trial_used").limit(10000),
  ]);

  // Daily revenue
  const dayMap: Record<string, number> = {};
  for (const p of pays ?? []) {
    const d = (p.created_at as string).slice(0, 10);
    dayMap[d] = (dayMap[d] ?? 0) + paise2inr(p.amount ?? 0);
  }
  const daySlots: string[] = [];
  const cur = new Date(start30);
  const end = new Date();
  while (isoDateStr(cur) <= isoDateStr(end)) {
    daySlots.push(isoDateStr(cur));
    cur.setDate(cur.getDate() + 1);
  }
  const daily = daySlots.map((d) => ({ day: shortDate(d), Revenue: Math.round(dayMap[d] ?? 0) }));

  // Monthly revenue (all time)
  const { data: allPays } = await supabase
    .from("payments")
    .select("amount,created_at")
    .eq("status", "captured")
    .limit(5000);
  const monthMap: Record<string, number> = {};
  for (const p of allPays ?? []) {
    const m = (p.created_at as string).slice(0, 7);
    monthMap[m] = (monthMap[m] ?? 0) + paise2inr(p.amount ?? 0);
  }
  const monthly = Object.entries(monthMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-12)
    .map(([m, v]) => ({ month: shortMonth(m), Revenue: Math.round(v) }));

  // Plan distribution
  const planCount: Record<string, number> = {};
  for (const p of profiles ?? []) {
    const k = p.plan ?? "free";
    planCount[k] = (planCount[k] ?? 0) + 1;
  }
  const planDist = Object.entries(planCount).map(([plan, count]) => ({ plan, count }));

  // Trial conversion rate
  const trialists = (profiles ?? []).filter((p) => p.trial_used).length;
  const converted = (profiles ?? []).filter((p) => p.trial_used && (p.plan === "pro" || p.plan === "lifetime")).length;
  const trialConvRate = trialists > 0 ? Math.round((converted / trialists) * 100) : 0;

  return { daily, monthly, planDist, trialConvRate };
}

// ── Coupons ───────────────────────────────────────────────────────────────────

interface Coupon {
  id: number;
  code: string;
  discount_type: "percentage" | "fixed";
  discount_value: number;
  expires_at: string | null;
  usage_limit: number | null;
  usage_count: number;
  is_active: boolean;
  created_by_email: string | null;
  note: string | null;
  created_at: string;
}

// ── Sub management ────────────────────────────────────────────────────────────

interface SubUser {
  id: string;
  email: string | null;
  display_name: string | null;
  plan: string;
  plan_expires_at: string | null;
  trial_used: boolean | null;
}

// ── Component ─────────────────────────────────────────────────────────────────

const PLAN_COLORS: Record<string, string> = {
  free: "#9ca3af", trial: "#E5A93C", pro: "#0d9488", lifetime: "#6366f1",
};

export default function BillingManager() {
  const [tab, setTab] = useState<Tab>("overview");
  const { showToast } = useToast();

  // ── Overview ──────────────────────────────────────────────────────────────
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(false);

  const loadOverview = async () => {
    setOverviewLoading(true);
    try { setOverview(await fetchOverview()); } catch (e: any) { showToast({ type: "error", title: "Overview failed", message: e.message }); }
    setOverviewLoading(false);
  };

  // ── Payments ──────────────────────────────────────────────────────────────
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [paymentsLoading, setPaymentsLoading] = useState(false);

  const loadPayments = async () => {
    setPaymentsLoading(true);
    try { setPayments(await fetchPayments()); } catch (e: any) { showToast({ type: "error", title: "Payments failed", message: e.message }); }
    setPaymentsLoading(false);
  };

  // ── Revenue ───────────────────────────────────────────────────────────────
  const [revenue, setRevenue] = useState<RevenueChartData | null>(null);
  const [revenueLoading, setRevenueLoading] = useState(false);

  const loadRevenue = async () => {
    setRevenueLoading(true);
    try { setRevenue(await fetchRevenueData()); } catch (e: any) { showToast({ type: "error", title: "Revenue failed", message: e.message }); }
    setRevenueLoading(false);
  };

  // ── Coupons ───────────────────────────────────────────────────────────────
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [couponsLoading, setCouponsLoading] = useState(false);
  const [couponForm, setCouponForm] = useState({
    code: "", discount_type: "percentage" as "percentage" | "fixed",
    discount_value: "", expires_at: "", usage_limit: "", note: "",
  });
  const [couponSaving, setCouponSaving] = useState(false);

  const loadCoupons = async () => {
    setCouponsLoading(true);
    const { data } = await supabase.from("coupons").select("*").order("created_at", { ascending: false });
    setCoupons((data ?? []) as Coupon[]);
    setCouponsLoading(false);
  };

  const handleCreateCoupon = async () => {
    if (!couponForm.code.trim() || !couponForm.discount_value) {
      showToast({ type: "error", title: "Missing fields", message: "Code and discount value are required." });
      return;
    }
    setCouponSaving(true);
    const adminUser = (await supabase.auth.getUser()).data.user;
    const { error } = await supabase.from("coupons").insert({
      code: couponForm.code.trim().toUpperCase(),
      discount_type: couponForm.discount_type,
      discount_value: Number(couponForm.discount_value),
      expires_at: couponForm.expires_at || null,
      usage_limit: couponForm.usage_limit ? Number(couponForm.usage_limit) : null,
      note: couponForm.note || null,
      created_by_email: adminUser?.email ?? null,
    });
    setCouponSaving(false);
    if (error) {
      showToast({ type: "error", title: "Create failed", message: error.message });
    } else {
      showToast({ type: "success", title: "Coupon created", message: "Coupon is now active." });
      setCouponForm({ code: "", discount_type: "percentage", discount_value: "", expires_at: "", usage_limit: "", note: "" });
      loadCoupons();
    }
  };

  const toggleCoupon = async (id: number, is_active: boolean) => {
    await supabase.from("coupons").update({ is_active: !is_active }).eq("id", id);
    loadCoupons();
  };

  // ── Subscriptions ─────────────────────────────────────────────────────────
  const [subSearch, setSubSearch] = useState("");
  const [subResults, setSubResults] = useState<SubUser[]>([]);
  const [subSearching, setSubSearching] = useState(false);
  const [subActionUser, setSubActionUser] = useState<SubUser | null>(null);
  const [subActionLoading, setSubActionLoading] = useState(false);
  const [subActionMsg, setSubActionMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const searchSubs = async () => {
    if (!subSearch.trim()) return;
    setSubSearching(true);
    const q = subSearch.trim().toLowerCase();
    const { data } = await supabase
      .from("profiles")
      .select("id,email,display_name,plan,plan_expires_at,trial_used")
      .or(`email.ilike.%${q}%,display_name.ilike.%${q}%`)
      .limit(10);
    setSubResults((data ?? []) as SubUser[]);
    setSubSearching(false);
  };

  const doSubAction = async (user: SubUser, action: string) => {
    setSubActionLoading(true);
    setSubActionMsg(null);
    const now = new Date();
    try {
      let newPlan = user.plan;
      let expiresAt: string | null = null;
      let note = "";

      if (action === "upgrade") {
        newPlan = "pro";
        expiresAt = new Date(now.getTime() + 30 * 86400000).toISOString();
        note = "admin: upgraded to pro (30d)";
      } else if (action === "downgrade") {
        newPlan = "free";
        expiresAt = null;
        note = "admin: downgraded to free";
      } else if (action === "grant_trial") {
        newPlan = "trial";
        expiresAt = new Date(now.getTime() + 7 * 86400000).toISOString();
        note = "admin: granted trial (7d)";
        await supabase.from("profiles").update({ trial_started_at: now.toISOString(), trial_used: true }).eq("id", user.id);
      } else if (action === "extend_trial") {
        newPlan = "trial";
        const currentExpiry = user.plan_expires_at ? new Date(user.plan_expires_at) : now;
        expiresAt = new Date(Math.max(currentExpiry.getTime(), now.getTime()) + 7 * 86400000).toISOString();
        note = "admin: trial extended (+7d)";
      } else if (action === "cancel") {
        newPlan = "free";
        expiresAt = null;
        note = "admin: subscription cancelled";
      } else if (action === "reactivate") {
        newPlan = "pro";
        expiresAt = new Date(now.getTime() + 30 * 86400000).toISOString();
        note = "admin: subscription reactivated";
      }

      await applyPlanChange(user.id, user.plan, newPlan, expiresAt, note);
      setSubActionMsg({ type: "success", text: `Done. Plan → ${newPlan.toUpperCase()}` });
      // Refresh the found user inline
      const { data: updated } = await supabase.from("profiles").select("id,email,display_name,plan,plan_expires_at,trial_used").eq("id", user.id).single();
      if (updated) {
        setSubActionUser(updated as SubUser);
        setSubResults((prev) => prev.map((u) => u.id === user.id ? updated as SubUser : u));
      }
    } catch (e: any) {
      setSubActionMsg({ type: "error", text: e.message });
    } finally {
      setSubActionLoading(false);
    }
  };

  // ── Tab-driven loads ──────────────────────────────────────────────────────
  useEffect(() => {
    if (tab === "overview" && !overview) loadOverview();
    if (tab === "payments" && payments.length === 0) loadPayments();
    if (tab === "revenue" && !revenue) loadRevenue();
    if (tab === "coupons" && coupons.length === 0) loadCoupons();
  }, [tab]); // eslint-disable-line react-hooks/exhaustive-deps

  const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "overview",       label: "Overview",       icon: <TrendingUp size={14} /> },
    { id: "subscriptions",  label: "Subscriptions",  icon: <Users size={14} /> },
    { id: "payments",       label: "Payments",       icon: <CreditCard size={14} /> },
    { id: "revenue",        label: "Revenue",        icon: <IndianRupee size={14} /> },
    { id: "coupons",        label: "Coupons",        icon: <Tag size={14} /> },
  ];

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 max-w-7xl mx-auto py-2">

      <AdminBreadcrumb crumbs={[{ label: "Billing" }]} />

      {/* Header */}
      <div className="border-b border-rule pb-6">
        <div className="font-mono text-[9px] tracking-widest text-muted uppercase mb-1">Administrative deck</div>
        <h1 className="font-serif text-3xl font-medium tracking-tight text-ink">Billing & Subscriptions</h1>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-bg-2 border border-rule rounded-xl p-1 w-fit overflow-x-auto">
        {TABS.map(({ id, label, icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg font-mono text-[10px] uppercase tracking-wider font-bold transition-colors cursor-pointer whitespace-nowrap ${
              tab === id ? "bg-ink text-paper shadow-sm" : "text-muted hover:text-ink hover:bg-bg-2/60"
            }`}
          >
            {icon} {label}
          </button>
        ))}
      </div>

      {/* ══ OVERVIEW ══════════════════════════════════════════════════════════ */}
      {tab === "overview" && (
        <div className="space-y-6">
          <div className="flex justify-end">
            <button onClick={loadOverview} disabled={overviewLoading} className="flex items-center gap-1.5 px-4 py-2 border border-rule hover:bg-bg-2 rounded-full font-sans text-xs text-ink transition-colors disabled:opacity-50 cursor-pointer">
              <RefreshCw size={12} className={overviewLoading ? "animate-spin" : ""} /> Refresh
            </button>
          </div>

          {overviewLoading && !overview ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">{Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-24 bg-bg-2 rounded-xl animate-pulse" />)}</div>
          ) : overview ? (
            <>
              {/* User breakdown */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
                {[
                  { label: "Free",           value: overview.free,          icon: <Users size={16} />,    bg: "bg-ink/5 text-ink" },
                  { label: "Captain (Pro)",  value: overview.pro,           icon: <Award size={16} />,    bg: "bg-teal-50 text-teal-800" },
                  { label: "Lifetime",       value: overview.lifetime,      icon: <Gift size={16} />,     bg: "bg-indigo-50 text-indigo-800" },
                  { label: "Active Trial",   value: overview.trial,         icon: <CheckCircle2 size={16} />, bg: "bg-amber-50 text-amber-800" },
                  { label: "Expired Trial",  value: overview.expiredTrial,  icon: <Ban size={16} />,      bg: "bg-rose-50 text-rose-800" },
                ].map(({ label, value, icon, bg }) => (
                  <div key={label} className="bg-paper border border-rule rounded-xl p-5 flex items-center gap-3 shadow-sm">
                    <div className={`p-2.5 rounded-full shrink-0 ${bg}`}>{icon}</div>
                    <div>
                      <div className="font-mono text-[9px] uppercase tracking-wider text-muted">{label}</div>
                      <div className="font-serif text-2xl font-bold text-ink">{value.toLocaleString()}</div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Revenue KPIs */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[
                  { label: "MRR",          value: inr(overview.mrr),                         sub: `${overview.pro + overview.trial} active × ₹499` },
                  { label: "ARR",          value: inr(overview.arr),                         sub: "MRR × 12" },
                  { label: "Total Collected", value: inr(paise2inr(overview.totalPayments)), sub: `${overview.purchaseCount} transactions` },
                  { label: "Avg per Sale", value: overview.purchaseCount > 0 ? inr(paise2inr(overview.totalPayments) / overview.purchaseCount) : "—", sub: "all-time average" },
                ].map(({ label, value, sub }) => (
                  <div key={label} className="bg-paper border border-rule rounded-xl p-5 shadow-sm">
                    <div className="font-mono text-[9px] uppercase tracking-wider text-muted">{label}</div>
                    <div className="font-serif text-2xl font-bold text-ink mt-1">{value}</div>
                    <div className="font-mono text-[9px] text-muted-2 mt-1">{sub}</div>
                  </div>
                ))}
              </div>
            </>
          ) : null}
        </div>
      )}

      {/* ══ SUBSCRIPTIONS ════════════════════════════════════════════════════ */}
      {tab === "subscriptions" && (
        <div className="space-y-6">
          {/* Search */}
          <div className="bg-paper border border-rule rounded-xl p-6 shadow-sm space-y-4">
            <h2 className="font-serif text-lg font-medium text-ink">Find User</h2>
            <div className="flex gap-3">
              <div className="relative flex-1">
                <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
                <input
                  type="text"
                  placeholder="Email or display name..."
                  value={subSearch}
                  onChange={(e) => setSubSearch(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && searchSubs()}
                  className="w-full bg-bg border border-rule rounded-lg text-xs px-10 py-2.5 outline-none focus:border-ink"
                />
              </div>
              <button
                onClick={searchSubs}
                disabled={subSearching}
                className="px-4 py-2 bg-ink text-paper font-mono text-[10px] uppercase font-bold rounded-lg hover:bg-ink-2 transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
              >
                {subSearching ? <RefreshCw size={12} className="animate-spin" /> : <Search size={12} />} Search
              </button>
            </div>

            {subResults.length > 0 && (
              <div className="space-y-2">
                {subResults.map((u) => (
                  <div
                    key={u.id}
                    onClick={() => { setSubActionUser(u); setSubActionMsg(null); }}
                    className={`flex items-center justify-between gap-4 p-3 rounded-lg border cursor-pointer transition-colors ${subActionUser?.id === u.id ? "border-ink bg-bg-2" : "border-rule hover:bg-bg-2/40"}`}
                  >
                    <div>
                      <div className="font-sans font-semibold text-sm text-ink">{u.display_name || "—"}</div>
                      <div className="font-mono text-[9px] text-muted-2">{u.email}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <PlanBadge plan={u.plan ?? "free"} />
                      {u.plan_expires_at && (
                        <span className="font-mono text-[8px] text-muted-2">
                          exp {new Date(u.plan_expires_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Action panel */}
          {subActionUser && (
            <div className="bg-paper border border-rule rounded-xl p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-serif text-lg font-medium text-ink">{subActionUser.display_name || subActionUser.email}</h2>
                  <div className="flex items-center gap-2 mt-1">
                    <PlanBadge plan={subActionUser.plan ?? "free"} />
                    {subActionUser.plan_expires_at && (
                      <span className="font-mono text-[9px] text-muted-2">
                        expires {new Date(subActionUser.plan_expires_at).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>
                <button onClick={() => { setSubActionUser(null); setSubActionMsg(null); }} className="p-1.5 hover:bg-bg-2 rounded-full text-muted cursor-pointer">
                  <X size={16} />
                </button>
              </div>

              {subActionMsg && (
                <div className={`p-3 rounded-lg text-xs border ${subActionMsg.type === "success" ? "bg-emerald-50 border-emerald-200 text-emerald-800" : "bg-rose-50 border-rose-200 text-rose-800"}`}>
                  {subActionMsg.text}
                </div>
              )}

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {[
                  { action: "upgrade",     label: "Upgrade to Pro",   cls: "bg-teal-600 hover:bg-teal-700 text-white" },
                  { action: "grant_trial", label: "Grant Trial (7d)", cls: "bg-amber-500 hover:bg-amber-600 text-white" },
                  { action: "extend_trial",label: "Extend Trial +7d", cls: "bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300" },
                  { action: "reactivate",  label: "Reactivate",       cls: "bg-indigo-600 hover:bg-indigo-700 text-white" },
                  { action: "downgrade",   label: "Downgrade to Free",cls: "bg-bg border border-rule text-muted hover:bg-bg-2" },
                  { action: "cancel",      label: "Cancel Sub",       cls: "bg-rose-50 border border-rose-200 text-rose-700 hover:bg-rose-100" },
                ].map(({ action, label, cls }) => (
                  <button
                    key={action}
                    disabled={subActionLoading}
                    onClick={() => doSubAction(subActionUser, action)}
                    className={`py-2.5 px-3 font-mono text-[10px] uppercase font-bold rounded-lg tracking-wider transition-colors cursor-pointer disabled:opacity-40 ${cls}`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <p className="font-mono text-[8px] text-muted-2">All actions write to plan_changes audit log and notify the user.</p>
            </div>
          )}
        </div>
      )}

      {/* ══ PAYMENTS ══════════════════════════════════════════════════════════ */}
      {tab === "payments" && (
        <div className="bg-paper border border-rule rounded-xl overflow-hidden shadow-sm">
          <div className="p-5 border-b border-rule bg-bg-2/20 flex justify-between items-center">
            <h2 className="font-serif text-lg font-medium text-ink">Payment History ({payments.length})</h2>
            <button onClick={loadPayments} disabled={paymentsLoading} className="flex items-center gap-1.5 px-3 py-1.5 border border-rule hover:bg-bg-2 rounded-full font-mono text-[9px] text-ink transition-colors disabled:opacity-50 cursor-pointer uppercase">
              <RefreshCw size={11} className={paymentsLoading ? "animate-spin" : ""} /> Refresh
            </button>
          </div>

          {paymentsLoading ? (
            <div className="p-8 text-center"><div className="w-8 h-8 border-4 border-ink border-t-transparent rounded-full animate-spin mx-auto" /></div>
          ) : payments.length === 0 ? (
            <div className="p-16 text-center">
              <CreditCard className="mx-auto text-muted mb-3" size={28} />
              <p className="font-mono text-[9px] uppercase text-muted">No payments recorded yet.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs font-sans">
                <thead>
                  <tr className="border-b border-rule font-mono uppercase tracking-wide text-muted text-[10px] bg-bg-2/30">
                    <th className="py-3 px-4 font-semibold">User</th>
                    <th className="py-3 px-3 font-semibold text-center w-24">Plan</th>
                    <th className="py-3 px-3 font-semibold text-right w-24">Amount</th>
                    <th className="py-3 px-3 font-semibold text-center w-20">Status</th>
                    <th className="py-3 px-3 font-semibold text-center w-20">Provider</th>
                    <th className="py-3 px-3 font-semibold text-right w-32">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((p) => (
                    <tr key={p.id} className="border-b border-rule/50 hover:bg-bg-2/30 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-semibold text-ink truncate max-w-[180px]">{p.display_name || "—"}</div>
                        <div className="font-mono text-[9px] text-muted-2 truncate max-w-[180px]">{p.email || p.user_id?.slice(0, 8) + "…"}</div>
                      </td>
                      <td className="py-3 px-3 text-center">
                        {p.interval ? <PlanBadge plan={p.interval === "yearly" ? "lifetime" : "pro"} /> : <span className="text-muted-2 font-mono text-[9px]">—</span>}
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-bold text-ink text-[11px]">
                        {inr(paise2inr(p.amount))}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span className={`font-mono text-[8px] font-bold px-2 py-0.5 rounded-full border uppercase ${p.status === "captured" ? "bg-emerald-50 text-emerald-700 border-emerald-100" : "bg-rose-50 text-rose-700 border-rose-100"}`}>
                          {p.status}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center font-mono text-[9px] text-muted-2">Razorpay</td>
                      <td className="py-3 px-3 text-right font-mono text-[9px] text-muted-2">
                        {new Date(p.created_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ══ REVENUE ═══════════════════════════════════════════════════════════ */}
      {tab === "revenue" && (
        <div className="space-y-6">
          <div className="flex justify-end">
            <button onClick={loadRevenue} disabled={revenueLoading} className="flex items-center gap-1.5 px-4 py-2 border border-rule hover:bg-bg-2 rounded-full font-sans text-xs text-ink transition-colors disabled:opacity-50 cursor-pointer">
              <RefreshCw size={12} className={revenueLoading ? "animate-spin" : ""} /> Refresh
            </button>
          </div>

          {revenueLoading && !revenue ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-60 bg-bg-2 rounded-xl animate-pulse" />)}</div>
          ) : revenue ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

              {/* Daily revenue */}
              <div className="bg-paper border border-rule rounded-xl p-6 shadow-sm">
                <h3 className="font-serif text-base font-medium text-ink mb-1">Daily Revenue (last 30d)</h3>
                <p className="font-mono text-[9px] text-muted uppercase tracking-wider mb-4">₹ captured per day</p>
                <div className="h-[200px]" role="img" aria-label="Daily revenue bar chart">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={revenue.daily} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                      <XAxis dataKey="day" fontSize={8} stroke="var(--muted)" tickLine={false} interval={Math.floor(revenue.daily.length / 6)} />
                      <YAxis fontSize={8} stroke="var(--muted)" tickLine={false} tickFormatter={(v) => `₹${v}`} />
                      <Tooltip contentStyle={{ background: "#222", border: 0, borderRadius: 8, color: "#fbfaf6", fontFamily: "monospace", fontSize: 10 }} formatter={(v) => [`₹${Number(v).toLocaleString("en-IN")}`, "Revenue"]} />
                      <Bar dataKey="Revenue" fill="#0F1E3C" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Monthly revenue */}
              <div className="bg-paper border border-rule rounded-xl p-6 shadow-sm">
                <h3 className="font-serif text-base font-medium text-ink mb-1">Monthly Revenue</h3>
                <p className="font-mono text-[9px] text-muted uppercase tracking-wider mb-4">₹ captured per month (last 12)</p>
                <div className="h-[200px]" role="img" aria-label="Monthly revenue bar chart">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={revenue.monthly} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                      <XAxis dataKey="month" fontSize={8} stroke="var(--muted)" tickLine={false} />
                      <YAxis fontSize={8} stroke="var(--muted)" tickLine={false} tickFormatter={(v) => `₹${v}`} />
                      <Tooltip contentStyle={{ background: "#222", border: 0, borderRadius: 8, color: "#fbfaf6", fontFamily: "monospace", fontSize: 10 }} formatter={(v) => [`₹${Number(v).toLocaleString("en-IN")}`, "Revenue"]} />
                      <Bar dataKey="Revenue" fill="#E5A93C" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Plan distribution */}
              <div className="bg-paper border border-rule rounded-xl p-6 shadow-sm">
                <h3 className="font-serif text-base font-medium text-ink mb-1">Plan Distribution</h3>
                <p className="font-mono text-[9px] text-muted uppercase tracking-wider mb-4">Users per plan tier</p>
                <div className="flex items-center gap-6 h-[200px]">
                  <div className="flex-1 h-full" role="img" aria-label="Plan distribution pie chart">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={revenue.planDist} dataKey="count" nameKey="plan" cx="50%" cy="50%" outerRadius={80} label={(props) => { const p = props as unknown as { plan: string; percent: number }; return `${p.plan} ${Math.round((p.percent ?? 0) * 100)}%`; }} labelLine={false} fontSize={9}>
                          {revenue.planDist.map((entry) => (
                            <Cell key={entry.plan} fill={PLAN_COLORS[entry.plan] ?? "#ccc"} />
                          ))}
                        </Pie>
                        <Tooltip contentStyle={{ background: "#222", border: 0, borderRadius: 8, color: "#fbfaf6", fontFamily: "monospace", fontSize: 10 }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="space-y-2 shrink-0">
                    {revenue.planDist.map(({ plan, count }) => (
                      <div key={plan} className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-sm shrink-0" style={{ backgroundColor: PLAN_COLORS[plan] ?? "#ccc" }} />
                        <span className="font-mono text-[9px] text-ink capitalize">{plan}</span>
                        <span className="font-mono text-[9px] font-bold text-muted-2">{count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Trial conversion */}
              <div className="bg-paper border border-rule rounded-xl p-6 shadow-sm flex flex-col justify-between">
                <div>
                  <h3 className="font-serif text-base font-medium text-ink mb-1">Trial Conversion Rate</h3>
                  <p className="font-mono text-[9px] text-muted uppercase tracking-wider mb-4">Trialists who upgraded to Pro / Lifetime</p>
                </div>
                <div className="flex flex-col items-center justify-center flex-1 py-6">
                  <div className={`font-serif text-6xl font-bold ${revenue.trialConvRate >= 30 ? "text-emerald-600" : revenue.trialConvRate >= 10 ? "text-amber-600" : "text-rose-600"}`}>
                    {revenue.trialConvRate}%
                  </div>
                  <p className="font-mono text-[9px] text-muted mt-2 uppercase tracking-wider">trial → paid conversion</p>
                </div>
                <div className="h-3 bg-bg-2 rounded-full overflow-hidden mt-2">
                  <div className={`h-full rounded-full transition-all duration-700 ${revenue.trialConvRate >= 30 ? "bg-emerald-500" : revenue.trialConvRate >= 10 ? "bg-amber-500" : "bg-rose-500"}`}
                    style={{ width: `${Math.min(revenue.trialConvRate, 100)}%` }} />
                </div>
              </div>

            </div>
          ) : null}
        </div>
      )}

      {/* ══ COUPONS ═══════════════════════════════════════════════════════════ */}
      {tab === "coupons" && (
        <div className="space-y-6">

          {/* Create form */}
          <div className="bg-paper border border-rule rounded-xl p-6 shadow-sm space-y-4">
            <h2 className="font-serif text-lg font-medium text-ink flex items-center gap-2"><Plus size={16} /> Create Coupon</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <label className="block font-mono text-[9px] uppercase tracking-widest text-muted-2 mb-1.5 font-bold">Code *</label>
                <input type="text" placeholder="SUMMER20" value={couponForm.code} onChange={(e) => setCouponForm((p) => ({ ...p, code: e.target.value.toUpperCase() }))}
                  className="w-full text-sm bg-bg border border-rule-strong rounded-lg px-3 py-2 text-ink font-mono uppercase focus:outline-none focus:border-ink" />
              </div>
              <div>
                <label className="block font-mono text-[9px] uppercase tracking-widest text-muted-2 mb-1.5 font-bold">Type</label>
                <select value={couponForm.discount_type} onChange={(e) => setCouponForm((p) => ({ ...p, discount_type: e.target.value as "percentage" | "fixed" }))}
                  className="w-full text-sm bg-bg border border-rule-strong rounded-lg px-3 py-2 text-ink focus:outline-none focus:border-ink cursor-pointer">
                  <option value="percentage">Percentage (%)</option>
                  <option value="fixed">Fixed (₹)</option>
                </select>
              </div>
              <div>
                <label className="block font-mono text-[9px] uppercase tracking-widest text-muted-2 mb-1.5 font-bold">
                  Value * {couponForm.discount_type === "percentage" ? "(%)" : "(₹)"}
                </label>
                <input type="number" min={0.01} placeholder={couponForm.discount_type === "percentage" ? "20" : "100"} value={couponForm.discount_value}
                  onChange={(e) => setCouponForm((p) => ({ ...p, discount_value: e.target.value }))}
                  className="w-full text-sm bg-bg border border-rule-strong rounded-lg px-3 py-2 text-ink focus:outline-none focus:border-ink" />
              </div>
              <div>
                <label className="block font-mono text-[9px] uppercase tracking-widest text-muted-2 mb-1.5 font-bold">Expiry Date</label>
                <input type="date" value={couponForm.expires_at} onChange={(e) => setCouponForm((p) => ({ ...p, expires_at: e.target.value }))}
                  className="w-full text-sm bg-bg border border-rule-strong rounded-lg px-3 py-2 text-ink focus:outline-none focus:border-ink" />
              </div>
              <div>
                <label className="block font-mono text-[9px] uppercase tracking-widest text-muted-2 mb-1.5 font-bold">Usage Limit</label>
                <input type="number" min={1} placeholder="Unlimited" value={couponForm.usage_limit} onChange={(e) => setCouponForm((p) => ({ ...p, usage_limit: e.target.value }))}
                  className="w-full text-sm bg-bg border border-rule-strong rounded-lg px-3 py-2 text-ink focus:outline-none focus:border-ink" />
              </div>
              <div>
                <label className="block font-mono text-[9px] uppercase tracking-widest text-muted-2 mb-1.5 font-bold">Note</label>
                <input type="text" placeholder="Optional internal note" value={couponForm.note} onChange={(e) => setCouponForm((p) => ({ ...p, note: e.target.value }))}
                  className="w-full text-sm bg-bg border border-rule-strong rounded-lg px-3 py-2 text-ink focus:outline-none focus:border-ink" />
              </div>
            </div>
            <button onClick={handleCreateCoupon} disabled={couponSaving}
              className="px-5 py-2.5 bg-ink text-paper font-mono text-[10px] uppercase font-bold rounded-lg hover:bg-ink-2 transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1.5">
              <Plus size={13} /> {couponSaving ? "Creating…" : "Create Coupon"}
            </button>
          </div>

          {/* Coupon list */}
          <div className="bg-paper border border-rule rounded-xl overflow-hidden shadow-sm">
            <div className="p-5 border-b border-rule bg-bg-2/20 flex justify-between items-center">
              <h2 className="font-serif text-lg font-medium text-ink">Active Coupons ({coupons.length})</h2>
              <button onClick={loadCoupons} disabled={couponsLoading} className="flex items-center gap-1.5 px-3 py-1.5 border border-rule hover:bg-bg-2 rounded-full font-mono text-[9px] text-ink transition-colors cursor-pointer uppercase">
                <RefreshCw size={11} className={couponsLoading ? "animate-spin" : ""} /> Refresh
              </button>
            </div>

            {couponsLoading ? (
              <div className="p-8 text-center"><div className="w-8 h-8 border-4 border-ink border-t-transparent rounded-full animate-spin mx-auto" /></div>
            ) : coupons.length === 0 ? (
              <div className="p-12 text-center">
                <Tag className="mx-auto text-muted mb-3" size={28} />
                <p className="font-mono text-[9px] uppercase text-muted">No coupons created yet.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs font-sans">
                  <thead>
                    <tr className="border-b border-rule font-mono uppercase tracking-wide text-muted text-[10px] bg-bg-2/30">
                      <th className="py-3 px-4 font-semibold">Code</th>
                      <th className="py-3 px-3 font-semibold text-center">Discount</th>
                      <th className="py-3 px-3 font-semibold text-center">Usage</th>
                      <th className="py-3 px-3 font-semibold text-center">Expires</th>
                      <th className="py-3 px-3 font-semibold text-center">Status</th>
                      <th className="py-3 px-3 font-semibold w-20" />
                    </tr>
                  </thead>
                  <tbody>
                    {coupons.map((c) => {
                      const expired = c.expires_at && new Date(c.expires_at) < new Date();
                      return (
                        <tr key={c.id} className={`border-b border-rule/50 hover:bg-bg-2/30 transition-colors ${!c.is_active ? "opacity-50" : ""}`}>
                          <td className="py-3 px-4">
                            <span className="font-mono font-bold text-ink tracking-wider">{c.code}</span>
                            {c.note && <div className="font-sans text-[9px] text-muted-2 mt-0.5">{c.note}</div>}
                          </td>
                          <td className="py-3 px-3 text-center font-mono font-bold text-ink">
                            {c.discount_type === "percentage" ? `${c.discount_value}%` : inr(c.discount_value)}
                          </td>
                          <td className="py-3 px-3 text-center font-mono text-[10px] text-ink">
                            {c.usage_count}{c.usage_limit ? ` / ${c.usage_limit}` : " / ∞"}
                          </td>
                          <td className="py-3 px-3 text-center font-mono text-[9px]">
                            {c.expires_at ? (
                              <span className={expired ? "text-rose-600 font-bold" : "text-muted-2"}>
                                {new Date(c.expires_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "2-digit" })}
                              </span>
                            ) : <span className="text-muted-2">No expiry</span>}
                          </td>
                          <td className="py-3 px-3 text-center">
                            <span className={`font-mono text-[8px] font-bold px-2 py-0.5 rounded-full border uppercase ${c.is_active && !expired ? "bg-emerald-50 text-emerald-700 border-emerald-100" : "bg-rose-50 text-rose-700 border-rose-100"}`}>
                              {c.is_active && !expired ? "Active" : expired ? "Expired" : "Disabled"}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-center">
                            <button onClick={() => toggleCoupon(c.id, c.is_active)}
                              className="font-mono text-[9px] uppercase font-bold px-2.5 py-1 border border-rule rounded hover:bg-bg-2 text-muted transition-colors cursor-pointer">
                              {c.is_active ? "Disable" : "Enable"}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <p className="font-mono text-[9px] text-amber-700">
              <strong>Note:</strong> Coupons are stored in the DB. To apply at checkout, pass the code to the <code>create-order</code> endpoint and validate against this table before reducing the order amount.
            </p>
          </div>
        </div>
      )}

    </div>
  );
}
