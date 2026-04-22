import type { PDFPageProxy } from "pdfjs-dist";
import type { PdfRect } from "../store/types";

export interface OcrWord {
  text: string;
  rect: PdfRect; // PDF coordinate space (origin bottom-left)
  confidence: number;
  fontSize: number; // in PDF points — median of cluster, used as fallback
  // Structured rows: each row is a line, each entry is a word with its own fontSize.
  rows: Array<Array<{ text: string; fontSize: number }>>;
}

const OCR_SCALE = 3;
const TESS_BASE = "/tesseract";

const CONF_WORD = 25;

interface TessBBox { x0: number; y0: number; x1: number; y1: number }
interface TessWord { text: string; bbox: TessBBox; confidence: number; symbols?: unknown[] }
interface TessLine { text: string; bbox: TessBBox; confidence: number; words: TessWord[] }

// Kept for API compatibility — only "smart" is exposed in the UI.
export type OcrGranularity = "smart";

export const DEFAULT_CHAR_WHITELIST =
  "0123456789" +
  "ABCDEFGHIJKLMNOPQRSTUVWXYZ" +
  "abcdefghijklmnopqrstuvwxyz" +
  " .,:;-_+=/()[]{}<>*#%&@!?\"'" +
  "°±×µ∅ØÆæ";

// ---------------------------------------------------------------------------
// Pre-processing: grayscale + contrast stretch → better number detection.
// ---------------------------------------------------------------------------
function preprocessCanvas(src: HTMLCanvasElement): HTMLCanvasElement {
  const dst = document.createElement("canvas");
  dst.width = src.width;
  dst.height = src.height;
  const ctx = dst.getContext("2d")!;
  ctx.drawImage(src, 0, 0);

  const img = ctx.getImageData(0, 0, dst.width, dst.height);
  const d = img.data;
  const n = d.length >> 2;
  const gray = new Uint8ClampedArray(n);

  // Pass 1 — convert to grayscale.
  for (let i = 0, j = 0; i < d.length; i += 4, j++) {
    gray[j] = (d[i] * 77 + d[i + 1] * 150 + d[i + 2] * 29) >> 8;
  }

  // Pass 2 — fixed-threshold binarization.
  // Threshold 80/255: only pixels darker than ~31% gray survive as foreground.
  // Medium-gray watermarks (typically 120-170/255) become pure white before
  // Tesseract sees the image, so they produce no OCR output. Anti-aliased edges
  // of those marks (80-100/255) are also eliminated, preventing isolated-pixel
  // fragments that Tesseract reads as letters like "J" or "L".
  // Vector PDFs have crisp black ink (0-50/255), so real text is unaffected.
  const threshold = 80;

  // Pass 3 — write binarized pixels back (0 = black text, 255 = white background).
  for (let i = 0, j = 0; i < d.length; i += 4, j++) {
    const v = gray[j] <= threshold ? 0 : 255;
    d[i] = d[i + 1] = d[i + 2] = v;
    d[i + 3] = 255;
  }

  ctx.putImageData(img, 0, 0);
  return dst;
}

// ---------------------------------------------------------------------------
// Logo / watermark / non-text filter.
// pageW/pageH are in PDF points (scale=1).
// ---------------------------------------------------------------------------
function looksLikeText(text: string, rect: PdfRect, pageW: number, pageH: number): boolean {
  const trimmed = text.replace(/\s/g, "");
  if (!trimmed) return false;

  // Watermark detection: diagonal stamp text has a bbox that spans a large
  // fraction of the page. Real words never exceed ~20% of page width at once.
  if (rect.width  > pageW * 0.20) return false;
  if (rect.height > pageH * 0.15) return false;

  // Single character: only accept if the bbox is plausibly small.
  // A lone "J" or "L" read from a diagonal watermark has a large bbox (the
  // glyph spans a big chunk of the page). Real single chars in annotations like
  // "(H)" are part of a 3-char group; bare single-char tokens are almost always
  // watermark/logo artifacts.
  if (trimmed.length === 1) {
    if (rect.height > pageH * 0.06) return false;
    return true;
  }

  // 1-2 lowercase-only characters: standalone "ed", "is", "of", etc. are
  // almost always logo/watermark fragments, not real annotation content.
  if (trimmed.length <= 2 && /^[a-z]+$/.test(trimmed)) return false;

  // Short strings (2-3 chars): brackets, digits, punctuation — relax density check.
  if (trimmed.length <= 3) {
    if (!/\S/.test(trimmed)) return false;
    if (rect.width > rect.height * 10) return false;
    return true;
  }

  if (!/[A-Za-z0-9]/.test(trimmed)) return false;
  // Character density: logos spread few chars over a large area.
  const area = rect.width * rect.height;
  const expectedArea = rect.height * rect.height * 0.6 * trimmed.length;
  if (area > expectedArea * 5) return false;
  if (rect.width > rect.height * 8) return false;
  return true;
}

