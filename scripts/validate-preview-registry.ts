/**
 * Phase 7: Feature Preview Registry — Validator & Coverage Audit
 *
 * Parses source files without importing React or Vite to validate registry
 * integrity and report admin-visible preview coverage metrics.
 *
 * Usage:
 *   tsx scripts/validate-preview-registry.ts              # human-readable report
 *   tsx scripts/validate-preview-registry.ts --json       # JSON output (CI parsers)
 *   tsx scripts/validate-preview-registry.ts --strict     # exit 2 if coverage < 50%
 *
 * Exit codes:
 *   0  all integrity checks passed
 *   1  one or more integrity errors
 *   2  coverage below threshold (--strict only)
 */
import fs from "fs";
import path from "path";

const ROOT = path.resolve(process.cwd());
const SRC = path.join(ROOT, "src");

const ARGS = process.argv.slice(2);
const JSON_MODE = ARGS.includes("--json");
const STRICT = ARGS.includes("--strict");
const COVERAGE_THRESHOLD = 0.5;

// ─── Source reader ────────────────────────────────────────────────────────────

function read(...parts: string[]): string {
  return fs.readFileSync(path.join(SRC, ...parts), "utf-8");
}

// ─── Parsers ──────────────────────────────────────────────────────────────────

/** String literal members of the FlagKeys union type. */
function parseFlagKeys(): string[] {
  const src = read("hooks", "useFeatureFlags.tsx");
  const m = src.match(/export type FlagKeys\s*=\s*([^;]+);/);
  if (!m) throw new Error("Cannot locate FlagKeys in useFeatureFlags.tsx");
  return [...m[1].matchAll(/"([^"]+)"/g)].map((r) => r[1]);
}

interface RegistryEntry {
  key: string;
  previewType: string;
  adminVisible: boolean;
  category: string;
}

/**
 * Feature entries parsed from featureRegistry.ts using the `key: "..."` anchor
 * at 4-space indent. Each entry's surrounding 500 chars contain all properties.
 */
function parseFeatureRegistry(): RegistryEntry[] {
  const src = read("views", "admin", "featureRegistry.ts");
  const entries: RegistryEntry[] = [];
  const keyRe = /^\s{4}key:\s*"([^"]+)"/gm;
  let m: RegExpExecArray | null;
  while ((m = keyRe.exec(src)) !== null) {
    const key = m[1];
    const lo = Math.max(0, m.index - 60);
    const hi = Math.min(src.length, m.index + 500);
    const chunk = src.slice(lo, hi);
    const previewType = chunk.match(/previewType:\s*"([^"]+)"/)?.[1];
    const adminVisible = chunk.match(/adminVisible:\s*(true|false)/)?.[1];
    const category = chunk.match(/category:\s*"([^"]+)"/)?.[1];
    if (previewType !== undefined && adminVisible !== undefined && category !== undefined) {
      entries.push({ key, previewType, adminVisible: adminVisible === "true", category });
    }
  }
  return entries;
}

/** Keys present in the readyComponentPreviews map. */
function parseComponentPreviewKeys(): string[] {
  const src = read("views", "admin", "featurePreviewRegistry.ts");
  const block = src.match(/const readyComponentPreviews[^=]+=\s*\{([\s\S]*?)\};/m);
  if (!block) return [];
  return [...block[1].matchAll(/^\s+(\w+):\s*lazyPreviewComponent/gm)].map((r) => r[1]);
}

