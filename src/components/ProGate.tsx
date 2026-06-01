import React, { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { Lock, Sparkles, ArrowRight } from "lucide-react";
import { Button } from "./Atoms";
import { isPaidActive } from "../lib/plan";
import { supabase } from "../lib/supabase";
import { useNotifications } from "../contexts/NotificationContext";

interface ProGateProps {
  children: React.ReactNode;
  type: "subject" | "chapter" | "timed-mock" | "ai-feature" | "viva-practice" | "analytics";
  isUnlocked?: boolean;
  key?: any;
}

export function ProGate({ children, type, isUnlocked = false }: ProGateProps) {
  const { user, userData, openAuthModal, updateUserData } = useAuth();
  const { addNotification } = useNotifications();
  const [isTrialLoading, setIsTrialLoading] = useState(false);
  
  // Expose pro plan or bypass if explicit unlock has been passed
  const isPro = isPaidActive(userData);

  // Check custom rules if isUnlocked is not explicitly defined/true
  let locked = !isPro;

  if (isPro) {
    locked = false;
  } else {
    // Rules for free tier:
    if (type === "subject") {
      // Handled via explicit isUnlocked or let's default to false unless isUnlocked is passed
      locked = !isUnlocked;
    } else if (type === "chapter") {
      // Handled via explicit isUnlocked
      locked = !isUnlocked;
    } else if (type === "timed-mock") {
      // Handled via explicit isUnlocked
      locked = !isUnlocked;
    } else {
      // AI features, VIVA practice, full analytics are always locked on free tier
      locked = true;
    }
  }

  const startTrial = async () => {
    setIsTrialLoading(true);
    try {
      const token = await supabase.auth.getSession().then((s) => s.data.session?.access_token);
      if (!token) throw new Error("No active session");

      const response = await fetch("/api/start-trial", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to start trial");
      }

      const result = await response.json();
      
      // Update local state to reflect the new plan so the UI updates immediately
      await updateUserData({
        plan: "trial",
        planStartedAt: new Date().toISOString(),
        planExpiresAt: result.plan_expires_at,
        trialStartedAt: new Date().toISOString(),
        trialUsed: true,
      });

      addNotification(
        "🎉 Trial Activated",
        "Your 7-day Pro trial is live. Full access to AI coaching, mock exams and analytics is unlocked. Make it count!",
        "system"
      );

    } catch (err) {
      console.error("Failed starting trial:", err);
    } finally {
      setIsTrialLoading(false);
    }
  };

  if (!locked) {
    return <>{children}</>;
  }

  // Define visual text details based on type
  const typeConfig = {
    subject: {
      title: "Unlock Full Certification Catalog",
      badge: "PRO SPECIALIZATION",
      desc: "Unlock comprehensive study packages, full question banks, expert documentation and custom checklists.",
    },
    chapter: {
      title: "Unlock Training Sub-Topic",
      badge: "PRO CONTENT",
      desc: "This CPL/ATPL training chapter is gated. Upgrade to Captain Pro to access all questions, formulas, and mock sections.",
    },
    "timed-mock": {
      title: "Unlock Realistic Simulator Mode",
      badge: "PRO SIMULATION",
      desc: "Complete all timed exams modeled under active authority parameters with real time constraints, negative marking, and pass-rate analysis.",
    },
    "ai-feature": {
      title: "Ask the Check Examiner / Coach",
      badge: "PRO AI UTILITIES",
      desc: "Unlock intelligent explanation generation, real-time diagnostic performance profiling, and personalised study roadmaps.",
    },
    "viva-practice": {
      title: "Oral Viva & Practical Interview prep",
      badge: "PRO ORAL PREP",
      desc: "Access highly certified line checklists, oral questions, examiner panels and simulator briefs.",
    },
    analytics: {
      title: "Access Deep Diagnostics",
      badge: "PRO TELEMETRY & DIAGNOSIS",
      desc: "Gain deep analysis into your pilot weak chapters, ATA-standard error logging, and AI-powered risk diagnosis.",
    },
  }[type] || {
    title: "Premium Captain Pro Feature",
    badge: "PRO EXCLUSIVE",
    desc: "Unlock this section to advance your flight training studies under airline guidelines.",
  };

  return (
    <div className="relative w-full overflow-hidden rounded-2xl border border-rule group/gate">
      {/* Blurred Preview Content */}
      <div className="select-none pointer-events-none filter blur-[5px] opacity-40 scale-[1.01] transition-all duration-300">
        {children}
      </div>

      {/* Premium Gate Overlay Card */}
      <div className="absolute inset-0 bg-bg/60 backdrop-blur-[2px] flex items-center justify-center p-6 sm:p-8 z-20">
        <div className="w-full max-w-md bg-white border border-rule shadow-[0_8px_30px_rgb(13,26,45,0.08)] rounded-2xl p-6 text-center space-y-5 animate-in fade-in zoom-in-95 duration-200">
          <div className="flex justify-center">
            <div className="p-3 bg-[#fbfaf6] text-navy border border-amber/30 rounded-xl relative">
              <Lock size={22} className="text-navy" />
              <Sparkles size={12} className="absolute -top-1 -right-1 text-amber animate-pulse" />
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-1.5 font-mono text-[9px] tracking-widest font-bold uppercase text-navy bg-sky-soft px-2.5 py-0.5 rounded-full border border-sky/20">
              <Sparkles size={10} className="text-sky animate-spin-slow" />
              <span>{typeConfig.badge}</span>
            </div>
            <h5 className="font-serif text-xl font-semibold text-ink leading-tight">
              {typeConfig.title}
            </h5>
            <p className="font-sans text-xs text-muted leading-relaxed max-w-sm mx-auto">
              {typeConfig.desc}
            </p>
          </div>

          <div className="pt-2 flex flex-col gap-2.5 sm:flex-row sm:justify-center">
            {!user ? (
              <Button
                variant="primary"
                onClick={() => openAuthModal("signup")}
                className="w-full sm:w-auto h-10 text-xs px-5 justify-center"
              >
                Sign Up & Open Sandbox
              </Button>
            ) : (
              <div className="flex flex-col sm:flex-row gap-2.5 items-center justify-center w-full">
                {(!userData?.plan || userData?.plan === "free") && !userData?.trialUsed && (
                  <Button
                    variant="ghost"
                    onClick={startTrial}
                    loading={isTrialLoading}
                    className="w-full sm:w-auto h-10 text-xs px-4 justify-center border-amber text-amber-700 hover:bg-amber-50 font-semibold cursor-pointer"
                  >
                    Start 7-day free trial
                  </Button>
                )}
                <Link to="/pricing" className="w-full sm:w-auto">
                  <Button
                    variant="primary"
                    className="w-full h-10 text-xs px-5 justify-center bg-navy hover:bg-navy-dark text-bg transition-all"
                  >
                    Upgrade to Captain Pro
                    <ArrowRight size={14} />
                  </Button>
                </Link>
              </div>
            )}
            
            <Link to="/pricing" className="block text-center text-[11px] font-medium text-muted hover:text-ink transition-colors py-2 sm:py-0 self-center">
              View Feature Chart
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
