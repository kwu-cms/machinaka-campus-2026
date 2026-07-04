#!/usr/bin/env node
/**
 * ローカル開発サーバー
 *   npm run dev       … 起動（バックグラウンド）
 *   npm run dev stop  … 停止
 */
import { spawn } from "node:child_process";
import { existsSync, readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const PID_FILE = join(root, ".dev-server.pid");
const PORT = Number(process.env.PORT || 8080);
const HOST = process.env.HOST || "127.0.0.1";

/** @param {number} pid */
function isAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function readPid() {
  if (!existsSync(PID_FILE)) return null;
  const pid = parseInt(readFileSync(PID_FILE, "utf8").trim(), 10);
  return Number.isFinite(pid) ? pid : null;
}

function clearPidFile() {
  if (existsSync(PID_FILE)) unlinkSync(PID_FILE);
}

function stopServer() {
  const pid = readPid();
  if (!pid) {
    console.log("開発サーバーは起動していません。");
    process.exit(0);
  }
  if (!isAlive(pid)) {
    clearPidFile();
    console.log("開発サーバーは既に停止しています（PID ファイルを削除しました）。");
    process.exit(0);
  }
  process.kill(pid, "SIGTERM");
  clearPidFile();
  console.log(`開発サーバーを停止しました（PID ${pid}）。`);
}

function startServer() {
  const existing = readPid();
  if (existing && isAlive(existing)) {
    console.log(`開発サーバーは既に起動中です: http://${HOST}:${PORT}/ （PID ${existing}）`);
    console.log("停止: npm run dev stop");
    process.exit(0);
  }
  clearPidFile();

  const child = spawn(process.execPath, [join(__dirname, "dev-server-http.mjs")], {
    cwd: root,
    detached: true,
    stdio: "ignore",
    env: { ...process.env, PORT: String(PORT), HOST },
  });
  child.unref();
  writeFileSync(PID_FILE, String(child.pid), "utf8");
  console.log(`開発サーバーを起動しました: http://${HOST}:${PORT}/ （PID ${child.pid}）`);
  console.log("停止: npm run dev stop");
}

const sub = process.argv[2];
if (sub === "stop") {
  stopServer();
} else if (sub) {
  console.error(`不明な引数: ${sub}`);
  console.error("使用法: npm run dev [stop]");
  process.exit(1);
} else {
  startServer();
}
