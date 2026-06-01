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
    const { prompt, userAnswer, correctAnswer } = req.body || {};
    
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
    console.error("Error in explain handler:", error);
    if (!res.headersSent) {
      res.status(500).json({ error: "Failed to generate explanation. Please try again." });
    } else {
      res.end();
    }
  }
}
