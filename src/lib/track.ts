import { supabase } from "./supabase";

let lastPageViewTime = 0;
let lastPageViewPath = "";

interface TrackPayload {
  subjectId?: string;
  subcategoryId?: string;
  questionId?: string;
  metadata?: Record<string, any>;
}

export function trackEvent(
  eventType: string,
  payload?: TrackPayload
) {
  // Execute async fire-and-forget logic
  (async () => {
    try {
      // Throttle rapid sub-second page_view updates or duplicate route clicks
      if (eventType === "page_view") {
        const now = Date.now();
        const currentPath = payload?.metadata?.path || "";
        if (currentPath === lastPageViewPath && now - lastPageViewTime < 2000) {
          return;
        }
        lastPageViewTime = now;
        lastPageViewPath = currentPath;
      }

      // Fetch current session (retrieved from local state/cookie or network)
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id || null;

      const row = {
        user_id: userId,
        event_type: eventType,
        subject_id: payload?.subjectId || null,
        subcategory_id: payload?.subcategoryId || null,
        question_id: payload?.questionId || null,
        metadata: payload?.metadata || {},
      };

      await supabase.from("events").insert(row);
    } catch (err) {
      // Never throw or block the main application execution
      console.warn("Lightweight tracking event failed silently:", err);
    }
  })();
}
