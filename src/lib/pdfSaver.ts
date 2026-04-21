import {
  PDFDocument,
  StandardFonts,
  rgb,
  PDFPage,
} from "pdf-lib";
import type { EditRecord, TextEdit, NewTextBox, Highlight } from "../store/types";

function colorTuple(c: [number, number, number]) {
  return rgb(c[0], c[1], c[2]);
}

export async function buildDocument(
  rawBytes: Uint8Array,
  pageOrder: number[],
  edits: Record<string, EditRecord>
): Promise<Uint8Array> {
  const srcDoc = await PDFDocument.load(rawBytes);
  const outDoc = await PDFDocument.create();

  // Copy pages in the requested order
  const copiedPages = await outDoc.copyPages(srcDoc, pageOrder);
  for (const page of copiedPages) {
    outDoc.addPage(page);
  }

  // Embed a font for text edits / new text boxes
  const helvetica = await outDoc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await outDoc.embedFont(StandardFonts.HelveticaBold);

  const pages = outDoc.getPages();

  // Map original page index → new page index (after reorder)
  const originalToNew = new Map<number, number>();
  pageOrder.forEach((origIdx, newIdx) => {
    originalToNew.set(origIdx, newIdx);
  });

  for (const edit of Object.values(edits)) {
    const newPageIdx = originalToNew.get(edit.pageIndex);
    if (newPageIdx === undefined) continue;
    const page: PDFPage = pages[newPageIdx];
    page.getSize(); // ensure page is accessible

    if (edit.type === "text-replacement") {
      const e = edit as TextEdit;
      const r = e.originalRect;
      // Erase original text with white rect
      page.drawRectangle({
        x: r.x,
        y: r.y,
        width: r.width + 2,
        height: r.height + 2,
        color: rgb(1, 1, 1),
        borderWidth: 0,
      });
      if (e.newText.trim()) {
        page.drawText(e.newText, {
          x: r.x,
          y: r.y,
          size: Math.max(e.fontSize, 6),
          font: helvetica,
          color: colorTuple(e.color),
          maxWidth: r.width * 2,
        });
      }
    } else if (edit.type === "new-text") {
      const e = edit as NewTextBox;
      if (e.text.trim()) {
        page.drawText(e.text, {
          x: e.rect.x,
          y: e.rect.y,
          size: Math.max(e.fontSize, 6),
          font: e.fontFamily === "Helvetica-Bold" ? helveticaBold : helvetica,
          color: colorTuple(e.color),
          maxWidth: e.rect.width > 10 ? e.rect.width : undefined,
          lineHeight: e.fontSize * 1.2,
        });
      }
    } else if (edit.type === "highlight") {
      const e = edit as Highlight;
      for (const r of e.rects) {
        page.drawRectangle({
          x: r.x,
          y: r.y,
          width: r.width,
          height: r.height,
          color: colorTuple(e.color),
          opacity: e.opacity,
          borderWidth: 0,
        });
      }
    }
  }

  return outDoc.save();
}
