import type { VercelRequest, VercelResponse } from "@vercel/node";
import { ai, getAuthenticatedUser, checkRateLimit, isProUser, isFeatureEnabled, validateInstructorPayload, screenSubmission } from "../_lib/utils";

// Per-action gating, mirroring server.ts (dev). `explain` is free; the rest
// require an active Pro/Trial plan. Each maps to its app_settings feature flag.
const ACTION_GATES: Record<string, { flag: string; requiresPro: boolean }> = {
  explain: { flag: "aiExplain", requiresPro: false },
  practice: { flag: "aiPractice", requiresPro: true },
  coach: { flag: "aiCoach", requiresPro: true },
  diagnosis: { flag: "aiDiagnosis", requiresPro: true },
};

// Consolidated instructor AI endpoint. A single dynamic Serverless Function
// (api/instructor/[action].ts) serves /api/instructor/{explain,practice,coach,
// diagnosis}, keeping us under the platform's function-count limit. Client URLs
// and server.ts (dev) routes are unchanged.

async function explain(req: VercelRequest, res: VercelResponse) {
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
}

async function practice(req: VercelRequest, res: VercelResponse) {
  const { topic, code } = req.body || {};

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
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
}

async function coach(req: VercelRequest, res: VercelResponse) {
  const { scores = {} } = req.body || {};

  const scoresText = Object.entries(scores)
    .map(([topic, data]: [string, any]) => {
      const total = Number(data?.total) || 0;
      const correct = Number(data?.correct) || 0;
      if (total <= 0) return null; // skip empty topics; avoids divide-by-zero NaN
      return `${topic}: ${correct}/${total} (${Math.round((correct / total) * 100)}%)`;
    })
    .filter(Boolean)
    .join("\n");

  if (!scoresText) {
    return res.status(400).json({ error: "No scored topics provided." });
  }

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
}

async function diagnosis(req: VercelRequest, res: VercelResponse) {
  const { summary } = req.body || {};

  const responseStream = await ai.models.generateContentStream({
    model: "gemini-2.5-flash",
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
}

const handlers: Record<string, (req: VercelRequest, res: VercelResponse) => Promise<unknown>> = {
  explain,
  practice,
  coach,
  diagnosis,
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const actionParam = req.query.action;
  const action = Array.isArray(actionParam) ? actionParam[0] : actionParam;
  const fn = action ? handlers[action] : undefined;
  if (!fn) {
    return res.status(404).json({ error: "Not Found" });
  }

  const user = await getAuthenticatedUser(req, res);
  if (!user) return;

  const gate = ACTION_GATES[action as string];
  if (gate) {
    if (!(await isFeatureEnabled(gate.flag))) {
      return res.status(403).json({ error: "This feature is currently disabled." });
    }
    if (gate.requiresPro && !(await isProUser(user.id))) {
      return res.status(403).json({ error: "Access denied. Pro or active Trial subscription required." });
    }
  }

  const screen = await screenSubmission({
    formId: `instructor:${action}`,
    identity: user.id,
    body: req.body,
    structuredFields: action === "practice" ? ["topic", "code"] : [],
  });
  if (!screen.ok) {
    return res.status(screen.status).json({ error: screen.error });
  }

  const validationError = validateInstructorPayload(action as string, req.body);
  if (validationError) {
    return res.status(400).json({ error: validationError });
  }

  const allowed = await checkRateLimit(user.id);
  if (!allowed) {
    return res.status(429).json({ error: "Rate limit reached. Try again later." });
  }

  try {
    await fn(req, res);
  } catch (error) {
    console.error(`Error in instructor/${action} handler:`, error);
    if (!res.headersSent) {
      res.status(500).json({ error: "Failed to generate response. Please try again." });
    } else {
      res.end();
    }
  }
}
