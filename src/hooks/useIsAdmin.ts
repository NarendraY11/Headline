import { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../lib/supabase";

export function useIsAdmin() {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let active = true;
    if (!user || !user.email) {
      setIsAdmin(false);
      setChecking(false);
      return;
    }

    const checkAdmin = async () => {
      setChecking(true);
      try {
        const { data, error } = await supabase
          .from("admins")
          .select("email")
          .eq("email", user.email)
          .maybeSingle();

        if (!active) return;

        if (error) {
          console.error("Error checking admin status:", error);
          setIsAdmin(false);
        } else if (data) {
          setIsAdmin(true);
        } else {
          setIsAdmin(false);
        }
      } catch (err) {
        console.error("Exception checking admin status:", err);
        if (active) setIsAdmin(false);
      } finally {
        if (active) setChecking(false);
      }
    };

    checkAdmin();

    return () => {
      active = false;
    };
  }, [user]);

  return { isAdmin, checking };
}
