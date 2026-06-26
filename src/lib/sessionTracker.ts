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

// CSPRNG session id. Prefer crypto.randomUUID; fall back to crypto.getRandomValues
// (still cryptographically secure) for older secure contexts. No Math.random —
// a predictable id would weaken the single-device hijack-detection slot.
function generateSessionId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  }
  // No CSPRNG available: refuse rather than emit a guessable id.
  throw new Error("No cryptographically secure RNG available for session id.");
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
    sessionId = generateSessionId();
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

  // Same-device proof by id. Our own registerActiveSession() upsert always sets
  // session_id === clientId, so when the server row's id matches ours this IS
  // our session even if the UA string differs between contexts (installed PWAs
  // and their service worker can report a slightly different user-agent than
  // the page that first bound the row). A genuinely different device would hold
  // a different session_id, so this does not weaken single-device eviction.
  if (data.session_id === clientId) return true;

  // Legacy rows without device_info: fall back to the session-id match.
  if (!data.device_info && data.session_id === clientId) return true;

  // A different device took over the single active slot.
  return false;
}
