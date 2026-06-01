export function generateRobotsTxt(baseUrl: string): string {
  let content = `User-agent: *\n`;
  content += `Allow: /\n`;
  content += `Disallow: /admin\n`;
  content += `Disallow: /admin/\n`;
  content += `Disallow: /api/*\n\n`;

  // Explicitly allow AI and Search crawler bots
  const allowedBots = [
    "GPTBot",
    "ClaudeBot",
    "PerplexityBot",
    "Google-Extended",
    "Bingbot",
    "Applebot-Extended"
  ];
  
  allowedBots.forEach(bot => {
    content += `User-agent: ${bot}\n`;
    content += `Allow: /\n`;
    content += `Disallow: /admin\n`;
    content += `Disallow: /admin/\n`;
    content += `Disallow: /api/*\n\n`;
  });

  content += `Sitemap: ${baseUrl}/sitemap.xml\n`;
  
  return content;
}
