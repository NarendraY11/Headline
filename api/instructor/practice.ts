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
    const { topic, code } = req.body || {};
    
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: [
        { role: "user", parts: [{ text: `Topic: ${code} - ${topic}` }] }
      ],
      config: {
        systemInstruction: `You are an aviation examiner. Generate 5 practice multiple-choice questions for the specified topic.
Return STRICT JSON ONLY, matching exactly this schema:
[
  {
    "id": "unique-string-id",
    "ata": "Topic Code and Name",
    "difficulty": "standard" | "complex" | "extreme",
    "prompt": "Question text",
    "diagramCaption": "Optional diagram text (can be null or omitted)",
    "choices": [
      { "id": "a", "label": "Option A" },
      { "id": "b", "label": "Option B" },
      { "id": "c", "label": "Option C" },
      { "id": "d", "label": "Option D" }
    ],
    "correct": "a" | "b" | "c" | "d",
    "explanation": "2-3 sentences technical explanation.",
    "references": ["FCOM 1.27...", "ATA..."]
  }
]
Do not include \`\`\`json or \`\`\` blocks, just the raw JSON array. Make the questions technically accurate, challenging, and suitable for A320 type rating prep where applicable.`,
        responseMimeType: "application/json"
      }
    });

    let responseText = response.text || "[]";
    responseText = responseText.replace(/^```json\s*/, "").replace(/\s*```$/, "");
    
    const questions = JSON.parse(responseText);
    return res.status(200).json(questions);
  } catch (error) {
    console.error("Error in practice handler:", error);
    return res.status(500).json({ error: "Failed to generate practice set. Please try again." });
  }
}
