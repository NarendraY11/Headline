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

// Device identity is the user-agent fingerprint. The installed PWA and the
// browser on one physical device keep separate session ids in separate storage
// partitions, so an id mismatch alone must NOT evict — only a different device
// (different UA) should. Returns true when `deviceInfo` is this same device.
export function isSameDevice(deviceInfo?: string | null): boolean {
  return !!deviceInfo && deviceInfo === currentUA();
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

  // Same physical device (installed PWA vs browser vs multi-tab) keeps the
  // session even when the random id differs — device identity is the UA.
  if (isSameDevice(data.device_info)) return true;

  // Legacy rows without device_info: fall back to the session-id match.
  if (!data.device_info && data.session_id === clientId) return true;

  // A different device took over the single active slot.
  return false;
}
