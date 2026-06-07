import { createClient } from "@supabase/supabase-js";
import { GoogleGenAI } from "@google/genai";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import Razorpay from "razorpay";
import crypto from "crypto";
import { logSecurityEvent } from "./securityLog.js";

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "";
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || "";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export const ai = new GoogleGenAI({ 
//... (keep existing init)

  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

export async function getAuthenticatedUser(req: VercelRequest, res: VercelResponse) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    void logSecurityEvent({
      req,
      eventType: "auth.failed",
      severity: "warn",
      statusCode: 401,
      metadata: { reason: "missing_token" },
    });
    res.status(401).json({ error: "Unauthorized: Missing authentication token." });
    return null;
  }

  const token = authHeader.split(" ")[1];
  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) {
      throw error || new Error("User verification failed");
    }
    return user;
  } catch (error) {
    // Note: the token is never logged — only the failure reason.
    void logSecurityEvent({
      req,
      eventType: "auth.failed",
      severity: "warn",
      statusCode: 401,
      metadata: { reason: "invalid_or_expired_token" },
    });
    console.error("Error verifying Supabase token (token redacted).");
    res.status(401).json({ error: "Unauthorized: Invalid or expired authentication token." });
    return null;
  }
}

const userRequestTimestamps = new Map<string, number[]>();

// Shared, cross-instance fixed-window limiter backed by public.rl_hit().
// Under serverless autoscale the old in-memory maps gave each lambda its own
// counter (effective limit ≈ limit × instances); this is one atomic upsert in
// Postgres shared by every instance. Returns true=allowed, false=blocked,
// null=limiter unavailable (caller falls back to a best-effort local check;
// fail-open is deliberate so a limiter outage can't take down core features).
export async function dbRateLimit(
  bucket: string,
  limit: number,
  windowSec: number
): Promise<boolean | null> {
  try {
    const { data, error } = await getSupabaseAdmin().rpc("rl_hit", {
      p_key: bucket,
      p_limit: limit,
      p_window_sec: windowSec,
    });
    if (error) {
      console.warn("rl_hit error:", error.message);
      return null;
    }
    return data === true;
  } catch (e) {
    console.warn("rl_hit call failed:", e);
    return null;
  }
}

export async function checkRateLimit(uid: string): Promise<boolean> {
  // Primary gate: shared 20/hour across ALL serverless instances.
  const allowed = await dbRateLimit(`ai:${uid}`, 20, 60 * 60);

  if (allowed === false) return false;

  if (allowed === true) {
    // Authoritative usage log (analytics + the fallback backstop below).
    try {
      await getSupabaseAdmin().from("events").insert({ user_id: uid, event_type: "ai_used" });
    } catch (logErr) {
      console.warn("Failed to record ai_used event:", logErr);
    }
    return true;
  }

  // Fallback path (shared limiter unavailable): per-instance map + a precise
  // events-count backstop. Must use the admin client: events SELECT is
  // admin-only under RLS, so the anon client would always count 0.
  const now = Date.now();
  const oneHourAgo = now - 60 * 60 * 1000;
  let timestamps = (userRequestTimestamps.get(uid) || []).filter(t => t > oneHourAgo);
  if (timestamps.length >= 20) return false;

  const oneHourAgoISO = new Date(oneHourAgo).toISOString();
  try {
    const { count, error } = await getSupabaseAdmin()
      .from("events")
      .select("*", { count: "estimated", head: true })
      .eq("user_id", uid)
      .eq("event_type", "ai_used")
      .gte("created_at", oneHourAgoISO);

    if (error) {
      console.warn("DB rate limit count error:", error);
    } else if (count !== null && count >= 20) {
      return false;
    }
  } catch (dbError) {
    console.warn("DB rate limiter backstop failed:", dbError);
  }

  timestamps.push(now);
  userRequestTimestamps.set(uid, timestamps);

  try {
    await getSupabaseAdmin().from("events").insert({ user_id: uid, event_type: "ai_used" });
  } catch (logErr) {
    console.warn("Failed to record ai_used event:", logErr);
  }

  return true;
}

