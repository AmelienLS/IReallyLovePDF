import type { PDFPageProxy } from "pdfjs-dist";
import type { PdfRect } from "../store/types";

export interface OcrWord {
  text: string;
  rect: PdfRect; // PDF coordinate space (origin bottom-left)
  confidence: number;
  fontSize: number; // in PDF points
}

const OCR_SCALE = 3; // render at 3× for better OCR accuracy

/**
 * Base URL for tesseract assets served from public/tesseract/.
 * Works both in Vite dev (http://localhost:1420/) and in Tauri production
 * (tauri://localhost/ or http://tauri.localhost/) because `public/` is copied to `dist/`.
 */
const TESS_BASE = "/tesseract";

interface TessBBox { x0: number; y0: number; x1: number; y1: number }
interface TessSymbol { text: string; bbox: TessBBox; confidence: number }
interface TessWord { text: string; bbox: TessBBox; confidence: number; symbols?: TessSymbol[] }
interface TessLine { text: string; bbox: TessBBox; confidence: number; words: TessWord[] }

/**
 * Granularité de découpage du texte reconnu en zones éditables :
 * - "symbol" : un caractère par zone (idéal pour modifier une valeur de cote chiffre par chiffre)
 * - "word"   : un mot par zone (idéal pour des labels courts)
 * - "line"   : une ligne par zone (idéal pour des paragraphes)
 */
export type OcrGranularity = "symbol" | "word" | "line";

/**
 * Jeu de caractères ASCII imprimables adapté aux dessins techniques :
 * chiffres, lettres, ponctuation courante et symboles métriques (°, ±, ×, µ, Ø).
 */
export const DEFAULT_CHAR_WHITELIST =
  "0123456789" +
  "ABCDEFGHIJKLMNOPQRSTUVWXYZ" +
  "abcdefghijklmnopqrstuvwxyz" +
  " .,:;-_+=/()[]{}<>*#%&@!?\"'" +
  "°±×µ∅ØÆæ";

export async function runOcrOnPage(
  page: PDFPageProxy,
  opts: {
    lang?: string;
    granularity?: OcrGranularity;
    charWhitelist?: string | null; // null = pas de restriction
    onProgress?: (p: number) => void;
    onStatus?: (s: string) => void;
  } = {}
): Promise<OcrWord[]> {
  const {
    lang = "eng",
    granularity = "symbol",
    charWhitelist = DEFAULT_CHAR_WHITELIST,
    onProgress,
    onStatus,
  } = opts;

  onStatus?.("Rendu de la page…");
  const viewport = page.getViewport({ scale: OCR_SCALE });
  const canvas = document.createElement("canvas");
  canvas.width = viewport.width;
  canvas.height = viewport.height;

  await page.render({ canvas, viewport }).promise;

  // Dynamic import so the bundle only loads tesseract on demand
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

  // PSM.AUTO (3) = fully automatic page segmentation; good default.
  // Whitelist ASCII pour les dessins techniques → meilleure précision (pas de caractères exotiques parasites).
  const params: Record<string, string | number> = {
    tessedit_pageseg_mode: PSM.AUTO,
    preserve_interword_spaces: "1",
  };
  if (charWhitelist) params.tessedit_char_whitelist = charWhitelist;
  await worker.setParameters(params);

  onStatus?.("Reconnaissance…");
  // v7 requires explicit `output.blocks: true` to get the block/paragraph/line/word tree.
  const { data } = await worker.recognize(
    canvas,
    {},
    { text: true, blocks: true, hocr: false, tsv: false }
  );
  await worker.terminate();

  const pageHeightPt = page.getViewport({ scale: 1 }).height;

  const toPdfRect = (bb: TessBBox): PdfRect => {
    const pdfX = bb.x0 / OCR_SCALE;
    const pdfY = pageHeightPt - bb.y1 / OCR_SCALE;
    const width = (bb.x1 - bb.x0) / OCR_SCALE;
    const height = (bb.y1 - bb.y0) / OCR_SCALE;
    return { x: pdfX, y: pdfY, width, height };
  };

  // tesseract.js v7 returns `blocks`, not top-level `words`/`lines`.
  // Walk the hierarchy: blocks -> paragraphs -> lines -> words.
  const d = data as unknown as {
    blocks?: Array<{
      paragraphs?: Array<{
        lines?: Array<TessLine>;
      }>;
    }>;
    // Older versions may still expose these at top level:
    lines?: Array<TessLine>;
    words?: Array<TessWord>;
  };

  const allLines: TessLine[] = [];
  if (d.blocks && d.blocks.length) {
    for (const b of d.blocks) {
      for (const p of b.paragraphs ?? []) {
        for (const l of p.lines ?? []) allLines.push(l);
      }
    }
  } else if (d.lines) {
    allLines.push(...d.lines);
  }

  const results: OcrWord[] = [];

  if (granularity === "symbol") {
    // Caractère par caractère — chaque symbole devient une zone cliquable indépendante.
    for (const line of allLines) {
      for (const w of line.words ?? []) {
        for (const s of w.symbols ?? []) {
          const text = s.text;
          if (!text || !text.trim()) continue;
          if (s.confidence < 30) continue;
          const rect = toPdfRect(s.bbox);
          results.push({
            text,
            rect,
            confidence: s.confidence,
            // Le bbox Tesseract colle au glyphe (pas d'ascendants/descendants) ;
            // on majore pour retrouver la vraie taille de police en points.
            fontSize: rect.height * 1.35,
          });
        }
      }
    }
  } else if (granularity === "line") {
    for (const line of allLines) {
      const text = line.text?.replace(/\s+$/g, "").trim();
      if (!text) continue;
      if (line.confidence < 30) continue;
      const rect = toPdfRect(line.bbox);
      results.push({
        text,
        rect,
        confidence: line.confidence,
        fontSize: rect.height * 1.15,
      });
    }
  } else {
    // word granularity — prefer hierarchical walk for consistency with fallback
    const allWords: TessWord[] = [];
    if (allLines.length) {
      for (const l of allLines) for (const w of l.words ?? []) allWords.push(w);
    } else if (d.words) {
      allWords.push(...d.words);
    }
    for (const w of allWords) {
      const text = w.text?.trim();
      if (!text) continue;
      if (w.confidence < 30) continue;
      const rect = toPdfRect(w.bbox);
      results.push({
        text,
        rect,
        confidence: w.confidence,
        fontSize: rect.height * 1.15,
      });
    }
  }

  return results;
}
