import { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../lib/supabase";

export function useLogbook() {
  const { user } = useAuth();
  const [logbook, setLogbook] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    if (user) {
      setLoading(true);
      const getLogs = async () => {
        try {
          const { data, error } = await supabase
            .from("attempts")
            .select("data")
            .eq("user_id", user.uid)
            .order("created_at", { ascending: false })
            .limit(100);

          if (!active) return;
          if (error) {
            console.error("Supabase loading error in useLogbook:", error);
          } else {
            const lb = data?.map((d) => d.data) || [];
            setLogbook(lb);
          }
        } catch (err) {
          console.error("Error loading useLogbook from Supabase:", err);
        } finally {
          if (active) setLoading(false);
        }
      };
      getLogs();
    } else {
      try {
        const saved = localStorage.getItem("heading_logbook");
        if (saved) {
          setLogbook(JSON.parse(saved));
        }
      } catch (e) {
        console.error("Local storage error in useLogbook:", e);
      }
      setLoading(false);
    }
    return () => {
      active = false;
    };
  }, [user]);

  return { logbook, loading };
}
