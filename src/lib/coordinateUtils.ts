import type { PDFPageProxy } from "pdfjs-dist";
import type { PdfRect } from "../store/types";

export function getViewport(page: PDFPageProxy, scale: number) {
  return page.getViewport({ scale });
}

/** Convert a PDF.js TextItem transform to a PdfRect in PDF coordinate space */
export function textItemToPdfRect(
  transform: number[],
  width: number
): PdfRect {
  const [, , , scaleY, tx, ty] = transform;
  const fontSize = Math.abs(scaleY);
  return { x: tx, y: ty, width, height: fontSize };
}

/** Convert a PdfRect (PDF space, origin bottom-left) to CSS pixels on the canvas */
export function pdfRectToCanvasStyle(
  rect: PdfRect,
  scale: number
): { left: number; top: number; width: number; height: number } {
  return {
    left: rect.x * scale,
    top: rect.y * scale,
    width: rect.width * scale,
    height: rect.height * scale,
  };
}

/** Convert canvas click coords to PDF point space */
export function canvasToPdfPoint(
  canvasX: number,
  canvasY: number,
  pageHeightPt: number,
  scale: number
): { x: number; y: number } {
  return {
    x: canvasX / scale,
    y: pageHeightPt - canvasY / scale,
  };
}

/** Convert a DOMRect (viewport pixels) to PdfRect using the page viewport */
export function domRectToPdfRect(
  domRect: DOMRect,
  containerEl: HTMLElement,
  pageHeightPt: number,
  scale: number
): PdfRect {
  const containerRect = containerEl.getBoundingClientRect();
  const relX = domRect.left - containerRect.left;
  const relY = domRect.top - containerRect.top;
  const x = relX / scale;
  const y = pageHeightPt - (relY + domRect.height) / scale;
  return {
    x,
    y,
    width: domRect.width / scale,
    height: domRect.height / scale,
  };
}
