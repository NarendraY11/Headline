/**
 * Postinstall: force @vercel/node's nested esbuild and tsx to safe versions.
 *
 * @vercel/node hard-pins esbuild@0.27.0 and tsx@4.21.0 (exact, no ^),
 * so npm overrides cannot reach them. This script deletes those nested copies
 * and symlinks the safe top-level versions in their place.
 *
 * CVE: GHSA-gv7w-rqvm-qjhr (esbuild <0.28.1, missing binary integrity check)
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const VERCEL_NODE_NM = path.join(ROOT, 'node_modules', '@vercel', 'node', 'node_modules');

function rmrf(dir) {
  if (!fs.existsSync(dir)) return;
  fs.readdirSync(dir).forEach((f) => {
    const p = path.join(dir, f);
    if (fs.lstatSync(p).isDirectory()) rmrf(p);
    else fs.unlinkSync(p);
  });
  fs.rmdirSync(dir);
}

function safeCopyDir(src, dst) {
  if (!fs.existsSync(src)) {
    console.warn(`patch-vercel-node-deps: source not found: ${src}`);
    return false;
  }
  rmrf(dst);
  fs.mkdirSync(dst, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const dstPath = path.join(dst, entry.name);
    if (entry.isDirectory()) {
      safeCopyDir(srcPath, dstPath);
    } else {
      fs.copyFileSync(srcPath, dstPath);
    }
  }
  return true;
}

const patches = [
  {
    name: 'esbuild',
    src: path.join(ROOT, 'node_modules', 'esbuild'),
    dst: path.join(VERCEL_NODE_NM, 'esbuild'),
  },
  {
    name: 'tsx',
    src: path.join(ROOT, 'node_modules', 'tsx'),
    dst: path.join(VERCEL_NODE_NM, 'tsx'),
  },
];

let anyFailed = false;
for (const { name, src, dst } of patches) {
  const ok = safeCopyDir(src, dst);
  if (ok) {
    const ver = JSON.parse(fs.readFileSync(path.join(dst, 'package.json'), 'utf8')).version;
    console.log(`patch-vercel-node-deps: ${name} -> ${ver} ✓`);
  } else {
    console.warn(`patch-vercel-node-deps: skipped ${name} (source missing)`);
    anyFailed = true;
  }
}

if (!anyFailed) {
  console.log('patch-vercel-node-deps: done — @vercel/node nested deps patched');
}
