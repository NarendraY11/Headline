import { createClient } from "@supabase/supabase-js";
import { GoogleGenAI } from "@google/genai";
import type { VercelRequest, VercelResponse } from "@vercel/node";

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "";
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || "";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export const ai = new GoogleGenAI({ 
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

export async function getAuthenticatedUser(req: VercelRequest, res: VercelResponse) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized: Missing authentication token." });
    return null;
  }

  const token = authHeader.split(" ")[1];
  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) {
      throw error || new Error("User verification failed");
    }
    return user;
  } catch (error) {
    console.error("Error verifying Supabase token:", error);
    res.status(401).json({ error: "Unauthorized: Invalid or expired authentication token." });
    return null;
  }
}

const userRequestTimestamps = new Map<string, number[]>();

export async function checkRateLimit(uid: string): Promise<boolean> {
  const now = Date.now();
  const oneHourAgo = now - 60 * 60 * 1000;

  // 1. In-memory per-instance check
  let timestamps = userRequestTimestamps.get(uid) || [];
  timestamps = timestamps.filter(t => t > oneHourAgo);
  if (timestamps.length >= 20) {
    return false;
  }

  // 2. Precise Supabase backstop
  const oneHourAgoISO = new Date(oneHourAgo).toISOString();
  try {
    const { count, error } = await supabase
      .from("events")
      .select("*", { count: "estimated", head: true })
      .eq("user_id", uid)
      .eq("event_type", "ai_used")
      .gte("created_at", oneHourAgoISO);

    if (error) {
      console.warn("DB rate limit count error:", error);
    } else if (count !== null && count >= 20) {
      return false;
    }
  } catch (dbError) {
    console.warn("DB rate limiter backstop failed:", dbError);
  }

  timestamps.push(now);
  userRequestTimestamps.set(uid, timestamps);
  return true;
}