// ---------------------------------------------------------------------------
// Post-process common Tesseract errors on technical drawings.
// ---------------------------------------------------------------------------
function postProcess(text: string): string {
  return text
    // ± symbol: Tesseract often outputs "+/-", "+-", "+\-", "+/−"
    .replace(/\+\s*[/\\]?\s*[-−]/g, "±")
    .replace(/[-−]\s*[/\\]?\s*\+/g,  "±")
    // ∅ symbol: Tesseract reads it as "@" before a digit (diameter notation)
    .replace(/@(\d)/g, "∅$1")
    // Spurious "Y" before "%": OCR artefact on some typefaces
    .replace(/\bY(%)/g, "$1")
    // Degree symbol: sometimes output as "o" or "°" already — normalize
    .replace(/(\d)\s*o\b/g, "$1°")
    // Remove stray newlines within a word
    .replace(/(\w)\n(\w)/g, "$1$2");
}

function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

// ---------------------------------------------------------------------------
// Smart clustering: Union-Find groups spatially close words of similar size,
// preserving line breaks and relative font sizes between groups.
// ---------------------------------------------------------------------------
function clusterWords(words: OcrWord[]): OcrWord[] {
  if (words.length === 0) return [];
  const n = words.length;

  const parent = Array.from({ length: n }, (_, i) => i);
  function find(i: number): number {
    while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i]; }
    return i;
  }
  function union(i: number, j: number) { parent[find(i)] = find(j); }

  const avgH     = words.reduce((s, w) => s + w.rect.height, 0) / n;
  const avgCharW = words.reduce((s, w) => s + w.rect.width / Math.max(w.text.length, 1), 0) / n;
  const hThresh  = avgCharW * 3;   // max horizontal gap to be "on the same line"
  const vThresh  = avgH * 2.5;     // max vertical gap for stacked annotations (dimension clusters)

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const a = words[i], b = words[j];

      // Don't group words with very different font sizes (titles vs body).
      const fsRatio = Math.max(a.fontSize, b.fontSize) / Math.min(a.fontSize, b.fontSize);
      if (fsRatio > 1.4) continue;

      const hGap = Math.max(0, Math.max(a.rect.x, b.rect.x) - Math.min(a.rect.x + a.rect.width,  b.rect.x + b.rect.width));
      const aCy  = a.rect.y + a.rect.height / 2;
      const bCy  = b.rect.y + b.rect.height / 2;
      const vGap = Math.max(0, Math.abs(aCy - bCy) - (a.rect.height + b.rect.height) / 2);

      if (hGap < hThresh && vGap < vThresh) union(i, j);
    }
  }

  // Collect clusters.
  const buckets = new Map<number, OcrWord[]>();
  for (let i = 0; i < n; i++) {
    const root = find(i);
    if (!buckets.has(root)) buckets.set(root, []);
    buckets.get(root)!.push(words[i]);
  }

  return Array.from(buckets.values()).map((cluster) => {
    // Sort top-to-bottom (Y descending in PDF space = closer to top of page),
    // then left-to-right within each row.
    cluster.sort((a, b) => {
      const dy = b.rect.y - a.rect.y;
      if (Math.abs(dy) > avgH * 0.4) return dy;
      return a.rect.x - b.rect.x;
    });

    // Group into rows: words with similar Y belong to the same row.
    const rows: OcrWord[][] = [];
    let row: OcrWord[] = [cluster[0]];
    for (let k = 1; k < cluster.length; k++) {
      const prev = cluster[k - 1];
      const curr = cluster[k];
      const dy   = Math.abs(prev.rect.y - curr.rect.y);
      if (dy > avgH * 0.4) { rows.push(row); row = []; }
      row.push(curr);
    }
    rows.push(row);

    // Structured rows: each row is an array of { text, fontSize } tokens.
    const ocrRows = rows.map((r) => r.map((w) => ({ text: w.text, fontSize: w.fontSize })));

    // Flat text for backward compat / search: rows joined by \n, words by space.
    const text = ocrRows.map((r) => r.map((t) => t.text).join(" ")).join("\n");

    const minX = Math.min(...cluster.map((w) => w.rect.x));
    const minY = Math.min(...cluster.map((w) => w.rect.y));
    const maxX = Math.max(...cluster.map((w) => w.rect.x + w.rect.width));
    const maxY = Math.max(...cluster.map((w) => w.rect.y + w.rect.height));
    const avgConf = cluster.reduce((s, w) => s + w.confidence, 0) / cluster.length;
    const fontSize = median(cluster.map((w) => w.fontSize));

    return {
      text,
      rect: { x: minX, y: minY, width: maxX - minX, height: maxY - minY },
      confidence: avgConf,
      fontSize,
      rows: ocrRows,
    };
  });
}

