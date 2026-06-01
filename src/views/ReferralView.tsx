import {
    Check,
    Clock,
    Copy,
    Gift,
    ShieldCheck,
    Users
} from "lucide-react";
import { useEffect, useState } from "react";
import { Button, Card } from "../components/Atoms";
import { useAuth } from "../contexts/AuthContext";
import { useDocumentMeta } from "../hooks/useDocumentMeta";
import { supabase } from "../lib/supabase";

export default function ReferralView() {
  useDocumentMeta();

  const { user, userData } = useAuth();
  const [referrals, setReferrals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  const referralCode = userData?.referralCode || "PILOT";
  const referralLink = `${window.location.origin}?ref=${referralCode}`;

  const fetchReferralStats = async () => {
    if (!user) return;
    setLoading(true);
    try {
      // Fetch user's referrals. Supabase handles a join on referred_id -> profiles
      const { data, error } = await supabase
        .from("referrals")
        .select(`
          id,
          status,
          reward_granted,
          created_at,
          referred:referred_id (
            display_name,
            email
          )
        `)
        .eq("referrer_id", user.uid)
        .order("created_at", { ascending: false });

      if (error) {
        throw error;
      }
      setReferrals(data || []);
    } catch (err: any) {
      console.warn("Could not load referral data directly via RLS:", err);
      // Fallback clean local mock array if schema rules aren't deployed locally
      setReferrals([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReferralStats();
  }, [user]);

  const handleCopy = () => {
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Stats calculation
  const totalInvites = referrals.length;
  const successfulInvites = referrals.filter(r => r.status === "completed" || r.reward_granted).length;
  const pendingInvites = totalInvites - successfulInvites;
  const totalDaysEarned = successfulInvites * 30;

  return (
    <div className="max-w-4xl mx-auto px-6 py-10 space-y-8 font-sans">
      
      {/* 1. HERO HEADER BANNER */}
      <div className="relative rounded-2xl bg-[#0F172A] border border-slate-800 text-white p-8 overflow-hidden">
        {/* Subtle decorative instrument dials in background */}
        <div className="absolute right-[-40px] bottom-[-40px] w-64 h-64 border border-white/5 rounded-full select-none pointer-events-none flex items-center justify-center">
          <div className="w-48 h-48 border border-white/5 rounded-full flex items-center justify-center">
            <div className="w-32 h-32 border border-white/5 rounded-full" />
          </div>
        </div>

        <div className="relative max-w-xl space-y-4">
          <span className="font-mono text-[9px] text-[#DF9D38] border border-[#DF9D38]/30 bg-[#DF9D38]/10 px-2.5 py-1 rounded uppercase tracking-widest font-bold inline-flex items-center gap-1.5">
            <Gift size={11} /> Double Sided Reward Program
          </span>
          <h1 className="font-serif text-3xl sm:text-4xl font-bold tracking-tight text-white leading-tight">
            Invite fellow pilots.<br />Earn free Pro days.
          </h1>
          <p className="text-slate-400 text-sm leading-relaxed">
            Share the cockpit with your peer studying groups. When your referral registers and upgrades to Pro, <strong className="text-white">you both get 30 days of full Pro access added automatically</strong> to your subscription.
          </p>
        </div>
      </div>

      {/* 2. STATS CARDS LIST */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-5 border border-rule bg-paper rounded-xl shadow-sm text-center">
          <p className="font-mono text-[9px] text-muted-2 uppercase tracking-wider">Total Invited</p>
          <h3 className="text-2xl font-serif font-bold text-ink mt-1">{totalInvites}</h3>
          <span className="text-[10px] text-muted block mt-0.5">Pilots registered</span>
        </Card>

        <Card className="p-5 border border-rule bg-paper rounded-xl shadow-sm text-center">
          <p className="font-mono text-[9px] text-muted-2 uppercase tracking-wider">Pending Upgrades</p>
          <h3 className="text-2xl font-serif font-bold text-[#EAB308] mt-1">{pendingInvites}</h3>
          <span className="text-[10px] text-muted block mt-0.5">Awaiting first checkout</span>
        </Card>

        <Card className="p-5 border border-rule bg-[#059669]/10 rounded-xl shadow-sm text-center border-[#059669]/20">
          <p className="font-mono text-[9px] text-[#059669] uppercase tracking-wider">Successful Upgrades</p>
          <h3 className="text-2xl font-serif font-bold text-[#10B981] mt-1">{successfulInvites}</h3>
          <span className="text-[10px] text-muted block mt-0.5">Double rewards granted</span>
        </Card>

        <Card className="p-5 border border-rule bg-paper rounded-xl shadow-sm text-center">
          <p className="font-mono text-[9px] text-muted-2 uppercase tracking-wider">Pro Credit Granted</p>
          <h3 className="text-2xl font-serif font-bold text-ink mt-1">+{totalDaysEarned} Days</h3>
          <span className="text-[10px] text-[#10B981] font-mono uppercase text-[9px] block mt-0.5">Value: ${(totalDaysEarned / 30) * 15} USD</span>
        </Card>
      </div>

      {/* 3. YOUR UNIQUE LINK */}
      <Card className="p-6 border border-rule-strong bg-paper rounded-2xl shadow-sm space-y-4">
        <div className="space-y-1">
          <h2 className="font-serif text-lg font-bold text-ink">Your Pilot Referral Dispatch Link</h2>
          <p className="text-muted text-[12px]">
            Copy this unique flight plan dispatch URL. Post it directly inside Study WhatsApp Groups, Discord aviation channels, or share directly via email.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
          <div className="flex-1 bg-bg-2 px-4 py-2.5 rounded-lg border border-rule font-mono text-xs text-ink break-all flex items-center justify-between min-h-[42px]">
            <span>{referralLink}</span>
          </div>
          <Button 
            id="copyReferralLinkBtn"
            variant={copied ? "ghost" : "primary"} 
            onClick={handleCopy}
            className={`sm:w-auto h-11 px-6 rounded-lg text-xs font-mono uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer transition-all ${
              copied ? "bg-emerald-50 text-emerald-600 border border-emerald-200" : "bg-ink hover:bg-ink-2 text-bg"
            }`}
          >
            {copied ? (
              <>
                <Check size={14} /> Copied!
              </>
            ) : (
              <>
                <Copy size={14} /> Copy Link
              </>
            )}
          </Button>
        </div>
      </Card>

      {/* 4. DETAILS ROW (HOW IT WORKS BENTO GRID) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="space-y-2 p-5 bg-paper border border-rule rounded-xl">
          <div className="w-8 h-8 rounded-full bg-navy/10 text-navy flex items-center justify-center font-bold font-mono text-xs">
            1
          </div>
          <h4 className="font-serif text-sm font-bold text-ink">Friend boards the cockpit</h4>
          <p className="text-muted text-xs leading-relaxed">
            Your friend registers an account on Heading using your unique link in browser. The referral token is saved instantly.
          </p>
        </div>

        <div className="space-y-2 p-5 bg-paper border border-rule rounded-xl">
          <div className="w-8 h-8 rounded-full bg-navy/10 text-navy flex items-center justify-center font-bold font-mono text-xs">
            2
          </div>
          <h4 className="font-serif text-sm font-bold text-ink">Friend upgrades to Pro</h4>
          <p className="text-muted text-xs leading-relaxed">
            When they feel ready to unlock C1 syllabus questions, premium calculators, and AI ground instructor help, they subscribe to Pro.
          </p>
        </div>

        <div className="space-y-2 p-5 bg-paper border border-rule rounded-xl">
          <div className="w-8 h-8 rounded-full bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-bold font-mono text-xs">
            3
          </div>
          <h4 className="font-serif text-sm font-bold text-ink">Double Rewards Granted</h4>
          <p className="text-muted text-xs leading-relaxed">
            Our Stripe verification webhook immediately triggers. Adding +30 days on your account and an extra +30 days on theirs!
          </p>
        </div>
      </div>

      {/* 5. LIVE INVITE HISTORY */}
      <Card className="border border-rule bg-paper rounded-2xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-rule bg-paper flex items-center justify-between">
          <h3 className="font-serif text-sm font-bold text-ink">Referrals Ledger</h3>
          <span className="font-mono text-[8.5px] text-muted-2 uppercase tracking-wide">LIVE DATABASE STATS</span>
        </div>

        <div className="overflow-x-auto">
          {loading ? (
            <div className="p-8 text-center text-muted text-xs font-mono">
              <span className="inline-block w-5 h-5 border-2 border-navy border-t-transparent rounded-full animate-spin mb-2"></span>
              <p>Fetching referred pilots...</p>
            </div>
          ) : referrals.length === 0 ? (
            <div className="p-10 text-center max-w-sm mx-auto space-y-2.5">
              <Users size={28} className="text-muted mx-auto" />
              <h4 className="font-serif text-sm font-bold text-ink">No referrals recorded yet</h4>
              <p className="text-muted text-xs leading-relaxed">
                When fellow candidates register on your shared channel, their flight logs will accumulate inside this table immediately.
              </p>
            </div>
          ) : (
            <table className="min-w-full divide-y divide-rule text-xs font-sans">
              <thead className="bg-bg-2">
                <tr className="border-b border-rule">
                  <th className="px-5 py-3 text-left font-mono text-[8.5px] text-muted-2 uppercase tracking-wider">Candidate Pilot</th>
                  <th className="px-5 py-3 text-left font-mono text-[8.5px] text-muted-2 uppercase tracking-wider">Initiated On</th>
                  <th className="px-5 py-3 text-left font-mono text-[8.5px] text-muted-2 uppercase tracking-wider">Status Node</th>
                  <th className="px-5 py-3 text-right font-mono text-[8.5px] text-muted-2 uppercase tracking-wider">Reward Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-rule bg-paper">
                {referrals.map((item) => {
                  const referredEmail = item.referred?.email;
                  const maskedEmail = referredEmail 
                    ? referredEmail.replace(/(.{2})(.*)(@.*)/, "$1***$3") 
                    : "Candidate Pilot";
                  
                  const isCompleted = item.status === "completed" || item.reward_granted;
                  
                  return (
                    <tr key={item.id} className="hover:bg-bg-2/30">
                      <td className="px-5 py-3 font-semibold text-ink">
                        {item.referred?.display_name || maskedEmail}
                      </td>
                      <td className="px-5 py-3 text-muted">
                        {new Date(item.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      </td>
                      <td className="px-5 py-3">
                        {isCompleted ? (
                          <span className="inline-flex items-center gap-1 text-[#059669] bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded font-mono text-[9px] font-bold uppercase">
                            <ShieldCheck size={11} /> Upgraded PRO
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-slate-500 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded font-mono text-[9px] font-bold uppercase">
                            <Clock size={11} /> Registered Free
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-right text-muted font-mono text-[10.5px]">
                        {isCompleted ? (
                          <span className="text-emerald-600 font-bold">+30 Days Active Pro</span>
                        ) : (
                          <span className="text-slate-400">Claims on friend checkout</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </Card>

    </div>
  );
}
