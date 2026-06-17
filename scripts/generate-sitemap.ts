/**
 * Build-time sitemap generator.
 *
 * Outputs public/sitemap.xml covering:
 *   - Static public routes
 *   - /exams/:examId landing pages
 *   - /blog/:slug entries (from static data; no Supabase call needed since
 *     posts live in src/data/blog.ts, not a DB table)
 *
 * Run standalone:  node --loader ts-node/esm scripts/generate-sitemap.ts
 * Or via build:    called by vite.config.ts closeBundle hook after prerender.
 */

import fs from "fs";
import path from "path";
import { blogPosts } from "../src/data/blog.js";

const PROD_ORIGIN = "https://headline-blush.vercel.app";
const OUT_PATH = path.resolve(process.cwd(), "public", "sitemap.xml");

interface SitemapEntry {
  url: string;
  lastmod?: string;
  changefreq: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
  priority: number;
}

// ISO date today for static pages that don't carry their own date
const today = new Date().toISOString().slice(0, 10);

const STATIC_ROUTES: SitemapEntry[] = [
  { url: "/",            changefreq: "daily",   priority: 1.0 },
  { url: "/pricing",     changefreq: "weekly",  priority: 0.9 },
  { url: "/about",       changefreq: "monthly", priority: 0.7 },
  { url: "/blog",        changefreq: "daily",   priority: 0.9 },
  { url: "/qotd",        changefreq: "daily",   priority: 0.8 },
  { url: "/a320-systems",changefreq: "weekly",  priority: 0.8 },
  { url: "/contact",     changefreq: "monthly", priority: 0.5 },
  { url: "/privacy",     changefreq: "yearly",  priority: 0.3 },
  { url: "/terms",       changefreq: "yearly",  priority: 0.3 },
  { url: "/refund",      changefreq: "yearly",  priority: 0.3 },
];

const EXAM_IDS = ["dgca-cpl", "dgca-atpl", "easa-atpl", "faa-written", "a320-type-rating"];

const examEntries: SitemapEntry[] = EXAM_IDS.map((id) => ({
  url: `/exams/${id}`,
  lastmod: today,
  changefreq: "weekly",
  priority: 0.85,
}));

// Parse "May 18, 2026" → "2026-05-18"
function parsePostDate(humanDate: string): string {
  const d = new Date(humanDate);
  return isNaN(d.getTime()) ? today : d.toISOString().slice(0, 10);
}

const blogEntries: SitemapEntry[] = blogPosts.map((post) => ({
  url: `/blog/${post.slug}`,
  lastmod: parsePostDate(post.date),
  changefreq: "monthly",
  priority: 0.7,
}));

function buildXml(entries: SitemapEntry[]): string {
  const urls = entries
    .map((e) => {
      const lastmod = e.lastmod ? `\n    <lastmod>${e.lastmod}</lastmod>` : "";
      return [
        "  <url>",
        `    <loc>${PROD_ORIGIN}${e.url}</loc>${lastmod}`,
        `    <changefreq>${e.changefreq}</changefreq>`,
        `    <priority>${e.priority.toFixed(1)}</priority>`,
        "  </url>",
      ].join("\n");
    })
    .join("\n");

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    urls,
    "</urlset>",
    "",
  ].join("\n");
}

const allEntries: SitemapEntry[] = [
  ...STATIC_ROUTES.map((r) => ({ ...r, lastmod: today })),
  ...examEntries,
  ...blogEntries,
];

const xml = buildXml(allEntries);
fs.writeFileSync(OUT_PATH, xml, "utf-8");
console.log(`[sitemap] wrote ${allEntries.length} URLs → ${OUT_PATH}`);