// Returns true if the user currently holds an active paid/trial plan.
// Mirrors the requirePro middleware in server.ts so the prod serverless
// functions enforce the same gate (they previously did not).
export async function isProUser(uid: string): Promise<boolean> {
  try {
    const { data: profile } = await getSupabaseAdmin()
      .from("profiles")
      .select("plan, plan_expires_at")
      .eq("id", uid)
      .single();

    if (!profile) return false;

    const plan = profile.plan;
    const planExpiresAt = profile.plan_expires_at;
    const now = Date.now();

    if (plan === "lifetime") return true;
    if (plan === "pro") return !planExpiresAt || new Date(planExpiresAt).getTime() > now;
    if (plan === "trial") return !!planExpiresAt && new Date(planExpiresAt).getTime() > now;
    return false;
  } catch (e) {
    console.error("isProUser check failed:", e);
    return false;
  }
}

// Feature-flag check backed by app_settings.flags, cached 60s per instance.
// Mirrors assertFeatureEnabled in server.ts. Fails open (returns true) on
// error so a settings outage can't take down core features.
let appSettingsCache: { flags: Record<string, boolean>; timestamp: number } | null = null;
const FLAG_CACHE_TTL = 60 * 1000;

export async function isFeatureEnabled(flagKey: string): Promise<boolean> {
  try {
    const now = Date.now();
    if (!appSettingsCache || now - appSettingsCache.timestamp > FLAG_CACHE_TTL) {
      const { data } = await getSupabaseAdmin()
        .from("app_settings")
        .select("flags")
        .eq("id", 1)
        .single();
      appSettingsCache = { flags: (data && data.flags) || {}, timestamp: now };
    }
    return appSettingsCache.flags[flagKey] ?? true;
  } catch (e) {
    console.error("Feature flag check error:", e);
    return true;
  }
}

// ---------------------------------------------------------------------------
// Request-body validators. Endpoints forward these payloads to Gemini / write
// notifications, so reject malformed input up front instead of letting it
// through. Each returns a human-readable error string, or null when valid.
// ---------------------------------------------------------------------------

function checkString(
  val: unknown,
  name: string,
  { required = true, min = 1, max }: { required?: boolean; min?: number; max: number }
): string | null {
  if (val === undefined || val === null || val === "") {
    return required ? `${name} is required.` : null;
  }
  if (typeof val !== "string") return `${name} must be a string.`;
  const len = val.trim().length;
  if (required && len < min) return `${name} must be at least ${min} character(s).`;
  if (val.length > max) return `${name} must not exceed ${max} characters.`;
  return null;
}

// Validates the body for each instructor action. Mirrors the per-action shape
// in api/instructor/[action].ts and server.ts.
export function validateInstructorPayload(action: string, body: any): string | null {
  const b = body || {};
  switch (action) {
    case "explain": {
      return (
        checkString(b.prompt, "prompt", { max: 5000 }) ||
        checkString(b.userAnswer, "userAnswer", { required: false, max: 2000 }) ||
        checkString(b.correctAnswer, "correctAnswer", { required: false, max: 2000 })
      );
    }
    case "practice": {
      return (
        checkString(b.topic, "topic", { max: 300 }) ||
        checkString(b.code, "code", { max: 100 })
      );
    }
    case "coach": {
      const scores = b.scores;
      if (typeof scores !== "object" || scores === null || Array.isArray(scores)) {
        return "scores must be an object.";
      }
      const entries = Object.entries(scores);
      if (entries.length === 0) return "scores must contain at least one topic.";
      if (entries.length > 200) return "scores has too many topics.";
      for (const [topic, data] of entries) {
        if (topic.length > 200) return "scores topic name too long.";
        const d: any = data;
        if (typeof d !== "object" || d === null) return `scores['${topic}'] must be an object.`;
        const correct = Number(d.correct);
        const total = Number(d.total);
        if (!Number.isFinite(correct) || !Number.isFinite(total)) {
          return `scores['${topic}'] correct/total must be numbers.`;
        }
        if (total < 0 || total > 100000) return `scores['${topic}'] total out of range.`;
        if (correct < 0 || correct > total) return `scores['${topic}'] correct out of range.`;
      }
      return null;
    }
    case "diagnosis": {
      return checkString(b.summary, "summary", { max: 10000 });
    }
    default:
      return null;
  }
}

