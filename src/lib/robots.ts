export function generateRobotsTxt(baseUrl: string): string {
  const AI_BOTS = [
    "GPTBot",
    "OAI-SearchBot",
    "ChatGPT-User",
    "ClaudeBot",
    "Claude-User",
    "PerplexityBot",
    "Perplexity-User",
    "Applebot-Extended",
    "Google-Extended",
    "Bingbot",
  ];

  // Authenticated + admin areas — not indexable
  const DISALLOW = [
    "/today",
    "/modules",
    "/topic/",
    "/mock-exams",
    "/analytics",
    "/bookmarks",
    "/profile",
    "/referral",
    "/quiz/",
    "/admin/",
    "/dashboard",
    "/study-plan",
    "/schedule",
    "/exam-centre",
    "/reset-password",
    "/login",
    "/api/",
  ];

  const disallowBlock = DISALLOW.map((p) => `Disallow: ${p}`).join("\n");

  // AI crawlers get explicit Allow: / before the disallows so the wildcard
  // block's Disallow lines don't shadow the allow-all intent.
  let content = "";
  for (const bot of AI_BOTS) {
    content += `User-agent: ${bot}\nAllow: /\n\n`;
  }

  content += `User-agent: *\n${disallowBlock}\n\n`;
  content += `Sitemap: ${baseUrl}/sitemap.xml\n`;

  return content;
}
