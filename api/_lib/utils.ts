import { createClient } from "@supabase/supabase-js";
import { GoogleGenAI } from "@google/genai";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import Razorpay from "razorpay";
import crypto from "crypto";

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
    console.error("Error verifying Supabase token:", error);
    res.status(401).json({ error: "Unauthorized: Invalid or expired authentication token." });
    return null;
  }
}

const userRequestTimestamps = new Map<string, number[]>();

export async function checkRateLimit(uid: string): Promise<boolean> {
  const now = Date.now();
  const oneHourAgo = now - 60 * 60 * 1000;

  // 1. In-memory per-instance check
  let timestamps = userRequestTimestamps.get(uid) || [];
  timestamps = timestamps.filter(t => t > oneHourAgo);
  if (timestamps.length >= 20) {
    return false;
  }

  // 2. Precise Supabase backstop. Must use the admin client: events SELECT is
  // admin-only under RLS, so the anon client would always count 0.
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

  // Authoritative server-side usage log so the DB backstop above actually
  // has rows to count (client-side analytics events can be bypassed).
  // Uses the admin client because the anon client has no auth context here.
  try {
    await getSupabaseAdmin()
      .from("events")
      .insert({ user_id: uid, event_type: "ai_used" });
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
export function validateBroadcastPayload(body: any): string | null {
  const b = body || {};
  const err =
    checkString(b.title, "title", { max: 200 }) ||
    checkString(b.message, "message", { max: 2000 }) ||
    checkString(b.type, "type", { required: false, max: 50 });
  return err;
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
    console.warn("Warning: SUPABASE_SERVICE_ROLE_KEY is missing. Falling back to ANON_KEY. Admin operations may fail.");
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
  return digest === signature;
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
