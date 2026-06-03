import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "";
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "";

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn("Supabase credentials missing. Run setup or add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your local secrets.");
}

// Auth-token lock. supabase-js defaults to a navigator.locks lock to serialize
// access to the auth token across tabs. In a standalone / service-worker-
// controlled PWA that lock can deadlock — held by another controlled client and
// never released — so getSession() awaits it forever and the app freezes on the
// auth skeleton. Bound the wait: if the lock can't be acquired in ~3s, proceed
// without it. A brief token-refresh race is harmless for a single-user browser
// client; a permanent hang is not.
async function timeoutLock<R>(
  name: string,
  _acquireTimeout: number,
  fn: () => Promise<R>
): Promise<R> {
  if (typeof navigator === "undefined" || !("locks" in navigator)) {
    return fn();
  }
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 3000);
  try {
    return await navigator.locks.request(
      name,
      { mode: "exclusive", signal: ctrl.signal },
      async () => fn()
    );
  } catch (err) {
    // Lock acquisition timed out -> run without the lock rather than hang.
    if (ctrl.signal.aborted) return fn();
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

// PKCE flow for OAuth + password-recovery code exchange (more secure than the
// legacy implicit flow). Session options are explicit to document intent.
// NOTE: tokens still persist in localStorage — see docs/auth-hardening.md for
// why httpOnly cookies do not fit the browser-client data model.
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: "pkce",
    lock: timeoutLock,
  },
});
