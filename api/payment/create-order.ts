import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getAuthenticatedUser, getRazorpay } from "../_lib/utils";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const user = await getAuthenticatedUser(req, res);
  if (!user) return; // Response is already written by getAuthenticatedUser on error

  try {
    const { interval = "monthly", plan } = req.body || {};
    const selectedBilling = plan || interval;

    // Support both monthly (₹499) and annual (₹2999)
    const isYearly = selectedBilling === "yearly" || selectedBilling === "annual" || selectedBilling === "yearly";
    const amount = isYearly ? 2999 * 100 : 499 * 100;

    const rz = getRazorpay();
    const options = {
      amount,
      currency: "INR",
      receipt: `receipt_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      notes: {
        userId: user.id,
        interval: isYearly ? "yearly" : "monthly",
      },
    };

    const order = await rz.orders.create(options);

    // Return the response matching PricingView expectations as well as explicit instructions
    return res.status(200).json({
      ...order,
      key_id: process.env.RAZORPAY_KEY_ID || ""
    });
  } catch (error: any) {
    console.error("Error creating Razorpay order in serverless function:", error);
    return res.status(500).json({
      error: error.message || "Failed to create payment order. Ensure RAZORPAY_KEY_ID is set."
    });
  }
}
