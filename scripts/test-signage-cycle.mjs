#!/usr/bin/env node
/**
 * サイネージ cycle（ポスター→上映→イベント）の遷移を短い duration で検証する。
 * 用法: node scripts/test-signage-cycle.mjs [baseUrl] [durationSec]
 */
import { chromium } from "playwright-core";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const baseUrl = process.argv[2] || "http://localhost:8080";
const durationSec = Math.max(5, Number.parseInt(process.argv[3] || "6", 10));
const waitMs = durationSec * 1000 + 800;

const outDir = join(root, "tmp/signage-check");
mkdirSync(outDir, { recursive: true });

/** @param {import('playwright-core').Page} page */
async function readSignageMode(page) {
  return page.evaluate(() => document.body.dataset.signage || null);
}

/** @param {import('playwright-core').Page} page */
async function readSearch(page) {
  return page.evaluate(() => window.location.search);
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1080, height: 1920 },
  deviceScaleFactor: 1,
});
const page = await context.newPage();

const startUrl = `${baseUrl}/?signage=cycle&duration=${durationSec}`;
console.log(`Open: ${startUrl}`);
await page.goto(startUrl, { waitUntil: "networkidle" });

const sequence = [];
for (let i = 0; i < 4; i += 1) {
  const mode = await readSignageMode(page);
  const search = await readSearch(page);
  sequence.push({ step: i + 1, mode, search });
  const shot = join(outDir, `cycle-step${i + 1}-${mode || "unknown"}-1080x1920.png`);
  await page.screenshot({ path: shot, fullPage: true });
  console.log(`step ${i + 1}: mode=${mode} search=${search}`);
  if (i < 3) await page.waitForTimeout(waitMs);
}

await browser.close();

const modes = sequence.map((s) => s.mode);
const expected = ["poster", "screening", "event", "poster"];
const ok =
  modes[0] === "poster" &&
  modes[1] === "screening" &&
  modes[2] === "event" &&
  modes[3] === "poster";

const durationOk = sequence.every((s) => s.search.includes(`duration=${durationSec}`));

console.log("\n--- result ---");
console.log(`cycle order: ${modes.join(" → ")}`);
console.log(`expected:    ${expected.join(" → ")}`);
console.log(`order ok: ${ok ? "YES" : "NO"}`);
console.log(`duration param preserved: ${durationOk ? "YES" : "NO"}`);

if (!ok || !durationOk) process.exit(1);
