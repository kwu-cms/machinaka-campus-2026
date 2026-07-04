#!/usr/bin/env node
/**
 * 開発用静的ファイルサーバー（Cache-Control: no-store で JS/CSS/CSV を常に最新取得）
 */
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { dirname, extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const PORT = Number(process.env.PORT || 8080);
const HOST = process.env.HOST || "127.0.0.1";

/** @type {Record<string, string>} */
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".csv": "text/csv; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml",
};

/** @param {string} filePath */
function isInsideRoot(filePath) {
  const rel = normalize(filePath).slice(root.length);
  return !rel.startsWith("..");
}

/** @param {import("node:http").IncomingMessage} req @param {import("node:http").ServerResponse} res */
async function handle(req, res) {
  try {
    const url = new URL(req.url || "/", `http://${HOST}`);
    let pathname = decodeURIComponent(url.pathname);
    if (pathname.endsWith("/")) pathname += "index.html";

    const filePath = join(root, pathname);
    if (!isInsideRoot(filePath)) {
      res.writeHead(403);
      res.end("Forbidden");
      return;
    }

    let st;
    try {
      st = await stat(filePath);
    } catch {
      res.writeHead(404);
      res.end("Not found");
      return;
    }

    if (st.isDirectory()) {
      res.writeHead(302, { Location: `${pathname.replace(/\/?$/, "/")}index.html` });
      res.end();
      return;
    }

    const ext = extname(filePath).toLowerCase();
    const type = MIME[ext] || "application/octet-stream";
    const body = await readFile(filePath);
    /** @type {Record<string, string>} */
    const headers = { "Content-Type": type };
    if (ext !== ".webp" && ext !== ".jpeg" && ext !== ".jpg" && ext !== ".png") {
      headers["Cache-Control"] = "no-store, no-cache, must-revalidate";
    }
    res.writeHead(200, headers);
    res.end(body);
  } catch (err) {
    console.error(err);
    res.writeHead(500);
    res.end("Internal Server Error");
  }
}

createServer(handle).listen(PORT, HOST, () => {
  console.log(`Dev server listening on http://${HOST}:${PORT}/`);
});