// ---------------------------------------------------------------------------
// Main entry point.
// ---------------------------------------------------------------------------
export async function runOcrOnPage(
  page: PDFPageProxy,
  opts: {
    lang?: string;
    charWhitelist?: string | null;
    onProgress?: (p: number) => void;
    onStatus?: (s: string) => void;
  } = {}
): Promise<OcrWord[]> {
  const {
    lang = "eng",
    charWhitelist = DEFAULT_CHAR_WHITELIST,
    onProgress,
    onStatus,
  } = opts;

  onStatus?.("Rendu de la page…");
  const viewport = page.getViewport({ scale: OCR_SCALE });
  const raw = document.createElement("canvas");
  raw.width = viewport.width;
  raw.height = viewport.height;
  await page.render({ canvas: raw, viewport }).promise;

  onStatus?.("Pré-traitement…");
  const canvas = preprocessCanvas(raw);

  onStatus?.("Chargement du moteur OCR…");
  const { createWorker, PSM } = await import("tesseract.js");

  const worker = await createWorker(lang, 1, {
    workerPath: `${TESS_BASE}/worker.min.js`,
    corePath: TESS_BASE,
    langPath: TESS_BASE,
    cacheMethod: "none",
    gzip: false,
    logger: (m: { status: string; progress: number }) => {
      if (onStatus) onStatus(m.status);
      if (m.status === "recognizing text" && onProgress) onProgress(m.progress);
    },
  });

  await worker.setParameters({
    // AUTO handles both structured documents (lists, paragraphs) and scattered
    // technical text. Logo noise is handled by our looksLikeText filter.
    tessedit_pageseg_mode: PSM.AUTO,
    preserve_interword_spaces: "1",
    ...(charWhitelist ? { tessedit_char_whitelist: charWhitelist } : {}),
  });

  onStatus?.("Reconnaissance…");
  const { data } = await worker.recognize(canvas, {}, { text: true, blocks: true, hocr: false, tsv: false });
  await worker.terminate();

  const pageHeightPt = page.getViewport({ scale: 1 }).height;
  const toPdfRect = (bb: TessBBox): PdfRect => ({
    x:      bb.x0 / OCR_SCALE,
    y:      pageHeightPt - bb.y1 / OCR_SCALE,
    width:  (bb.x1 - bb.x0) / OCR_SCALE,
    height: (bb.y1 - bb.y0) / OCR_SCALE,
  });

  const d = data as unknown as {
    blocks?: Array<{ paragraphs?: Array<{ lines?: TessLine[] }> }>;
    lines?: TessLine[];
    words?: TessWord[];
  };

  const allLines: TessLine[] = [];
  if (d.blocks?.length) {
    for (const b of d.blocks)
      for (const p of b.paragraphs ?? [])
        for (const l of p.lines ?? []) allLines.push(l);
  } else if (d.lines) {
    allLines.push(...d.lines);
  }

  // Extract word-level results with line-derived font sizes.
  // Using the LINE bbox height for all words on that line ensures consistent
  // font size regardless of whether a word is all-caps, all-lowercase, etc.
  const wordResults: OcrWord[] = [];

  const pageW = page.getViewport({ scale: 1 }).width;

  // Purely numeric tokens (e.g. list numbers "1.", "2.", digits in dimensions)
  // often get low Tesseract confidence — accept them unconditionally so they
  // are not silently dropped from lists and annotation blocks.
  const isNumericOnly = (s: string) => /^\d+\.?$/.test(s);

  if (allLines.length) {
    for (const line of allLines) {
      const lineRect = toPdfRect(line.bbox);
      const lineFontSize = lineRect.height * 0.88;
      for (const w of line.words ?? []) {
        const raw = w.text?.trim();
        if (!raw) continue;
        if (!isNumericOnly(raw) && w.confidence < CONF_WORD) continue;
        const rect = toPdfRect(w.bbox);
        if (!looksLikeText(raw, rect, pageW, pageHeightPt)) continue;
        const text = postProcess(raw);
        wordResults.push({ text, rect, confidence: w.confidence, fontSize: lineFontSize, rows: [[{ text, fontSize: lineFontSize }]] });
      }
    }
  } else {
    for (const w of (d.words ?? []) as TessWord[]) {
      const raw = w.text?.trim();
      if (!raw) continue;
      if (!isNumericOnly(raw) && w.confidence < CONF_WORD) continue;
      const rect = toPdfRect(w.bbox);
      if (!looksLikeText(raw, rect, pageW, pageHeightPt)) continue;
      const text = postProcess(raw);
      const fontSize = rect.height * 1.15;
      wordResults.push({ text, rect, confidence: w.confidence, fontSize, rows: [[{ text, fontSize }]] });
    }
  }

  // Font-size outlier filter: remove words that are either too large (watermark
  // fragments) or too small (illegibly tiny text that would be mangled when
  // re-drawn). Using 2.0× median keeps large-but-legitimate titles while
  // rejecting the outsized artifacts ("433", bold logo fragments).
  if (wordResults.length > 1) {
    const medFs = median(wordResults.map((w) => w.fontSize));
    wordResults.splice(
      0, wordResults.length,
      ...wordResults.filter((w) => w.fontSize >= 5 && w.fontSize <= medFs * 2.0),
    );
  }

  return clusterWords(wordResults);
}
