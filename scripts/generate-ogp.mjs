#!/usr/bin/env node
/**
 * OGP 原稿（images-src/image_ogp.png）から
 * images/ogp-1200.{jpeg,webp}（1200×630）を生成する。
 */
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const src = join(root, "images-src/image_ogp.png");
const outDir = join(root, "images");

const OGP_W = 1200;
const OGP_H = 630;
const JPEG_Q = 82;
const WEBP_Q = 80;

mkdirSync(outDir, { recursive: true });

const pipeline = sharp(src).resize(OGP_W, OGP_H, {
  fit: "cover",
  position: "centre",
});

await pipeline.clone().jpeg({ quality: JPEG_Q, mozjpeg: true }).toFile(join(outDir, "ogp-1200.jpeg"));
await pipeline.clone().webp({ quality: WEBP_Q }).toFile(join(outDir, "ogp-1200.webp"));

console.log(`Wrote images/ogp-1200.jpeg and images/ogp-1200.webp (${OGP_W}×${OGP_H} from image_ogp.png)`);
