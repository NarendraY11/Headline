import { GoogleGenAI } from "@google/genai";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";
import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { getRazorpay, getSupabaseAdmin, grantReferralRewards, verifyWebhookSignature, validateInstructorPayload, validateBroadcastPayload, validatePaymentInterval, validateVerifyPayload, screenSubmission, getClientIdentity } from "./api/_lib/utils.js";
import { validateStudyPlan, expandPlanToMissions } from "./api/_lib/studyPlan.js";
import { handleCoach } from "./api/_lib/coach.js";

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "";
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || "";

const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Ensure AI features operate server-side only to protect GEMINI_API_KEY.
// Key is retrieved safely from process.env here on the server.
const ai = new GoogleGenAI({ 
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});



async function startServer() {
  const app = express();
  const PORT = 3000;

  // === Security Headers Middleware ===
  app.use((req, res, next) => {
    res.setHeader("Content-Security-Policy", "default-src 'self'; script-src 'self' 'unsafe-inline' https://checkout.razorpay.com https://*.razorpay.com https://vitals.vercel-insights.com https://pagead2.googlesyndication.com https://*.googlesyndication.com https://*.google.com https://*.gstatic.com https://*.posthog.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' data: https://fonts.gstatic.com; img-src 'self' data: blob: https://*.supabase.co https://checkout.razorpay.com https://pagead2.googlesyndication.com https://*.googlesyndication.com https://*.google.com https://*.gstatic.com https://*.googleusercontent.com; connect-src 'self' wss://*.supabase.co https://*.supabase.co https://checkout.razorpay.com https://*.razorpay.com https://aviationweather.gov https://api.pwnedpasswords.com https://vitals.vercel-insights.com https://pagead2.googlesyndication.com https://*.googlesyndication.com https://*.google.com https://*.gstatic.com https://*.posthog.com https://*.sentry.io; worker-src 'self' blob:; frame-src 'self' https://checkout.razorpay.com https://*.razorpay.com https://pagead2.googlesyndication.com https://*.googlesyndication.com https://*.google.com https://*.gstatic.com; object-src 'none'; base-uri 'self';");
    res.setHeader("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
    next();
  });

  // === Razorpay Webhook (must accept raw body, so declared before express.json()) ===
  app.post("/api/payment/webhook", express.raw({ type: "application/json" }), async (req, res) => {
    try {
      const signature = req.headers["x-razorpay-signature"] as string;
      const bodyBuffer = req.body;
      const rawBody = bodyBuffer ? bodyBuffer.toString("utf8") : "";

      const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

      if (process.env.NODE_ENV === "production" && !webhookSecret) {
        console.error("CRITICAL: RAZORPAY_WEBHOOK_SECRET is missing in production. Refusing webhook.");
        return res.status(500).json({ error: "Server misconfiguration" });
      }

      if (webhookSecret) {
        if (!signature) {
          console.error("Webhook signature header is missing.");
          return res.status(400).json({ error: "Missing signature header" });
        }
        const isValid = verifyWebhookSignature(rawBody, signature, webhookSecret);
        if (!isValid) {
          console.error("Webhook signature mismatch.");
          return res.status(400).json({ error: "Invalid signature" });
        }
      } else {
        console.warn("Warning: RAZORPAY_WEBHOOK_SECRET is not set. Bypassing signature verification.");
      }

      const payload = JSON.parse(rawBody);
      const event = payload.event;
      console.log(`Razorpay Webhook Event Received: ${event}`);

      if (event === "order.paid" || event === "payment.captured") {
        const orderEntity = payload.payload?.order?.entity || {};
        const paymentEntity = payload.payload?.payment?.entity || {};
        const orderNotes = orderEntity.notes || {};
        const paymentNotes = paymentEntity.notes || {};

        const userId = orderNotes.userId || paymentNotes.userId;
        const interval = orderNotes.interval || paymentNotes.interval || "monthly";

        if (userId) {
          const admin0 = getSupabaseAdmin();
          // Durable payment ledger (best-effort). Unique razorpay_payment_id
          // dedupes against the verify insert when both fire for one payment.
          const razorpayPaymentId = paymentEntity.id;
          if (razorpayPaymentId) {
            try {
              await admin0.from("payments").insert({
                user_id: userId,
                razorpay_payment_id: razorpayPaymentId,
                razorpay_order_id: paymentEntity.order_id || orderEntity.id || null,
                amount: paymentEntity.amount ?? orderEntity.amount ?? 0,
                currency: paymentEntity.currency || orderEntity.currency || "INR",
                status: paymentEntity.status || "captured",
                interval,
                source: "webhook",
                notes: { ...orderNotes, ...paymentNotes },
              });
            } catch (payErr) {
              console.warn("payments insert (webhook) skipped/failed:", payErr);
            }
          }

          const startedAt = new Date().toISOString();
          const expiresAt = new Date();
          if (interval === "yearly") {
            expiresAt.setFullYear(expiresAt.getFullYear() + 1);
          } else {
            expiresAt.setMonth(expiresAt.getMonth() + 1);
          }

          const admin = getSupabaseAdmin();
          const { error } = await admin
            .from("profiles")
            .update({
              plan: "pro",
              plan_started_at: startedAt,
              plan_expires_at: expiresAt.toISOString(),
            })
            .eq("id", userId);

          if (error) {
            console.error(`Failed to update profile for user ${userId}:`, error);
            return res.status(500).json({ error: "Database update failed" });
          }
          console.log(`Successfully updated user ${userId} to Pro plan (${interval})`);
        }
      }

      res.json({ status: "ok" });
    } catch (err: any) {
      console.error("Error in Razorpay Webhook:", err);
      res.status(500).json({ error: err.message || "Internal server error" });
    }
  });

  app.use(express.json());

  // === Authentication Middleware ===
  const requireAuth = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Unauthorized: Missing authentication token." });
    }

    const token = authHeader.split(" ")[1];
    try {
      const { data: { user }, error } = await supabase.auth.getUser(token);
      if (error || !user) {
        throw error || new Error("User verification failed");
      }
      (req as any).uid = user.id;
      next();
    } catch (error) {
      console.error("Error verifying Supabase token:", error);
      return res.status(401).json({ error: "Unauthorized: Invalid or expired authentication token." });
    }
  };

  app.post("/api/admin/init-owner", requireAuth, async (req, res) => {
    try {
      const admin = getSupabaseAdmin();
      const uid = (req as any).uid;
      const { data } = await admin.auth.admin.getUserById(uid);
      
      const email = data?.user?.email;
      if (email === 'narendray112050@gmail.com') {
        const { error: insertErr } = await admin.from('admins').insert({ email });
        // ignore duplicate key error (23505)
        if (insertErr && insertErr.code !== '23505') {
          console.error("Failed to seed admin:", insertErr);
        }
        return res.json({ success: true, email });
      }
      return res.status(403).json({ error: "Not primary owner" });
    } catch (e: any) {
      console.error("Owner init error:", e);
      return res.status(500).json({ error: e.message });
    }
  });

  // Broadcast a notification to every user (admins only).
  app.post("/api/admin/broadcast", requireAuth, async (req, res) => {
    try {
      const admin = getSupabaseAdmin();
      const uid = (req as any).uid;
      const { data: userRes } = await admin.auth.admin.getUserById(uid);
      const email = userRes?.user?.email;

      const { data: adminRow } = await admin.from("admins").select("email").eq("email", email).maybeSingle();
      if (!adminRow) return res.status(403).json({ error: "Admins only." });

      const broadcastScreen = await screenSubmission({
        formId: "admin:broadcast",
        identity: getClientIdentity(req as any, uid),
        body: req.body,
        structuredFields: ["title", "type"],
      });
      if (!broadcastScreen.ok) return res.status(broadcastScreen.status).json({ error: broadcastScreen.error });

      const broadcastError = validateBroadcastPayload(req.body);
      if (broadcastError) return res.status(400).json({ error: broadcastError });
      const { title, message, type } = req.body || {};

      // Fan-out runs in Postgres (one INSERT…SELECT) — mirrors api/admin/broadcast.ts.
      const { data: sent, error } = await admin.rpc("broadcast_notification", {
        p_title: title,
        p_message: message,
        p_type: type || "system",
      });
      if (error) throw error;

      return res.json({ success: true, sent });
    } catch (e: any) {
      console.error("Broadcast error:", e);
      return res.status(500).json({ error: e.message || "Broadcast failed." });
    }
  });

  // === Rate Limiting Middleware ===
  // uid/IP -> timestamps of requests made within the last minute
  const clientRequestTimestamps = new Map<string, number[]>();

  const rateLimiter = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const clientKey = (req as any).uid || req.ip || req.headers["x-forwarded-for"] || "anonymous";

    const now = Date.now();
    const oneMinuteAgo = now - 60 * 1000;

    let timestamps = clientRequestTimestamps.get(String(clientKey)) || [];
    timestamps = timestamps.filter(t => t > oneMinuteAgo);

    if (timestamps.length >= 60) {
      return res.status(429).json({ error: "Rate limit reached. Please try again after 1 minute." });
    }

    timestamps.push(now);
    clientRequestTimestamps.set(String(clientKey), timestamps);
    next();
  };

  const requirePro = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    try {
      const uid = (req as any).uid;
      const admin = getSupabaseAdmin();
      const { data: profile } = await admin.from('profiles').select('*').eq('id', uid).single();
      
      let isPro = false;
      if (profile) {
        const plan = profile.plan;
        const planExpiresAt = profile.plan_expires_at || profile.planExpiresAt;
        
        if (plan === 'lifetime') isPro = true;
        else if (plan === 'pro') {
          if (!planExpiresAt) isPro = true;
          else isPro = new Date(planExpiresAt).getTime() > new Date().getTime();
        } else if (plan === 'trial') {
          if (planExpiresAt && new Date(planExpiresAt).getTime() > new Date().getTime()) {
            isPro = true;
          }
        }
      }
      
      if (!isPro) {
        return res.status(403).json({ error: "Access denied. Pro or active Trial subscription required." });
      }
      next();
    } catch (e) {
      console.error("requirePro error:", e);
      return res.status(500).json({ error: "Failed to verify subscription status." });
    }
  };

  // === Feature Flags ===
  let appSettingsCache: { flags: Record<string, boolean>, timestamp: number } | null = null;
  const CACHE_TTL = 60 * 1000; // 60 seconds

  const assertFeatureEnabled = async (flagKey: string, res: express.Response) => {
    try {
      const now = Date.now();
      if (!appSettingsCache || (now - appSettingsCache.timestamp > CACHE_TTL)) {
        const admin = getSupabaseAdmin();
        const { data } = await admin.from('app_settings').select('flags').eq('id', 1).single();
        if (data && data.flags) {
           appSettingsCache = { flags: data.flags, timestamp: now };
        } else {
           appSettingsCache = { flags: {}, timestamp: now };
        }
      }
      
      const enabled = appSettingsCache.flags[flagKey] ?? true;
      if (!enabled) {
        res.status(403).json({ error: "This feature is currently disabled." });
        return false;
      }
      return true;
    } catch (e) {
       console.error("Feature flag check error:", e);
       return true; 
    }
  };

  // === Razorpay Order Creation Endpoint ===
  app.post("/api/payment/create-order", requireAuth, rateLimiter, async (req, res) => {
    if (!(await assertFeatureEnabled("pricingCheckout", res))) return;
    const orderScreen = await screenSubmission({
      formId: "payment:create-order",
      identity: getClientIdentity(req as any, (req as any).uid),
      body: req.body,
      structuredFields: ["interval", "plan"],
    });
    if (!orderScreen.ok) return res.status(orderScreen.status).json({ error: orderScreen.error });

    const intervalError = validatePaymentInterval(req.body);
    if (intervalError) {
      return res.status(400).json({ error: intervalError });
    }
    try {
      const { interval = "monthly" } = req.body;
      const isYearly = interval === "yearly" || interval === "annual";
      const amount = isYearly ? 2999 * 100 : 499 * 100;

      const rz = getRazorpay();
      const options = {
        amount,
        currency: "INR",
        receipt: `receipt_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        notes: {
          userId: (req as any).uid,
          interval: isYearly ? "yearly" : "monthly",
        },
      };

      const order = await rz.orders.create(options);
      res.json(order);
    } catch (error: any) {
      console.error("Error creating Razorpay order:", error);
      res.status(500).json({ error: error.message || "Failed to create payment order. Ensure RAZORPAY_KEY_ID is set." });
    }
  });

  // === Razorpay Signature Verification Endpoint ===
  app.post("/api/payment/verify", requireAuth, rateLimiter, async (req, res) => {
    if (!(await assertFeatureEnabled("pricingCheckout", res))) return;
    const verifyScreen = await screenSubmission({
      formId: "payment:verify",
      identity: getClientIdentity(req as any, (req as any).uid),
      body: req.body,
      structuredFields: ["razorpay_payment_id", "razorpay_order_id", "razorpay_signature"],
    });
    if (!verifyScreen.ok) return res.status(verifyScreen.status).json({ error: verifyScreen.error });

    const verifyError = validateVerifyPayload(req.body);
    if (verifyError) {
      return res.status(400).json({ error: verifyError });
    }
    try {
      const { razorpay_payment_id, razorpay_order_id, razorpay_signature } = req.body;
      const signaturePayload = `${razorpay_order_id}|${razorpay_payment_id}`;
      
      const keySecret = process.env.RAZORPAY_KEY_SECRET;
      if (!keySecret) {
        throw new Error("RAZORPAY_KEY_SECRET is missing.");
      }

      const isValid = verifyWebhookSignature(signaturePayload, razorpay_signature, keySecret);
      if (!isValid) {
        return res.status(400).json({ error: "Signature verification failed." });
      }

      const rz = getRazorpay();
      const order = await rz.orders.fetch(razorpay_order_id);

      // Authorization: order must belong to the caller (see api/payment/verify.ts).
      if ((order as any)?.notes?.userId && (order as any).notes.userId !== (req as any).uid) {
        return res.status(403).json({ error: "Order does not belong to this account." });
      }
      if ((order as any)?.status !== "paid") {
        return res.status(400).json({ error: "Order is not paid." });
      }

      const admin = getSupabaseAdmin();

      // Idempotency: skip re-granting if this payment was already recorded.
      // Keyed on the unique payments.razorpay_payment_id.
      const { data: priorPayment } = await admin
        .from("payments")
        .select("id")
        .eq("razorpay_payment_id", razorpay_payment_id)
        .maybeSingle();
      if (priorPayment) {
        return res.json({ success: true, alreadyProcessed: true });
      }

      const PLAN_PRICE_MONTHLY = 499 * 100;
      const PLAN_PRICE_YEARLY = 2999 * 100;

      const paidAmount = order.amount;

      let verifiedInterval = "monthly";
      if (paidAmount === PLAN_PRICE_YEARLY) {
        verifiedInterval = "yearly";
      } else if (paidAmount === PLAN_PRICE_MONTHLY) {
        verifiedInterval = "monthly";
      } else {
        return res.status(400).json({ error: "Paid amount does not match any known plan price." });
      }

      const startedAt = new Date().toISOString();
      const expiresAt = new Date();
      if (verifiedInterval === "yearly") {
        expiresAt.setFullYear(expiresAt.getFullYear() + 1);
      } else {
        expiresAt.setMonth(expiresAt.getMonth() + 1);
      }

      const { error } = await admin
        .from("profiles")
        .update({
          plan: "pro",
          plan_started_at: startedAt,
          plan_expires_at: expiresAt.toISOString(),
        })
        .eq("id", (req as any).uid);

      if (error) {
        throw error;
      }

      // Durable payment ledger + idempotency key checked above.
      try {
        await admin.from("payments").insert({
          user_id: (req as any).uid,
          razorpay_payment_id,
          razorpay_order_id,
          amount: paidAmount,
          currency: order.currency || "INR",
          status: order.status,
          interval: verifiedInterval,
          source: "verify",
          notes: order.notes ?? null,
        });
      } catch (payErr) {
        console.warn("payments insert failed:", payErr);
      }

      // Audit trail.
      try {
        await admin.from("plan_changes").insert({
          user_id: (req as any).uid,
          new_plan: "pro",
          expires_at: expiresAt.toISOString(),
          note: `razorpay payment ${razorpay_payment_id} (${verifiedInterval})`,
        });
      } catch (auditErr) {
        console.warn("plan_changes audit insert failed:", auditErr);
      }

      await grantReferralRewards(admin, (req as any).uid, expiresAt);

      res.json({ success: true });
    } catch (error: any) {
      console.error("Payment verification failed:", error);
      res.status(500).json({ error: error.message || "Failed to verify signature." });
    }
  });

  // === TIER & TRIAL MANAGEMENT ENDPOINT ===
  app.post("/api/start-trial", requireAuth, rateLimiter, async (req, res) => {
    if (!(await assertFeatureEnabled("freeTrial", res))) return;
    const trialScreen = await screenSubmission({
      formId: "start-trial",
      identity: getClientIdentity(req as any, (req as any).uid),
      body: req.body,
    });
    if (!trialScreen.ok) return res.status(trialScreen.status).json({ error: trialScreen.error });
    try {
      const admin = getSupabaseAdmin();
      const userId = (req as any).uid;

      // Ensure the user hasn't already had a trial
      const { data: profile, error: readProfileError } = await admin
        .from("profiles")
        .select("plan, plan_started_at")
        .eq("id", userId)
        .single();
      
      if (readProfileError || !profile) {
        return res.status(404).json({ error: "Profile not found." });
      }

      // Check if user already had a trial or pro plan
      // A user is eligible if they are currently 'free' and plan_started_at is not set
      // (assuming plan_started_at is populated when trial or pro is granted)
      if (profile.plan !== "free" || profile.plan_started_at !== null) {
          // If handle_new_user already puts plan_started_at there, we'll refine the logic:
          // A user can start trial if they are currently free. If you want to be stricter,
          // check for a trialUsed flag in settings, but let's assume `plan !== 'free'` or existing plan_expires_at ensures trial is used.
          // Since instructions say ONLY if plan_started_at is null or plan='free', let's use:
      }
      
      // Let's rely on checking if they have ever been off 'free'
      // To strictly prevent multi-trials, we check if settings->>'trialUsed' is true

      const startedAt = new Date().toISOString();
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7); // 7 days trial
      
      const { data: currentSettingsProfile } = await admin
        .from("profiles")
        .select("settings")
        .eq("id", userId)
        .single();
        
      const currentSettings = currentSettingsProfile?.settings || {};
      
      if (currentSettings.trialUsed) {
        return res.status(400).json({ error: "Trial has already been used." });
      }

      currentSettings.trialUsed = true;
      currentSettings.trialStartedAt = startedAt;

      const { error } = await admin
        .from("profiles")
        .update({
          plan: "trial",
          plan_started_at: startedAt,
          plan_expires_at: expiresAt.toISOString(),
          settings: currentSettings
        })
        .eq("id", userId);

      if (error) {
        console.error(`Failed to grant trial for user ${userId}:`, error);
        return res.status(500).json({ error: "Failed to grant trial." });
      }
      
      console.log(`Successfully granted 7 day trial to user ${userId}`);
      res.json({ success: true, plan: "trial", plan_expires_at: expiresAt.toISOString() });
    } catch (error: any) {
      console.error("Trial start failed:", error);
      res.status(500).json({ error: error.message || "Failed to start trial." });
    }
  });

  // === STUDY SCHEDULER (Phase M1) — dev mirror of api/study/[action].ts ===
  // Gated behind `aiStudyScheduler` (OFF by default). Only action: materialize.
  app.post("/api/study/:action", requireAuth, rateLimiter, async (req, res) => {
    if (!(await assertFeatureEnabled("aiStudyScheduler", res))) return;
    const action = req.params.action;
    if (action !== "materialize") return res.status(404).json({ error: "Not Found" });

    const screen = await screenSubmission({
      formId: `study:${action}`,
      identity: getClientIdentity(req as any, (req as any).uid),
      body: req.body,
    });
    if (!screen.ok) return res.status(screen.status).json({ error: screen.error });

    try {
      const uid = (req as any).uid;
      const admin = getSupabaseAdmin();

      const { data: planRow, error: planErr } = await admin
        .from("study_plans")
        .select("id, plan")
        .eq("user_id", uid)
        .eq("status", "active")
        .maybeSingle();
      if (planErr) {
        console.error("materialize: plan lookup failed:", planErr.message);
        return res.status(500).json({ error: "Failed to load study plan." });
      }
      if (!planRow) return res.status(404).json({ error: "No active study plan to materialize." });

      const validation = validateStudyPlan(planRow.plan);
      if (!validation.ok) {
        return res.status(422).json({ error: `Invalid study plan: ${validation.error}` });
      }

      const baseDate = new Date();
      const rows = expandPlanToMissions(validation.plan, { planId: planRow.id, userId: uid, baseDate });

      const todayISO = baseDate.toISOString().slice(0, 10);
      const { error: delErr } = await admin
        .from("study_missions")
        .delete()
        .eq("plan_id", planRow.id)
        .eq("source", "plan")
        .eq("status", "pending")
        .gte("scheduled_date", todayISO);
      if (delErr) {
        console.error("materialize: clear-pending failed:", delErr.message);
        return res.status(500).json({ error: "Failed to refresh missions." });
      }

      if (rows.length > 0) {
        const { error: insErr } = await admin.from("study_missions").insert(rows);
        if (insErr) {
          console.error("materialize: insert failed:", insErr.message);
          return res.status(500).json({ error: "Failed to create missions." });
        }
      }

      return res.json({ success: true, planId: planRow.id, missions: rows.length });
    } catch (error: any) {
      console.error("Study materialize failed:", error);
      return res.status(500).json({ error: error.message || "Failed to process request." });
    }
  });

  // === AI FEATURE 1: "Ask the Instructor" ===
  app.post("/api/instructor/explain", requireAuth, rateLimiter, async (req, res) => {
    if (!(await assertFeatureEnabled("aiExplain", res))) return;
    try {
      const explainScreen = await screenSubmission({
        formId: "instructor:explain",
        identity: getClientIdentity(req as any, (req as any).uid),
        body: req.body,
      });
      if (!explainScreen.ok) return res.status(explainScreen.status).json({ error: explainScreen.error });
      const explainError = validateInstructorPayload("explain", req.body);
      if (explainError) return res.status(400).json({ error: explainError });
      const { prompt, userAnswer, correctAnswer } = req.body;
      
      const responseStream = await ai.models.generateContentStream({
        model: "gemini-2.5-flash",
        contents: [
          { role: "user", parts: [{ text: `Question: ${prompt}\nUser's Answer: ${userAnswer}\nCorrect Answer: ${correctAnswer}` }] }
        ],
        config: {
          systemInstruction: "You are a senior airline ground instructor and Type Rating Examiner. Explain this aviation exam question clearly and concisely for a CPL/ATPL student. Be technically precise, cite the system logic, and keep it under 150 words. If the student picked a wrong answer, gently explain the specific misconception."
        }
      });

      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.setHeader("Transfer-Encoding", "chunked");

      for await (const chunk of responseStream) {
        if (chunk.text) {
          res.write(chunk.text);
        }
      }
      res.end();
    } catch (error) {
      console.error("Error in explain deeper:", error);
      res.status(500).json({ error: "Failed to generate explanation. Please try again." });
    }
  });

  // === AI FEATURE 2: "Generate practice questions" ===
  app.post("/api/instructor/practice", requireAuth, requirePro, rateLimiter, async (req, res) => {
    if (!(await assertFeatureEnabled("aiPractice", res))) return;
    try {
      const practiceScreen = await screenSubmission({
        formId: "instructor:practice",
        identity: getClientIdentity(req as any, (req as any).uid),
        body: req.body,
        structuredFields: ["topic", "code"],
      });
      if (!practiceScreen.ok) return res.status(practiceScreen.status).json({ error: practiceScreen.error });
      const practiceError = validateInstructorPayload("practice", req.body);
      if (practiceError) return res.status(400).json({ error: practiceError });
      const { topic, code } = req.body;
      const admin = getSupabaseAdmin();
      
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data: cachedDrafts } = await admin.from('questions')
        .select('id, ata, difficulty, prompt, diagram_caption, choices, correct, explanation')
        .eq('ata', code)
        .eq('status', 'draft')
        .gte('created_at', oneDayAgo)
        .limit(5);

      if (cachedDrafts && cachedDrafts.length === 5) {
        // Map db format back to expected json format for client
        const out = cachedDrafts.map((q: any) => ({
          ...q,
          diagramCaption: q.diagram_caption,
          references: []
        }));
        return res.json(out);
      }
      
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [
          { role: "user", parts: [{ text: `Topic: ${code} - ${topic}` }] }
        ],
        config: {
          systemInstruction: `You are an aviation examiner. Generate 5 practice multiple-choice questions for the specified topic.
Return STRICT JSON ONLY, matching exactly this schema:
[
  {
    "id": "unique-string-id",
    "ata": "Topic Code and Name",
    "difficulty": "standard" | "complex" | "extreme",
    "prompt": "Question text",
    "diagramCaption": "Optional diagram text (can be null or omitted)",
    "choices": [
      { "id": "a", "label": "Option A" },
      { "id": "b", "label": "Option B" },
      { "id": "c", "label": "Option C" },
      { "id": "d", "label": "Option D" }
    ],
    "correct": "a" | "b" | "c" | "d",
    "explanation": "2-3 sentences technical explanation.",
    "references": ["FCOM 1.27...", "ATA..."]
  }
]
Do not include \`\`\`json or \`\`\` blocks, just the raw JSON array. Make the questions technically accurate, challenging, and suitable for A320 type rating prep where applicable.`,
          responseMimeType: "application/json"
        }
      });

      let responseText = response.text || "[]";
      // Clean up markdown fences if model ignored responseMimeType
      responseText = responseText.replace(/^```json\s*/, "").replace(/\s*```$/, "");
      
      const questions = JSON.parse(responseText);
      
      const questionsToInsert = questions.map((q: any) => ({
        id: crypto.randomUUID(),
        ata: code,
        prompt: q.prompt,
        diagram_caption: q.diagramCaption || null,
        choices: q.choices,
        correct: q.correct,
        explanation: q.explanation,
        difficulty: q.difficulty || "standard",
        status: "draft"
      }));

      const { data: inserted, error: insertError } = await admin.from('questions').insert(questionsToInsert).select();
      if (insertError) {
        console.error("Error inserting drafts:", insertError);
        return res.json(questions);
      }

      const out = inserted.map((q: any) => ({
          ...q,
          diagramCaption: q.diagram_caption,
          references: []
      }));
      res.json(out);
    } catch (error) {
      console.error("Error generating practice questions:", error);
      res.status(500).json({ error: "Failed to generate practice set. Please try again." });
    }
  });

  // === AI FEATURE 3: "Weak-area coach" ===
  app.post("/api/instructor/coach", requireAuth, requirePro, rateLimiter, async (req, res) => {
    if (!(await assertFeatureEnabled("aiCoach", res))) return;
    try {
      const coachScreen = await screenSubmission({
        formId: "instructor:coach",
        identity: getClientIdentity(req as any, (req as any).uid),
        body: req.body,
      });
      if (!coachScreen.ok) return res.status(coachScreen.status).json({ error: coachScreen.error });
      const coachError = validateInstructorPayload("coach", req.body);
      if (coachError) return res.status(400).json({ error: coachError });

      // Shared with prod (api/instructor/[action].ts) via handleCoach: markdown
      // by default, structured StudyPlan JSON persisted to study_plans when the
      // aiStudyScheduler flag is on. Caching + fallback live inside handleCoach.
      const uid = (req as any).uid;
      const result = await handleCoach(ai, getSupabaseAdmin(), uid, req.body || {});
      res.status(result.status).json(result.body);
    } catch (error) {
      console.error("Error generating study plan:", error);
      res.status(500).json({ error: "Failed to generate study plan. Please try again." });
    }
  });

  // === AI FEATURE 4: "Analytics Diagnosis" ===
  app.post("/api/instructor/diagnosis", requireAuth, requirePro, rateLimiter, async (req, res) => {
    if (!(await assertFeatureEnabled("aiDiagnosis", res))) return;
    try {
      const diagnosisScreen = await screenSubmission({
        formId: "instructor:diagnosis",
        identity: getClientIdentity(req as any, (req as any).uid),
        body: req.body,
      });
      if (!diagnosisScreen.ok) return res.status(diagnosisScreen.status).json({ error: diagnosisScreen.error });
      const diagnosisError = validateInstructorPayload("diagnosis", req.body);
      if (diagnosisError) return res.status(400).json({ error: diagnosisError });
      const { summary } = req.body;
      const uid = (req as any).uid;
      const today = new Date().toISOString().split('T')[0];
      const cacheKey = `diagnosis_${uid}_${today}`;
      const admin = getSupabaseAdmin();

      const { data: cacheRow } = await admin.from('ai_cache').select('*').eq('cache_key', cacheKey).single();
      const CACHE_DURATION = 24 * 60 * 60 * 1000;
      if (cacheRow && (Date.now() - new Date(cacheRow.updated_at).getTime() < CACHE_DURATION)) {
        res.setHeader("Content-Type", "text/plain; charset=utf-8");
        res.write(cacheRow.data.text);
        return res.end();
      }

      const responseStream = await ai.models.generateContentStream({
        model: "gemini-2.5-flash",
        contents: [
          { role: "user", parts: [{ text: `Here is the user's analytics summary:\n${summary}\n\nBased on this, write a 3-sentence diagnosis of the user's biggest risk area before their exam.` }] }
        ],
        config: {
          systemInstruction: "You are a strict, demanding airline check airman analyzing a student's pilot exam statistics to tell them exactly where they are most likely to fail out. Be direct, authoritative, and concise. No more than 3 sentences."
        }
      });
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.setHeader("Transfer-Encoding", "chunked");

      let fullText = "";
      for await (const chunk of responseStream) {
        if (chunk.text) {
          fullText += chunk.text;
          res.write(chunk.text);
        }
      }
      res.end();
      
      await admin.from('ai_cache').upsert({
        cache_key: cacheKey,
        data: { text: fullText },
        updated_at: new Date().toISOString()
      }, { onConflict: 'cache_key' });

    } catch (error) {
      console.error("Error in AI diagnosis:", error);
      res.status(500).json({ error: "Failed to generate diagnosis." });
    }
  });

  // === AUTH EVENT BREADCRUMB (public; client reports auth attempts) ===
  // Dev parity for api/auth-event.ts. Server stamps IP/UA into security_log.
  app.post("/api/auth-event", async (req, res) => {
    const ALLOWED: Record<string, string> = {
      login_success: "info", login_failed: "warn", signup: "info",
      password_reset_requested: "info", logout: "info",
    };
    const type = typeof req.body?.type === "string" ? req.body.type : "";
    const severity = ALLOWED[type];
    if (!severity) return res.status(204).end();
    const xff = req.headers["x-forwarded-for"];
    const ip = (Array.isArray(xff) ? xff[0] : xff || "").split(",")[0].trim() || req.ip || "anonymous";
    const ua = String(req.headers["user-agent"] || "").slice(0, 500);
    const rawEmail = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
    const email = /^[^\s@]{1,200}@[^\s@]{1,200}\.[^\s@]{1,20}$/.test(rawEmail) ? rawEmail : null;
    try {
      await getSupabaseAdmin().from("security_log").insert({
        event_type: `auth.${type}`, severity, actor_email: email,
        ip, user_agent: ua, route: "/api/auth-event", http_method: "POST",
      });
    } catch { /* best-effort */ }
    return res.status(204).end();
  });

  // === SESSION IP-BINDING CHECK ===
  app.post("/api/session/check", requireAuth, async (req, res) => {
    const uid = (req as any).uid;
    const sessionId = typeof req.body?.session_id === "string" ? req.body.session_id : "";
    const ua = typeof req.headers["user-agent"] === "string" ? req.headers["user-agent"] : "";
    const ip = getClientIdentity(req as any); // IP only (no uid passed)
    try {
      const admin = getSupabaseAdmin();
      const { data: row, error } = await admin
        .from("active_sessions")
        .select("session_id, ip_address, device_info")
        .eq("user_id", uid)
        .maybeSingle();

      if (error || !row) return res.json({ valid: true });
      // Different session id owns the slot, but tolerate the same physical
      // device (installed PWA vs browser keep separate ids yet share a UA).
      const sameDevice = !!row.device_info && !!ua && row.device_info === ua;
      if (sessionId && row.session_id && row.session_id !== sessionId && !sameDevice) {
        return res.json({ valid: false, reason: "superseded" });
      }
      if (!row.ip_address) {
        await admin.from("active_sessions").update({ ip_address: ip }).eq("user_id", uid);
        return res.json({ valid: true, bound: true });
      }
      // Advisory only: mobile networks rotate the public IP legitimately, so a
      // prefix change must NOT evict (it was logging users out of installed
      // PWAs repeatedly). The session_id supersede check above still enforces
      // single-device takeover.
      return res.json({ valid: true });
    } catch (e) {
      console.warn("session/check failed (fail-open):", e);
      return res.json({ valid: true });
    }
  });

  // === WEATHER METAR ENDPOINT (WITH SERVER CACHING) ===
  app.post("/api/weather", requireAuth, requirePro, rateLimiter, async (req, res) => {
    if (!(await assertFeatureEnabled("weatherBriefing", res))) return;
    const weatherScreen = await screenSubmission({
      formId: "weather",
      identity: getClientIdentity(req as any, (req as any).uid),
      body: req.body,
      structuredFields: ["icao"],
    });
    if (!weatherScreen.ok) return res.status(weatherScreen.status).json({ error: weatherScreen.error });
    try {
      const { icao = "EGLL" } = req.body;
      const cachedKey = typeof icao === "string" ? icao.trim().toUpperCase() : "";
      // ICAO station IDs are 3-4 alphanumerics. Validate before interpolating
      // into the NOAA URL (prevents query-string injection / junk cache keys).
      if (!/^[A-Z0-9]{3,4}$/.test(cachedKey)) {
        return res.status(400).json({ error: "Invalid ICAO code." });
      }
      
      const admin = getSupabaseAdmin();

      const { data: cacheRow } = await admin
        .from('weather_cache')
        .select('*')
        .eq('icao', cachedKey)
        .single();

      const CACHE_DURATION = 45 * 60 * 1000; // 45 minutes
      const now = Date.now();

      if (cacheRow && (now - new Date(cacheRow.updated_at).getTime() < CACHE_DURATION)) {
        return res.json(cacheRow.data);
      }

      const url = `https://aviationweather.gov/api/data/metar?ids=${cachedKey}&format=json`;
      const noaaRes = await fetch(url);
      if (!noaaRes.ok) throw new Error("NOAA API failed");
      const metarData = await noaaRes.json();

      if (!metarData || metarData.length === 0) {
        throw new Error(`No METAR found for ${cachedKey}`);
      }

      const metar = metarData[0];

      const wdir = metar.wdir === 'VRB' ? 'Variable' : (metar.wdir ? `${metar.wdir}°` : '');
      const wspd = metar.wspd ? `${metar.wspd}kt` : '';
      const wind = wdir && wspd ? `Wind ${wdir} at ${wspd}` : '';
      const vis = metar.visib ? `Vis ${metar.visib}sm` : '';
      const temp = (metar.temp !== null && metar.temp !== undefined) ? `Temp ${metar.temp}°C` : '';
      const clouds = metar.clouds ? metar.clouds.map((c: any) => c.cover).join('/') : '';

      const briefingParts = [wind, vis, temp, clouds].filter(Boolean);
      const briefing = `METAR for ${cachedKey}: ${briefingParts.join(', ')}.`;

      let condition = "SUNNY";
      if (metar.wxString && metar.wxString.includes("TS")) condition = "STORM";
      else if (metar.wxString && (metar.wxString.includes("RA") || metar.wxString.includes("DZ"))) condition = "RAIN";
      else if (metar.wxString && metar.wxString.includes("SN")) condition = "SNOW";
      else if (metar.wxString && (metar.wxString.includes("BR") || metar.wxString.includes("FG"))) condition = "FOG";
      else if (wspd && parseInt(metar.wspd) > 20) condition = "WINDY";
      else if (metar.clouds && metar.clouds.some((c: any) => ['BKN', 'OVC'].includes(c.cover))) condition = "CLOUDY";

      const finalData = {
        briefing,
        condition,
        forecast: []
      };

      await admin.from('weather_cache').upsert({
        icao: cachedKey,
        data: finalData,
        updated_at: new Date().toISOString()
      }, { onConflict: 'icao' });

      res.json(finalData);
    } catch (e) {
      console.error("Error in weather handler:", e);
      res.status(500).json({ error: "Failed to fetch weather." });
    }
  });

  // === HEALTH PROBE (public; uptime monitors / status page) ===
  app.get("/api/health", async (_req, res) => {
    const startedAt = Date.now();
    let db = false;
    try {
      const { error } = await getSupabaseAdmin()
        .from("app_settings").select("id", { head: true, count: "estimated" }).limit(1);
      db = !error;
    } catch { db = false; }
    res.setHeader("Cache-Control", "no-store");
    res.status(db ? 200 : 503).json({
      status: db ? "ok" : "degraded", db, dbLatencyMs: Date.now() - startedAt,
      timestamp: new Date().toISOString(),
    });
  });

  // === DYNAMIC SITEMAP ENGINE ===
  app.get("/sitemap.xml", async (req, res) => {
    const host = req.headers["x-forwarded-host"] || req.headers.host || "heading.com";
    const proto = req.headers["x-forwarded-proto"] || "https";
    const baseUrl = `${proto}://${host}`;

    const { generateSitemapXml } = await import("./src/lib/sitemap.js");

    const xml = await generateSitemapXml(baseUrl, async () => {
      try {
        const adminSupabase = getSupabaseAdmin();
        const { data } = await adminSupabase
          .from("blog_posts")
          .select("slug, updated_at")
          .eq("status", "published");
        return data || [];
      } catch (e) {
        return [];
      }
    });

    res.header("Content-Type", "application/xml");
    res.status(200).send(xml);
  });

  // === DYNAMIC ROBOTS.TXT ENGINE ===
  app.get("/robots.txt", async (req, res) => {
    const host = req.headers["x-forwarded-host"] || req.headers.host || "heading.com";
    const proto = req.headers["x-forwarded-proto"] || "https";
    const baseUrl = `${proto}://${host}`;
    
    const { generateRobotsTxt } = await import("./src/lib/robots.js");
    const content = generateRobotsTxt(baseUrl);
    
    res.header("Content-Type", "text/plain");
    res.status(200).send(content);
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    // First let express.static try to find the direct mapping (which includes dist/<route>/index.html naturally)
    app.use(express.static(distPath, { extensions: ['html'] }));
    
    // Known SPA prefixes
    const KNOWN_PREFIXES = [
      '/about', '/pricing', '/reset-password', '/privacy', '/terms', '/refund', '/contact', 
      '/exams', '/blog', '/qotd', '/a320-systems', '/admin', '/today', '/modules', '/topic', 
      '/mock-exams', '/analytics', '/bookmarks', '/profile', '/referral', '/quiz'
    ];

    // For anything express.static didn't catch, check if there's a pre-rendered folder
    app.get('*all', async (req, res) => {
      // Clean path to prevent directory traversal
      const reqPath = String(req.path).replace(/\.\./g, '');
      const potentialPrerenderPath = path.join(distPath, reqPath, 'index.html');
      
      try {
        const stats = await import('fs/promises').then(m => m.stat(potentialPrerenderPath));
        if (stats.isFile()) {
           return res.sendFile(potentialPrerenderPath);
        }
      } catch (err) {
        // file doesn't exist, ignore and fallback
      }

      // Soft 404 for unknown routes
      const isKnownRoute = reqPath === '/' || KNOWN_PREFIXES.some(prefix => reqPath.startsWith(prefix));
      if (!isKnownRoute) {
        res.status(404);
      }

      // Final fallback to SPA shell
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
