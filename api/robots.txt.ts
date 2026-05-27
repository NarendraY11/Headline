import type { VercelRequest, VercelResponse } from "@vercel/node";

export default function handler(req: VercelRequest, res: VercelResponse) {
  const host = req.headers["x-forwarded-host"] || req.headers.host || "heading.com";
  const protocol = (req.headers["x-forwarded-proto"] as string) || "https";
  const baseUrl = `${protocol}://${host}`;

  let content = `User-agent: *\n`;
  content += `Allow: /\n`;
  content += `Disallow: /admin\n`;
  content += `Disallow: /admin/\n\n`;
  content += `Sitemap: ${baseUrl}/sitemap.xml\n`;

  res.setHeader("Content-Type", "text/plain");
  return res.status(200).send(content);
}
