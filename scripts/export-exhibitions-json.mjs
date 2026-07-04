#!/usr/bin/env node
/**
 * data/exhibitions.csv → data/exhibitions.json（展示作品の固定化用）
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseCSV, rowToObj } from "../js/lib/csv.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const csvPath = join(root, "data", "exhibitions.csv");
const jsonPath = join(root, "data", "exhibitions.json");

/** @param {Record<string, string>} r */
function exhibitionRowToRecord(r) {
  const id = String(r["ID"] || "").trim();
  const title = String(r["タイトル"] || "").trim();
  const author = String(r["作者"] || "").trim();
  const domain = String(r["領域"] || "").trim();
  const authorType = String(r["作者区分"] || "").trim();
  const year = String(r["制作年"] || "").trim();
  const media = String(r["メディア種別"] || "").trim();
  const displayMethod = String(r["展示方法"] || "").trim();
  const description = String(r["作品説明"] || "").trim();
  const exhibitionDate = String(r["展示日"] || "").trim();
  const imageFile = String(r["画像ファイル名"] || "").trim();
  const relatedUrl = String(r["関連URL（任意）"] || r["関連URL"] || "").trim();
  const notes = String(r["備考"] || r["メモ"] || "").trim();
  const sortNum = (() => {
    const m = /^exhi-(\d+)$/i.exec(id);
    return m ? parseInt(m[1], 10) : 999;
  })();

  return {
    id,
    title,
    author,
    domain,
    authorType,
    year,
    media,
    displayMethod,
    description,
    exhibitionDate,
    imageFile,
    relatedUrl,
    notes,
    sort: sortNum,
  };
}

function isPublishable(item) {
  if (!/^exhi-\d+$/i.test(item.id)) return false;
  if (!item.title && !item.domain) return false;
  return true;
}

const text = readFileSync(csvPath, "utf8").replace(/^\uFEFF/, "");
const rows = parseCSV(text);
if (!rows.length) {
  console.error("Empty CSV:", csvPath);
  process.exit(1);
}

const headers = rows[0];
const items = rows
  .slice(1)
  .map((row) => exhibitionRowToRecord(rowToObj(headers, row)))
  .filter(isPublishable)
  .sort((a, b) => a.sort - b.sort);

const payload = {
  generatedAt: new Date().toISOString(),
  source: "data/exhibitions.csv",
  count: items.length,
  items,
};

writeFileSync(jsonPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
console.log(`  → data/exhibitions.json (${items.length} items)`);
