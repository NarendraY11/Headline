import React from "react";
import { useAuth } from "../contexts/AuthContext";
import { useIsAdmin } from "../hooks/useIsAdmin";
import { Button } from "./Atoms";
import { useNavigate } from "react-router-dom";
import { ShieldAlert, Key, LogOut } from "lucide-react";

export function AdminGuard({ children }: { children: React.ReactNode }) {
  const { user, signInWithGoogle, logout, loading: authLoading } = useAuth();
  const { isAdmin, checking: adminChecking } = useIsAdmin();
  const navigate = useNavigate();

  if (authLoading || adminChecking) {
    return (
      <div className="min-h-screen bg-canvas flex flex-col items-center justify-center p-6 text-center">
        <div className="w-12 h-12 border-4 border-ink border-t-transparent rounded-full animate-spin mb-4"></div>
        <div className="font-mono text-xs text-muted tracking-widest uppercase">Verifying Authorization...</div>
      </div>
    );
  }

  // Not signed in
  if (!user) {
    return (
      <div className="min-h-screen bg-canvas flex flex-col items-center justify-center p-6 bg-[#fbfaf6]">
        <div className="max-w-md w-full bg-surface border border-rule-strong rounded-2xl p-8 shadow-sm flex flex-col items-center text-center bg-white">
          <div className="w-12 h-12 bg-ink/5 text-ink rounded-full flex items-center justify-center mb-6">
            <Key size={24} />
          </div>
          <h1 className="font-serif text-2xl text-ink mb-2">Admin Access</h1>
          <p className="text-xs text-muted leading-relaxed mb-8 font-sans">
            This module is restricted to authorized credentials. Please sign in to authenticate.
          </p>
          <Button 
            variant="primary" 
            onClick={signInWithGoogle}
            className="w-full justify-center gap-2 h-11"
          >
            Authenticate with Google
          </Button>
          <button 
            type="button"
            onClick={() => navigate("/")}
            className="mt-6 font-mono text-[10px] text-muted hover:text-ink uppercase tracking-widest"
          >
            Return to Student Terminal
          </button>
        </div>
      </div>
    );
  }

  // Signed in but not admin
  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-canvas flex flex-col items-center justify-center p-6 bg-[#fbfaf6]">
        <div className="max-w-md w-full bg-surface border border-rule-strong rounded-2xl p-8 shadow-sm flex flex-col items-center text-center bg-white">
          <div className="w-12 h-12 bg-rose-500/10 text-rose-600 rounded-full flex items-center justify-center mb-6 animate-pulse">
            <ShieldAlert size={24} />
          </div>
          <h1 className="font-serif text-2xl text-ink mb-2">Access Denied</h1>
          <div className="font-mono text-[10px] text-rose-600 tracking-widest mb-4 uppercase">Restricted Area</div>
          <p className="text-xs text-muted leading-relaxed mb-8 font-sans">
            The account <span className="font-mono text-ink text-[11px] font-semibold">{user.email}</span> does not have administrative privileges.
          </p>
          <div className="flex flex-col gap-3 w-full">
            <Button 
              variant="ghost" 
              onClick={() => navigate("/")}
              className="w-full justify-center"
            >
              Back to Home
            </Button>
            <button 
              type="button"
              onClick={() => logout()}
              className="flex items-center justify-center gap-1.5 font-mono text-[10px] text-muted hover:text-rose-600 uppercase tracking-widest mt-4"
            >
              <LogOut size={12} /> Sign out / Switch account
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Admin -> render children
  return <>{children}</>;
}
