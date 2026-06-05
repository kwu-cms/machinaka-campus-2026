#!/usr/bin/env node
import { chromium } from "playwright-core";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, "../tmp/signage-check");
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
await page.goto("http://localhost:8080/?signage=poster", { waitUntil: "networkidle" });

const info = await page.evaluate(() => ({
  mode: document.body.dataset.signage,
  imgSrc: document.querySelector(".signage-poster-view img")?.getAttribute("src") || null,
  imgOk: Boolean(document.querySelector(".signage-poster-view img")?.complete),
}));

await page.screenshot({
  path: join(outDir, "poster-1080x1920.png"),
  fullPage: true,
});
await browser.close();

console.log(info);
if (info.mode !== "poster" || !info.imgSrc?.includes("signage_poster")) process.exit(1);
