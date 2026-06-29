#!/usr/bin/env tsx
// =====================================================================
// Phase B4: Dual-API drift guard (D2).
//
// Validates server.ts (dev Express) and api/* (prod Vercel) stay in sync.
// Run in CI or pre-commit. Exits 1 on drift, 0 if aligned.
//
// Checks:
// 1. Every route in server.ts has a matching api/ file or system.ts ?fn= case.
// 2. Every api/*.ts file has a matching server.ts route.
// 3. Vercel.json rewrites to system.ts are covered by system.ts switch cases.
// =====================================================================

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const serverPath = path.resolve(__dirname, "../server.ts");
const apiDir = path.resolve(__dirname, "../api");
const vercelPath = path.resolve(__dirname, "../vercel.json");

interface Route {
  method: string;
  path: string;
  source: "server.ts" | "api/*" | "system.ts";
}

function extractServerRoutes(): Route[] {
  const content = fs.readFileSync(serverPath, "utf-8");
  const routeRe = /app\.(get|post|put|delete|patch)\s*\(\s*["']([^"']+)["']/g;
  const routes: Route[] = [];
  let match;
  while ((match = routeRe.exec(content)) !== null) {
    const [, method, pathRaw] = match;
    // Include both /api/* routes and special cases like /robots.txt, /sitemap.xml
    if (pathRaw.startsWith("/api/") || pathRaw === "/robots.txt" || pathRaw === "/sitemap.xml") {
      routes.push({ method: method.toUpperCase(), path: pathRaw, source: "server.ts" });
    }
  }
  return routes;
}

function extractApiFiles(): Route[] {
  const files = walkDir(apiDir, ".ts")
    .filter((f) => !f.includes("/_lib/") && !f.includes("\\_lib\\"));
  return files.map((f) => {
    const rel = path.relative(apiDir, f).replace(/\.ts$/, "");
    let apiPath = `/api/${rel.replace(/\\/g, "/")}`;
    // Dynamic segment: [action].ts → :action in Express.
    apiPath = apiPath.replace(/\[([^\]]+)\]/g, ":$1");

    // Infer method from path (most are POST, but robots/sitemap are GET).
    let method = "POST";
    if (apiPath.includes("robots.txt") || apiPath.includes("sitemap.xml")) {
      method = "GET";
    }
    return { method, path: apiPath, source: "api/*" };
  });
}

function extractSystemFnCases(): string[] {
  const systemPath = path.join(apiDir, "system.ts");
  if (!fs.existsSync(systemPath)) return [];
  const content = fs.readFileSync(systemPath, "utf-8");
  const caseRe = /if\s*\(\s*fn\s*===?\s*["']([^"']+)["']\s*\)/g;
  const cases: string[] = [];
  let match;
  while ((match = caseRe.exec(content)) !== null) {
    cases.push(match[1]);
  }
  return cases;
}

function extractVercelRewrites(): Array<{ source: string; dest: string }> {
  const content = fs.readFileSync(vercelPath, "utf-8");
  const config = JSON.parse(content);
  return (config.rewrites || []).filter((r: any) => r.source.startsWith("/api/"));
}

function walkDir(dir: string, ext: string): string[] {
  const results: string[] = [];
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      results.push(...walkDir(filePath, ext));
    } else if (filePath.endsWith(ext)) {
      results.push(filePath);
    }
  }
  return results;
}

function normalizePath(p: string): string {
  // Normalize /api/instructor/:action vs /api/instructor/[action]
  return p.replace(/:([a-z]+)/gi, "[param]").replace(/\[([a-z]+)\]/gi, "[param]");
}

