import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { motion } from "motion/react";
import { Lock, Loader2, AlertCircle, CheckCircle, Eye, EyeOff, ShieldCheck } from "lucide-react";
import { Button, Card } from "../components/Atoms";
import { validatePasswordStrength, isPwnedPassword, tooManyPasswordAttempts } from "../lib/passwordSecurity";

export default function ResetPasswordView() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Verify that we actually have a session or recovery parameters (optional, but good practice)
  useEffect(() => {
    async function checkSession() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        // Let them know, but don't strictly block in case hash parsing is delayed
        console.warn("No active recovery session found. The token might have expired or wasn't captured yet.");
      }
    }
    checkSession();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password || !confirmPassword) {
      setError("Please fill in both password fields.");
      return;
    }

    const strengthError = validatePasswordStrength(password);
    if (strengthError) {
      setError(strengthError);
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    // (4) Throttle attempts to 5/min.
    if (tooManyPasswordAttempts("reset")) {
      setError("Too many attempts. Please wait a minute and try again.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // (2) Reject passwords found in known breach corpora.
      if (await isPwnedPassword(password)) {
        setError("This password has appeared in a data breach. Please choose a different one.");
        setLoading(false);
        return;
      }

      const { error } = await supabase.auth.updateUser({
        password: password,
      });

      if (error) {
        throw error;
      }

      // Invalidate every existing session after a password change: revoke all
      // refresh tokens server-side (global scope) so any device using the old
      // password is logged out. The user re-authenticates with the new one.
      try {
        await supabase.auth.signOut({ scope: "global" });
      } catch (revokeErr) {
        console.warn("Post-reset session revocation failed:", revokeErr);
      }

      setSuccess(true);
      // Wait a moment and navigate or let them click
    } catch (err: any) {
      console.error("Password change error:", err);
      setError(err.message || "Failed to update your password. Please requests another reset link.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center p-4 bg-bg font-sans">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <Card className="p-6 md:p-8 bg-paper border border-rule-strong shadow-2xl">
          <div className="text-center mb-6">
            <div className="mx-auto w-12 h-12 bg-navy-soft text-navy rounded-full flex items-center justify-center mb-4">
              <ShieldCheck size={24} />
            </div>
            <span className="font-mono text-[9px] text-muted-2 tracking-widest uppercase border border-rule px-2 py-0.5 rounded-sm">
              COCKPIT SECURITY
            </span>
            <h1 className="font-serif text-2xl text-ink tracking-tight mt-3">
              Configure New Password
            </h1>
            <p className="font-sans text-xs text-muted mt-1.5 animate-pulse">
              Establish your new authentication key for safe system clearance.
            </p>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-signal-soft/50 border border-signal/20 text-signal text-xs rounded-lg flex items-start gap-2.5">
              <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
              <span className="font-sans font-medium">{error}</span>
            </div>
          )}

          {success ? (
            <div className="space-y-4">
              <div className="p-4 bg-mint-soft/50 border border-mint/20 text-mint text-xs rounded-lg flex items-start gap-2.5">
                <CheckCircle size={18} className="flex-shrink-0" />
                <div>
                  <h3 className="font-bold text-sm mb-1">Authorization Updated!</h3>
                  <p className="text-ink-2 font-normal leading-normal">
                    Your password has been changed successfully. You can now use your email and new password to sign into Heading.
                  </p>
                </div>
              </div>
              <Button
                variant="primary"
                onClick={() => navigate("/")}
                className="w-full justify-center"
              >
                Go to Homepage
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-mono text-muted uppercase tracking-wider mb-1.5">
                  New Password
                </label>
                <div className="relative">
                  <Lock size={16} className="absolute left-3.5 top-3 text-muted-2" />
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    disabled={loading}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full h-[40px] pl-10 pr-10 bg-bg-2 border border-rule-strong rounded-lg text-sm text-ink font-sans focus:outline-none focus:border-ink transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-3 text-muted-2 hover:text-ink cursor-pointer"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                <span className="block mt-1.5 font-sans text-[10px] text-muted-2">
                  Password must be at least 8 characters long.
                </span>
              </div>

              <div>
                <label className="block text-xs font-mono text-muted uppercase tracking-wider mb-1.5">
                  Confirm Password
                </label>
                <div className="relative">
                  <Lock size={16} className="absolute left-3.5 top-3 text-muted-2" />
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    required
                    disabled={loading}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full h-[40px] pl-10 pr-10 bg-bg-2 border border-rule-strong rounded-lg text-sm text-ink font-sans focus:outline-none focus:border-ink transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3.5 top-3 text-muted-2 hover:text-ink cursor-pointer"
                  >
                    {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                variant="primary"
                disabled={loading}
                className="w-full h-[44px] justify-center mt-2.5"
              >
                {loading ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Updating Security Seals...
                  </>
                ) : (
                  "Change Password"
                )}
              </Button>
            </form>
          )}
        </Card>
      </motion.div>
    </div>
  );
}
