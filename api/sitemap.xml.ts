import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "";
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";

const getSupabaseClient = () => {
  return createClient(supabaseUrl, serviceKey);
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const host = req.headers["x-forwarded-host"] || req.headers.host || "heading.com";
  const protocol = (req.headers["x-forwarded-proto"] as string) || "https";
  const baseUrl = `${protocol}://${host}`;

  interface SiteMapConfig {
    priority: string;
    changefreq: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
  }

  const CONFIG_BY_PAGE_TYPE: Record<string, SiteMapConfig> = {
    home: { priority: "1.0", changefreq: "daily" },
    exam_landing: { priority: "0.95", changefreq: "daily" },
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
    const supabaseClient = getSupabaseClient();
    const { data } = await supabaseClient
      .from("blog_posts")
      .select("slug")
      .eq("status", "published");
    if (data && data.length > 0) {
      const fetchedSlugs = data.map((item: any) => item.slug);
      blogSlugs = Array.from(new Set([...staticBlogSlugs, ...fetchedSlugs]));
    }
  } catch (e) {
    console.warn("Failed to retrieve dynamic blog posts for sitemap, resorting to static slugs.");
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

  // 1. Static routes
  staticRoutes.forEach(({ path: r, type }) => {
    const config = CONFIG_BY_PAGE_TYPE[type];
    xml += `  <url>\n`;
    xml += `    <loc>${baseUrl}${r}</loc>\n`;
    xml += `    <changefreq>${config.changefreq}</changefreq>\n`;
    xml += `    <priority>${config.priority}</priority>\n`;
    xml += `  </url>\n`;
  });

  // 2. Exam landing pages
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

  res.setHeader("Content-Type", "application/xml");
  return res.status(200).send(xml);
}
