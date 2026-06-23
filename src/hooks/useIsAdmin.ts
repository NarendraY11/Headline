import { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../lib/supabase";

export type AdminRole = "owner" | "admin" | "sub_admin" | "manager";

export const ROLE_PAGES: Record<AdminRole, string[]> = {
  owner:     ["*"],
  admin:     ["dashboard", "subjects", "exams", "subcategories", "questions", "import", "users", "activity", "settings", "features", "blog", "notifications", "pricing", "site-content"],
  sub_admin: ["questions", "import", "blog", "notifications"],
  manager:   ["users", "activity"],
};

export function useIsAdmin() {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminRole, setAdminRole] = useState<AdminRole | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let active = true;
    if (!user || !user.email) {
      setIsAdmin(false);
      setAdminRole(null);
      setChecking(false);
      return;
    }

    const checkAdmin = async () => {
      setChecking(true);
      try {
        const { data, error } = await supabase
          .from("admins")
          .select("email, role")
          .eq("email", user.email)
          .maybeSingle();

        if (!active) return;

        if (error) {
          console.error("Error checking admin status:", error);
          setIsAdmin(false);
          setAdminRole(null);
        } else if (data) {
          setIsAdmin(true);
          setAdminRole((data.role as AdminRole) || "admin");
        } else {
          setIsAdmin(false);
          setAdminRole(null);
        }
      } catch (err) {
        console.error("Exception checking admin status:", err);
        if (active) { setIsAdmin(false); setAdminRole(null); }
      } finally {
        if (active) setChecking(false);
      }
    };

    checkAdmin();
    return () => { active = false; };
  }, [user]);

  const canAccess = (page: string): boolean => {
    if (!adminRole) return false;
    const allowed = ROLE_PAGES[adminRole];
    return allowed[0] === "*" || allowed.includes(page);
  };

  return { isAdmin, adminRole, canAccess, checking };
}
