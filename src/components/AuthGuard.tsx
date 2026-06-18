import React, { useEffect, useRef } from "react";
import { useAuth } from "../contexts/AuthContext";
import { Button } from "./Atoms";
import { useNavigate, useLocation } from "react-router-dom";
import { Lock, ArrowLeft } from "lucide-react";
import { useToast } from "./ui/Toast";

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

      // Distinguish first-time visitors (no stored token) from expired sessions.
      // Supabase persists the session under a "sb-*-auth-token" key in localStorage.
      const hadPriorSession =
        typeof window !== "undefined" &&
        Object.keys(localStorage).some((k) => k.startsWith("sb-") && k.includes("auth-token"));

      showToast({
        type: hadPriorSession ? "error" : "info",
        title: hadPriorSession ? "Session Expired" : "Sign in to continue",
        message: hadPriorSession
          ? "Your session has expired. Please sign in again to resume studying."
          : "Create a free account or sign in to access this feature.",
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
    // Two distinct states share this skeleton:
    //  - redirecting: auth resolved, the user is NOT signed in -> redirect home.
    //  - !redirecting (authLoading): auth state still resolving / a signed-in
    //    user's profile is loading. Showing "Auth Required" here is wrong and
    //    alarms users who just logged in successfully — use neutral copy.
    const redirecting = !authLoading && !user && redirectTriggered.current;
    return (
      <div
        className="anim-fade AuthGuard min-h-[60vh] bg-bg flex flex-col items-center justify-center p-6 text-center relative border border-rule/50 rounded-2xl m-4 overflow-hidden"
      >
        <div
          className="anim-pop absolute inset-0 bg-paper/85 backdrop-blur-[4px] flex flex-col items-center justify-center z-10"
        >
          <div className="w-14 h-14 bg-navy/5 text-navy rounded-full flex items-center justify-center mb-4 border border-navy/15 shadow-sm animate-pulse">
            <Lock size={24} className="stroke-[1.7] text-ink" />
          </div>
          <h3 className="font-serif text-lg font-medium text-ink">
            {redirecting ? "Auth Required" : "Signing you in"}
          </h3>
          <p className="font-mono text-[9px] text-[#A66C23] tracking-widest mt-1 uppercase">
            {redirecting ? "Securing Connection & Redirecting..." : "Loading your flight deck..."}
          </p>
        </div>

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
      </div>
    );
  }

  // Fallback view in case of state mismatch
  if (!user) {
    return (
      <div className="AuthGuard min-h-screen bg-bg flex flex-col items-center justify-center p-6">
        <div
          className="anim-pop max-w-md w-full bg-panel border border-rule-strong rounded-2xl p-8 shadow-sm flex flex-col items-center text-center relative overflow-hidden"
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
        </div>
      </div>
    );
  }

  // Authenticated -> render children
  return <>{children}</>;
}
