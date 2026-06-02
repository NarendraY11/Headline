import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "";
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "";

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn("Supabase credentials missing. Run setup or add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your local secrets.");
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
  },
});
