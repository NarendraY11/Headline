import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Gift, Check, Copy } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { supabase } from "../../lib/supabase";

const REWARD_GOAL = 3; // referrals needed for the next reward tier

export function ReferralWidget() {
  const { user, userData } = useAuth();
  const [total, setTotal] = useState(0);
  const [rewarded, setRewarded] = useState(0);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("referrals")
        .select("status, reward_granted")
        .eq("referrer_id", user.uid);
      if (cancelled || !data) return;
      setTotal(data.length);
      setRewarded(data.filter((r: any) => r.reward_granted).length);
    })();
    return () => { cancelled = true; };
  }, [user]);

  const code = userData?.referralCode;
  if (!user || !code) return null;

  const progress = Math.min(100, Math.round(((total % REWARD_GOAL) / REWARD_GOAL) * 100));
  const toNext = REWARD_GOAL - (total % REWARD_GOAL || (total > 0 ? REWARD_GOAL : 0));

  const copy = () => {
    navigator.clipboard?.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <div className="bg-paper border border-rule rounded-xl p-4 mb-6">
      <div className="flex items-center justify-between mb-3">
        <div className="font-mono text-[9px] uppercase tracking-widest text-muted-2 flex items-center gap-1.5">
          <Gift size={13} className="text-amber" /> Invite & earn Pro
        </div>
        <Link to="/referral" className="font-mono text-[9px] uppercase tracking-wider text-navy hover:underline">
          Details →
        </Link>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex-1">
          <div className="flex items-baseline gap-2">
            <span className="font-serif text-2xl text-ink">{total}</span>
            <span className="font-sans text-[11px] text-muted-2">invited · {rewarded} rewarded</span>
          </div>
          <div className="mt-2 h-1.5 w-full bg-bg-2 rounded-full overflow-hidden">
            <div className="h-full bg-amber rounded-full transition-all" style={{ width: `${progress}%` }} />
          </div>
          <div className="font-sans text-[10px] text-muted-2 mt-1">
            {toNext === REWARD_GOAL && total > 0
              ? "Reward unlocked — keep going!"
              : `${toNext} more for your next 30 days free Pro`}
          </div>
        </div>

        <button
          onClick={copy}
          className="shrink-0 inline-flex items-center gap-1.5 border border-rule bg-bg-2 hover:border-ink/40 px-3 py-2 rounded-lg font-mono text-[10px] font-bold tracking-wider text-ink transition-colors"
          title="Copy your referral code"
        >
          {copied ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
          {code}
        </button>
      </div>
    </div>
  );
}
