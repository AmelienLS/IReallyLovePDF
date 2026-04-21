#!/usr/bin/env node
/**
 * Copies tesseract.js worker + core WASM files from node_modules into public/tesseract/
 * and downloads language data (eng, fra) from the official Tesseract traineddata_fast repo
 * if not already present.
 *
 * Runs before dev/build so the Tauri webview has everything locally — no CDN calls at runtime.
 */

import { copyFileSync, existsSync, mkdirSync, createWriteStream, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import https from "node:https";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const PUBLIC_DIR = join(ROOT, "public", "tesseract");
const NODE_MODULES = join(ROOT, "node_modules");

const LANGS = ["eng", "fra"];
const TRAINED_DATA_URL = (lang) =>
  `https://github.com/tesseract-ocr/tessdata_fast/raw/main/${lang}.traineddata`;

function ensureDir(p) {
  if (!existsSync(p)) mkdirSync(p, { recursive: true });
}

function copyIfNewer(src, dest) {
  if (!existsSync(src)) return false;
  copyFileSync(src, dest);
  return true;
}

function download(url, dest) {
  return new Promise((resolve, reject) => {
    const doGet = (u, redirects = 0) => {
      if (redirects > 5) return reject(new Error("Too many redirects"));
      https
        .get(u, (res) => {
          if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
            return doGet(res.headers.location, redirects + 1);
          }
          if (res.statusCode !== 200) {
            return reject(new Error(`HTTP ${res.statusCode} for ${u}`));
          }
          const file = createWriteStream(dest);
          res.pipe(file);
          file.on("finish", () => file.close(() => resolve()));
          file.on("error", reject);
        })
        .on("error", reject);
    };
    doGet(url);
  });
}

async function main() {
  ensureDir(PUBLIC_DIR);

  // 1. Copy worker
  const workerSrc = join(NODE_MODULES, "tesseract.js", "dist", "worker.min.js");
  const workerDest = join(PUBLIC_DIR, "worker.min.js");
  if (copyIfNewer(workerSrc, workerDest)) {
    console.log("[tesseract] copied worker.min.js");
  } else {
    console.error("[tesseract] MISSING:", workerSrc);
  }

  // 2. Copy all core WASM + JS files
  const coreDir = join(NODE_MODULES, "tesseract.js-core");
  if (existsSync(coreDir)) {
    const files = readdirSync(coreDir).filter((f) => /^tesseract-core.*\.(wasm|js)$/.test(f));
    for (const f of files) {
      copyFileSync(join(coreDir, f), join(PUBLIC_DIR, f));
    }
    console.log(`[tesseract] copied ${files.length} core files`);
  } else {
    console.error("[tesseract] MISSING core dir:", coreDir);
  }

  // 3. Download language data if absent
  for (const lang of LANGS) {
    const dest = join(PUBLIC_DIR, `${lang}.traineddata`);
    if (existsSync(dest)) {
      console.log(`[tesseract] ${lang}.traineddata already present`);
      continue;
    }
    console.log(`[tesseract] downloading ${lang}.traineddata ...`);
    try {
      await download(TRAINED_DATA_URL(lang), dest);
      console.log(`[tesseract]   ✓ saved ${lang}.traineddata`);
    } catch (e) {
      console.error(`[tesseract]   ✗ failed ${lang}:`, e.message);
      console.error(`[tesseract]   OCR will not work for "${lang}" until this file is fetched.`);
    }
  }
}

main().catch((e) => {
  console.error("[tesseract] setup failed:", e);
  process.exit(1);
});
