import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getAuthenticatedUser, isFeatureEnabled, validateVerifyPayload, screenSubmission } from "../_lib/utils.js";
import { processVerifiedPayment } from "../_lib/processVerifiedPayment.js";

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

    // Security-critical grant logic lives in the shared module so the dev
    // Express server (server.ts) runs the exact same path.
    const result = await processVerifiedPayment({
      user,
      razorpay_payment_id,
      razorpay_order_id,
      razorpay_signature,
      req,
    });
    return res.status(result.status).json(result.body);
  } catch (error: any) {
    console.error("Payment verification failed in serverless function:", error);
    return res.status(500).json({ error: error.message || "Failed to verify signature." });
  }
}