// Validates the admin broadcast body.
const BROADCAST_TYPES = ["system", "promo", "alert", "update"];
export function validateBroadcastPayload(body: any): string | null {
  const b = body || {};
  const err =
    checkString(b.title, "title", { max: 200 }) ||
    checkString(b.message, "message", { max: 2000 }) ||
    checkString(b.type, "type", { required: false, max: 50 });
  if (err) return err;
  if (b.type !== undefined && b.type !== null && b.type !== "" && !BROADCAST_TYPES.includes(b.type)) {
    return `type must be one of: ${BROADCAST_TYPES.join(", ")}.`;
  }
  return null;
}

// Validates the create-order body. Both `interval` and `plan` are accepted as
// the billing selector; if present it must be a known value.
const BILLING_INTERVALS = ["monthly", "yearly", "annual"];
export function validatePaymentInterval(body: any): string | null {
  const b = body || {};
  const selector = b.plan ?? b.interval;
  if (selector === undefined || selector === null || selector === "") return null;
  if (typeof selector !== "string") return "interval must be a string.";
  if (!BILLING_INTERVALS.includes(selector)) {
    return `interval must be one of: ${BILLING_INTERVALS.join(", ")}.`;
  }
  return null;
}

// Validates the payment verification body: the three Razorpay handshake fields
// must be present and string-typed before signature verification.
export function validateVerifyPayload(body: any): string | null {
  const b = body || {};
  for (const f of ["razorpay_payment_id", "razorpay_order_id", "razorpay_signature"]) {
    if (typeof b[f] !== "string" || b[f].length === 0) {
      return "Missing or invalid payment parameters.";
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Abuse screening. Three layers applied to form-style POST endpoints:
//   1. Per-form rate limit (10/min per user-or-IP) -> 429.
//   2. Attack-pattern detection on short structured fields -> 400.
//   3. Honeypot field (hidden from real users; bots fill it) -> 400.
// Blocked attempts are logged to console and the events table.
// ---------------------------------------------------------------------------

// Hidden form field. Real UIs render it visually hidden + aria-hidden with
// autocomplete off; only bots populate it. Keep in sync with the client forms.
export const HONEYPOT_FIELD = "website";

export function isHoneypotTripped(body: any): boolean {
  const v = body?.[HONEYPOT_FIELD];
  return v !== undefined && v !== null && String(v).trim() !== "";
}

// Injection-specific patterns. Deliberately narrow so normal prose (which may
// contain bare words like "select" or "table") does not trip them.
const ATTACK_PATTERNS: { re: RegExp; label: string }[] = [
  { re: /<\s*script\b/i, label: "script tag" },
  { re: /javascript:/i, label: "js uri" },
  { re: /\son\w+\s*=\s*["']?\s*\w/i, label: "event handler" },
  { re: /\bunion\b\s+\bselect\b/i, label: "sql union" },
  { re: /;\s*drop\s+table\b/i, label: "sql drop" },
  { re: /\b(?:or|and)\b\s+['"]?\d+\s*=\s*\d+/i, label: "sql tautology" },
  { re: /\/\*[\s\S]*?\*\//, label: "sql block comment" },
];
const MAX_STRUCTURED_FIELD_LEN = 5000;

// Scans a single structured field value. Returns a user-facing error string
// (the internal label is logged separately), or null when clean.
export function detectAttackPattern(value: unknown, fieldName: string): { error: string; label: string } | null {
  if (typeof value !== "string") return null;
  if (value.length > MAX_STRUCTURED_FIELD_LEN) {
    return { error: `${fieldName} is too long.`, label: "oversize" };
  }
  for (const p of ATTACK_PATTERNS) {
    if (p.re.test(value)) {
      return { error: `${fieldName} contains a disallowed pattern.`, label: p.label };
    }
  }
  return null;
}

const formSubmissionTimestamps = new Map<string, number[]>();

// Cross-instance form limiter (shared via rl_hit), with a per-instance
// in-memory fallback when the shared limiter is unavailable. Async now: the
// only callers (screenSubmission, api/system.ts) already run in async handlers.
export async function checkFormRateLimit(
  formId: string,
  identity: string,
  limit = 10,
  windowMs = 60_000
): Promise<boolean> {
  const windowSec = Math.max(1, Math.floor(windowMs / 1000));
  const shared = await dbRateLimit(`form:${formId}:${identity}`, limit, windowSec);
  if (shared !== null) return shared;

  // Fallback: best-effort per-instance window.
  const key = `${formId}:${identity}`;
  const now = Date.now();
  const cutoff = now - windowMs;
  const ts = (formSubmissionTimestamps.get(key) || []).filter(t => t > cutoff);
  if (ts.length >= limit) {
    formSubmissionTimestamps.set(key, ts);
    return false;
  }
  ts.push(now);
  formSubmissionTimestamps.set(key, ts);
  return true;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function logAbuse(
  identity: string,
  formId: string,
  reason: string,
  req?: VercelRequest
): Promise<void> {
  console.warn(`[abuse] form=${formId} identity=${identity} reason=${reason}`);

  // Durable security-log entry (append-only, admin-only read). Captures IP/UA
  // when the request is available. This is the authoritative abuse record.
  void logSecurityEvent({
    req,
    eventType: "abuse.blocked",
    severity: "warn",
    userId: UUID_RE.test(identity) ? identity : null,
    metadata: { form: formId, reason, identity: UUID_RE.test(identity) ? undefined : identity },
  });

  // events.user_id is a uuid FK; only write when identity is an authenticated
  // user id. IP-only attempts stay console-only to avoid FK violations.
  if (!UUID_RE.test(identity)) return;
  try {
    await getSupabaseAdmin()
      .from("events")
      .insert({ user_id: identity, event_type: "abuse_blocked" });
  } catch (e) {
    console.warn("Failed to log abuse event:", e);
  }
}

// Network prefix of an IP for coarse session binding: IPv4 -> /24 (first three
// octets), IPv6 -> /64 (first four hextets). Tolerates carrier/WiFi IP churn
// within the same subnet while still catching a jump to a different network.
// Unknown/non-IP values (e.g. "anonymous") are returned unchanged.
export function ipNetworkPrefix(ip: string): string {
  if (!ip) return ip;
  if (ip.includes(".")) {
    return ip.split(".").slice(0, 3).join(".");
  }
  if (ip.includes(":")) {
    return ip.split(":").slice(0, 4).join(":");
  }
  return ip;
}

// Derives a rate-limit/log identity: authenticated user id when available,
// else the first X-Forwarded-For IP, else "anonymous".
export function getClientIdentity(req: VercelRequest, uid?: string | null): string {
  if (uid) return uid;
  const xff = req.headers["x-forwarded-for"];
  const raw = Array.isArray(xff) ? xff[0] : xff || "";
  const ip = raw.split(",")[0].trim();
  return ip || "anonymous";
}

// Single entry point: honeypot -> rate limit -> attack scan. Returns ok, or a
// status+error the handler should return directly.
export async function screenSubmission(params: {
  formId: string;
  identity: string;
  body: any;
  structuredFields?: string[];
  req?: VercelRequest;
}): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const { formId, identity, body, structuredFields = [], req } = params;

  if (isHoneypotTripped(body)) {
    await logAbuse(identity, formId, "honeypot", req);
    return { ok: false, status: 400, error: "Invalid submission." };
  }

  if (!(await checkFormRateLimit(formId, identity))) {
    await logAbuse(identity, formId, "form_rate_limit", req);
    return { ok: false, status: 429, error: "Too many submissions. Please wait a minute and try again." };
  }

  for (const f of structuredFields) {
    const hit = detectAttackPattern(body?.[f], f);
    if (hit) {
      await logAbuse(identity, formId, `attack:${f}:${hit.label}`, req);
      return { ok: false, status: 400, error: hit.error };
    }
  }

  return { ok: true };
}

let razorpayClient: Razorpay | null = null;

export function getRazorpay(): Razorpay {
  if (!razorpayClient) {
    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keyId || !keySecret) {
      throw new Error("Razorpay environment variables RAZORPAY_KEY_ID or RAZORPAY_KEY_SECRET are missing.");
    }
    razorpayClient = new Razorpay({
      key_id: keyId,
      key_secret: keySecret,
    });
  }
  return razorpayClient;
}

export const getSupabaseAdmin = () => {
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "";
  let serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    // In production, never silently fall back to the anon key: admin paths
    // (plan grants, admin authz lookups) would then run under RLS as anon and
    // fail in confusing, security-relevant ways. Fail loudly instead.
    if (process.env.NODE_ENV === "production") {
      throw new Error("SUPABASE_SERVICE_ROLE_KEY is required in production for admin operations.");
    }
    console.warn("Warning: SUPABASE_SERVICE_ROLE_KEY is missing. Falling back to ANON_KEY (dev only). Admin operations may fail.");
    serviceKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
  }
  if (!serviceKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY environment variable is required.");
  }
  return createClient(supabaseUrl, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
};

export const verifyWebhookSignature = (body: string, signature: string, secret: string) => {
  const shasum = crypto.createHmac("sha256", secret);
  shasum.update(body);
  const digest = shasum.digest("hex");
  // Constant-time comparison. A plain `digest === signature` leaks, via timing,
  // how many leading bytes a forged signature matched — enough to forge a valid
  // HMAC byte-by-byte. timingSafeEqual requires equal-length Buffers, so guard
  // the length first (and a non-hex/odd input would throw otherwise).
  if (typeof signature !== "string" || signature.length !== digest.length) {
    return false;
  }
  try {
    return crypto.timingSafeEqual(Buffer.from(digest, "hex"), Buffer.from(signature, "hex"));
  } catch {
    return false;
  }
};

export async function grantReferralRewards(admin: any, userId: string, expiresAt: Date) {
  try {
    const { data: referral, error: refLookupErr } = await admin
      .from("referrals")
      .select("*")
      .eq("referred_id", userId)
      .eq("status", "pending")
      .maybeSingle();

    if (referral && !refLookupErr) {
      // 1. Mark referral as completed and reward granted
      await admin
        .from("referrals")
        .update({
          status: "completed",
          reward_granted: true
        })
        .eq("id", referral.id);

      // 2. Grant 30 days free Pro to the referrer
      const { data: referrerProfile } = await admin
        .from("profiles")
        .select("plan, plan_expires_at")
        .eq("id", referral.referrer_id)
        .maybeSingle();

      if (referrerProfile) {
        let refExpiresOn = new Date();
        if (referrerProfile.plan === "pro" && referrerProfile.plan_expires_at) {
          refExpiresOn = new Date(referrerProfile.plan_expires_at);
        }
        refExpiresOn.setDate(refExpiresOn.getDate() + 30); // 30 extra days reward

        await admin
          .from("profiles")
          .update({
            plan: "pro",
            plan_expires_at: refExpiresOn.toISOString(),
            plan_started_at: new Date().toISOString()
          })
          .eq("id", referral.referrer_id);
      }

      // 3. Grant 30 days additional free Pro to the upgraded referred user (extend by 30 days)
      const extendedExpiresAt = new Date(expiresAt);
      extendedExpiresAt.setDate(extendedExpiresAt.getDate() + 30);
      
      await admin
        .from("profiles")
        .update({
          plan_expires_at: extendedExpiresAt.toISOString()
        })
        .eq("id", userId);

      console.log(`Referral rewards processed: Referrer ${referral.referrer_id} & Referred ${userId} credited with 30 days Pro.`);
    }
  } catch (refErr) {
    console.error("Non-blocking referral reward grant error:", refErr);
  }
}
