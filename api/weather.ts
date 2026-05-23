import type { VercelRequest, VercelResponse } from "@vercel/node";
import { ai, getAuthenticatedUser, checkRateLimit } from "./_lib/utils";

interface WeatherCacheEntry {
  data: any;
  timestamp: number;
}
const weatherCache = new Map<string, WeatherCacheEntry>();

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
    const { location = "major global aviation hubs" } = req.body || {};
    const cachedKey = location.trim().toLowerCase();
    const cachedEntry = weatherCache.get(cachedKey);
    const CACHE_DURATION = 45 * 60 * 1000; // 45 minutes

    if (cachedEntry && (Date.now() - cachedEntry.timestamp < CACHE_DURATION)) {
      return res.status(200).json(cachedEntry.data);
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

    return res.status(200).json(parsed);
  } catch (e) {
    console.error("Error in weather handler:", e);
    return res.status(500).json({ error: "Failed to fetch weather." });
  }
}
