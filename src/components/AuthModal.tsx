import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";
import { useToast } from "./ui/Toast";
import FocusTrap from "focus-trap-react";
import { X, Mail, Lock, User, Loader2, AlertCircle, CheckCircle, Eye, EyeOff } from "lucide-react";
import { Button, Card } from "./Atoms";
import { useFeature } from "../hooks/useFeatureFlags";
import { validatePasswordStrength, isPwnedPassword, tooManyPasswordAttempts } from "../lib/passwordSecurity";
import { logAuthEvent } from "../lib/authEvents";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultTab?: "signin" | "signup" | "forgot";
}

export default function AuthModal({ isOpen, onClose, defaultTab = "signin" }: AuthModalProps) {
  const { signInWithGoogle } = useAuth();
  const { showToast } = useToast();
  const signupsOpen = useFeature("signupsOpen");
  
  const [activeTab, setActiveTab] = useState<"signin" | "signup" | "forgot">(
    defaultTab === "signup" && !signupsOpen ? "signin" : defaultTab
  );
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Form Fields
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [displayName, setDisplayName] = useState("");

  // States
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const scrollInputIntoView = useCallback((e: React.FocusEvent<HTMLInputElement>) => {
    e.target.scrollIntoView({ block: "center", behavior: "smooth" });
  }, []);

  function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error("Request timed out. Check your connection and try again.")), ms)
      ),
    ]);
  }

  // Sync state if defaultTab changes when opening modal
  useEffect(() => {
    if (isOpen) {
      setActiveTab(defaultTab);
      setError(null);
      setSuccessMsg(null);
      // Clear inputs
      setEmail("");
      setPassword("");
      setConfirmPassword("");
      setDisplayName("");

      const handleEscape = (e: KeyboardEvent) => {
        if (e.key === "Escape" && !loading) {
          onClose();
        }
      };
      window.addEventListener("keydown", handleEscape);
      return () => {
        window.removeEventListener("keydown", handleEscape);
      };
    }
  }, [isOpen, defaultTab, loading, onClose]);

  if (!isOpen) return null;

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError("Please fill in all fields.");
      return;
    }

    setLoading(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const { error } = await withTimeout(
        supabase.auth.signInWithPassword({ email, password }),
        15_000
      );

      if (error) {
        throw error;
      }

      logAuthEvent("login_success", email);
      onClose(); // Close modal on success
    } catch (err: any) {
      logAuthEvent("login_failed", email);
      console.error("Sign In Error:", err);
      // Map standard Firebase/Supabase style errors for better copy
      let msg = err.message || "An error occurred during sign in.";
      if (err.message?.includes("Invalid login credentials") || err.message?.includes("Invalid password") || err.message?.includes("Invalid credentials")) {
        msg = "Incorrect email or password. Please try again.";
      } else if (err.message?.includes("Email not confirmed")) {
        msg = "Your email address is not yet confirmed. Please check your inbox.";
      } else if (err.message?.includes("Rate limit") || err.message?.includes("Too many requests")) {
        msg = "Too many attempts. Please try again later.";
      }
      setError(msg);
      showToast({ type: 'error', title: 'Sign In Failed', message: msg });
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName || !email || !password || !confirmPassword) {
      setError("Please fill in all fields.");
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

    // (4) Throttle attempts to 5/min per email.
    if (tooManyPasswordAttempts(`signup:${email.trim().toLowerCase()}`)) {
      setError("Too many attempts. Please wait a minute and try again.");
      return;
    }

    setLoading(true);
    setError(null);
    setSuccessMsg(null);

    try {
      // (2) Reject passwords found in known breach corpora.
      if (await isPwnedPassword(password)) {
        setError("This password has appeared in a data breach. Please choose a different one.");
        setLoading(false);
        return;
      }

      const { data, error } = await withTimeout(
        supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/`,
            data: {
              display_name: displayName,
              full_name: displayName,
            },
          },
        }),
        15_000
      );

      if (error) {
        throw error;
      }

      logAuthEvent("signup", email);
      // Check if user is automatically logged in or needs verification
      if (data?.user && data.session) {
        // Logged in directly, close modal
        onClose();
      } else {
        setSuccessMsg("Check your email to confirm your account and complete sign-up!");
        // Reset states but keep message
        setEmail("");
        setPassword("");
        setConfirmPassword("");
        setDisplayName("");
      }
    } catch (err: any) {
      console.error("Sign Up Error:", err);
      let msg = err.message || "An error occurred during registration.";
      if (err.message?.includes("User already registered") || err.message?.includes("User already exists")) {
        msg = "An account with this email address already exists.";
      } else if (err.message?.includes("Rate limit") || err.message?.includes("Too many requests")) {
        msg = "Too many attempts. Please try again later.";
      }
      setError(msg);
      showToast({ type: 'error', title: 'Sign Up Failed', message: msg });
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setError("Please enter your email address.");
      return;
    }

    setLoading(true);
    setError(null);
    setSuccessMsg(null);

    // (5) Always show the same neutral message regardless of whether the email
    // is registered — never reveal account existence. The only error surfaced
    // is throttling, which does not leak existence.
    const neutralMsg = "If an account exists for that email, we've sent a password reset link.";
    try {
      await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      logAuthEvent("password_reset_requested", email);
      setSuccessMsg(neutralMsg);
      setEmail("");
    } catch (err: any) {
      console.error("Password Reset Error:", err);
      if (err?.message && /rate|too many/i.test(err.message)) {
        setError("Too many attempts. Please wait a minute and try again.");
      } else {
        // Swallow other errors: showing them could reveal whether the account
        // exists. Present the same neutral confirmation.
        setSuccessMsg(neutralMsg);
        setEmail("");
      }
    } finally {
      setLoading(false);
    }
  };

  const triggerGoogleSignIn = async () => {
    setLoading(true);
    setError(null);
    try {
      await signInWithGoogle();
    } catch (err: any) {
      const msg = err.message || "Google Sign-In failed.";
      setError(msg);
      showToast({ type: 'error', title: 'Authentication Error', message: msg });
      setLoading(false);
    }
  };

  return (
    <>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <FocusTrap focusTrapOptions={{ initialFocus: false, escapeDeactivates: false, clickOutsideDeactivates: false, returnFocusOnDeactivate: true }}>
            <div className="fixed inset-0 flex items-center justify-center pointer-events-none">
              {/* Backdrop overlay */}
              <div role="button" tabIndex={0} aria-label="Close dialog" onKeyDown={(e) => { if(e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.currentTarget.click(); } }}
                onClick={loading ? undefined : onClose}
                className="anim-fade fixed inset-0 bg-ink/40 dark:bg-black/60 backdrop-blur-md pointer-events-auto"
              />

              {/* Modal body container */}
              <div
                className="anim-pop relative w-full max-w-md z-10 pointer-events-auto mx-4"
                role="dialog"
                aria-modal="true"
                aria-labelledby="modal-title"
              >
                <Card className="p-6 md:p-8 pb-[max(1.5rem,env(safe-area-inset-bottom))] bg-paper border border-rule-strong shadow-2xl relative max-h-[calc(100dvh-2rem)] overflow-y-auto">
                  {/* Close button */}
                  <button
                    onClick={onClose}
                    disabled={loading}
                    className="absolute top-4 right-4 p-2.5 min-w-[44px] min-h-[44px] text-muted hover:text-ink hover:bg-bg-2 rounded-full cursor-pointer transition-colors flex items-center justify-center"
                    aria-label="Close authentication modal"
                  >
                    <X size={18} />
                  </button>

            {/* Header branding */}
            <div className="text-center mb-6">
              <span className="font-mono text-[9px] text-muted-2 tracking-widest uppercase border border-rule px-2 py-0.5 rounded-sm">
                HEADING AV-SYS
              </span>
              <h2 id="modal-title" className="font-serif text-2xl text-ink tracking-tight mt-3">
                {activeTab === "signin" && "Welcome Aviator"}
                {activeTab === "signup" && "Enlist New Candidate"}
                {activeTab === "forgot" && "Reset Cockpit Authorization"}
              </h2>
              <p className="font-sans text-xs text-muted mt-1.5">
                {activeTab === "signin" && "Access your pilot logbook and practice modules."}
                {activeTab === "signup" && "Create an account to track metrics across devices."}
                {activeTab === "forgot" && "Retrieve your credential configurations safely."}
              </p>
            </div>

            {/* Alert / Messages */}
            {error && (
              <div id="auth-error" role="alert" aria-live="assertive" className="mb-4 p-3 bg-signal-soft/50 border border-signal/20 text-signal text-xs rounded-lg flex items-start gap-2.5">
                <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
                <span className="font-sans font-medium">{error}</span>
              </div>
            )}

            {successMsg && (
              <div role="status" aria-live="polite" className="mb-4 p-3 bg-mint-soft/50 border border-mint/20 text-mint text-xs rounded-lg flex items-start gap-2.5">
                <CheckCircle size={16} className="mt-0.5 flex-shrink-0" />
                <span className="font-sans font-medium">{successMsg}</span>
              </div>
            )}

            {/* Main Tabs Form Content */}
            <div className="space-y-4">
              {activeTab === "signin" && (
                <form onSubmit={handleSignIn} className="space-y-4">
                  <div>
                    <label htmlFor="signin-email" className="block text-xs font-mono text-muted uppercase tracking-wider mb-1.5">
                      Email Address
                    </label>
                    <div className="relative">
                      <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-2 pointer-events-none" />
                      <input
                        id="signin-email"
                        name="email"
                        type="email"
                        autoComplete="email"
                        inputMode="email"
                        required
                        aria-invalid={!!error}
                        disabled={loading}
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        onFocus={scrollInputIntoView}
                        placeholder="pilot@airline.com"
                        className="w-full h-[44px] pl-10 pr-4 bg-bg-2 border border-rule-strong rounded-lg text-sm text-ink font-sans focus:outline-none focus:border-ink transition-colors"
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-1.5">
                      <label htmlFor="signin-password" className="block text-xs font-mono text-muted uppercase tracking-wider">
                        Password
                      </label>
                      <button
                        type="button"
                        onClick={() => setActiveTab("forgot")}
                        className="text-xs font-sans text-sky hover:text-sky/80 cursor-pointer min-h-[44px] flex items-center px-1"
                      >
                        Forgot password?
                      </button>
                    </div>
                    <div className="relative">
                      <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-2 pointer-events-none" />
                      <input
                        id="signin-password"
                        name="password"
                        type={showPassword ? "text" : "password"}
                        autoComplete="current-password"
                        enterKeyHint="go"
                        required
                        aria-invalid={!!error}
                        disabled={loading}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        onFocus={scrollInputIntoView}
                        placeholder="••••••••"
                        className="w-full h-[44px] pl-10 pr-10 bg-bg-2 border border-rule-strong rounded-lg text-sm text-ink font-sans focus:outline-none focus:border-ink transition-colors"
                      />
                      <button
                        type="button"
                        aria-label={showPassword ? "Hide password" : "Show password"}
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-0 top-0 bottom-0 px-3 flex items-center text-muted-2 hover:text-ink cursor-pointer"
                      >
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
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
                        Verifying Clearances...
                      </>
                    ) : (
                      "Sign In"
                    )}
                  </Button>
                </form>
              )}

              {activeTab === "signup" && !signupsOpen && (
                <div className="py-8 text-center">
                  <AlertCircle size={32} className="mx-auto text-muted-2 mb-3" />
                  <p className="font-medium text-ink">Registration is currently closed.</p>
                  <p className="text-sm text-muted-2 mt-1">We are not accepting new accounts at this time. Please check back later.</p>
                </div>
              )}

              {activeTab === "signup" && signupsOpen && (
                <form onSubmit={handleSignUp} className="space-y-4">
                  <div>
                    <label htmlFor="signup-name" className="block text-xs font-mono text-muted uppercase tracking-wider mb-1.5">
                      Display Name
                    </label>
                    <div className="relative">
                      <User size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-2 pointer-events-none" />
                      <input
                        id="signup-name"
                        name="name"
                        type="text"
                        autoComplete="name"
                        required
                        aria-invalid={!!error}
                        disabled={loading}
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        onFocus={scrollInputIntoView}
                        placeholder="FirstOfficer John"
                        className="w-full h-[44px] pl-10 pr-4 bg-bg-2 border border-rule-strong rounded-lg text-sm text-ink font-sans focus:outline-none focus:border-ink transition-colors"
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="signup-email" className="block text-xs font-mono text-muted uppercase tracking-wider mb-1.5">
                      Email Address
                    </label>
                    <div className="relative">
                      <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-2 pointer-events-none" />
                      <input
                        id="signup-email"
                        name="email"
                        type="email"
                        autoComplete="email"
                        inputMode="email"
                        required
                        aria-invalid={!!error}
                        disabled={loading}
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        onFocus={scrollInputIntoView}
                        placeholder="pilot@airline.com"
                        className="w-full h-[44px] pl-10 pr-4 bg-bg-2 border border-rule-strong rounded-lg text-sm text-ink font-sans focus:outline-none focus:border-ink transition-colors"
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="signup-password" className="block text-xs font-mono text-muted uppercase tracking-wider mb-1.5">
                      Create Password
                    </label>
                    <div className="relative">
                      <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-2 pointer-events-none" />
                      <input
                        id="signup-password"
                        name="new-password"
                        type={showPassword ? "text" : "password"}
                        autoComplete="new-password"
                        aria-describedby="signup-password-hint"
                        required
                        aria-invalid={!!error}
                        disabled={loading}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        onFocus={scrollInputIntoView}
                        placeholder="••••••••"
                        className="w-full h-[44px] pl-10 pr-10 bg-bg-2 border border-rule-strong rounded-lg text-sm text-ink font-sans focus:outline-none focus:border-ink transition-colors"
                      />
                      <button
                        type="button"
                        aria-label={showPassword ? "Hide password" : "Show password"}
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-0 top-0 bottom-0 px-3 flex items-center text-muted-2 hover:text-ink cursor-pointer"
                      >
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                    <span id="signup-password-hint" className="block mt-1.5 font-sans text-[10px] text-muted-2">
                      At least 8 characters. Common or previously-breached passwords are rejected.
                    </span>
                  </div>

                  <div>
                    <label htmlFor="signup-confirm" className="block text-xs font-mono text-muted uppercase tracking-wider mb-1.5">
                      Confirm Password
                    </label>
                    <div className="relative">
                      <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-2 pointer-events-none" />
                      <input
                        id="signup-confirm"
                        name="confirm-password"
                        type={showConfirmPassword ? "text" : "password"}
                        autoComplete="new-password"
                        enterKeyHint="go"
                        required
                        aria-invalid={!!error}
                        disabled={loading}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        onFocus={scrollInputIntoView}
                        placeholder="••••••••"
                        className="w-full h-[44px] pl-10 pr-10 bg-bg-2 border border-rule-strong rounded-lg text-sm text-ink font-sans focus:outline-none focus:border-ink transition-colors"
                      />
                      <button
                        type="button"
                        aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-0 top-0 bottom-0 px-3 flex items-center text-muted-2 hover:text-ink cursor-pointer"
                      >
                        {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>

                  <Button
                    type="submit"
                    variant="primary"
                    disabled={loading}
                    className="w-full h-[44px] justify-center mt-2"
                  >
                    {loading ? (
                      <>
                        <Loader2 size={16} className="animate-spin" />
                        Transmitting flight manifest...
                      </>
                    ) : (
                      "Create Account"
                    )}
                  </Button>
                </form>
              )}

              {activeTab === "forgot" && (
                <form onSubmit={handleForgotPassword} className="space-y-4">
                  <div>
                    <label htmlFor="forgot-email" className="block text-xs font-mono text-muted uppercase tracking-wider mb-1.5">
                      Registered Email Address
                    </label>
                    <div className="relative">
                      <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-2 pointer-events-none" />
                      <input
                        id="forgot-email"
                        name="email"
                        type="email"
                        autoComplete="email"
                        inputMode="email"
                        enterKeyHint="send"
                        required
                        aria-invalid={!!error}
                        disabled={loading}
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        onFocus={scrollInputIntoView}
                        placeholder="pilot@airline.com"
                        className="w-full h-[44px] pl-10 pr-4 bg-bg-2 border border-rule-strong rounded-lg text-sm text-ink font-sans focus:outline-none focus:border-ink transition-colors"
                      />
                    </div>
                    <p className="mt-1.5 text-[10px] text-muted-2 leading-normal">
                      We'll dispatch a safe routing recovery token allowing manual password reset configuration.
                    </p>
                  </div>

                  <div className="flex gap-3 pt-2">
                    <Button
                      type="button"
                      variant="ghost"
                      disabled={loading}
                      onClick={() => setActiveTab("signin")}
                      className="w-1/3 justify-center"
                    >
                      Back
                    </Button>
                    <Button
                      type="submit"
                      variant="primary"
                      disabled={loading}
                      className="flex-grow justify-center"
                    >
                      {loading ? (
                        <>
                          <Loader2 size={16} className="animate-spin" />
                          Sending...
                        </>
                      ) : (
                        "Send reset link"
                      )}
                    </Button>
                  </div>
                </form>
              )}

              {/* Providers separation divider */}
              {activeTab !== "forgot" && (
                <>
                  <div className="relative py-3 flex items-center">
                    <div className="flex-grow border-t border-rule"></div>
                    <span className="flex-shrink mx-4 text-[10px] font-mono text-muted-2 uppercase tracking-widest">
                      or
                    </span>
                    <div className="flex-grow border-t border-rule"></div>
                  </div>

                  <Button
                    type="button"
                    variant="paper"
                    disabled={loading}
                    onClick={triggerGoogleSignIn}
                    className="w-full hover:bg-bg-2 flex items-center justify-center gap-3 relative border-rule-strong h-[42px]"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24">
                      <path
                        fill="currentColor"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                      <path
                        fill="currentColor"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="currentColor"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.85z"
                      />
                      <path
                        fill="currentColor"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.85c.87-2.6 3.3-4.53 6.16-4.53z"
                      />
                    </svg>
                    Continue with Google
                  </Button>
                </>
              )}

              {/* Bottom switcher action lines */}
              <div className="text-center pt-2">
                {activeTab === "signin" && (
                  <p className="text-xs text-muted-2">
                    Don't have an account?{" "}
                    {signupsOpen ? (
                      <button
                        type="button"
                        onClick={() => setActiveTab("signup")}
                        className="text-indigo-600 dark:text-sky font-semibold hover:underline cursor-pointer py-2 px-1 inline-flex items-center min-h-[44px]"
                      >
                        Sign up
                      </button>
                    ) : (
                      <span className="text-muted-2">Signups closed for now.</span>
                    )}
                  </p>
                )}
                {activeTab === "signup" && (
                  <p className="text-xs text-muted-2">
                    Already have an account?{" "}
                    <button
                      type="button"
                      onClick={() => setActiveTab("signin")}
                      className="text-indigo-600 dark:text-sky font-semibold hover:underline cursor-pointer py-2 px-1 inline-flex items-center min-h-[44px]"
                    >
                      Sign in
                    </button>
                  </p>
                )}
              </div>
            </div>
          </Card>
        </div>
      </div>
      </FocusTrap>
      </div>
      )}
    </>
  );
}
