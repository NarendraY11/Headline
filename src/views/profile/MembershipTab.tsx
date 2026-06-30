// UX-Nav Phase 2C: Membership tab — a subscription dashboard (promoted from the
// old single Subscription card). Surfaces plan, status, renewal, remaining days,
// and a derived premium-feature summary. No invented backend data: payment
// history is a clearly-disabled placeholder.

import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, CalendarClock, Check, CreditCard, Sparkles, ShieldCheck } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { Button, Card } from "../../components/Atoms";
import { isPaidActive, daysLeft, planLabel } from "../../lib/plan";
import { trackEvent } from "../../lib/track";

const PREMIUM_FEATURES = [
  "Full C1 syllabus question bank",
  "Premium aviation calculators",
  "AI ground instructor explanations",
  "Unlimited mock exams & exam centre",
];

const fmtDate = (d?: string) =>
  d ? new Date(d).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" }) : "—";

export default function MembershipTab() {
  const { userData } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    trackEvent("profile_subscription_opened");
  }, []);

  const isPro = isPaidActive(userData);
  const subPlan: string = userData?.plan || "free";
  const subDaysLeft = daysLeft(userData);

  const planTitle =
    subPlan === "lifetime" ? "Captain · Lifetime Pro" :
    subPlan === "pro" ? "Captain (Pro)" :
    subPlan === "trial" ? "Pro Trial" : "Cadet (Free)";

  const statusText = isPro ? "Active" : subPlan === "trial" ? "Trial" : "Free";

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Plan summary hero */}
      <Card
        style={isPro ? { backgroundColor: "var(--color-navy)", borderColor: "var(--color-navy)" } : undefined}
        className={`p-6 md:p-8 rounded-2xl relative overflow-hidden ${isPro ? "bg-navy border-navy text-bg" : subPlan === "trial" ? "bg-amber-soft/40 border border-amber/30" : "bg-panel border border-rule"}`}
      >
        {isPro && <div className="absolute top-0 right-0 w-64 h-64 bg-[var(--pro-gold)]/10 blur-2xl rounded-full translate-x-1/3 -translate-y-1/3 pointer-events-none -z-[1]" />}
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <span className={`inline-flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.2em] font-bold ${isPro ? "text-[var(--pro-gold)]" : "text-muted"}`}>
              {isPro ? <Sparkles size={12} /> : <ShieldCheck size={12} />} Membership · {statusText}
            </span>
            <h2 className={`font-serif text-2xl md:text-3xl ${isPro ? "text-bg" : "text-ink"}`}>{planTitle}</h2>
            <div className={`font-mono text-[11px] tracking-wider ${isPro ? "text-bg/70" : "text-muted"}`}>{planLabel(userData)}</div>
          </div>
          <Button
            variant="primary"
            onClick={() => navigate("/pricing")}
            className={`h-11 rounded-full font-mono text-[10px] uppercase tracking-wider px-6 shrink-0 gap-1.5 ${isPro ? "bg-bg text-navy hover:bg-bg/90" : "bg-navy text-bg hover:bg-navy/90"}`}
          >
            {isPro ? "Manage subscription" : "Upgrade to Pro"} <ArrowRight size={14} />
          </Button>
        </div>
      </Card>

      {/* Renewal / status detail grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <DetailCard label="Status" value={statusText} />
        <DetailCard label="Started" value={fmtDate(userData?.planStartedAt)} />
        <DetailCard
          label={subPlan === "lifetime" ? "Renews / Expires" : "Renews / Expires"}
          value={subPlan === "lifetime" ? "Never" : fmtDate(userData?.planExpiresAt)}
        />
      </div>

      {subDaysLeft !== null && subPlan !== "lifetime" && (
        <div className="rounded-2xl border border-rule bg-paper px-5 py-4 flex items-center gap-3">
          <CalendarClock size={16} className="text-muted-2" />
          <span className="font-sans text-sm text-ink"><strong className="tabular-nums">{subDaysLeft}</strong> days remaining on your current plan.</span>
        </div>
      )}

      {/* Premium features summary */}
      <Card className="bg-paper p-6">
        <span className="font-mono text-[10px] uppercase tracking-widest text-muted-2 font-bold block mb-4">Premium features {isPro ? "enabled" : "with Pro"}</span>
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {PREMIUM_FEATURES.map((f) => (
            <li key={f} className="flex items-start gap-2.5">
              <span className={`mt-0.5 w-4 h-4 rounded-full flex items-center justify-center shrink-0 ${isPro ? "bg-mint/20" : "bg-bg-2 border border-rule"}`}>
                <Check size={11} className={isPro ? "text-mint" : "text-muted-2"} />
              </span>
              <span className={`font-sans text-sm ${isPro ? "text-ink" : "text-muted"}`}>{f}</span>
            </li>
          ))}
        </ul>
      </Card>

      {/* Payment history — placeholder (no backend yet) */}
      <Card className="bg-paper p-6 opacity-60" aria-disabled="true">
        <div className="flex items-center justify-between">
          <span className="font-mono text-[10px] uppercase tracking-widest text-muted-2 font-bold inline-flex items-center gap-2"><CreditCard size={13} /> Payment History</span>
          <span className="font-mono text-[9px] uppercase tracking-widest text-muted-2 border border-rule rounded-full px-2.5 py-1">Coming soon</span>
        </div>
        <p className="font-sans text-sm text-muted-2 mt-3">Your invoices and transaction history will appear here.</p>
      </Card>
    </div>
  );
}

function DetailCard({ label, value }: { label: string; value: string }) {
  return (
    <Card className="bg-paper p-5">
      <div className="font-mono text-[10px] uppercase text-muted tracking-widest mb-1.5">{label}</div>
      <div className="font-serif text-xl text-ink">{value}</div>
    </Card>
  );
}
