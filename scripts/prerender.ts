import puppeteer from "puppeteer";
import express from "express";
import path from "path";
import fs from "fs";
import { blogPosts } from "../src/data/blog";

const PORT = 5000;
const DIST_DIR = path.resolve(process.cwd(), "dist");

// All public routes to prerender
const routes = [
  "/",
  "/about",
  "/pricing",
  "/contact",
  "/blog",
  "/privacy",
  "/terms",
  "/refund",
  "/exams/dgca-cpl",
  "/exams/dgca-atpl",
  "/exams/easa-atpl",
  "/exams/faa-written",
  "/exams/a320-type-rating",
  "/qotd",
  "/a320-systems",
  ...blogPosts.map(p => `/blog/${p.slug}`)
];

async function prerender() {
  console.log("Starting prerender script...");

  // Spin up an express server to serve the dist/ directory
  const app = express();
  app.use(express.static(DIST_DIR));
  app.get("*", (req, res) => {
    res.sendFile(path.join(DIST_DIR, "index.html"));
  });

  const server = app.listen(PORT, async () => {
    console.log(`Server started on http://localhost:${PORT}`);

    try {
      const browser = await puppeteer.launch({
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
        headless: true
      });

      for (const route of routes) {
        console.log(`Prerendering route: ${route}`);
        const page = await browser.newPage();
        
        // Wait for network to be idle to ensure JS has executed and #root is populated
        await page.goto(`http://localhost:${PORT}${route}`, {
          waitUntil: "networkidle0",
          timeout: 30000
        });

        // Wait an extra second for any animations or late rendering
        await new Promise(resolve => setTimeout(resolve, 500));

        let html = await page.content();
        
        // Since we are taking a snapshot, we should strip out injected browser scripts 
        // if they interfere, but usually it's fine. It's an SPA so JS will re-hydrate.

        const routeDir = path.join(DIST_DIR, route.substring(1));
        if (route !== "/" && !fs.existsSync(routeDir)) {
          fs.mkdirSync(routeDir, { recursive: true });
        }

        const filePath = route === "/" 
          ? path.join(DIST_DIR, "index.html") 
          : path.join(routeDir, "index.html");

        fs.writeFileSync(filePath, html, "utf-8");
        console.log(`Saved ${filePath}`);
        await page.close();
      }

      await browser.close();
    } catch (error) {
      console.error("Prerender error:", error);
      process.exit(1);
    } finally {
      server.close();
      console.log("Prerender complete.");
    }
  });
}

prerender();
