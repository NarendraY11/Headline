import React, { useEffect, useRef } from "react";
import { useAuth } from "../contexts/AuthContext";
import { Button } from "./Atoms";
import { useNavigate, useLocation } from "react-router-dom";
import { Lock, ArrowLeft } from "lucide-react";
import { useToast } from "./ui/Toast";
import { motion } from "motion/react";

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, openAuthModal, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { showToast } = useToast();
  const redirectTriggered = useRef(false);

  useEffect(() => {
    if (!authLoading && !user && !redirectTriggered.current) {
      redirectTriggered.current = true;
      
      // Capture user's attempted route (including queries)
      const targetPath = location.pathname + location.search;
      
      // Store in sessionStorage for full reloads and Google OAuth redirects
      sessionStorage.setItem("auth_redirect_path", targetPath);

      // Trigger standard 'Session Expired' toast notification immediately
      showToast({
        type: "error",
        title: "Session Expired",
        message: "Your authentication session is required or has expired. Please sign in to access details.",
        duration: 5000,
      });

      // Automatically open the sign-in modal on landing
      openAuthModal("signin");

      // Redirect user to the Home page of terminal while passing attempted path in navigation state
      navigate("/", { 
        replace: true, 
        state: { from: targetPath } 
      });
    }
  }, [user, authLoading, navigate, location, showToast, openAuthModal]);

  if (authLoading || (!user && redirectTriggered.current)) {
    return (
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
        className="AuthGuard min-h-[60vh] bg-bg flex flex-col items-center justify-center p-6 text-center relative border border-rule/50 rounded-2xl m-4 overflow-hidden"
      >
        {/* Subtle 'Auth Required' Lock Icon Overlay inside the container */}
        <motion.div 
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.1, duration: 0.4, ease: "easeOut" }}
          className="absolute inset-0 bg-paper/85 backdrop-blur-[4px] flex flex-col items-center justify-center z-10"
        >
          <div className="w-14 h-14 bg-navy/5 text-navy rounded-full flex items-center justify-center mb-4 border border-navy/15 shadow-sm animate-pulse">
            <Lock size={24} className="stroke-[1.7] text-ink" />
          </div>
          <h3 className="font-serif text-lg font-medium text-ink">Auth Required</h3>
          <p className="font-mono text-[9px] text-[#A66C23] tracking-widest mt-1 uppercase">
            Securing Connection & Redirecting...
          </p>
        </motion.div>

        {/* Muted background skeleton representing the page contents under the lock */}
        <div className="w-full max-w-xl space-y-4 opacity-15 select-none pointer-events-none">
          <div className="h-4 bg-ink/20 w-1/3 rounded"></div>
          <div className="h-28 bg-ink/20 w-full rounded-lg"></div>
          <div className="grid grid-cols-3 gap-3">
            <div className="h-16 bg-ink/20 rounded"></div>
            <div className="h-16 bg-ink/20 rounded"></div>
            <div className="h-16 bg-ink/20 rounded"></div>
          </div>
        </div>
      </motion.div>
    );
  }

  // Fallback view in case of state mismatch
  if (!user) {
    return (
      <div className="AuthGuard min-h-screen bg-bg flex flex-col items-center justify-center p-6">
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className="max-w-md w-full bg-panel border border-rule-strong rounded-2xl p-8 shadow-sm flex flex-col items-center text-center relative overflow-hidden"
        >
          {/* Subtle 'Auth Required' lock icon overlay inside the container */}
          <div className="absolute top-4 right-4 text-emerald-600/10">
            <Lock size={48} className="stroke-[1]" />
          </div>

          <div className="w-12 h-12 bg-navy/5 text-navy rounded-full flex items-center justify-center mb-6 border border-navy/15">
            <Lock size={22} className="stroke-[1.5]" />
          </div>
          
          <h1 className="font-serif text-2xl text-ink mb-1 font-semibold tracking-tight">Trainee Authentication Required</h1>
          <div className="font-mono text-[9px] text-[#A66C23] tracking-widest mb-4 uppercase">
            Restricted Flight Operations Space
          </div>
          
          <p className="text-xs text-muted-2 leading-relaxed mb-8 font-sans max-w-xs">
            To view interactive analytics, synchronized logbooks, and profile-specific features, please sign in or register an account.
          </p>

          <div className="flex flex-col gap-3 w-full">
            <Button 
              variant="primary" 
              onClick={() => openAuthModal("signin")}
              className="w-full justify-center gap-2 h-11 text-xs"
            >
              Sign In to Terminal
            </Button>
            
            <Button 
              variant="ghost" 
              onClick={() => navigate("/")}
              className="w-full justify-center gap-2 h-11 text-xs"
            >
              <ArrowLeft size={14} /> Return to Home
            </Button>
          </div>
        </motion.div>
      </div>
    );
  }

  // Authenticated -> render children
  return <>{children}</>;
}