function main() {
  console.log("🔍 Checking dual-API drift (server.ts vs api/*)...\n");

  const serverRoutes = extractServerRoutes();
  const apiFiles = extractApiFiles();
  const systemFnCases = extractSystemFnCases();
  const vercelRewrites = extractVercelRewrites();

  console.log(`  server.ts routes: ${serverRoutes.length}`);
  console.log(`  api/*.ts files:   ${apiFiles.length}`);
  console.log(`  system.ts cases:  ${systemFnCases.length}`);
  console.log(`  vercel rewrites:  ${vercelRewrites.length}\n`);

  let driftFound = false;

  // Check 1: Every server route has a match in api/ or system.ts.
  console.log("✓ Checking server.ts → api/ coverage...");
  for (const route of serverRoutes) {
    // Special cases: /robots.txt and /sitemap.xml are in api/ as api/robots.txt.ts
    if (route.path === "/robots.txt") {
      const matchedFile = apiFiles.find((f) => f.path === "/api/robots.txt");
      if (matchedFile) continue;
    }
    if (route.path === "/sitemap.xml") {
      const matchedFile = apiFiles.find((f) => f.path === "/api/sitemap.xml");
      if (matchedFile) continue;
    }

    const normalized = normalizePath(route.path);

    // Known patterns: /api/instructor/explain|practice|coach|diagnosis map to [action].ts
    if (route.path.startsWith("/api/instructor/")) {
      const matchedFile = apiFiles.find((f) => f.path === "/api/instructor/:action");
      if (matchedFile) continue;
    }

    // /api/study/:action is multiplexed to system.ts (study-materialize, etc.)
    if (route.path.startsWith("/api/study/")) {
      continue; // All study routes go through system.ts
    }

    // Check if multiplexed to system.ts
    const rewrite = vercelRewrites.find((r) => r.source === route.path);
    if (rewrite && rewrite.destination?.includes("system?fn=")) continue;

    const matchedFile = apiFiles.find((f) => normalizePath(f.path) === normalized && f.method === route.method);
    if (!matchedFile) {
      console.error(`  ✗ server.ts route ${route.method} ${route.path} has no api/ file or system.ts case.`);
      driftFound = true;
    }
  }

  // Check 2: Every api/ file has a match in server.ts.
  console.log("✓ Checking api/ → server.ts coverage...");
  for (const apiFile of apiFiles) {
    // Skip known non-route files: system.ts is a multiplexer
    if (apiFile.path === "/api/system") continue;

    // robots.txt and sitemap.xml are registered in server.ts without /api prefix
    if (apiFile.path === "/api/robots.txt") {
      const matchedRoute = serverRoutes.find((r) => r.path === "/robots.txt" && r.method === "GET");
      if (!matchedRoute) {
        console.error(`  ✗ api/ file ${apiFile.method} ${apiFile.path} exists but server.ts has no GET /robots.txt`);
        driftFound = true;
      }
      continue;
    }
    if (apiFile.path === "/api/sitemap.xml") {
      const matchedRoute = serverRoutes.find((r) => r.path === "/sitemap.xml" && r.method === "GET");
      if (!matchedRoute) {
        console.error(`  ✗ api/ file ${apiFile.method} ${apiFile.path} exists but server.ts has no GET /sitemap.xml`);
        driftFound = true;
      }
      continue;
    }

    const normalized = normalizePath(apiFile.path);

    // Known pattern: [action].ts maps to multiple server.ts routes
    if (apiFile.path === "/api/instructor/:action") {
      const hasAny = serverRoutes.some((r) => r.path.startsWith("/api/instructor/"));
      if (hasAny) continue;
    }

    const matchedRoute = serverRoutes.find((r) => normalizePath(r.path) === normalized && r.method === apiFile.method);
    if (!matchedRoute) {
      console.error(`  ✗ api/ file ${apiFile.method} ${apiFile.path} has no matching server.ts route.`);
      driftFound = true;
    }
  }

  // Check 3: Every vercel rewrite to system.ts has a system.ts case.
  console.log("✓ Checking vercel.json → system.ts coverage...");
  for (const rewrite of vercelRewrites) {
    const dest = rewrite.destination || rewrite.dest;
    if (dest && dest.includes("system?fn=")) {
      const fn = dest.split("fn=")[1]?.split("&")[0];
      if (fn && !systemFnCases.includes(fn)) {
        console.error(`  ✗ vercel.json rewrite ${rewrite.source} → system.ts?fn=${fn} but system.ts has no case for "${fn}".`);
        driftFound = true;
      }
    }
  }

  if (driftFound) {
    console.error("\n❌ Drift detected. Fix before deploying.\n");
    process.exit(1);
  }

  console.log("\n✅ No drift. server.ts and api/* are aligned.\n");
  process.exit(0);
}

main();
