import type { VercelRequest, VercelResponse } from "@vercel/node";
import { generateRobotsTxt } from "../src/lib/robots.js";

export default function handler(req: VercelRequest, res: VercelResponse) {
  const host = req.headers["x-forwarded-host"] || req.headers.host || "heading.com";
  const protocol = (req.headers["x-forwarded-proto"] as string) || "https";
  const baseUrl = `${protocol}://${host}`;

  const content = generateRobotsTxt(baseUrl);

  res.setHeader("Content-Type", "text/plain");
  return res.status(200).send(content);
}
