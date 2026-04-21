import type { PDFPageProxy } from "pdfjs-dist";
import type { PdfRect } from "../store/types";

export interface OcrWord {
  text: string;
  rect: PdfRect; // PDF coordinate space (origin bottom-left)
  confidence: number;
  fontSize: number; // in PDF points
}

const OCR_SCALE = 3; // render at 3× for better OCR accuracy

export async function runOcrOnPage(
  page: PDFPageProxy,
  lang: string = "fra+eng",
  onProgress?: (p: number) => void
): Promise<OcrWord[]> {
  const viewport = page.getViewport({ scale: OCR_SCALE });
  const canvas = document.createElement("canvas");
  canvas.width = viewport.width;
  canvas.height = viewport.height;

  await page.render({ canvas, viewport }).promise;

  // Dynamic import so the bundle only loads tesseract on demand
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker(lang, 1, {
    logger: (m) => {
      if (m.status === "recognizing text" && onProgress) onProgress(m.progress);
    },
  });

  const { data } = await worker.recognize(canvas);
  await worker.terminate();

  const pageHeightPt = page.getViewport({ scale: 1 }).height;
  const words: OcrWord[] = [];

  const rawWords = (data as { words?: Array<{ text: string; bbox: { x0: number; y0: number; x1: number; y1: number }; confidence: number }> }).words ?? [];

  for (const w of rawWords) {
    const text = w.text?.trim();
    if (!text) continue;
    if (w.confidence < 30) continue;

    const { x0, y0, x1, y1 } = w.bbox;
    const pdfX = x0 / OCR_SCALE;
    const pdfY = pageHeightPt - y1 / OCR_SCALE;
    const width = (x1 - x0) / OCR_SCALE;
    const height = (y1 - y0) / OCR_SCALE;

    words.push({
      text,
      rect: { x: pdfX, y: pdfY, width, height },
      confidence: w.confidence,
      fontSize: height,
    });
  }
  return words;
}
