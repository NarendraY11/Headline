import { Plus, Shield, ShieldAlert, ShieldCheck, ShieldOff, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "../../components/Atoms";
import { AdminBreadcrumb } from "../../components/AdminBreadcrumb";
import { Spinner } from "../../components/Spinner";
import { useToast } from "../../components/ui/Toast";
import { supabase } from "../../lib/supabase";

type AdminRole = "owner" | "admin" | "sub_admin" | "manager";

interface AdminRecord {
  email: string;
  role: AdminRole;
  added_at: string;
  user_id?: string;
}

const ROLE_META: Record<AdminRole, { label: string; description: string; icon: React.ReactNode; color: string }> = {
  owner: {
    label: "Owner",
    description: "Full unrestricted access. Cannot be removed.",
    icon: <ShieldAlert size={14} />,
    color: "text-signal",
  },
  admin: {
    label: "Admin",
    description: "All admin sections except role management.",
    icon: <ShieldCheck size={14} />,
    color: "text-sky-600",
  },
  sub_admin: {
    label: "Sub-admin",
    description: "Questions, Blog, Notifications, Bulk Import only.",
    icon: <Shield size={14} />,
    color: "text-amber-600",
  },
  manager: {
    label: "Manager",
    description: "Users, Analytics, Activity only.",
    icon: <ShieldOff size={14} />,
    color: "text-muted-2",
  },
};

export default function RolesManager() {
  const [admins, setAdmins] = useState<AdminRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [newEmail, setNewEmail] = useState("");
  const [newRole, setNewRole] = useState<AdminRole>("sub_admin");
  const [adding, setAdding] = useState(false);
  const { showToast } = useToast();

  const fetchAdmins = async () => {
    const { data, error } = await supabase
      .from("admins")
      .select("email, role, added_at, user_id")
      .order("added_at", { ascending: true });
    if (!error && data) setAdmins(data as AdminRecord[]);
    setLoading(false);
  };

  useEffect(() => { fetchAdmins(); }, []);

  const handleRoleChange = async (email: string, role: AdminRole) => {
    const { error } = await supabase.from("admins").update({ role }).eq("email", email);
    if (error) {
      showToast({ type: "error", title: "Update failed", message: error.message });
    } else {
      setAdmins((prev) => prev.map((a) => (a.email === email ? { ...a, role } : a)));
      showToast({ type: "success", title: "Role updated", message: `${email} is now ${ROLE_META[role].label}.` });
    }
  };

  const handleAdd = async () => {
    if (!newEmail.trim() || !newEmail.includes("@")) {
      showToast({ type: "error", title: "Invalid email", message: "Enter a valid email address." });
      return;
    }
    setAdding(true);
    const { error } = await supabase.from("admins").upsert({ email: newEmail.trim(), role: newRole });
    setAdding(false);
    if (error) {
      showToast({ type: "error", title: "Add failed", message: error.message });
    } else {
      showToast({ type: "success", title: "Admin added", message: `${newEmail} added as ${ROLE_META[newRole].label}.` });
      setNewEmail("");
      fetchAdmins();
    }
  };

  const handleRemove = async (email: string) => {
    const { error } = await supabase.from("admins").delete().eq("email", email);
    if (error) {
      showToast({ type: "error", title: "Remove failed", message: error.message });
    } else {
      setAdmins((prev) => prev.filter((a) => a.email !== email));
      showToast({ type: "success", title: "Admin removed", message: `${email} removed from admin panel.` });
    }
  };

  if (loading) return <Spinner label="Loading admin roles" />;

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-8">
      <AdminBreadcrumb crumbs={[{ label: "Admin Roles" }]} />
      <div>
        <h1 className="text-3xl font-serif text-ink tracking-tight mb-1">Admin Roles</h1>
        <p className="text-sm text-muted font-sans">
          Manage who can access the admin panel and what they can control.
        </p>
      </div>

      {/* Role legend */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {(Object.entries(ROLE_META) as [AdminRole, typeof ROLE_META[AdminRole]][]).map(([role, meta]) => (
          <div key={role} className="p-3 bg-bg-2 border border-rule rounded-lg">
            <div className={`flex items-center gap-1.5 mb-1 font-semibold text-[12px] font-sans ${meta.color}`}>
              {meta.icon} {meta.label}
            </div>
            <p className="text-[10px] text-muted-2 font-sans leading-snug">{meta.description}</p>
          </div>
        ))}
      </div>

      {/* Admin list */}
      <div className="space-y-2">
        {admins.map((admin) => {
          const meta = ROLE_META[admin.role] || ROLE_META.admin;
          const isOwner = admin.role === "owner";
          return (
            <div
              key={admin.email}
              className="flex items-center gap-3 p-4 bg-paper border border-rule-strong rounded-lg"
            >
              <div className={`flex-shrink-0 ${meta.color}`}>{meta.icon}</div>
              <div className="flex-1 min-w-0">
                <div className="font-sans text-sm font-medium text-ink truncate">{admin.email}</div>
                <div className="font-mono text-[9px] text-muted-2 uppercase tracking-widest mt-0.5">
                  {new Date(admin.added_at).toLocaleDateString()}
                </div>
              </div>
              {isOwner ? (
                <span className="font-mono text-[10px] text-signal uppercase tracking-widest px-2 py-1 bg-signal/10 rounded">
                  Owner
                </span>
              ) : (
                <>
                  <select
                    value={admin.role}
                    onChange={(e) => handleRoleChange(admin.email, e.target.value as AdminRole)}
                    className="text-[12px] font-sans bg-bg border border-rule-strong rounded px-2 py-1.5 text-ink focus:outline-none focus:border-ink"
                  >
                    <option value="admin">Admin</option>
                    <option value="sub_admin">Sub-admin</option>
                    <option value="manager">Manager</option>
                  </select>
                  <button
                    onClick={() => handleRemove(admin.email)}
                    className="p-2 text-muted-2 hover:text-signal transition-colors rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky/60"
                    title="Remove admin"
                  >
                    <Trash2 size={14} />
                  </button>
                </>
              )}
            </div>
          );
        })}
      </div>

      {/* Add new admin */}
      <div className="p-5 bg-bg-2 border border-rule-strong rounded-xl space-y-4">
        <h2 className="font-serif text-lg text-ink">Add Admin</h2>
        <div className="flex gap-3 flex-wrap">
          <input
            type="email"
            placeholder="email@example.com"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            className="flex-1 min-w-[200px] text-sm bg-bg border border-rule-strong rounded-lg px-3 py-2 text-ink placeholder:text-muted-2 focus:outline-none focus:border-ink"
          />
          <select
            value={newRole}
            onChange={(e) => setNewRole(e.target.value as AdminRole)}
            className="text-sm font-sans bg-bg border border-rule-strong rounded-lg px-3 py-2 text-ink focus:outline-none focus:border-ink"
          >
            <option value="admin">Admin</option>
            <option value="sub_admin">Sub-admin</option>
            <option value="manager">Manager</option>
          </select>
          <Button variant="primary" onClick={handleAdd} disabled={adding}>
            <Plus size={14} /> {adding ? "Adding..." : "Add"}
          </Button>
        </div>
        <p className="text-[11px] text-muted-2 font-sans">
          The user must already have an account. Role takes effect on their next page load.
        </p>
      </div>
    </div>
  );
}
