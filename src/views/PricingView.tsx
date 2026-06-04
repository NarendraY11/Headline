import React, { useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "motion/react";
import { Button, Chip } from "../components/Atoms";
import { CheckCircle2, XCircle, Sparkles, Zap, RefreshCw } from "lucide-react";
import { trackEvent } from "../lib/track";
import { useAuth } from "../contexts/AuthContext";
import { apiFetchRaw, readError } from "../lib/api";
import { useToast } from "../components/ui/Toast";
import { useNotifications } from "../contexts/NotificationContext";

import { isPaidActive } from "../lib/plan";
import PaymentSuccessCelebration from "../components/PaymentSuccessCelebration";

// Scroll reveal helper
const FadeUp: React.FC<{ children: React.ReactNode, delay?: number, className?: string }> = ({ children, delay = 0, className = "" }) => {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: delay / 1000, ease: [0.21, 0.47, 0.32, 0.98] }}
      className={className}
    >
      {children}
    </motion.div>
  );
};

const loadRazorpayScript = () => {
  return new Promise((resolve) => {
    if ((window as any).Razorpay) {
      resolve(true);
      return;
    }
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
};

export default function PricingView() {
  const { user, userData, openAuthModal, updateUserData } = useAuth();
  const { showToast } = useToast();
  const { addNotification } = useNotifications();
  
  const [billingInterval, setBillingInterval] = useState<"monthly" | "yearly">("monthly");
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [isTrialLoading, setIsTrialLoading] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);

  const isPro = isPaidActive(userData);

  const handleStartTrial = async () => {
    if (!user) {
      showToast({
        type: "info",
        title: "Account Required",
        message: "Please sign up or sign in to activate your 7-day free trial.",
        duration: 6000
      });
      openAuthModal("signup");
      return;
    }
    
    setIsTrialLoading(true);
    try {
      if (updateUserData) {
        await updateUserData({
          plan: "trial",
          planStartedAt: new Date().toISOString(),
          planExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          trialStartedAt: new Date().toISOString(),
          trialUsed: true,
        });
        showToast({
          type: "success",
          title: "Trial Activated!",
          message: "You now have full Pro-level access for 7 days!",
          duration: 5000
        });
      }
    } catch (err) {
      console.error(err);
      showToast({
        type: "error",
        title: "Activation Failed",
        message: "Unable to activate free trial. Please try again.",
        duration: 5000
      });
    } finally {
      setIsTrialLoading(false);
    }
  };

  const handleSubscribe = async () => {
    if (!user) {
      showToast({
        type: "info",
        title: "Account Required",
        message: "Please sign in or sign up to activate a Captain (Pro) subscription.",
        duration: 6000
      });
      openAuthModal("signin");
      return;
    }

    if (isPro) {
      showToast({
        type: "success",
        title: "Already Captain",
        message: "You are already on the Pro plan with full operational clearance!",
        duration: 5000
      });
      return;
    }

    setPaymentLoading(true);
    try {
      trackEvent("upgrade_pro_attempt", { metadata: { interval: billingInterval } });
      const loaded = await loadRazorpayScript();
      if (!loaded) {
        throw new Error("Unable to load Razorpay payment client. Please verify your connection.");
      }

      const response = await apiFetchRaw("/api/payment/create-order", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ interval: billingInterval }),
      });

      if (!response) {
        throw new Error("Unable to communicate with the payment server. Ensure you have network access.");
      }
      if (!response.ok) {
        throw new Error(await readError(response, "Could not start checkout. Please try again."));
      }

      const orderData = await response.json();
      if (orderData.error) {
        throw new Error(orderData.error);
      }

      // Prefer the key_id the server returns from create-order (authoritative,
      // always matches the secret used to create the order). Fall back to the
      // build-time Vite var only if the server omitted it. Never ship a bogus
      // placeholder — an invalid key makes the modal fail to open.
      const keyId = orderData.key_id || import.meta.env.VITE_RAZORPAY_KEY_ID || "";
      if (!keyId) {
        throw new Error("Payment is not configured (missing Razorpay key). Please contact support.");
      }

      const options = {
        key: keyId,
        amount: orderData.amount,
        currency: orderData.currency,
        name: "Captain's Ground School",
        description: `Captain (Pro) Plan - ${billingInterval === "yearly" ? "Yearly" : "Monthly"}`,
        image: "https://images.unsplash.com/photo-1540962351504-03099e0a754b?w=64&auto=format&fit=crop&q=80",
        order_id: orderData.id,
        prefill: {
          email: user.email || "",
          name: user.displayName || "",
        },
        theme: {
          color: "#0F1E3C",
        },
        handler: async (paymentResponse: any) => {
          setPaymentLoading(true);
          try {
            const verifyPayload = {
              razorpay_payment_id: paymentResponse.razorpay_payment_id,
              razorpay_order_id: paymentResponse.razorpay_order_id,
              razorpay_signature: paymentResponse.razorpay_signature,
              interval: billingInterval,
            };

            const verifyRes = await apiFetchRaw("/api/payment/verify", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify(verifyPayload),
            });

            if (!verifyRes) {
              throw new Error("Local verification request timed out. Webhook will process signature in background.");
            }
            if (!verifyRes.ok) {
              throw new Error(await readError(verifyRes, "Payment verification failed."));
            }

            const verifyData = await verifyRes.json();
            if (verifyData.success) {
              addNotification(
                "🎉 Welcome to Pro!",
                `Your Captain (Pro) ${billingInterval === "yearly" ? "yearly" : "monthly"} plan is active. Every feature is unlocked — happy flying!`,
                "system"
              );

              // Play the celebration overlay; its onDone reloads the page so the
              // refreshed auth/plan state is picked up everywhere.
              trackEvent("upgrade_pro_success", { metadata: { interval: billingInterval } });
              setShowCelebration(true);
            } else {
              throw new Error(verifyData.error || "Payment verification failed.");
            }
          } catch (err: any) {
            console.error("Verification error:", err);
            showToast({
              type: "error",
              title: "Verification Error",
              message: "Payment success, but verification failed. Re-syncing database shortly...",
              duration: 8000
            });
          } finally {
            setPaymentLoading(false);
          }
        },
        modal: {
          ondismiss: () => {
            setPaymentLoading(false);
            showToast({
              type: "info",
              title: "Payment Dismissed",
              message: "Checkout canceled. Upgrade when you are ready to pass the boards.",
              duration: 5000
            });
          },
        },
      };

      const rzPay = new (window as any).Razorpay(options);
      // payment.failed fires when the bank/card declines or the gateway errors
      // (distinct from the user dismissing the modal). No charge is made.
      rzPay.on("payment.failed", (resp: any) => {
        setPaymentLoading(false);
        console.error("Razorpay payment.failed:", resp?.error);
        trackEvent("upgrade_pro_failed", {
          metadata: { interval: billingInterval, reason: resp?.error?.reason || resp?.error?.code },
        });
        showToast({
          type: "error",
          title: "Payment Failed",
          message:
            resp?.error?.description ||
            "Your payment could not be processed. No charge was made — please try again.",
          duration: 7000,
        });
      });
      rzPay.open();
    } catch (err: any) {
      console.error("Payment error:", err);
      showToast({
        type: "error",
        title: "Checkout Error",
        message: err.message || "Failed to initiate payment. Please try again.",
        duration: 6000
      });
      setPaymentLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg relative">
      {showCelebration && (
        <PaymentSuccessCelebration
          interval={billingInterval}
          onDone={() => window.location.reload()}
        />
      )}
      <div className="absolute inset-0 blueprint pointer-events-none opacity-[0.03] z-0" />
      
      <section id="pricing" className="pt-10 pb-24 md:pt-16 md:pb-32 max-w-[1000px] mx-auto px-6 w-full relative z-10">
         <FadeUp className="text-center mb-10">
            <span className="eyebrow block mb-4 text-[10px] tracking-[0.25em] text-signal font-mono uppercase">§ 04 · LICENSE TO FLY</span>
            <h2 className="font-serif text-[48px] md:text-[60px] text-ink mb-4 tracking-tight leading-none">Invest in your exam pass.</h2>
            <p className="font-sans text-ink-2 font-light text-[17px] max-w-lg mx-auto leading-relaxed">
              Unlock the entire operational syllabus today. Select your subscription frequency with zero commitment, cancel anytime.
            </p>
         </FadeUp>

         {/* BILLING TOGGLE */}
         <FadeUp delay={100} className="flex justify-center mb-16">
           <div className="bg-panel border border-rule p-1.5 rounded-full flex gap-1 shadow-sm">
             <button
               onClick={() => setBillingInterval("monthly")}
               className={`px-5 py-2.5 rounded-full text-xs font-mono tracking-wider uppercase transition-all duration-300 focus:outline-none ${billingInterval === "monthly" ? "bg-navy text-bg font-semibold shadow-sm" : "text-muted hover:text-ink"}`}
             >
               Monthly Access
             </button>
             <button
               onClick={() => setBillingInterval("yearly")}
               className={`px-5 py-2.5 rounded-full text-xs font-mono tracking-wider uppercase transition-all duration-300 focus:outline-none relative flex items-center gap-1.5 ${billingInterval === "yearly" ? "bg-navy text-bg font-semibold shadow-sm" : "text-muted hover:text-ink"}`}
             >
               Annual Access
               <span className="bg-[#DF9D38] text-[#0d1a2d] font-sans font-bold text-[8px] tracking-normal px-1.5 py-0.5 rounded uppercase leading-none">
                 Save 50%
               </span>
             </button>
           </div>
         </FadeUp>
         
         {/* VALUE CARDS */}
         <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch mb-24">
            {/* FREE TIER */}
            <FadeUp delay={150} className="h-full">
               <div className="border border-rule bg-paper rounded-[24px] p-10 h-full flex flex-col hover:border-ink/30 transition-colors">
                  <h3 className="font-sans font-semibold text-[22px] text-ink mb-2">Cadet (Free)</h3>
                  <p className="font-sans text-[13px] text-muted mb-8 font-light">Test the flight controls. Basic sandbox access.</p>
                  
                  <div className="font-serif text-[40px] md:text-[44px] leading-none text-muted mb-10 flex items-end">
                    Free
                  </div>
                  
                  <ul className="space-y-4 font-sans text-[14px] text-ink-2 mb-10 flex-1 border-t border-rule/50 pt-8">
                    <li className="flex items-center gap-4"><CheckCircle2 size={18} className="text-muted/60 shrink-0" /> 1 Full Course Subject</li>
                    <li className="flex items-center gap-4"><CheckCircle2 size={18} className="text-muted/60 shrink-0" /> First Chapter of other courses</li>
                    <li className="flex items-center gap-4"><CheckCircle2 size={18} className="text-muted/60 shrink-0" /> 1 Free Authority Mock Exam</li>
                    <li className="flex items-center gap-4"><CheckCircle2 size={18} className="text-muted/60 shrink-0" /> Basic telemetry logbook</li>
                    <li className="flex items-center gap-4 text-muted/60"><XCircle size={18} className="text-muted/40 shrink-0" /> No AI Instructor access</li>
                    <li className="flex items-center gap-4 text-muted/60"><XCircle size={18} className="text-muted/40 shrink-0" /> No study plan coaching</li>
                  </ul>
                  
                  <Link to="/modules" className="w-full">
                    <Button variant="ghost" className="w-full justify-center h-[52px] text-[14px] font-mono tracking-wider uppercase rounded-full">
                      Explore Free Sets
                    </Button>
                  </Link>
               </div>
            </FadeUp>
            
            {/* PRO TIER */}
            <FadeUp delay={250} className="h-full relative">
               <div className="absolute top-0 right-0 -tr-translate-y-1/2 translate-x-1/4 translate-y-[-16px] z-10">
                 <Chip variant="solid" className="bg-[#DF9D38] border-[#CF8E28] text-[#0d1a2d] text-[9px] px-3.5 py-1.5 shadow-md transform rotate-2 tracking-widest font-mono uppercase font-bold">★ PREFLIGHT CLEARANCE</Chip>
               </div>
               <div className={`border-2 ${isPro ? "border-mint" : "border-navy"} bg-paper rounded-[24px] p-10 h-full flex flex-col shadow-xl relative overflow-hidden`}>
                  <div className="absolute top-0 right-0 w-64 h-64 bg-navy/5 blur-3xl rounded-full translate-x-1/3 -translate-y-1/3" />
                  
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-sans font-semibold text-[22px] text-navy relative z-10">Captain (Pro)</h3>
                    {isPro && (
                      <span className="bg-mint text-bg font-mono font-bold text-[9px] py-1 px-2.5 rounded-full uppercase leading-none tracking-widest">
                        Active Plan
                      </span>
                    )}
                  </div>
                  <p className="font-sans text-[13px] text-navy/70 mb-8 font-medium relative z-10">The complete high-altitude arsenal.</p>
                  
                  <div className="font-serif text-[54px] md:text-[60px] text-ink mb-10 flex items-baseline gap-2 relative z-10 leading-none">
                    {billingInterval === "yearly" ? "₹2,999" : "₹499"}
                    <span className="font-sans text-[16px] text-muted font-light mb-1">
                      {billingInterval === "yearly" ? "/year" : "/month"}
                    </span>
                    {billingInterval === "yearly" && (
                      <span className="font-mono text-[9px] bg-mint text-bg font-bold px-2 py-1 rounded inline-block self-center tracking-wider ml-2 uppercase">
                        Save 50%
                      </span>
                    )}
                  </div>
                  
                  <ul className="space-y-4 font-sans text-[14px] text-ink-2 mb-10 flex-1 relative z-10 border-t border-rule/50 pt-8">
                    <li className="flex items-center gap-4 font-medium text-navy"><CheckCircle2 size={18} className="text-navy shrink-0" /> Full 6,940+ questions database</li>
                    <li className="flex items-center gap-4 font-medium text-navy"><CheckCircle2 size={18} className="text-navy shrink-0" /> Unlimited DGCA & EASA Mock Exams</li>
                    <li className="flex items-center gap-4 font-semibold text-navy"><Sparkles size={18} className="text-[#DF9D38] shrink-0" /> AI Ground Instructor explanation on demand</li>
                    <li className="flex items-center gap-4 font-medium text-navy"><CheckCircle2 size={18} className="text-navy shrink-0" /> Viva oral board preparation module</li>
                    <li className="flex items-center gap-4 font-medium text-navy"><CheckCircle2 size={18} className="text-navy shrink-0" /> Interactive weak-area heatmap & analytics</li>
                    <li className="flex items-center gap-4 font-semibold text-navy"><Sparkles size={18} className="text-[#DF9D38] shrink-0" /> AI Weakness Coach & 7-day study plan creators</li>
                  </ul>
                  
                  <div className="relative z-10 space-y-3">
                    {(!user || (userData?.plan === "free" && !userData?.trialUsed)) && (
                      <Button
                        variant="ghost"
                        onClick={handleStartTrial}
                        loading={isTrialLoading}
                        className="w-full justify-center h-[46px] text-xs font-mono tracking-wider uppercase rounded-full border-amber text-amber-700 hover:bg-amber-50 font-bold cursor-pointer"
                      >
                        Start 7-day free trial
                      </Button>
                    )}

                    <Button 
                      variant="primary" 
                      onClick={handleSubscribe} 
                      disabled={paymentLoading}
                      className={`w-full justify-center h-[52px] text-[14px] font-mono tracking-wider uppercase rounded-full shadow-lg ${isPro ? "bg-mint hover:bg-mint/90 text-bg" : "bg-navy hover:bg-navy/90 text-bg"}`}
                    >
                      {paymentLoading ? (
                        <span className="flex items-center gap-2">
                          <RefreshCw size={14} className="animate-spin" /> Preparing Launchpad...
                        </span>
                      ) : isPro ? (
                        " cleared for take-off"
                      ) : (
                        `Activate Pro Class`
                      )}
                    </Button>
                    <div className="text-center mt-4 font-mono text-[9px] text-muted tracking-widest uppercase">
                      {billingInterval === "yearly" ? "Billed once at ₹2,999 annually" : "Upgrade to annual later & save 50%"}
                    </div>
                  </div>
               </div>
            </FadeUp>
         </div>

         {/* COMPARISON TABLE */}
         <FadeUp delay={350}>
           <div className="border border-rule bg-paper rounded-2xl overflow-hidden shadow-sm">
             <div className="px-8 py-6 bg-paper-2 border-b border-rule flex items-center justify-between">
               <h3 className="font-serif text-lg text-ink font-semibold">Functional Matrix</h3>
               <span className="font-mono text-[9px] tracking-widest uppercase text-muted">Feature Comparison</span>
             </div>
             <table className="w-full text-left font-sans text-sm pb-4">
               <thead>
                 <tr className="border-b border-rule bg-panel font-mono text-[10px] text-muted uppercase tracking-wider">
                   <th className="py-4 px-6 md:px-8">Operational Feature</th>
                   <th className="py-4 px-4 w-32 md:w-44">Cadet Free</th>
                   <th className="py-4 px-4 w-32 md:w-44 text-navy">Captain Pro</th>
                 </tr>
               </thead>
               <tbody className="divide-y divide-rule/60 text-ink-2 font-light">
                 <tr>
                   <td className="py-4 px-6 md:px-8 font-medium text-ink">Aircraft Systems & Subject Access</td>
                   <td className="py-4 px-4 text-muted font-sans text-xs">1 Full module (Air Nav)</td>
                   <td className="py-4 px-4 text-navy font-medium font-sans text-xs">Unlimited All (15+ Subjects)</td>
                 </tr>
                 <tr>
                   <td className="py-4 px-6 md:px-8 font-medium text-ink">Chapter Syllabus Ingestion</td>
                   <td className="py-4 px-4 text-muted font-sans text-xs">Only Chapter 1 open</td>
                   <td className="py-4 px-4 text-navy font-medium font-sans text-xs">Unlimited full syllabus access</td>
                 </tr>
                 <tr>
                   <td className="py-4 px-6 md:px-8 font-medium text-ink">DGCA/EASA Simulator Mocks</td>
                   <td className="py-4 px-4 text-muted font-sans text-xs">1 mock (CPL Nav)</td>
                   <td className="py-4 px-4 text-navy font-medium font-sans text-xs">Unlimited timed exams</td>
                 </tr>
                 <tr>
                   <td className="py-4 px-6 md:px-8 font-medium text-ink">Ground Instructor AI Explanations</td>
                   <td className="py-4 px-4 text-muted font-sans text-xs font-mono text-[10px]">LOCKED</td>
                   <td className="py-4 px-4 text-navy font-medium font-sans text-xs flex items-center gap-1.5 font-mono text-[10px]"><Zap size={11} className="text-[#DF9D38]" /> UNLIMITED</td>
                 </tr>
                 <tr>
                   <td className="py-4 px-6 md:px-8 font-medium text-ink">Viva Oral Board Flashcards</td>
                   <td className="py-4 px-4 text-muted font-sans text-xs font-mono text-[10px]">LOCKED</td>
                   <td className="py-4 px-4 text-navy font-medium font-sans text-xs flex items-center gap-1.5 font-mono text-[10px]"><CheckCircle2 size={11} className="text-navy" /> ACTIVE</td>
                 </tr>
                 <tr>
                   <td className="py-4 px-6 md:px-8 font-medium text-ink">Dynamic Analytics & Diagnostic</td>
                   <td className="py-4 px-4 text-muted font-sans text-xs">Basic history log</td>
                   <td className="py-4 px-4 text-navy font-medium font-sans text-xs flex items-center gap-1.5 font-mono text-[10px]"><Zap size={11} className="text-[#DF9D38]" /> HEATMAPS & AI COACHING</td>
                 </tr>
               </tbody>
             </table>
           </div>
         </FadeUp>
      </section>
    </div>
  );
}