/** Export names passed to lazyPreviewComponent("..."). */
function parseComponentPreviewExportNames(): string[] {
  const src = read("views", "admin", "featurePreviewRegistry.ts");
  return [...src.matchAll(/lazyPreviewComponent\("([^"]+)"\)/g)].map((r) => r[1]);
}

/** Named exports from featureComponentPreviews.tsx. */
function parseComponentPreviewExports(): string[] {
  const src = read("views", "admin", "featureComponentPreviews.tsx");
  return [...src.matchAll(/^export function (\w+)/gm)].map((r) => r[1]);
}

/** Top-level keys in the previewRoutes export. */
function parseRoutePreviewKeys(): string[] {
  const src = read("views", "admin", "previewRoutes.tsx");
  const start = src.indexOf("export const previewRoutes");
  if (start === -1) return [];
  return [...src.slice(start).matchAll(/^  (\w+):\s*\{/gm)].map((r) => r[1]);
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface ValidationIssue {
  severity: "error" | "warning";
  code: string;
  message: string;
}

interface CategoryCoverage {
  total: number;
  covered: number;
  ratio: number;
}

interface CoverageReport {
  totalFeatures: number;
  adminVisible: number;
  componentPreviews: number;
  routePreviews: number;
  withAnyPreview: number;
  apiOnly: number;
  plannedFeatures: number;
  adminVisibleCoverageRatio: number;
  byCategory: Record<string, CategoryCoverage>;
}

interface ValidationResult {
  passed: boolean;
  errorCount: number;
  warningCount: number;
  issues: ValidationIssue[];
  coverage: CoverageReport;
}

// ─── Core validation ──────────────────────────────────────────────────────────

function validate(): ValidationResult {
  const issues: ValidationIssue[] = [];

  function error(code: string, message: string): void {
    issues.push({ severity: "error", code, message });
  }
  function warning(code: string, message: string): void {
    issues.push({ severity: "warning", code, message });
  }

  const flagKeys = parseFlagKeys();
  const registryEntries = parseFeatureRegistry();
  const componentKeys = parseComponentPreviewKeys();
  const componentExportNames = parseComponentPreviewExportNames();
  const componentExports = parseComponentPreviewExports();
  const routeKeys = parseRoutePreviewKeys();

  const flagKeySet = new Set(flagKeys);
  const registryKeySet = new Set(registryEntries.map((e) => e.key));
  const componentKeySet = new Set(componentKeys);
  const routeKeySet = new Set(routeKeys);
  const exportSet = new Set(componentExports);

  // ── Check 1: every FlagKey has a registry entry ──────────────────────────
  for (const k of flagKeys) {
    if (!registryKeySet.has(k)) {
      error("REGISTRY_MISSING_FLAGKEY", `FlagKey "${k}" has no entry in featureRegistry`);
    }
  }

  // ── Check 2: every registry key is a valid FlagKey ───────────────────────
  for (const e of registryEntries) {
    if (!flagKeySet.has(e.key)) {
      error("FLAGKEY_MISSING_FOR_REGISTRY", `featureRegistry key "${e.key}" is not a FlagKey`);
    }
  }

  // ── Check 3: no duplicate keys in featureRegistry ────────────────────────
  const seen = new Set<string>();
  for (const e of registryEntries) {
    if (seen.has(e.key)) {
      error("DUPLICATE_KEY", `Duplicate featureRegistry key "${e.key}"`);
    }
    seen.add(e.key);
  }

  // ── Check 4: component preview keys are valid registry keys ──────────────
  for (const k of componentKeys) {
    if (!registryKeySet.has(k)) {
      error(
        "ORPHAN_COMPONENT_PREVIEW",
        `readyComponentPreviews key "${k}" is not in featureRegistry`
      );
    }
  }

  // ── Check 5: every lazyPreviewComponent("X") export name actually exists ─
  for (const name of componentExportNames) {
    if (!exportSet.has(name)) {
      error(
        "MISSING_PREVIEW_EXPORT",
        `lazyPreviewComponent("${name}") referenced but "${name}" is not exported from featureComponentPreviews.tsx`
      );
    }
  }

  // ── Check 6: route preview keys are valid registry keys ──────────────────
  for (const k of routeKeys) {
    if (!registryKeySet.has(k)) {
      error(
        "ORPHAN_ROUTE_PREVIEW",
        `previewRoutes key "${k}" is not in featureRegistry`
      );
    }
  }

  // ── Check 7: adminVisible features without any preview (warnings) ─────────
  const adminEntries = registryEntries.filter((e) => e.adminVisible);
  for (const e of adminEntries) {
    if (
      !componentKeySet.has(e.key) &&
      !routeKeySet.has(e.key) &&
      e.previewType !== "api-only" &&
      e.previewType !== "none"
    ) {
      warning(
        "MISSING_PREVIEW",
        `adminVisible "${e.key}" (previewType: ${e.previewType}) has no preview implementation`
      );
    }
  }

  // ── Coverage metrics ──────────────────────────────────────────────────────

  const adminVisibleEligible = adminEntries.filter(
    (e) => e.previewType !== "api-only" && e.previewType !== "none"
  ).length;
  const adminVisibleCovered = adminEntries.filter(
    (e) => componentKeySet.has(e.key) || routeKeySet.has(e.key)
  ).length;
  const coverageRatio =
    adminVisibleEligible > 0 ? adminVisibleCovered / adminVisibleEligible : 1;

  if (STRICT && coverageRatio < COVERAGE_THRESHOLD) {
    error(
      "COVERAGE_BELOW_THRESHOLD",
      `Admin-visible preview coverage ${(coverageRatio * 100).toFixed(1)}% is below the ${(COVERAGE_THRESHOLD * 100).toFixed(0)}% threshold (pass --strict to enforce)`
    );
  }

  const categories = [...new Set(adminEntries.map((e) => e.category))];
  const byCategory: Record<string, CategoryCoverage> = {};
  for (const cat of categories) {
    const catEntries = adminEntries.filter((e) => e.category === cat);
    const catCovered = catEntries.filter(
      (e) => componentKeySet.has(e.key) || routeKeySet.has(e.key)
    ).length;
    byCategory[cat] = {
      total: catEntries.length,
      covered: catCovered,
      ratio: catEntries.length > 0 ? catCovered / catEntries.length : 1,
    };
  }

  const coverage: CoverageReport = {
    totalFeatures: registryEntries.length,
    adminVisible: adminEntries.length,
    componentPreviews: componentKeys.length,
    routePreviews: routeKeys.length,
    withAnyPreview: registryEntries.filter(
      (e) => componentKeySet.has(e.key) || routeKeySet.has(e.key)
    ).length,
    apiOnly: registryEntries.filter((e) => e.previewType === "api-only").length,
    plannedFeatures: adminEntries.filter(
      (e) =>
        !componentKeySet.has(e.key) &&
        !routeKeySet.has(e.key) &&
        e.previewType !== "api-only" &&
        e.previewType !== "none"
    ).length,
    adminVisibleCoverageRatio: coverageRatio,
    byCategory,
  };

  const errorCount = issues.filter((i) => i.severity === "error").length;
  const warningCount = issues.filter((i) => i.severity === "warning").length;

  return { passed: errorCount === 0, errorCount, warningCount, issues, coverage };
}

// ─── Formatters ───────────────────────────────────────────────────────────────

function bar(ratio: number, width = 22): string {
  const filled = Math.round(ratio * width);
  return "[" + "█".repeat(filled) + "░".repeat(width - filled) + "]";
}

function pct(ratio: number): string {
  return (ratio * 100).toFixed(1) + "%";
}

function printHuman(result: ValidationResult): void {
  const { issues, coverage, passed, errorCount, warningCount } = result;

  const R = "\x1b[0m";
  const RED = "\x1b[31m";
  const YLW = "\x1b[33m";
  const GRN = "\x1b[32m";
  const DIM = "\x1b[2m";
  const B = "\x1b[1m";

  const DIV = `${B}${"─".repeat(56)}${R}`;

  console.log(`\n${DIV}`);
  console.log(`${B}  Feature Preview Registry — Validation Report${R}`);
  console.log(`${DIV}\n`);

  // Integrity issues
  const integrity = issues.filter(
    (i) => i.code !== "MISSING_PREVIEW" && i.code !== "COVERAGE_BELOW_THRESHOLD"
  );
  const coverageIssue = issues.find((i) => i.code === "COVERAGE_BELOW_THRESHOLD");
  const missingPreviews = issues.filter((i) => i.code === "MISSING_PREVIEW");

  if (integrity.length === 0) {
    console.log(`${GRN}✓ Registry integrity: all checks passed${R}`);
  } else {
    console.log(`${B}INTEGRITY ERRORS${R}`);
    for (const i of integrity) {
      const col = i.severity === "error" ? RED : YLW;
      const icon = i.severity === "error" ? "✗" : "⚠";
      console.log(`  ${col}${icon} [${i.code}]${R} ${i.message}`);
    }
  }

  if (missingPreviews.length > 0) {
    console.log(`\n${B}PLANNED (no preview yet)${R} ${DIM}— use 'validate:preview' to track${R}`);
    for (const i of missingPreviews) {
      console.log(`  ${YLW}⚠${R} ${i.message}`);
    }
  }

  if (coverageIssue) {
    console.log(`\n  ${RED}✗ [${coverageIssue.code}]${R} ${coverageIssue.message}`);
  }

  // Coverage summary
  console.log(`\n${B}COVERAGE${R}`);
  console.log(`  Total features            ${coverage.totalFeatures}`);
  console.log(`  Admin-visible             ${coverage.adminVisible}`);
  console.log(`  Component previews        ${coverage.componentPreviews}`);
  console.log(`  Route previews            ${coverage.routePreviews}`);
  console.log(`  With any preview          ${coverage.withAnyPreview}`);
  console.log(`  API-only (no preview)     ${coverage.apiOnly}`);
  console.log(`  Planned (no preview yet)  ${coverage.plannedFeatures}`);
  const covColor =
    coverage.adminVisibleCoverageRatio >= 0.8
      ? GRN
      : coverage.adminVisibleCoverageRatio >= 0.5
      ? YLW
      : RED;
  console.log(
    `  ${B}Admin-visible coverage${R}    ${covColor}${bar(coverage.adminVisibleCoverageRatio)} ${pct(coverage.adminVisibleCoverageRatio)}${R}`
  );

  // Per-category
  console.log(`\n${B}BY CATEGORY (admin-visible)${R}`);
  const cats = Object.entries(coverage.byCategory);
  const maxLen = Math.max(...cats.map(([c]) => c.length));
  for (const [cat, data] of cats) {
    const pad = " ".repeat(maxLen - cat.length + 2);
    const col =
      data.ratio >= 1 ? GRN : data.ratio >= 0.5 ? YLW : RED;
    console.log(
      `  ${cat}${pad}${col}${data.covered}/${data.total}${R}  ${DIM}${pct(data.ratio)}${R}`
    );
  }

  // Final verdict
  console.log(`\n${DIV}`);
  if (passed) {
    const warnNote =
      warningCount > 0 ? `  ${DIM}${warningCount} warning(s)${R}` : "";
    console.log(`${GRN}${B}✓ PASSED${R}${warnNote}`);
  } else {
    console.log(
      `${RED}${B}✗ FAILED${R}  ${errorCount} error(s)` +
        (warningCount > 0 ? `, ${warningCount} warning(s)` : "")
    );
  }
  console.log(`${DIV}\n`);
}

function printJson(result: ValidationResult): void {
  console.log(JSON.stringify(result, null, 2));
}

// ─── Entry point ──────────────────────────────────────────────────────────────

try {
  const result = validate();

  if (JSON_MODE) {
    printJson(result);
  } else {
    printHuman(result);
  }

  if (!result.passed) {
    process.exit(1);
  }
  if (STRICT && result.coverage.adminVisibleCoverageRatio < COVERAGE_THRESHOLD) {
    process.exit(2);
  }
  process.exit(0);
} catch (e) {
  const msg = e instanceof Error ? e.message : String(e);
  if (JSON_MODE) {
    console.log(JSON.stringify({ error: msg, passed: false }));
  } else {
    console.error(`\x1b[31m✗ Validator crashed:\x1b[0m ${msg}`);
  }
  process.exit(1);
}
