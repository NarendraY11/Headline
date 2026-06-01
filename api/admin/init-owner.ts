import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getAuthenticatedUser, getSupabaseAdmin } from "../_lib/utils";

const PRIMARY_OWNER_EMAIL = "narendray112050@gmail.com";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const user = await getAuthenticatedUser(req, res);
  if (!user) return;

  try {
    const email = user.email;
    if (email !== PRIMARY_OWNER_EMAIL) {
      return res.status(403).json({ error: "Not primary owner" });
    }

    const admin = getSupabaseAdmin();
    const { error: insertErr } = await admin.from("admins").insert({ email });
    // 23505 = unique violation (already seeded) -> treat as success.
    if (insertErr && insertErr.code !== "23505") {
      console.error("Failed to seed admin:", insertErr);
      return res.status(500).json({ error: insertErr.message });
    }

    return res.status(200).json({ success: true, email });
  } catch (e: any) {
    console.error("Owner init error:", e);
    return res.status(500).json({ error: e.message });
  }
}
