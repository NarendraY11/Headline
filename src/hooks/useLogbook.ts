import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../lib/supabase";

const CACHE_KEY_PREFIX = "heading_logbook_cache_";
const CACHE_DURATION_MS = 30 * 60 * 1000; // 30 minutes

interface CacheEntry {
  data: any[];
  timestamp: number;
}

export function useLogbook() {
  const { user } = useAuth();
  const [logbook, setLogbook] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLogbook = useCallback(async (userId: string, active: boolean, forceRefresh = false) => {
    if (!forceRefresh) {
      try {
        const cachedItem = localStorage.getItem(`${CACHE_KEY_PREFIX}${userId}`);
        if (cachedItem) {
          const entry: CacheEntry = JSON.parse(cachedItem);
          const age = Date.now() - entry.timestamp;
          if (age < CACHE_DURATION_MS) {
            if (active) {
              setLogbook(entry.data);
              setLoading(false);
            }
            return;
          }
        }
      } catch (err) {
        console.error("Error reading logbook cache:", err);
      }
    }

    if (active) setLoading(true);

    try {
      const { data, error } = await supabase
        .from("attempts")
        .select("data")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(100);

      if (!active) return;

      if (error) {
        console.error("Supabase loading error in useLogbook:", error);
      } else {
        const lb = data?.map((d) => d.data) || [];
        setLogbook(lb);
        try {
          const newEntry: CacheEntry = {
            data: lb,
            timestamp: Date.now(),
          };
          localStorage.setItem(`${CACHE_KEY_PREFIX}${userId}`, JSON.stringify(newEntry));
        } catch (err) {
          console.error("Error updating logbook cache:", err);
        }
      }
    } catch (err) {
      console.error("Error loading useLogbook from Supabase:", err);
    } finally {
      if (active) setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;

    if (user) {
      fetchLogbook(user.uid, active);
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
  }, [user, fetchLogbook]);

  const refresh = useCallback(() => {
    if (user) {
      fetchLogbook(user.uid, true, true);
    }
  }, [user, fetchLogbook]);

  return { logbook, loading, refresh };
}

