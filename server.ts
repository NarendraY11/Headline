import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "";
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || "";

const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Ensure AI features operate server-side only to protect GEMINI_API_KEY.
// Key is retrieved safely from process.env here on the server.
const ai = new GoogleGenAI({ 
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});



async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // === Authentication Middleware ===
  const requireAuth = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Unauthorized: Missing authentication token." });
    }

    const token = authHeader.split(" ")[1];
    try {
      const { data: { user }, error } = await supabase.auth.getUser(token);
      if (error || !user) {
        throw error || new Error("User verification failed");
      }
      (req as any).uid = user.id;
      next();
    } catch (error) {
      console.error("Error verifying Supabase token:", error);
      return res.status(401).json({ error: "Unauthorized: Invalid or expired authentication token." });
    }
  };

  // === Rate Limiting Middleware ===
  // uid -> timestamps of requests made within the last hour
  const userRequestTimestamps = new Map<string, number[]>();

  const rateLimiter = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const uid = (req as any).uid;
    if (!uid) {
      return res.status(401).json({ error: "Unauthorized: Missing identity context for rate limiting." });
    }

    const now = Date.now();
    const oneHourAgo = now - 60 * 60 * 1000;

    let timestamps = userRequestTimestamps.get(uid) || [];
    timestamps = timestamps.filter(t => t > oneHourAgo);

    if (timestamps.length >= 20) {
      return res.status(429).json({ error: "Rate limit reached. Try again later." });
    }

    timestamps.push(now);
    userRequestTimestamps.set(uid, timestamps);
    next();
  };

  // === Weather Cache ===
  interface WeatherCacheEntry {
    data: any;
    timestamp: number;
  }
  const weatherCache = new Map<string, WeatherCacheEntry>();

  // === AI FEATURE 1: "Ask the Instructor" ===
  app.post("/api/instructor/explain", requireAuth, rateLimiter, async (req, res) => {
    try {
      const { prompt, userAnswer, correctAnswer } = req.body;
      
      const responseStream = await ai.models.generateContentStream({
        model: "gemini-3.5-flash",
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
      console.error("Error in explain deeper:", error);
      res.status(500).json({ error: "Failed to generate explanation. Please try again." });
    }
  });

  // === AI FEATURE 2: "Generate practice questions" ===
  app.post("/api/instructor/practice", requireAuth, rateLimiter, async (req, res) => {
    try {
      const { topic, code } = req.body;
      
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
      // Clean up markdown fences if model ignored responseMimeType
      responseText = responseText.replace(/^```json\s*/, "").replace(/\s*```$/, "");
      
      const questions = JSON.parse(responseText);
      res.json(questions);
    } catch (error) {
      console.error("Error generating practice questions:", error);
      res.status(500).json({ error: "Failed to generate practice set. Please try again." });
    }
  });

  // === AI FEATURE 3: "Weak-area coach" ===
  app.post("/api/instructor/coach", requireAuth, rateLimiter, async (req, res) => {
    try {
      const { scores } = req.body;
      // scores might look like { "ATA 27": { correct: 5, total: 8 }, "ATA 21": { correct: 2, total: 10 } }
      
      const scoresText = Object.entries(scores).map(([topic, data]: [string, any]) => 
        `${topic}: ${data.correct}/${data.total} (${Math.round((data.correct/data.total)*100)}%)`
      ).join("\\n");

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: [
          { role: "user", parts: [{ text: `My pilot exam scores are:\n${scoresText}\n\nBased on these pilot exam scores, write a focused 7-day study plan prioritising the weakest ATA chapters/topics. For each day, suggest specific sub-topics or concepts to focus on. Ensure the response is concise and highly actionable. Under 250 words.` }] }
        ],
        config: {
          systemInstruction: "You are an expert aviation instructor guiding a CPL/ATPL cadet. Use their score breakdown to identify their weakest areas and provide specific, actionable concepts to study."
        }
      });

      res.json({ text: response.text });
    } catch (error) {
      console.error("Error generating study plan:", error);
      res.status(500).json({ error: "Failed to generate study plan. Please try again." });
    }
  });

  // === AI FEATURE 4: "Analytics Diagnosis" ===
  app.post("/api/instructor/diagnosis", requireAuth, rateLimiter, async (req, res) => {
    try {
      const { summary } = req.body;
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
        if (chunk.text) res.write(chunk.text);
      }
      res.end();
    } catch (error) {
      console.error("Error in AI diagnosis:", error);
      res.status(500).json({ error: "Failed to generate diagnosis." });
    }
  });

  // === WEATHER METAR ENDPOINT (WITH SERVER CACHING) ===
  app.post("/api/weather", requireAuth, rateLimiter, async (req, res) => {
    try {
      const { location = "major global aviation hubs" } = req.body;
      const cachedKey = location.trim().toLowerCase();
      const cachedEntry = weatherCache.get(cachedKey);
      const CACHE_DURATION = 45 * 60 * 1000; // 45 minutes

      if (cachedEntry && (Date.now() - cachedEntry.timestamp < CACHE_DURATION)) {
        return res.json(cachedEntry.data);
      }

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: [
          { role: "user", parts: [{ text: `Provide a concise 1-2 sentence current aviation weather briefing for ${location}. Include METAR highlights like visibility or wind warnings if relevant. Keep it under 200 characters. Return the response as JSON with three fields: "briefing" (the text), "condition" (one of: "SUNNY", "CLOUDY", "RAIN", "STORM", "SNOW", "WINDY", "FOG"), and "forecast" (array of 6 objects with "hour" (e.g. "+1H"), "condition" (same enum), and "temp" (e.g. "15°C")).` }] }
        ],
        config: {
          responseMimeType: "application/json",
          tools: [{ googleSearch: {} }]
        }
      });
      let parsed = {};
      try {
        parsed = JSON.parse(response.text || "{}");
      } catch (parseError) {
        // Silently handle parse errors
      }

      if (parsed && (parsed as any).briefing) {
        weatherCache.set(cachedKey, {
          data: parsed,
          timestamp: Date.now()
        });
      }

      res.json(parsed);
    } catch (e) {
      // Silently handle failed fetches
      res.status(500).json({ error: "Failed to fetch weather." });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
