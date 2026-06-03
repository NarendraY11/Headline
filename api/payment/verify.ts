import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getAuthenticatedUser, getRazorpay, getSupabaseAdmin, verifyWebhookSignature, grantReferralRewards, isFeatureEnabled, validateVerifyPayload, screenSubmission } from "../_lib/utils.js";
import { logSecurityEvent, logAudit } from "../_lib/securityLog.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const user = await getAuthenticatedUser(req, res);
  if (!user) return; // Response is already written by getAuthenticatedUser on error

  if (!(await isFeatureEnabled("pricingCheckout"))) {
    return res.status(403).json({ error: "Checkout is currently disabled." });
  }

  try {
    const screen = await screenSubmission({
      formId: "payment:verify",
      identity: user.id,
      body: req.body,
      structuredFields: ["razorpay_payment_id", "razorpay_order_id", "razorpay_signature"],
      req,
    });
    if (!screen.ok) {
      return res.status(screen.status).json({ error: screen.error });
    }

    const verifyError = validateVerifyPayload(req.body);
    if (verifyError) {
      return res.status(400).json({ error: verifyError });
    }
    const { razorpay_payment_id, razorpay_order_id, razorpay_signature } = req.body || {};

    const signaturePayload = `${razorpay_order_id}|${razorpay_payment_id}`;
    
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keySecret) {
      return res.status(500).json({ error: "RAZORPAY_KEY_SECRET is missing." });
    }

    const isValid = verifyWebhookSignature(signaturePayload, razorpay_signature, keySecret);
    if (!isValid) {
      // Forged/invalid signature on a payment is a high-signal security event.
      void logSecurityEvent({
        req,
        eventType: "payment.signature_invalid",
        severity: "critical",
        userId: user.id,
        actorEmail: user.email,
        statusCode: 400,
        metadata: { order_id: razorpay_order_id, payment_id: razorpay_payment_id },
      });
      return res.status(400).json({ error: "Signature verification failed." });
    }

    const rz = getRazorpay();
    const order = await rz.orders.fetch(razorpay_order_id);

    // Authorization: the order must belong to the caller. create-order stamps
    // the buyer's uid into notes.userId; a valid signature for someone else's
    // order must not be replayable to upgrade a different account.
    if (order?.notes?.userId && order.notes.userId !== user.id) {
      void logSecurityEvent({
        req,
        eventType: "payment.order_owner_mismatch",
        severity: "critical",
        userId: user.id,
        actorEmail: user.email,
        statusCode: 403,
        metadata: { order_id: razorpay_order_id, order_owner: order.notes.userId },
      });
      return res.status(403).json({ error: "Order does not belong to this account." });
    }

    // Only grant on an actually-paid order.
    if (order?.status !== "paid") {
      return res.status(400).json({ error: "Order is not paid." });
    }

    const admin = getSupabaseAdmin();

    // Idempotency: if this payment was already recorded, return success without
    // re-granting (prevents replay / double-submit from stacking entitlements).
    // Keyed on the unique payments.razorpay_payment_id.
    const { data: priorPayment } = await admin
      .from("payments")
      .select("id")
      .eq("razorpay_payment_id", razorpay_payment_id)
      .maybeSingle();
    if (priorPayment) {
      return res.status(200).json({ success: true, alreadyProcessed: true });
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
    if (verifiedInterval === "yearly" || verifiedInterval === "annual") {
      expiresAt.setFullYear(expiresAt.getFullYear() + 1);
    } else {
      expiresAt.setMonth(expiresAt.getMonth() + 1);
    }

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

    // Durable payment ledger. Unique razorpay_payment_id is the idempotency
    // key; a duplicate (race with the webhook) surfaces as a conflict and is
    // swallowed — the grant above is already idempotent via the pre-check.
    try {
      await admin.from("payments").insert({
        user_id: user.id,
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

    void logSecurityEvent({
      req,
      eventType: "payment.verified",
      severity: "info",
      userId: user.id,
      actorEmail: user.email,
      statusCode: 200,
      metadata: { interval: verifiedInterval, payment_id: razorpay_payment_id, amount: paidAmount },
    });
    void logAudit({
      req,
      actorUserId: user.id,
      actorEmail: user.email,
      action: "plan.grant",
      tableName: "profiles",
      recordId: user.id,
      oldValue: { plan: prevProfile?.plan ?? null },
      newValue: { plan: "pro", interval: verifiedInterval, expires_at: expiresAt.toISOString() },
      source: "api",
    });
    return res.status(200).json({ success: true });
  } catch (error: any) {
    console.error("Payment verification failed in serverless function:", error);
    return res.status(500).json({ error: error.message || "Failed to verify signature." });
  }
}
