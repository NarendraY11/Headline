import { supabase } from "./supabase";

export async function registerActiveSession(userId: string) {
  let sessionId = localStorage.getItem("client_session_id");
  if (!sessionId) {
    sessionId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2);
    localStorage.setItem("client_session_id", sessionId);
  }

  const { error } = await supabase.from('active_sessions').upsert({
    user_id: userId,
    session_id: sessionId,
    device_info: typeof navigator !== 'undefined' ? navigator.userAgent : 'Unknown'
  });

  if (error) console.error("Active session upsert error:", error);
  return sessionId;
}

export function clearLocalSession() {
  localStorage.removeItem("client_session_id");
}

export async function checkSessionValidity(userId: string): Promise<boolean> {
  const clientId = localStorage.getItem("client_session_id");
  if (!clientId) return false; // if there's no local ID, it's not valid

  const { data } = await supabase
    .from('active_sessions')
    .select('session_id')
    .eq('user_id', userId)
    .maybeSingle();

  if (data && data.session_id !== clientId) {
    return false;
  }
  return true;
}
