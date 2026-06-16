import chromium from "@sparticuz/chromium";
import puppeteerCore from "puppeteer-core";
import express from "express";
import path from "path";
import fs from "fs";
import { blogPosts } from "../src/data/blog";

const PORT = 5555;
const DIST_DIR = path.resolve(process.cwd(), "dist");

// Resolve a local Chrome/Chromium executable. The serverless @sparticuz binary
// is not present on dev machines, so prefer an explicit override or a common
// system install before falling back to it.
async function resolveLocalChrome(): Promise<string> {
  if (process.env.PUPPETEER_EXECUTABLE_PATH) return process.env.PUPPETEER_EXECUTABLE_PATH;
  const candidates = [
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return chromium.executablePath();
}

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
      // On Vercel (and other serverless build images) the bundled Chrome
      // can't launch because system shared libs (libnspr4 etc.) are missing.
      // Use @sparticuz/chromium which ships a self-contained Chrome.
      // Locally, fall back to a Chrome found via PUPPETEER_EXECUTABLE_PATH or
      // the system install.
      const isServerless = !!process.env.VERCEL || !!process.env.AWS_LAMBDA_FUNCTION_NAME;

      const browser = isServerless
        ? await puppeteerCore.launch({
            args: chromium.args,
            executablePath: await chromium.executablePath(),
            headless: true
          })
        : await puppeteerCore.launch({
            args: ["--no-sandbox", "--disable-setuid-sandbox"],
            executablePath: await resolveLocalChrome(),
            headless: true
          });

      for (const route of routes) {
        console.log(`Prerendering route: ${route}`);
        const page = await browser.newPage();
        
        await page.setRequestInterception(true);
        page.on('request', (req) => {
          const url = req.url();
          if (
            ['image', 'stylesheet', 'font'].includes(req.resourceType()) ||
            url.includes('google') ||
            url.includes('doubleclick') ||
            url.includes('/_vercel/')
          ) {
            req.abort();
          } else {
            req.continue();
          }
        });

        // Wait for network to be idle to ensure JS has executed and #root is populated
        await page.goto(`http://localhost:${PORT}${route}`, {
          waitUntil: "networkidle2",
          timeout: 15000
        });

        // CRITICAL: React 19's createRoot commits its initial render on a
        // scheduler task AFTER network goes idle (supabase calls abort fast, so
        // networkidle2 fires while React is still mounting). A fixed delay raced
        // that commit and snapshotted an EMPTY #root — shipping a blank shell to
        // prod, which is why FCP/LCP were ~4-7s (paint waited on the full JS
        // bundle). Wait until React has actually committed real DOM into #root.
        try {
          await page.waitForFunction(
            () => {
              const r = document.getElementById("root");
              if (!r || r.childElementCount === 0) return false;
              // The instant boot splash (#app-splash) is itself a #root child
              // injected in index.html, so childElementCount>0 is true BEFORE
              // React commits — snapshotting then captures a blank splash-only
              // shell (home/pricing committed slower than blog and shipped
              // blank). createRoot replaces #root's children on first commit,
              // removing the splash, so wait until it's gone = React mounted.
              return !document.getElementById("app-splash");
            },
            { timeout: 10000 }
          );
        } catch {
          console.warn(`  #root never populated for ${route}; snapshot may be empty.`);
        }

        // Brief settle for any synchronous child renders after first commit.
        await new Promise(resolve => setTimeout(resolve, 400));

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
      // Prerender is progressive SEO enhancement, not a core build step. A
      // failure here (e.g. no local Chrome) must NOT abort the build chain and
      // skip the esbuild server bundle. Warn and exit 0; the SPA still hydrates.
      console.warn("Prerender skipped (non-fatal):", error instanceof Error ? error.message : error);
      server.close();
      process.exit(0);
    } finally {
      server.close();
      console.log("Prerender complete.");
    }
  });
}

prerender();
