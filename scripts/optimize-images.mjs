#!/usr/bin/env node
/**
 * images-src/ のラスター原稿から images/ に WebP/JPEG（複数幅）を生成する。
 * プロファイルは scripts/image-profiles.json を参照。
 */
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
} from "node:fs";
import { basename, dirname, extname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const srcRoot = join(root, "images-src");
const outRoot = join(root, "images");

const config = JSON.parse(readFileSync(join(__dirname, "image-profiles.json"), "utf8"));
const { profiles, jpegQuality = 82, webpQuality = 80 } = config;

const RASTER_EXT = new Set([".avif", ".gif", ".jpg", ".jpeg", ".png", ".webp"]);
const PROFILE_ORDER = ["hero", "event", "screening", "guest", "misc"];

/** @param {string} dir */
function walk(dir) {
  /** @type {string[]} */
  const files = [];
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, ent.name);
    if (ent.isDirectory()) files.push(...walk(full));
    else files.push(full);
  }
  return files;
}

/** @param {string} pattern */
function globPatternToRegExp(pattern) {
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
  return new RegExp(`^${escaped}$`, "i");
}

/** @param {string} relPath images-src からの相対パス */
function resolveProfile(relPath) {
  const norm = relPath.replace(/\\/g, "/");
  const base = basename(norm);

  for (const name of PROFILE_ORDER) {
    const profile = profiles[name];
    if (!profile?.match) continue;

    for (const pattern of profile.match) {
      if (pattern === "*") continue;

      if (pattern.includes("/")) {
        const dirPrefix = pattern.replace(/\/?\*.*$/, "").replace(/\/$/, "");
        if (dirPrefix && (norm.startsWith(`${dirPrefix}/`) || norm === dirPrefix)) {
          return name;
        }
        continue;
      }

      if (globPatternToRegExp(pattern).test(base)) {
        return name;
      }
    }
  }

  return "misc";
}

/** @param {string} relPath */
function stemFromRelPath(relPath) {
  return relPath.replace(/\\/g, "/").replace(/\.[^/.]+$/, "");
}

/**
 * @param {number} originalWidth
 * @param {number[]} widths
 */
function targetWidths(originalWidth, widths) {
  const filtered = widths.filter((w) => !originalWidth || w <= originalWidth);
  if (filtered.length) return filtered;
  return [Math.min(...widths)];
}

/** @param {string} absSrc */
async function processRaster(absSrc) {
  const rel = relative(srcRoot, absSrc);
  const profileName = resolveProfile(rel);
  const profile = profiles[profileName] || profiles.misc;
  const stem = stemFromRelPath(rel);
  const ext = extname(rel).toLowerCase();
  const originalOut = join(outRoot, rel);
  const meta = await sharp(absSrc).metadata();
  const originalWidth = meta.width || 0;
  const widths = targetWidths(originalWidth, profile.widths);

  mkdirSync(dirname(join(outRoot, stem)), { recursive: true });
  // 旧実装の直接参照（例: images/image_1.jpeg）を壊さないため、元拡張子も同梱する。
  if (ext === ".jpg" || ext === ".jpeg") {
    await sharp(absSrc).rotate().jpeg({ quality: jpegQuality, mozjpeg: true }).toFile(originalOut);
  } else if (ext === ".png") {
    await sharp(absSrc).rotate().png({ compressionLevel: 9 }).toFile(originalOut);
  } else {
    copyFileSync(absSrc, originalOut);
  }

  let written = 0;
  for (const width of widths) {
    const webpOut = join(outRoot, `${stem}-${width}.webp`);
    const jpegOut = join(outRoot, `${stem}-${width}.jpeg`);

    await sharp(absSrc)
      .rotate()
      .resize({ width, withoutEnlargement: true, fit: "inside" })
      .webp({ quality: webpQuality })
      .toFile(webpOut);

    await sharp(absSrc)
      .rotate()
      .resize({ width, withoutEnlargement: true, fit: "inside" })
      .jpeg({ quality: jpegQuality, mozjpeg: true })
      .toFile(jpegOut);

    written += 2;
  }

  console.log(`${profileName.padEnd(10)} ${rel} → ${written + 1} files`);
  return written + 1;
}

/** @param {string} absSrc */
function processSvg(absSrc) {
  const rel = relative(srcRoot, absSrc);
  const dest = join(outRoot, rel);
  mkdirSync(dirname(dest), { recursive: true });
  copyFileSync(absSrc, dest);
  console.log(`svg        ${rel}`);
  return 1;
}

async function main() {
  if (!existsSync(srcRoot)) {
    console.error(`Missing source directory: ${srcRoot}`);
    process.exit(1);
  }

  const inputs = walk(srcRoot).filter((file) => {
    const name = basename(file);
    return name !== "README.md" && !name.startsWith(".");
  });

  if (!inputs.length) {
    console.log("No files in images-src/");
    return;
  }

  let variantCount = 0;
  let svgCount = 0;
  let skipped = 0;

  for (const absSrc of inputs.sort()) {
    const ext = extname(absSrc).toLowerCase();
    if (ext === ".svg") {
      svgCount += processSvg(absSrc);
      continue;
    }
    if (!RASTER_EXT.has(ext)) {
      console.log(`skip       ${relative(srcRoot, absSrc)}`);
      skipped += 1;
      continue;
    }
    variantCount += await processRaster(absSrc);
  }

  console.log(`Done. ${variantCount} variants, ${svgCount} svg copied, ${skipped} skipped.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
