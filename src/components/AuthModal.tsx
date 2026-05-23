import React, { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";
import { motion, AnimatePresence } from "motion/react";
import { X, Mail, Lock, User, Loader2, AlertCircle, CheckCircle, Eye, EyeOff } from "lucide-react";
import { Button, Card } from "./Atoms";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultTab?: "signin" | "signup" | "forgot";
}

export default function AuthModal({ isOpen, onClose, defaultTab = "signin" }: AuthModalProps) {
  const { signInWithGoogle } = useAuth();
  
  const [activeTab, setActiveTab] = useState<"signin" | "signup" | "forgot">(defaultTab);
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
    }
  }, [isOpen, defaultTab]);

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
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        throw error;
      }

      onClose(); // Close modal on success
    } catch (err: any) {
      console.error("Sign In Error:", err);
      // Map standard Firebase/Supabase style errors for better copy
      if (err.message?.includes("Invalid login credentials")) {
        setError("Incorrect email or password. Please try again.");
      } else if (err.message?.includes("Email not confirmed")) {
        setError("Your email address is not yet confirmed. Please check your inbox.");
      } else {
        setError(err.message || "An error occurred during sign in.");
      }
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

    if (password.length < 8) {
      setError("Password must be at least 8 characters long.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
          data: {
            display_name: displayName,
            full_name: displayName,
          },
        },
      });

      if (error) {
        throw error;
      }

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
      if (err.message?.includes("User already registered")) {
        setError("An account with this email address already exists.");
      } else {
        setError(err.message || "An error occurred during registration.");
      }
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

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) {
        throw error;
      }

      setSuccessMsg("We've sent a password reset link to your email address.");
      setEmail("");
    } catch (err: any) {
      console.error("Password Reset Error:", err);
      setError(err.message || "Could not process password reset request.");
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
      setError(err.message || "Google Sign-In failed.");
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
        {/* Backdrop overlay */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={loading ? undefined : onClose}
          className="fixed inset-0 bg-ink/30 dark:bg-black/60 backdrop-blur-md"
        />

        {/* Modal body container */}
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 15 }}
          transition={{ duration: 0.23, ease: "easeOut" }}
          className="relative w-full max-w-md z-10"
        >
          <Card className="p-6 md:p-8 bg-paper border border-rule-strong shadow-2xl relative">
            {/* Close button */}
            <button
              onClick={onClose}
              disabled={loading}
              className="absolute top-4 right-4 p-1.5 text-muted hover:text-ink hover:bg-bg-2 rounded-full cursor-pointer transition-colors"
              aria-label="Close authentication modal"
            >
              <X size={18} />
            </button>

            {/* Header branding */}
            <div className="text-center mb-6">
              <span className="font-mono text-[9px] text-muted-2 tracking-widest uppercase border border-rule px-2 py-0.5 rounded-sm">
                HEADING AV-SYS
              </span>
              <h2 className="font-serif text-2xl text-ink tracking-tight mt-3">
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
              <div className="mb-4 p-3 bg-signal-soft/50 border border-signal/20 text-signal text-xs rounded-lg flex items-start gap-2.5">
                <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
                <span className="font-sans font-medium">{error}</span>
              </div>
            )}

            {successMsg && (
              <div className="mb-4 p-3 bg-mint-soft/50 border border-mint/20 text-mint text-xs rounded-lg flex items-start gap-2.5">
                <CheckCircle size={16} className="mt-0.5 flex-shrink-0" />
                <span className="font-sans font-medium">{successMsg}</span>
              </div>
            )}

            {/* Main Tabs Form Content */}
            <div className="space-y-4">
              {activeTab === "signin" && (
                <form onSubmit={handleSignIn} className="space-y-4">
                  <div>
                    <label className="block text-xs font-mono text-muted uppercase tracking-wider mb-1.5">
                      Email Address
                    </label>
                    <div className="relative">
                      <Mail size={16} className="absolute left-3.5 top-3 text-muted-2" />
                      <input
                        type="email"
                        required
                        disabled={loading}
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="pilot@airline.com"
                        className="w-full h-[40px] pl-10 pr-4 bg-bg-2 border border-rule-strong rounded-lg text-sm text-ink font-sans focus:outline-none focus:border-ink transition-colors"
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-1.5">
                      <label className="block text-xs font-mono text-muted uppercase tracking-wider">
                        Password
                      </label>
                      <button
                        type="button"
                        onClick={() => setActiveTab("forgot")}
                        className="text-xs font-sans text-sky hover:text-sky/80 cursor-pointer"
                      >
                        Forgot password?
                      </button>
                    </div>
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

              {activeTab === "signup" && (
                <form onSubmit={handleSignUp} className="space-y-4">
                  <div>
                    <label className="block text-xs font-mono text-muted uppercase tracking-wider mb-1.5">
                      Display Name
                    </label>
                    <div className="relative">
                      <User size={16} className="absolute left-3.5 top-3 text-muted-2" />
                      <input
                        type="text"
                        required
                        disabled={loading}
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        placeholder="FirstOfficer John"
                        className="w-full h-[40px] pl-10 pr-4 bg-bg-2 border border-rule-strong rounded-lg text-sm text-ink font-sans focus:outline-none focus:border-ink transition-colors"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-mono text-muted uppercase tracking-wider mb-1.5">
                      Email Address
                    </label>
                    <div className="relative">
                      <Mail size={16} className="absolute left-3.5 top-3 text-muted-2" />
                      <input
                        type="email"
                        required
                        disabled={loading}
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="pilot@airline.com"
                        className="w-full h-[40px] pl-10 pr-4 bg-bg-2 border border-rule-strong rounded-lg text-sm text-ink font-sans focus:outline-none focus:border-ink transition-colors"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-mono text-muted uppercase tracking-wider mb-1.5">
                      Create Password
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
                    <label className="block text-xs font-mono text-muted uppercase tracking-wider mb-1.5">
                      Registered Email Address
                    </label>
                    <div className="relative">
                      <Mail size={16} className="absolute left-3.5 top-3 text-muted-2" />
                      <input
                        type="email"
                        required
                        disabled={loading}
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="pilot@airline.com"
                        className="w-full h-[40px] pl-10 pr-4 bg-bg-2 border border-rule-strong rounded-lg text-sm text-ink font-sans focus:outline-none focus:border-ink transition-colors"
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
                    <button
                      type="button"
                      onClick={() => setActiveTab("signup")}
                      className="text-indigo-600 dark:text-sky font-semibold hover:underline cursor-pointer"
                    >
                      Sign up
                    </button>
                  </p>
                )}
                {activeTab === "signup" && (
                  <p className="text-xs text-muted-2">
                    Already have an account?{" "}
                    <button
                      type="button"
                      onClick={() => setActiveTab("signin")}
                      className="text-indigo-600 dark:text-sky font-semibold hover:underline cursor-pointer"
                    >
                      Sign in
                    </button>
                  </p>
                )}
              </div>
            </div>
          </Card>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
