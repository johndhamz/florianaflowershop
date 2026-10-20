/**
 * Renders the SVG placeholders to JPEG so they can live in the image buckets
 * (SVG uploads are intentionally disallowed) and flow through next/image.
 *   node scripts/rasterize-placeholders.mjs
 */
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { chromium } from "@playwright/test";

const dir = resolve(process.cwd(), "public/images/placeholders");
const sizes = {
  hero: { width: 1200, height: 1400 },
  default: { width: 800, height: 1000 },
};

const browser = await chromium.launch();
const page = await browser.newPage();
for (const file of readdirSync(dir).filter((f) => f.endsWith(".svg"))) {
  const name = file.replace(/\.svg$/, "");
  const { width, height } = sizes[name] ?? sizes.default;
  await page.setViewportSize({ width, height });
  const svg = readFileSync(resolve(dir, file), "utf8");
  await page.setContent(
    `<html><body style="margin:0">${svg.replace("<svg ", `<svg width="${width}" height="${height}" `)}</body></html>`,
  );
  await page.screenshot({ path: resolve(dir, `${name}.jpg`), type: "jpeg", quality: 86 });
  console.log(`rendered ${name}.jpg (${width}x${height})`);
}
await browser.close();
