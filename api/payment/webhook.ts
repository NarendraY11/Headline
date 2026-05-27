import type { VercelRequest, VercelResponse } from "@vercel/node";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";

export const config = {
  api: {
    bodyParser: false,
  },
};

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

async function getRawBody(req: any): Promise<string> {
  if (req.body && Buffer.isBuffer(req.body)) {
    return req.body.toString("utf8");
  }
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    const signature = req.headers["x-razorpay-signature"] as string;
    const rawBody = await getRawBody(req);

    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
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
      console.warn("Warning: RAZORPAY_WEBHOOK_SECRET is not set. Bypassing signatures in dev.");
    }

    const payload = JSON.parse(rawBody);
    const event = payload.event;
    console.log(`Razorpay Serverless Webhook Event Received: ${event}`);

    const admin = getSupabaseAdmin();

    // 1. Upgrades / Renewal Purchases
    if (
      event === "order.paid" || 
      event === "payment.captured" || 
      event === "subscription.charged" ||
      event === "subscription.activated"
    ) {
      const orderNotes = payload.payload?.order?.entity?.notes || {};
      const paymentNotes = payload.payload?.payment?.entity?.notes || {};
      const subNotes = payload.payload?.subscription?.entity?.notes || {};
      
      const userId = orderNotes.userId || paymentNotes.userId || subNotes.userId;
      const interval = orderNotes.interval || paymentNotes.interval || subNotes.interval || "monthly";

      if (userId) {
        const startedAt = new Date().toISOString();
        const expiresAt = new Date();
        if (interval === "yearly" || interval === "annual") {
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
          .eq("id", userId);

        if (error) {
          console.error(`Failed to update profile for user ${userId} on webhook event ${event}:`, error);
          return res.status(500).json({ error: "Database update failed" });
        }
        console.log(`Successfully updated user ${userId} to Pro plan via Webhook (${interval})`);
      }
    }

    // 2. Cancellations / Expiries / Downgrades
    if (
      event === "subscription.cancelled" ||
      event === "subscription.expired" ||
      event === "subscription.halted"
    ) {
      const orderNotes = payload.payload?.order?.entity?.notes || {};
      const paymentNotes = payload.payload?.payment?.entity?.notes || {};
      const subNotes = payload.payload?.subscription?.entity?.notes || {};
      
      const userId = orderNotes.userId || paymentNotes.userId || subNotes.userId;

      if (userId) {
        const { error } = await admin
          .from("profiles")
          .update({
            plan: "free",
            plan_expires_at: new Date().toISOString()
          })
          .eq("id", userId);

        if (error) {
          console.error(`Failed to revoke Pro plan for user ${userId} on webhook event ${event}:`, error);
          return res.status(500).json({ error: "Database update failed" });
        }
        console.log(`Successfully downgraded canceled user ${userId} to Free plan via Webhook`);
      }
    }

    return res.status(200).json({ status: "ok" });
  } catch (err: any) {
    console.error("Error in Serverless Razorpay Webhook:", err);
    return res.status(500).json({ error: err.message || "Internal server error" });
  }
}
