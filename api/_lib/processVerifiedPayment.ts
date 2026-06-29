// ---------------------------------------------------------------------------
// Shared Razorpay payment-verification grant. Single source of truth used by
// BOTH the prod serverless endpoint (api/payment/verify.ts) and the dev Express
// server (server.ts) so the money path can never drift between the two.
//
// Callers own the framework-specific prelude (auth, feature-flag gate, abuse
// screen, payload validation) and then hand the three Razorpay handshake fields
// here. This function performs the security-critical core:
//   signature verify -> order-ownership check -> paid-status check ->
//   idempotency -> plan grant -> payment ledger -> plan_changes audit ->
//   referral rewards -> security/audit logging -> revenue Slack ping.
//
// Returns { status, body } for the caller to write to its own response object.
// ---------------------------------------------------------------------------
import type { VercelRequest } from "@vercel/node";
import { getRazorpay, getSupabaseAdmin, verifyWebhookSignature, grantReferralRewards } from "./utils.js";
import { logSecurityEvent, logAudit } from "./securityLog.js";
import { notifySlack, formatRupees } from "./slack.js";

const PLAN_PRICE_MONTHLY = 499 * 100;
const PLAN_PRICE_YEARLY = 2999 * 100;

export interface VerifyPaymentParams {
  user: { id: string; email?: string | null };
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
  req?: VercelRequest;
}

export interface HandlerResult {
  status: number;
  body: Record<string, unknown>;
}

export async function processVerifiedPayment(params: VerifyPaymentParams): Promise<HandlerResult> {
  const { user, razorpay_payment_id, razorpay_order_id, razorpay_signature, req } = params;

  const signaturePayload = `${razorpay_order_id}|${razorpay_payment_id}`;

  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keySecret) {
    return { status: 500, body: { error: "RAZORPAY_KEY_SECRET is missing." } };
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
    return { status: 400, body: { error: "Signature verification failed." } };
  }

  const rz = getRazorpay();
  const order = await rz.orders.fetch(razorpay_order_id);

  // Authorization: the order must belong to the caller. create-order stamps the
  // buyer's uid into notes.userId; a valid signature for someone else's order
  // must not be replayable to upgrade a different account.
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
    return { status: 403, body: { error: "Order does not belong to this account." } };
  }

  // Only grant on an actually-paid order.
  if (order?.status !== "paid") {
    return { status: 400, body: { error: "Order is not paid." } };
  }

  const admin = getSupabaseAdmin();

  // Idempotency: if this payment was already recorded, return success without
  // re-granting (prevents replay / double-submit from stacking entitlements).
  const { data: priorPayment } = await admin
    .from("payments")
    .select("id")
    .eq("razorpay_payment_id", razorpay_payment_id)
    .maybeSingle();
  if (priorPayment) {
    return { status: 200, body: { success: true, alreadyProcessed: true } };
  }

  const paidAmount = order.amount;

  let verifiedInterval = "monthly";
  if (paidAmount === PLAN_PRICE_YEARLY) {
    verifiedInterval = "yearly";
  } else if (paidAmount === PLAN_PRICE_MONTHLY) {
    verifiedInterval = "monthly";
  } else {
    return { status: 400, body: { error: "Paid amount does not match any known plan price." } };
  }

  const startedAt = new Date().toISOString();
  const expiresAt = new Date();
  if (verifiedInterval === "yearly" || verifiedInterval === "annual") {
    expiresAt.setFullYear(expiresAt.getFullYear() + 1);
  } else {
    // Fixed 30-day window. setMonth(+1) gives 28–31 days depending on the
    // start month (Jan 31 → Feb 28 = 28 days); every paying user should get
    // the same span (D14).
    expiresAt.setDate(expiresAt.getDate() + 30);
  }

  const { data: prevProfile } = await admin
    .from("profiles")
    .select("plan")
    .eq("id", user.id)
    .maybeSingle();

  // Atomic: profile update + payment ledger + audit trail in one Postgres transaction.
  const { error: rpcError } = await admin.rpc("grant_plan_from_payment", {
    p_user_id:    user.id,
    p_payment_id: razorpay_payment_id,
    p_order_id:   razorpay_order_id,
    p_amount:     paidAmount,
    p_currency:   order.currency || "INR",
    p_interval:   verifiedInterval,
    p_status:     order.status,
    p_source:     "verify",
    p_notes:      order.notes ?? null,
    p_old_plan:   prevProfile?.plan ?? null,
    p_expires_at: expiresAt.toISOString(),
    p_started_at: startedAt,
  });

  if (rpcError) {
    throw rpcError;
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
  // Instant revenue ping. The priorPayment early-return above guarantees this
  // fires once per payment (no double with the webhook for the same id).
  void notifySlack(
    `:money_with_wings: *New Pro subscription* — ₹${formatRupees(paidAmount)} (${verifiedInterval}) from ${user.email ?? user.id}.`,
    "revenue",
  );

  return { status: 200, body: { success: true } };
}
