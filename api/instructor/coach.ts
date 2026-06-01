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
    const { scores = {} } = req.body || {};
    
    const scoresText = Object.entries(scores).map(([topic, data]: [string, any]) => 
      `${topic}: ${data.correct}/${data.total} (${Math.round((data.correct / data.total) * 100)}%)`
    ).join("\n");

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        { role: "user", parts: [{ text: `My pilot exam scores are:\n${scoresText}\n\nBased on these pilot exam scores, write a focused 7-day study plan prioritising the weakest ATA chapters/topics. For each day, suggest specific sub-topics or concepts to focus on. Ensure the response is concise and highly actionable. Under 250 words.` }] }
      ],
      config: {
        systemInstruction: "You are an expert aviation instructor guiding a CPL/ATPL cadet. Use their score breakdown to identify their weakest areas and provide specific, actionable concepts to study."
      }
    });

    return res.status(200).json({ text: response.text });
  } catch (error) {
    console.error("Error in coach handler:", error);
    return res.status(500).json({ error: "Failed to generate study plan. Please try again." });
  }
}
