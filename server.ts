import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";
import Razorpay from "razorpay";

let razorpayClient: any = null;

function getRazorpay() {
  if (!razorpayClient) {
    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keyId || !keySecret) {
      throw new Error("Razorpay environment variables RAZORPAY_KEY_ID or RAZORPAY_KEY_SECRET are missing.");
    }
    razorpayClient = new Razorpay({
      key_id: keyId,
      key_secret: keySecret,
    });
  }
  return razorpayClient;
}

const getSupabaseAdmin = () => {
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "";
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY environment variable is required.");
  }
  return createClient(supabaseUrl, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
};

const verifyWebhookSignature = (body: string, signature: string, secret: string) => {
  const shasum = crypto.createHmac("sha256", secret);
  shasum.update(body);
  const digest = shasum.digest("hex");
  return digest === signature;
};

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

  // === Razorpay Webhook (must accept raw body, so declared before express.json()) ===
  app.post("/api/payment/webhook", express.raw({ type: "application/json" }), async (req, res) => {
    try {
      const signature = req.headers["x-razorpay-signature"] as string;
      const bodyBuffer = req.body;
      const rawBody = bodyBuffer ? bodyBuffer.toString("utf8") : "";

      const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
      if (webhookSecret) {
        if (!signature) {
          console.error("Webhook signature header is missing.");
          return res.status(400).json({ error: "Missing signature header" });
        }
        const isValid = verifyWebhookSignature(rawBody, signature, webhookSecret);
        if (!isValid) {
          console.error("Webhook signature mismatch.");
          return res.status(400).json({ error: "Invalid signature" });
        }
      } else {
        console.warn("Warning: RAZORPAY_WEBHOOK_SECRET is not set. Bypassing signature verification.");
      }

      const payload = JSON.parse(rawBody);
      const event = payload.event;
      console.log(`Razorpay Webhook Event Received: ${event}`);

      if (event === "order.paid" || event === "payment.captured") {
        const orderNotes = payload.payload?.order?.entity?.notes || {};
        const paymentNotes = payload.payload?.payment?.entity?.notes || {};
        
        const userId = orderNotes.userId || paymentNotes.userId;
        const interval = orderNotes.interval || paymentNotes.interval || "monthly";

        if (userId) {
          const startedAt = new Date().toISOString();
          const expiresAt = new Date();
          if (interval === "yearly") {
            expiresAt.setFullYear(expiresAt.getFullYear() + 1);
          } else {
            expiresAt.setMonth(expiresAt.getMonth() + 1);
          }

          const admin = getSupabaseAdmin();
          const { error } = await admin
            .from("profiles")
            .update({
              plan: "pro",
              plan_started_at: startedAt,
              plan_expires_at: expiresAt.toISOString(),
            })
            .eq("id", userId);

          if (error) {
            console.error(`Failed to update profile for user ${userId}:`, error);
            return res.status(500).json({ error: "Database update failed" });
          }
          console.log(`Successfully updated user ${userId} to Pro plan (${interval})`);
        }
      }

      res.json({ status: "ok" });
    } catch (err: any) {
      console.error("Error in Razorpay Webhook:", err);
      res.status(500).json({ error: err.message || "Internal server error" });
    }
  });

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
  // uid/IP -> timestamps of requests made within the last minute
  const clientRequestTimestamps = new Map<string, number[]>();

  const rateLimiter = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const clientKey = (req as any).uid || req.ip || req.headers["x-forwarded-for"] || "anonymous";

    const now = Date.now();
    const oneMinuteAgo = now - 60 * 1000;

    let timestamps = clientRequestTimestamps.get(String(clientKey)) || [];
    timestamps = timestamps.filter(t => t > oneMinuteAgo);

    if (timestamps.length >= 60) {
      return res.status(429).json({ error: "Rate limit reached. Please try again after 1 minute." });
    }

    timestamps.push(now);
    clientRequestTimestamps.set(String(clientKey), timestamps);
    next();
  };

  // === Weather Cache ===
  interface WeatherCacheEntry {
    data: any;
    timestamp: number;
  }
  const weatherCache = new Map<string, WeatherCacheEntry>();

  // === Razorpay Order Creation Endpoint ===
  app.post("/api/payment/create-order", requireAuth, rateLimiter, async (req, res) => {
    try {
      const { interval = "monthly" } = req.body;
      const amount = interval === "yearly" ? 2999 * 100 : 499 * 100;

      const rz = getRazorpay();
      const options = {
        amount,
        currency: "INR",
        receipt: `receipt_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        notes: {
          userId: (req as any).uid,
          interval,
        },
      };

      const order = await rz.orders.create(options);
      res.json(order);
    } catch (error: any) {
      console.error("Error creating Razorpay order:", error);
      res.status(500).json({ error: error.message || "Failed to create payment order. Ensure RAZORPAY_KEY_ID is set." });
    }
  });

  // === Razorpay Signature Verification Endpoint ===
  app.post("/api/payment/verify", requireAuth, rateLimiter, async (req, res) => {
    try {
      const { razorpay_payment_id, razorpay_order_id, razorpay_signature, interval } = req.body;
      const signaturePayload = `${razorpay_order_id}|${razorpay_payment_id}`;
      
      const keySecret = process.env.RAZORPAY_KEY_SECRET;
      if (!keySecret) {
        throw new Error("RAZORPAY_KEY_SECRET is missing.");
      }

      const isValid = verifyWebhookSignature(signaturePayload, razorpay_signature, keySecret);
      if (!isValid) {
        return res.status(400).json({ error: "Signature verification failed." });
      }

      const startedAt = new Date().toISOString();
      const expiresAt = new Date();
      if (interval === "yearly") {
        expiresAt.setFullYear(expiresAt.getFullYear() + 1);
      } else {
        expiresAt.setMonth(expiresAt.getMonth() + 1);
      }

      const admin = getSupabaseAdmin();
      const { error } = await admin
        .from("profiles")
        .update({
          plan: "pro",
          plan_started_at: startedAt,
          plan_expires_at: expiresAt.toISOString(),
        })
        .eq("id", (req as any).uid);

      if (error) {
        throw error;
      }

      // Check for active pending referral link for this user
      try {
        const { data: referral, error: refLookupErr } = await admin
          .from("referrals")
          .select("*")
          .eq("referred_id", (req as any).uid)
          .eq("status", "pending")
          .maybeSingle();

        if (referral && !refLookupErr) {
          // 1. Mark referral as completed and reward granted
          await admin
            .from("referrals")
            .update({
              status: "completed",
              reward_granted: true
            })
            .eq("id", referral.id);

          // 2. Grant 30 days free Pro to the referrer
          const { data: referrerProfile } = await admin
            .from("profiles")
            .select("plan, plan_expires_at")
            .eq("id", referral.referrer_id)
            .maybeSingle();

          if (referrerProfile) {
            let refExpiresOn = new Date();
            if (referrerProfile.plan === "pro" && referrerProfile.plan_expires_at) {
              refExpiresOn = new Date(referrerProfile.plan_expires_at);
            }
            refExpiresOn.setDate(refExpiresOn.getDate() + 30); // 30 extra days reward

            await admin
              .from("profiles")
              .update({
                plan: "pro",
                plan_expires_at: refExpiresOn.toISOString(),
                plan_started_at: new Date().toISOString()
              })
              .eq("id", referral.referrer_id);
          }

          // 3. Grant 30 days additional free Pro to the upgraded referred user (extend by 30 days)
          const extendedExpiresAt = new Date(expiresAt);
          extendedExpiresAt.setDate(extendedExpiresAt.getDate() + 30);
          
          await admin
            .from("profiles")
            .update({
              plan_expires_at: extendedExpiresAt.toISOString()
            })
            .eq("id", (req as any).uid);

          console.log(`Referral rewards processed: Referrer ${referral.referrer_id} & Referred ${(req as any).uid} credited with 30 days Pro.`);
        }
      } catch (refErr) {
        console.error("Non-blocking referral reward grant error:", refErr);
      }

      res.json({ success: true });
    } catch (error: any) {
      console.error("Payment verification failed:", error);
      res.status(500).json({ error: error.message || "Failed to verify signature." });
    }
  });

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

  // === DYNAMIC SITEMAP ENGINE ===
  app.get("/sitemap.xml", async (req, res) => {
    const host = req.headers["x-forwarded-host"] || req.headers.host || "heading.com";
    const proto = req.headers["x-forwarded-proto"] || "https";
    const baseUrl = `${proto}://${host}`;

    // Define page-type priority and changefreq settings
    interface SiteMapConfig {
      priority: string;
      changefreq: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
    }

    const CONFIG_BY_PAGE_TYPE: Record<string, SiteMapConfig> = {
      home: { priority: "1.0", changefreq: "daily" },
      exam_landing: { priority: "0.95", changefreq: "daily" }, // Higher priority & frequent check-ins for core exam landing pages
      topic_module: { priority: "0.80", changefreq: "weekly" },
      blog_article: { priority: "0.75", changefreq: "weekly" },
      marketing: { priority: "0.65", changefreq: "monthly" },
      legal: { priority: "0.30", changefreq: "yearly" }
    };

    const staticRoutes = [
      { path: "", type: "home" },
      { path: "/about", type: "marketing" },
      { path: "/pricing", type: "marketing" },
      { path: "/contact", type: "marketing" },
      { path: "/blog", type: "marketing" },
      { path: "/privacy", type: "legal" },
      { path: "/terms", type: "legal" },
      { path: "/refund", type: "legal" },
    ];

    const examPaths = [
      "/exams/dgca-cpl",
      "/exams/dgca-atpl",
      "/exams/easa-atpl",
      "/exams/faa-written",
      "/exams/a320-type-rating",
    ];

    const staticBlogSlugs = [
      "dgca-cpl-air-navigation-syllabus-2026",
      "how-to-pass-easa-meteorology",
      "a320-flight-control-computers-elac-sec-fac",
      "complete-guide-faa-written-exams-acs",
    ];

    let blogSlugs = [...staticBlogSlugs];
    try {
      const adminSupabase = getSupabaseAdmin();
      const { data } = await adminSupabase
        .from("blog_posts")
        .select("slug")
        .eq("status", "published");
      if (data && data.length > 0) {
        const fetchedSlugs = data.map((item: any) => item.slug);
        blogSlugs = Array.from(new Set([...staticBlogSlugs, ...fetchedSlugs]));
      }
    } catch (e) {
      console.warn("Failed to retrieve dynamic blog posts for sitemap from Supabase, resorting to static slugs.");
    }

    const topicPaths = [
      "/topic/air-navigation",
      "/topic/meteorology",
      "/topic/air-regulations",
      "/topic/technical-general",
      "/topic/human-performance",
      "/topic/a320-systems",
    ];

    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
    xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;

    // 1. Static routes (Home, Marketing, Legal)
    staticRoutes.forEach(({ path: r, type }) => {
      const config = CONFIG_BY_PAGE_TYPE[type];
      xml += `  <url>\n`;
      xml += `    <loc>${baseUrl}${r}</loc>\n`;
      xml += `    <changefreq>${config.changefreq}</changefreq>\n`;
      xml += `    <priority>${config.priority}</priority>\n`;
      xml += `  </url>\n`;
    });

    // 2. Exam landing pages (Highly promoted)
    examPaths.forEach(r => {
      const config = CONFIG_BY_PAGE_TYPE["exam_landing"];
      xml += `  <url>\n`;
      xml += `    <loc>${baseUrl}${r}</loc>\n`;
      xml += `    <changefreq>${config.changefreq}</changefreq>\n`;
      xml += `    <priority>${config.priority}</priority>\n`;
      xml += `  </url>\n`;
    });

    // 3. Topic modules
    topicPaths.forEach(tp => {
      const config = CONFIG_BY_PAGE_TYPE["topic_module"];
      xml += `  <url>\n`;
      xml += `    <loc>${baseUrl}${tp}</loc>\n`;
      xml += `    <changefreq>${config.changefreq}</changefreq>\n`;
      xml += `    <priority>${config.priority}</priority>\n`;
      xml += `  </url>\n`;
    });

    // 4. Blog articles
    blogSlugs.forEach(slug => {
      const config = CONFIG_BY_PAGE_TYPE["blog_article"];
      xml += `  <url>\n`;
      xml += `    <loc>${baseUrl}/blog/${slug}</loc>\n`;
      xml += `    <changefreq>${config.changefreq}</changefreq>\n`;
      xml += `    <priority>${config.priority}</priority>\n`;
      xml += `  </url>\n`;
    });

    xml += `</urlset>`;

    res.header("Content-Type", "application/xml");
    res.status(200).send(xml);
  });

  // === DYNAMIC ROBOTS.TXT ENGINE ===
  app.get("/robots.txt", (req, res) => {
    const host = req.headers["x-forwarded-host"] || req.headers.host || "heading.com";
    const proto = req.headers["x-forwarded-proto"] || "https";
    const baseUrl = `${proto}://${host}`;
    
    let content = `User-agent: *\n`;
    content += `Allow: /\n`;
    content += `Disallow: /admin\n`;
    content += `Disallow: /admin/\n\n`;
    content += `Sitemap: ${baseUrl}/sitemap.xml\n`;
    
    res.header("Content-Type", "text/plain");
    res.status(200).send(content);
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
