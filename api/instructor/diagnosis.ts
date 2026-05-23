import type { VercelRequest, VercelResponse } from "@vercel/node";
import { ai, getAuthenticatedUser, checkRateLimit } from "../_lib/utils";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const user = await getAuthenticatedUser(req, res);
  if (!user) return;

  const allowed = await checkRateLimit(user.id);
  if (!allowed) {
    return res.status(429).json({ error: "Rate limit reached. Try again later." });
  }

  try {
    const { summary } = req.body || {};
    
    const responseStream = await ai.models.generateContentStream({
      model: "gemini-3.5-flash",
      contents: [
        { role: "user", parts: [{ text: `Here is the user's analytics summary:\n${summary}\n\nBased on this, write a 3-sentence diagnosis of the user's biggest risk area before their exam.` }] }
      ],
      config: {
        systemInstruction: "You are a strict, demanding airline check airman analyzing a student's pilot exam statistics to tell them exactly where they are most likely to fail out. Be direct, authoritative, and concise. No more than 3 sentences."
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
    console.error("Error in diagnosis handler:", error);
    if (!res.headersSent) {
      res.status(500).json({ error: "Failed to generate diagnosis." });
    } else {
      res.end();
    }
  }
}
