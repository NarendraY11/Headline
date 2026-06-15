// Convert OG PNG images to WebP for social sharing optimization
import sharp from "sharp";
import { readdir } from "fs/promises";
import { join, basename, extname } from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, "../public");
const ogPostsDir = join(publicDir, "og-posts");

async function convertToWebP(inputPath, outputPath) {
  const before = (await import("fs")).statSync(inputPath).size;
  await sharp(inputPath)
    .webp({ quality: 85, effort: 4 })
    .toFile(outputPath);
  const after = (await import("fs")).statSync(outputPath).size;
  const savings = ((1 - after / before) * 100).toFixed(1);
  console.log(`  ${basename(inputPath)} → ${basename(outputPath)} (${(before/1024).toFixed(0)}KB → ${(after/1024).toFixed(0)}KB, -${savings}%)`);
}

async function main() {
  console.log("Converting OG images to WebP...\n");

  // Main og-image
  await convertToWebP(join(publicDir, "og-image.png"), join(publicDir, "og-image.webp"));

  // Blog post OG images
  const files = await readdir(ogPostsDir);
  for (const file of files) {
    if (extname(file) === ".png") {
      const input = join(ogPostsDir, file);
      const output = join(ogPostsDir, basename(file, ".png") + ".webp");
      await convertToWebP(input, output);
    }
  }

  console.log("\nDone. Add <link rel=\"preload\"> for og-image.webp if used as hero.");
}

main().catch(console.error);
