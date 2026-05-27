import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getAuthenticatedUser } from "../_lib/utils";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";

const getSupabaseAdmin = () => {
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "";
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY environment variable is required.");
  }
  return createClient(supabaseUrl, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
};

const verifyWebhookSignature = (body: string, signature: string, secret: string) => {
  const shasum = crypto.createHmac("sha256", secret);
  shasum.update(body);
  const digest = shasum.digest("hex");
  return digest === signature;
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const user = await getAuthenticatedUser(req, res);
  if (!user) return; // Response is already written by getAuthenticatedUser on error

  try {
    const { razorpay_payment_id, razorpay_order_id, razorpay_signature, interval } = req.body || {};
    
    if (!razorpay_payment_id || !razorpay_order_id || !razorpay_signature) {
      return res.status(400).json({ error: "Missing required payment parameters." });
    }

    const signaturePayload = `${razorpay_order_id}|${razorpay_payment_id}`;
    
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keySecret) {
      return res.status(500).json({ error: "RAZORPAY_KEY_SECRET is missing." });
    }

    const isValid = verifyWebhookSignature(signaturePayload, razorpay_signature, keySecret);
    if (!isValid) {
      return res.status(400).json({ error: "Signature verification failed." });
    }

    const startedAt = new Date().toISOString();
    const expiresAt = new Date();
    if (interval === "yearly" || interval === "annual") {
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
      .eq("id", user.id);

    if (error) {
      throw error;
    }

    // Process Referral Rewards (Matches server.ts exactly)
    try {
      const { data: referral, error: refLookupErr } = await admin
        .from("referrals")
        .select("*")
        .eq("referred_id", user.id)
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
          .eq("id", user.id);

        console.log(`Referral rewards processed in serverless function: Referrer ${referral.referrer_id} & Referred ${user.id} credited with 30 days Pro.`);
      }
    } catch (refErr) {
      console.error("Non-blocking referral reward grant error in serverless function:", refErr);
    }

    return res.status(200).json({ success: true });
  } catch (error: any) {
    console.error("Payment verification failed in serverless function:", error);
    return res.status(500).json({ error: error.message || "Failed to verify signature." });
  }
}
