// UX-Nav Phase 2C: Account tab — account management. Security (email, password),
// Sessions (sign out / sign out everywhere), and a visually-isolated Danger Zone
// for the destructive logbook wipe. Real actions only; Delete account / Export
// data / Connected providers are disabled "Coming soon" rows (no backend yet).

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertCircle, AlertTriangle, KeyRound, LogOut, Mail } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { useToast } from "../../components/ui/Toast";
import { Button, Card } from "../../components/Atoms";

export default function AccountTab() {
  const { user, logout, logoutEverywhere, resetAccount } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isWiping, setIsWiping] = useState(false);
  const [confirmSignOutAll, setConfirmSignOutAll] = useState(false);
  const [confirmWipe, setConfirmWipe] = useState(false);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try { await logout(); }
    catch { setIsLoggingOut(false); showToast({ type: "error", title: "Sign Out Failed", message: "Could not sign out. Please try again." }); }
  };

  const handleLogoutEverywhere = async () => {
    setIsLoggingOut(true);
    try { await logoutEverywhere(); }
    catch { setIsLoggingOut(false); showToast({ type: "error", title: "Sign Out Failed", message: "Could not sign out of all devices. Please try again." }); }
  };

  const handleWipe = async () => {
    setIsWiping(true);
    try {
      await resetAccount();
      showToast({ type: "success", title: "Logbook Wiped", message: "All progress, attempts, and streaks have been cleared." });
    } catch (e: any) {
      showToast({ type: "error", title: "Wipe Failed", message: e?.message || "Could not clear progress. Please try again." });
    } finally {
      setIsWiping(false);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      {/* ── Security ── */}
      <Card className="bg-paper p-6">
        <span className="font-mono text-[10px] uppercase tracking-widest text-muted-2 font-bold block mb-4">Security</span>
        <div className="divide-y divide-rule">
          <div className="flex items-center justify-between gap-4 py-3.5">
            <div className="flex items-center gap-3 min-w-0">
              <Mail size={16} className="text-muted-2 shrink-0" />
              <div className="min-w-0">
                <div className="font-sans text-sm font-medium text-ink">Email</div>
                <div className="font-mono text-[11px] text-muted-2 truncate">{user?.email}</div>
              </div>
            </div>
          </div>
          <div className="flex items-center justify-between gap-4 py-3.5">
            <div className="flex items-center gap-3 min-w-0">
              <KeyRound size={16} className="text-muted-2 shrink-0" />
              <div className="min-w-0">
                <div className="font-sans text-sm font-medium text-ink">Password</div>
                <div className="font-mono text-[11px] text-muted-2">Update via secure reset link</div>
              </div>
            </div>
            <Button variant="ghost" size="small" className="border border-rule text-ink hover:bg-bg-2 text-xs h-9 shrink-0" onClick={() => navigate("/reset-password")}>
              Change password
            </Button>
          </div>
        </div>
      </Card>

      {/* ── Sessions ── */}
      <Card className="bg-paper p-6">
        <span className="font-mono text-[10px] uppercase tracking-widest text-muted-2 font-bold block mb-2">Sessions</span>
        <p className="font-sans text-sm text-ink-2 font-light leading-relaxed mb-4">Sign out of this device, or end every active session at once.</p>
        <div className="flex flex-col gap-3">
          <Button variant="ghost" onClick={handleLogout} disabled={isLoggingOut} className="gap-2 justify-center border border-rule-strong text-ink hover:bg-bg-2 disabled:opacity-50 disabled:cursor-not-allowed">
            <LogOut size={16} /> {isLoggingOut ? "Signing out…" : "Sign out"}
          </Button>
          {confirmSignOutAll ? (
            <div className="border border-amber/30 bg-amber-soft/40 rounded-lg p-3 flex flex-col gap-2">
              <p className="font-sans text-xs text-ink-2 leading-relaxed">This ends every active session, including this one. Continue?</p>
              <div className="flex gap-2">
                <Button variant="ghost" className="flex-1 min-h-[44px] text-xs border border-amber/40 text-amber hover:bg-amber-soft disabled:opacity-50" disabled={isLoggingOut} onClick={() => { setConfirmSignOutAll(false); handleLogoutEverywhere(); }}>
                  {isLoggingOut ? "Signing out…" : "Sign out everywhere"}
                </Button>
                <Button variant="ghost" className="min-h-[44px] text-xs border border-rule text-muted hover:bg-bg-2" onClick={() => setConfirmSignOutAll(false)}>Cancel</Button>
              </div>
            </div>
          ) : (
            <button type="button" onClick={() => setConfirmSignOutAll(true)} className="text-[11px] font-sans text-muted-2 hover:text-signal underline underline-offset-2 transition-colors self-center min-h-[44px] flex items-center px-2">
              Lost a device? Sign out of all devices
            </button>
          )}
        </div>
      </Card>

      {/* ── Future account actions (no backend yet) ── */}
      <Card className="bg-paper p-6">
        <span className="font-mono text-[10px] uppercase tracking-widest text-muted-2 font-bold block mb-3">Data & Privacy</span>
        <div className="divide-y divide-rule">
          {[
            { title: "Export my data", desc: "Download your study history and account data" },
            { title: "Connected providers", desc: "Manage linked sign-in providers" },
            { title: "Delete account", desc: "Permanently remove your account and all data" },
          ].map((row) => (
            <div key={row.title} className="flex items-center justify-between gap-4 py-3.5 opacity-50" aria-disabled="true">
              <div className="min-w-0">
                <div className="font-sans text-sm font-medium text-ink">{row.title}</div>
                <div className="font-mono text-[11px] text-muted-2 truncate">{row.desc}</div>
              </div>
              <span className="font-mono text-[9px] uppercase tracking-widest text-muted-2 border border-rule rounded-full px-2.5 py-1 shrink-0">Coming soon</span>
            </div>
          ))}
        </div>
      </Card>

      {/* ── Danger Zone — isolated below a clear divider, never adjacent to Sign out ── */}
      <div className="pt-2">
        <div className="flex items-center gap-3 mb-3">
          <div className="h-px bg-signal/30 flex-1" />
          <span className="font-mono text-[10px] uppercase tracking-widest text-signal font-bold">Danger Zone</span>
          <div className="h-px bg-signal/30 flex-1" />
        </div>
        <div className="border-[1.5px] border-signal/30 bg-signal/5 rounded-2xl p-6 flex flex-col items-start gap-3">
          <div className="flex items-center gap-3">
            <AlertCircle size={20} className="text-signal" />
            <span className="font-sans font-semibold text-base text-ink">Wipe Logbook & Progress</span>
          </div>
          <p className="font-sans text-sm text-ink-2 font-light leading-relaxed">
            Permanently erases all mock attempts, study history, and telemetry. This cannot be reversed.
          </p>
          {confirmWipe ? (
            <div className="w-full border border-signal/30 bg-signal-soft/40 rounded-lg p-3 flex flex-col gap-2">
              <div className="flex items-center gap-2 text-signal">
                <AlertTriangle size={14} />
                <p className="font-sans text-xs font-semibold">This action is permanent and cannot be undone.</p>
              </div>
              <div className="flex gap-2 mt-1">
                <Button variant="ghost" className="flex-1 min-h-[44px] text-xs border border-signal text-signal hover:bg-signal-soft disabled:opacity-50 disabled:cursor-not-allowed" disabled={isWiping} onClick={() => { setConfirmWipe(false); handleWipe(); }}>
                  {isWiping ? "Wiping…" : "Yes, wipe everything"}
                </Button>
                <Button variant="ghost" className="min-h-[44px] text-xs border border-rule text-muted hover:bg-bg-2" onClick={() => setConfirmWipe(false)}>Cancel</Button>
              </div>
            </div>
          ) : (
            <Button variant="ghost" className="text-signal hover:bg-signal-soft border border-signal-soft disabled:opacity-50 disabled:cursor-not-allowed" disabled={isWiping} onClick={() => setConfirmWipe(true)}>
              {isWiping ? "Wiping…" : "Wipe Logbook & Progress"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
