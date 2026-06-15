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

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const userId = session.user.id;
      const userEmail = session.user.email || null;
      const userName = session.user.user_metadata?.display_name || session.user.user_metadata?.full_name || null;

      const row = {
        user_id: userId,
        event_type: eventType,
        subject_id: payload?.subjectId || null,
        subcategory_id: payload?.subcategoryId || null,
        question_id: payload?.questionId || null,
        metadata: {
          ...payload?.metadata,
          user_email: userEmail,
          user_name: userName,
        },
      };

      await supabase.from("events").insert(row);
    } catch (err) {
      // Never throw or block the main application execution
      console.warn("Lightweight tracking event failed silently:", err);
    }
  })();
}
