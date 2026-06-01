import React, { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../contexts/AuthContext";
import { Button } from "../../components/Atoms";
import { ShieldCheck, UserPlus, Trash2, Mail, CheckCircle2, AlertCircle, RefreshCw, Megaphone, Send } from "lucide-react";
import { trackEvent } from "../../lib/track";
import { apiFetchRaw, readError } from "../../lib/api";

interface AdminRecord {
  email: string;
  added_at: string;
}

export default function AdminSettings() {
  const { user } = useAuth();
  const [admins, setAdmins] = useState<AdminRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [newAdminEmail, setNewAdminEmail] = useState("");
  const [errorStatus, setErrorStatus] = useState("");
  const [successStatus, setSuccessStatus] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  // Broadcast notification state
  const [bcTitle, setBcTitle] = useState("");
  const [bcMessage, setBcMessage] = useState("");
  const [bcSending, setBcSending] = useState(false);

  const handleBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorStatus("");
    setSuccessStatus("");
    if (!bcTitle.trim() || !bcMessage.trim()) {
      setErrorStatus("Broadcast needs both a title and a message.");
      return;
    }
    if (!window.confirm("Send this notification to ALL users?")) return;

    setBcSending(true);
    try {
      const res = await apiFetchRaw("/api/admin/broadcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: bcTitle.trim(), message: bcMessage.trim(), type: "system" }),
      });
      if (!res) throw new Error("Could not reach the broadcast service.");
      if (!res.ok) throw new Error(await readError(res, "Broadcast failed."));
      const data = await res.json();
      setSuccessStatus(`Broadcast delivered to ${data.sent} user${data.sent === 1 ? "" : "s"}.`);
      setBcTitle("");
      setBcMessage("");
      trackEvent("admin_broadcast", { metadata: { sent: data.sent } });
    } catch (err: any) {
      console.error("Broadcast failed:", err);
      setErrorStatus(err.message || "Broadcast failed.");
    } finally {
      setBcSending(false);
    }
  };

  const fetchAdmins = async () => {
    setLoading(true);
    setErrorStatus("");
    try {
      const { data, error } = await supabase
        .from("admins")
        .select("*")
        .order("added_at", { ascending: true });

      if (error) throw error;
      setAdmins(data || []);
    } catch (err: any) {
      console.error("Failed fetching admins:", err);
      setErrorStatus(err.message || "Failed to retrieve administrators roster.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdmins();
  }, []);

  const handleAddAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorStatus("");
    setSuccessStatus("");
    const emailToRegister = newAdminEmail.trim().toLowerCase();

    if (!emailToRegister) {
      setErrorStatus("Please provide a valid administrative email address.");
      return;
    }

    // Email regex validation matching schema
    const emailRegex = /^[0-9a-zA-Z._%-]+@[0-9a-zA-Z._%-]+\.[a-zA-Z]{2,4}$/;
    if (!emailRegex.test(emailToRegister)) {
      setErrorStatus("Format mismatch. Email does not align with validation standards.");
      return;
    }

    setActionLoading(true);
    try {
      const { error } = await supabase.from("admins").insert({
        email: emailToRegister,
        added_at: new Date().toISOString(),
      });

      if (error) throw error;

      trackEvent("admin_enroll_admin", {
        metadata: {
          enrolled_email: emailToRegister,
          details: `Enrolled administrative candidate: ${emailToRegister}`,
        },
      });

      setSuccessStatus(`Successfully added '${emailToRegister}' to the administration log.`);
      setNewAdminEmail("");
      fetchAdmins();
    } catch (err: any) {
      console.error("Failed adding admin:", err);
      setErrorStatus(err.message || "Failed to enroll new admin credentials. Ensure permission levels.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteAdmin = async (emailToDelete: string) => {
    if (emailToDelete === "narendray112050@gmail.com") {
      setErrorStatus("The primary owner account ('narendray112050@gmail.com') is protected and cannot be deleted.");
      return;
    }

    if (!window.confirm(`Are you sure you want to revoke administrative credentials for '${emailToDelete}'?`)) {
      return;
    }

    setErrorStatus("");
    setSuccessStatus("");
    setActionLoading(true);
    try {
      const { error } = await supabase
        .from("admins")
        .delete()
        .eq("email", emailToDelete);

      if (error) throw error;

      trackEvent("admin_revoke_admin", {
        metadata: {
          revoked_email: emailToDelete,
          details: `Revoked administrative credentials for account: ${emailToDelete}`,
        },
      });

      setSuccessStatus(`Access revoked safely for '${emailToDelete}'.`);
      fetchAdmins();
    } catch (err: any) {
      console.error("Failed revoking admin:", err);
      setErrorStatus(err.message || "Failed to revoke admin privileges.");
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto py-2 font-sans">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-rule pb-6">
        <div>
          <div className="font-mono text-[9px] tracking-widest text-muted uppercase mb-1">Authorization Controls</div>
          <h1 className="font-serif text-3xl font-medium tracking-tight text-ink">Administrative Settings</h1>
        </div>
        <button
          onClick={fetchAdmins}
          disabled={loading}
          className="flex items-center gap-1.5 px-4 py-2 border border-rule hover:bg-bg-2 rounded-full font-sans text-xs text-ink transition-colors disabled:opacity-50 cursor-pointer h-10 shrink-0"
        >
          <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
          <span>Sync Admins Roster</span>
        </button>
      </div>

      {errorStatus && (
        <div className="p-4 bg-rose-505/10 border border-rose-500/30 text-rose-800 rounded-lg text-xs flex items-center gap-3">
          <AlertCircle size={16} className="shrink-0" />
          <span>{errorStatus}</span>
        </div>
      )}

      {successStatus && (
        <div className="p-4 bg-mint/15 border border-mint/40 text-emerald-800 rounded-lg text-xs flex items-center gap-3">
          <CheckCircle2 size={16} className="shrink-0" />
          <span>{successStatus}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Add Admin form */}
        <div className="col-span-1">
          <div className="bg-white border border-rule rounded-xl p-5 shadow-xs space-y-4">
            <div>
              <h3 className="font-serif text-base font-medium text-ink">Enroll Administrator</h3>
              <p className="font-mono text-[9px] text-muted uppercase tracking-wider mt-0.5">Authorize colleagues access</p>
            </div>

            <form onSubmit={handleAddAdmin} className="space-y-3">
              <div>
                <label className="block font-mono text-[9px] uppercase text-muted tracking-widest mb-1.5 font-bold">Email address</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={14} />
                  <input
                    type="email"
                    value={newAdminEmail}
                    onChange={(e) => setNewAdminEmail(e.target.value)}
                    className="w-full text-xs p-2.5 pl-9 bg-bg-2 border border-rule rounded-lg focus:outline-none focus:border-rule-strong text-ink font-semibold"
                    placeholder="airline-rep@domain.com"
                    required
                  />
                </div>
              </div>
              
              <Button
                variant="primary"
                type="submit"
                disabled={actionLoading}
                className="w-full justify-center gap-2 h-10 text-xs"
              >
                {actionLoading ? <RefreshCw className="animate-spin" size={13} /> : <UserPlus size={13} />}
                <span>Enroll Credentials</span>
              </Button>
            </form>
          </div>
        </div>

        {/* Admins list */}
        <div className="col-span-2">
          <div className="bg-white border border-rule rounded-xl shadow-xs overflow-hidden">
            <div className="p-5 border-b border-rule bg-bg-2/30">
              <h3 className="font-serif text-base font-medium text-ink">Authorized Administrators List</h3>
              <p className="font-mono text-[9px] text-muted uppercase tracking-wider mt-0.5">Verify personnel roster</p>
            </div>

            {loading ? (
              <div className="p-10 text-center flex flex-col items-center justify-center">
                <div className="w-8 h-8 border-4 border-ink border-t-transparent rounded-full animate-spin mb-3"></div>
                <span className="font-mono text-xs text-muted">Reading roster...</span>
              </div>
            ) : (
              <div className="divide-y divide-rule/60">
                {admins.map((adm) => {
                  const isSelf = user?.email?.toLowerCase() === adm.email;
                  const isPrimaryOwner = adm.email === "narendray112050@gmail.com";
                  const dateDisplay = new Date(adm.added_at).toLocaleDateString("en-GB", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  });

                  return (
                    <div key={adm.email} className="p-4 flex items-center justify-between hover:bg-bg-2/30 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-teal-50 text-teal-800 flex items-center justify-center shrink-0">
                          <ShieldCheck size={16} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-sans font-semibold text-xs text-ink">{adm.email}</span>
                            {isPrimaryOwner && (
                              <span className="font-mono text-[8.5px] px-1.5 py-0.2 bg-purple-50 text-purple-700 border border-purple-100 rounded uppercase font-bold">
                                PRIMARY OWNER
                              </span>
                            )}
                            {isSelf && (
                              <span className="font-mono text-[8.5px] px-1.5 py-0.2 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded uppercase font-bold">
                                SELF
                              </span>
                            )}
                          </div>
                          <div className="font-mono text-[8.5px] text-muted-2 mt-0.5">
                            Added on: {dateDisplay}
                          </div>
                        </div>
                      </div>

                      {!isPrimaryOwner && !isSelf && (
                        <button
                          onClick={() => handleDeleteAdmin(adm.email)}
                          disabled={actionLoading}
                          className="p-1 px-2.5 border border-rose-200 hover:bg-rose-50 text-rose-600 rounded text-xs inline-flex items-center gap-1 cursor-pointer transition-colors"
                          title="Revoke access"
                        >
                          <Trash2 size={12} />
                          <span className="font-mono text-[9px] uppercase font-bold">Revoke</span>
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Broadcast notification */}
      <div className="bg-white border border-rule rounded-xl p-5 shadow-xs space-y-4">
        <div className="flex items-center gap-2 border-b border-rule pb-3">
          <Megaphone size={16} className="text-navy" />
          <div>
            <h3 className="font-serif text-base font-medium text-ink">Broadcast Notification</h3>
            <p className="font-mono text-[9px] text-muted uppercase tracking-wider mt-0.5">
              Send a message to every user's notification panel
            </p>
          </div>
        </div>

        <form onSubmit={handleBroadcast} className="space-y-3">
          <div>
            <label className="block font-mono text-[9px] uppercase text-muted tracking-widest mb-1.5 font-bold">Title</label>
            <input
              type="text"
              value={bcTitle}
              onChange={(e) => setBcTitle(e.target.value)}
              maxLength={200}
              className="w-full text-xs p-2.5 bg-bg-2 border border-rule rounded-lg focus:outline-none focus:border-rule-strong text-ink font-semibold"
              placeholder="New questions added!"
            />
          </div>
          <div>
            <label className="block font-mono text-[9px] uppercase text-muted tracking-widest mb-1.5 font-bold">Message</label>
            <textarea
              value={bcMessage}
              onChange={(e) => setBcMessage(e.target.value)}
              maxLength={2000}
              rows={3}
              className="w-full text-xs p-2.5 bg-bg-2 border border-rule rounded-lg focus:outline-none focus:border-rule-strong text-ink"
              placeholder="We just published 200 fresh DGCA Navigation questions. Go practice!"
            />
          </div>
          <Button variant="primary" type="submit" disabled={bcSending} className="justify-center gap-2 h-10 text-xs">
            {bcSending ? <RefreshCw className="animate-spin" size={13} /> : <Send size={13} />}
            <span>{bcSending ? "Sending…" : "Send to all users"}</span>
          </Button>
        </form>
      </div>
    </div>
  );
}
