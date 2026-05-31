import { supabase } from "./supabase";

export async function registerActiveSession(userId: string): Promise<string> {
  const sessionId = crypto.randomUUID();
  const deviceInfo = navigator.userAgent;

  const { error } = await supabase.from("active_sessions").upsert(
    {
      user_id: userId,
      session_id: sessionId,
      device_info: deviceInfo,
      last_seen: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );

  if (error) {
    console.error("Failed to register session:", error);
  }

  localStorage.setItem("heading_active_session_id", sessionId);
  return sessionId;
}

export async function checkSessionValidity(userId: string): Promise<boolean> {
  const localSessionId = localStorage.getItem("heading_active_session_id");
  if (!localSessionId) {
    // We are logged in but don't have a session ID. Reclaim the session for this device.
    await registerActiveSession(userId);
    return true;
  }

  const { data, error } = await supabase
    .from("active_sessions")
    .select("session_id")
    .eq("user_id", userId)
    .single();

  if (error || !data) {
    return true;
  }

  if (data.session_id !== localSessionId) {
    return false; // Stale session!
  }

  // Optionally update last_seen
  await supabase
    .from("active_sessions")
    .update({ last_seen: new Date().toISOString() })
    .eq("user_id", userId);

  return true;
}

export function clearLocalSession() {
  localStorage.removeItem("heading_active_session_id");
}
