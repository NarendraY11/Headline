import { describe, it, expect } from "vitest";
import { generateRobotsTxt } from "@/src/lib/robots";
import { generateSitemapXml } from "@/src/lib/sitemap";
import { getMetaForRoute } from "@/src/lib/seoMeta";

const BASE = "https://www.heading380.in";

describe("generateRobotsTxt", () => {
  const txt = generateRobotsTxt(BASE);

  it("disallows authenticated and admin areas", () => {
    for (const p of ["/today", "/admin/", "/mock-exams", "/profile", "/api/"]) {
      expect(txt).toContain(`Disallow: ${p}`);
    }
  });

  it("explicitly allows major AI crawlers", () => {
    for (const bot of ["GPTBot", "ClaudeBot", "PerplexityBot", "Google-Extended"]) {
      expect(txt).toContain(`User-agent: ${bot}`);
    }
    expect(txt).toContain("Allow: /");
  });

  it("points at the absolute sitemap URL", () => {
    expect(txt).toContain(`Sitemap: ${BASE}/sitemap.xml`);
  });
});

describe("generateSitemapXml", () => {
  it("produces a well-formed urlset with the homepage and exam landings", async () => {
    const xml = await generateSitemapXml(BASE);
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(xml).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');
    expect(xml).toContain(`<loc>${BASE}</loc>`);
    expect(xml).toContain(`<loc>${BASE}/exams/dgca-cpl</loc>`);
    expect(xml.trim().endsWith("</urlset>")).toBe(true);
  });

  it("excludes auth-gated routes (no soft-404 bait)", async () => {
    const xml = await generateSitemapXml(BASE);
    expect(xml).not.toContain(`${BASE}/today`);
    expect(xml).not.toContain(`${BASE}/topic/`);
    expect(xml).not.toContain(`${BASE}/mock-exams`);
  });

  it("merges dynamic blog posts when a fetcher is supplied", async () => {
    const xml = await generateSitemapXml(BASE, async () => [
      { slug: "a-dynamic-post", updated_at: "2026-06-01T00:00:00Z" },
    ]);
    expect(xml).toContain(`<loc>${BASE}/blog/a-dynamic-post</loc>`);
  });

  it("survives a throwing dynamic fetcher (still returns static URLs)", async () => {
    const xml = await generateSitemapXml(BASE, async () => {
      throw new Error("db down");
    });
    expect(xml).toContain(`<loc>${BASE}</loc>`);
    expect(xml.trim().endsWith("</urlset>")).toBe(true);
  });
});

describe("getMetaForRoute", () => {
  it("returns home title/description for /", () => {
    const m = getMetaForRoute("/");
    expect(m.title).toMatch(/Heading/);
    expect(m.description.length).toBeGreaterThan(20);
    expect(m.ogImage).toBe("/og-image.png");
  });

  it("returns distinct, non-empty meta for each exam landing", () => {
    const ids = ["dgca-cpl", "dgca-atpl", "easa-atpl", "faa-written", "a320-type-rating"];
    const titles = ids.map((id) => getMetaForRoute(`/exams/${id}`).title);
    expect(new Set(titles).size).toBe(ids.length);
    titles.forEach((t) => expect(t.length).toBeGreaterThan(10));
  });

  it("falls back to a sane default for an unknown blog slug", () => {
    const fallback = getMetaForRoute("/blog/__definitely-not-a-real-slug__");
    expect(fallback.title).toMatch(/Heading/);
  });

  it("falls back to a sane default for an unknown route", () => {
    const m = getMetaForRoute("/some/unknown/path");
    expect(m.title).toMatch(/Heading/);
    expect(m.ogImage).toBe("/og-image.png");
  });
});
