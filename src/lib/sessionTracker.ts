import { supabase } from "./supabase";

// Client-side session tracking. Best-effort layer on top of Supabase Auth:
// Supabase already issues a fresh access+refresh token on every login (so
// session fixation is not exploitable at the token level). This adds a
// per-device session id + user-agent binding for hijack detection.

const SESSION_ID_KEY = "client_session_id";
const SESSION_UA_KEY = "client_session_ua";

function currentUA(): string {
  return typeof navigator !== "undefined" ? navigator.userAgent : "Unknown";
}

// (1) Establish a session record. The id is generated fresh whenever none
// exists locally — and logout clears it — so each new login binds a new id
// (anti-fixation). A persisted id is reused across tabs/reloads of the same
// device so multi-tab use does not self-evict.
export async function registerActiveSession(userId: string) {
  let sessionId = localStorage.getItem(SESSION_ID_KEY);
  if (!sessionId) {
    sessionId = typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : Math.random().toString(36).substring(2);
    localStorage.setItem(SESSION_ID_KEY, sessionId);
  }

  const ua = currentUA();
  localStorage.setItem(SESSION_UA_KEY, ua);

  const { error } = await supabase.from("active_sessions").upsert({
    user_id: userId,
    session_id: sessionId,
    device_info: ua,
  });

  if (error) console.error("Active session upsert error:", error);
  return sessionId;
}

export function clearLocalSession() {
  localStorage.removeItem(SESSION_ID_KEY);
  localStorage.removeItem(SESSION_UA_KEY);
}

// (2) Validate the session: it is invalid if another device took over the
// single active slot, OR if the bound user agent changed (a token replayed
// from a different client). Returns false -> caller forces logout.
export async function checkSessionValidity(userId: string): Promise<boolean> {
  const clientId = localStorage.getItem(SESSION_ID_KEY);
  if (!clientId) return false;

  const { data } = await supabase
    .from("active_sessions")
    .select("session_id, device_info")
    .eq("user_id", userId)
    .maybeSingle();

  if (!data) return true; // no server row yet; don't evict

  // Another device registered a newer session.
  if (data.session_id !== clientId) return false;

  // User-agent binding: a sudden change signals a hijacked/replayed session.
  if (data.device_info && data.device_info !== currentUA()) return false;

  return true;
}
