import { blogPosts } from "../data/blog";

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

const topicPaths = [
  "/topic/air-navigation",
  "/topic/meteorology",
  "/topic/air-regulations",
  "/topic/technical-general",
  "/topic/human-performance",
  "/topic/a320-systems",
];

export async function generateSitemapXml(baseUrl: string, fetchDynamicPosts?: () => Promise<{slug: string, updated_at?: string}[]>): Promise<string> {
  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
  xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;

  const today = new Date().toISOString().split('T')[0];

  const addUrl = (path: string, type: string, lastmod: string) => {
    const config = CONFIG_BY_PAGE_TYPE[type] || CONFIG_BY_PAGE_TYPE["marketing"];
    xml += `  <url>\n`;
    xml += `    <loc>${baseUrl}${path}</loc>\n`;
    xml += `    <lastmod>${lastmod}</lastmod>\n`;
    xml += `    <changefreq>${config.changefreq}</changefreq>\n`;
    xml += `    <priority>${config.priority}</priority>\n`;
    xml += `  </url>\n`;
  };

  staticRoutes.forEach(({ path, type }) => {
    addUrl(path, type, today);
  });

  examPaths.forEach(path => {
    addUrl(path, "exam_landing", today);
  });

  topicPaths.forEach(path => {
    addUrl(path, "topic_module", today);
  });

  const staticBlogsMap = new Map<string, string>();
  blogPosts.forEach(post => {
    try {
      const d = new Date(post.date);
      staticBlogsMap.set(post.slug, isNaN(d.getTime()) ? today : d.toISOString().split('T')[0]);
    } catch {
      staticBlogsMap.set(post.slug, today);
    }
  });

  if (fetchDynamicPosts) {
    try {
      const dPosts = await fetchDynamicPosts();
      if (dPosts && dPosts.length > 0) {
        dPosts.forEach(post => {
          const dateStr = post.updated_at ? new Date(post.updated_at).toISOString().split('T')[0] : today;
          staticBlogsMap.set(post.slug, dateStr);
        });
      }
    } catch (e) {
      console.warn("Failed to fetch dynamic posts for sitemap generation.");
    }
  }

  staticBlogsMap.forEach((lastmod, slug) => {
    addUrl(`/blog/${slug}`, "blog_article", lastmod);
  });

  xml += `</urlset>`;
  return xml;
}
