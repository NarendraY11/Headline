import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getAuthenticatedUser, getRazorpay, getSupabaseAdmin, verifyWebhookSignature, grantReferralRewards } from "../_lib/utils";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const user = await getAuthenticatedUser(req, res);
  if (!user) return; // Response is already written by getAuthenticatedUser on error

  try {
    const { razorpay_payment_id, razorpay_order_id, razorpay_signature } = req.body || {};
    
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

    const rz = getRazorpay();
    const order = await rz.orders.fetch(razorpay_order_id);
    
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
    if (verifiedInterval === "yearly" || verifiedInterval === "annual") {
      expiresAt.setFullYear(expiresAt.getFullYear() + 1);
    } else {
      expiresAt.setMonth(expiresAt.getMonth() + 1);
    }

    const admin = getSupabaseAdmin();

    const { data: prevProfile } = await admin
      .from("profiles")
      .select("plan")
      .eq("id", user.id)
      .maybeSingle();

    const { error } = await admin
      .from("profiles")
      .update({
        plan: "pro",
        plan_status: "active",
        plan_started_at: startedAt,
        plan_expires_at: expiresAt.toISOString(),
      })
      .eq("id", user.id);

    if (error) {
      throw error;
    }

    // Audit trail (best-effort).
    try {
      await admin.from("plan_changes").insert({
        user_id: user.id,
        old_plan: prevProfile?.plan ?? null,
        new_plan: "pro",
        expires_at: expiresAt.toISOString(),
        note: `razorpay payment ${razorpay_payment_id} (${verifiedInterval})`,
      });
    } catch (auditErr) {
      console.warn("plan_changes audit insert failed:", auditErr);
    }

    await grantReferralRewards(admin, user.id, expiresAt);

    return res.status(200).json({ success: true });
  } catch (error: any) {
    console.error("Payment verification failed in serverless function:", error);
    return res.status(500).json({ error: error.message || "Failed to verify signature." });
  }
}
