import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import sharp from "sharp";

// Rasterizes the brand SVGs into the PNG icon set the web app manifest needs.
// Run via `npm run build:pwa-icons`. Output lands in /public so vite serves it.
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PUBLIC = path.resolve(__dirname, "../public");

const jobs: { src: string; out: string; size: number }[] = [
  { src: "favicon.svg", out: "pwa-192x192.png", size: 192 },
  { src: "favicon.svg", out: "pwa-512x512.png", size: 512 },
  { src: "favicon.svg", out: "apple-touch-icon.png", size: 180 },
  { src: "icon-maskable.svg", out: "maskable-512x512.png", size: 512 },
  // Monochrome notification badge (Android tints by alpha). Source is the
  // flattened white compass silhouette.
  { src: "icon-badge.svg", out: "badge-72x72.png", size: 72 },
];

async function run() {
  for (const job of jobs) {
    const svg = fs.readFileSync(path.join(PUBLIC, job.src));
    await sharp(svg, { density: 384 })
      .resize(job.size, job.size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toFile(path.join(PUBLIC, job.out));
    console.log(`generated ${job.out} (${job.size}x${job.size})`);
  }
}

run().catch((e) => {
  console.error("PWA icon generation failed:", e);
  process.exit(1);
});
