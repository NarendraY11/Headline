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

  // Content Signals: public pages may be searched and cited by AI (ai-input=yes),
  // but not used for model training (ai-train=no). Auth-gated content is already
  // disallowed above; this directive covers the public surface only.
  const CONTENT_SIGNAL = "Content-Signal: search=yes, ai-input=yes, ai-train=no";

  const disallowBlock = DISALLOW.map((p) => `Disallow: ${p}`).join("\n");

  // AI crawlers get explicit Allow: / before the disallows so the wildcard
  // block's Disallow lines don't shadow the allow-all intent.
  let content = "";
  for (const bot of AI_BOTS) {
    content += `User-agent: ${bot}\nAllow: /\n${CONTENT_SIGNAL}\n\n`;
  }

  content += `User-agent: *\n${disallowBlock}\n${CONTENT_SIGNAL}\n\n`;
  content += `Sitemap: ${baseUrl}/sitemap.xml\n`;

  return content;
}
