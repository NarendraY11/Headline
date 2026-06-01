import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";
import { generateSitemapXml } from "../src/lib/sitemap.js";

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "";
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";

const getSupabaseClient = () => {
  return createClient(supabaseUrl, serviceKey);
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const host = req.headers["x-forwarded-host"] || req.headers.host || "heading.com";
  const protocol = (req.headers["x-forwarded-proto"] as string) || "https";
  const baseUrl = `${protocol}://${host}`;

  const xml = await generateSitemapXml(baseUrl, async () => {
    try {
      const supabaseClient = getSupabaseClient();
      const { data } = await supabaseClient
        .from("blog_posts")
        .select("slug, updated_at")
        .eq("status", "published");
      return data || [];
    } catch (e) {
      return [];
    }
  });

  res.setHeader("Content-Type", "application/xml");
  return res.status(200).send(xml);
}
