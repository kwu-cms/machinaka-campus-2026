#!/usr/bin/env node
/**
 * Google スプレッドシート（CSV エクスポート URL）→ data/*.csv
 * URL は .env または js/config.shared.js の SHEET_DATA_URLS を使用。
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

function loadEnv() {
  const envPath = join(root, ".env");
  const env = {};
  if (!existsSync(envPath)) return env;
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 1) continue;
    env[t.slice(0, i).trim()] = t.slice(i + 1).trim().replace(/^["']|["']$/g, "");
  }
  return env;
}

async function loadDefaultUrls() {
  const mod = await import(join(root, "js", "config.shared.js"));
  return mod.SHEET_DATA_URLS;
}

function stripBom(text) {
  return text.replace(/^\uFEFF/, "");
}

function parseHeaderLine(text) {
  const line = stripBom(text).split(/\r?\n/)[0] || "";
  return line.split(",").map((h) => h.trim());
}

const TARGETS = [
  {
    envKey: "SHEET_EVENTS_URL",
    urlKey: "eventsCsvUrl",
    outFile: "data/events.csv",
    requiredHeaders: ["ID", "カテゴリ", "イベント名"],
  },
  {
    envKey: "SHEET_MOVIES_URL",
    urlKey: "moviesCsvUrl",
    outFile: "data/movies.csv",
    requiredHeaders: ["ID", "タイトル"],
  },
  {
    envKey: "SHEET_SPEAKERS_URL",
    urlKey: "speakersCsvUrl",
    outFile: "data/speakers.csv",
    requiredHeaders: ["speaker_id"],
  },
  {
    envKey: "SHEET_EXHIBITIONS_URL",
    urlKey: "exhibitionsCsvUrl",
    outFile: "data/exhibitions.csv",
    requiredHeaders: ["ID", "タイトル"],
  },
];

async function main() {
  const env = loadEnv();
  const defaults = await loadDefaultUrls();

  for (const t of TARGETS) {
    const url = env[t.envKey] || defaults[t.urlKey];
    if (!url) {
      console.error(`Missing URL for ${t.outFile} (set ${t.envKey} or config.shared.js)`);
      process.exit(1);
    }
    console.log(`Fetching ${t.outFile} …`);
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) {
      console.error(`Failed ${t.outFile}: HTTP ${res.status}`);
      process.exit(1);
    }
    const text = stripBom(await res.text());
    if (!text.trim()) {
      console.error(`Empty response for ${t.outFile}`);
      process.exit(1);
    }
    const headers = parseHeaderLine(text);
    for (const req of t.requiredHeaders) {
      if (!headers.includes(req)) {
        console.error(`${t.outFile}: missing column "${req}" (got: ${headers.join(", ")})`);
        process.exit(1);
      }
    }
    const outPath = join(root, t.outFile);
    writeFileSync(outPath, text.endsWith("\n") ? text : `${text}\n`, "utf8");
    console.log(`  → ${t.outFile} (${headers.length} columns)`);
  }
  console.log("Sync complete.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
