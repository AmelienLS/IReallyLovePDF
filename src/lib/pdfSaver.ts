import {
  PDFDocument,
  PDFFont,
  StandardFonts,
  rgb,
  PDFPage,
} from "pdf-lib";
import type { EditRecord, TextEdit, NewTextBox, Highlight, OcrRow } from "../store/types";

function colorTuple(c: [number, number, number]) {
  return rgb(c[0], c[1], c[2]);
}

// ---------------------------------------------------------------------------
// Draw one text-replacement zone, handling:
//   - single-line and multi-line clusters (\n separated)
//   - per-word font sizes from ocrRows
//   - y-origin at the TOP of the bbox (matching the CSS flex-start preview)
// ---------------------------------------------------------------------------
function drawTextReplacement(page: PDFPage, e: TextEdit, font: PDFFont) {
  const r = e.originalRect;

  // Erase original: add a small margin so thin strokes on the border are covered.
  page.drawRectangle({
    x: r.x - 1,
    y: r.y - 1,
    width:  r.width  + 2,
    height: r.height + 2,
    color: rgb(1, 1, 1),
    borderWidth: 0,
  });

  if (!e.newText.trim()) return;

  const color = colorTuple(e.color);

  if (e.ocrRows?.length) {
    // Structured rows with per-word font sizes.
    // Preview uses CSS flex-column with lineHeight:1.2. With Helvetica metrics
    // (cap-height 0.718, descenders 0.207) and lineHeight 1.2, the first-row
    // baseline falls at ~0.82 × fontSize below the container top (0.718 cap +
    // 0.1 half-leading = 0.818). Using 1.0 × fontSize shifts text too low by
    // ~0.18 × fontSize, causing the GUI/save mismatch.
    let curY    = r.y + r.height;
    let isFirst = true;

    for (const row of e.ocrRows) {
      if (!row.length) continue;

      const rowFontSize = Math.max(...row.map((t) => t.fontSize), 4);
      const lineHeight  = rowFontSize * 1.2;

      // First row: 0.82 × fontSize to match CSS cap-height positioning.
      // Subsequent rows: full fontSize advance (baseline-to-baseline = lineHeight).
      curY -= isFirst ? rowFontSize * 0.82 : rowFontSize;
      isFirst = false;

      let curX = r.x;
      for (let ti = 0; ti < row.length; ti++) {
        const token = row[ti];
        const text  = ti > 0 ? ` ${token.text}` : token.text;
        const size  = Math.max(token.fontSize, 4);
        page.drawText(text, { x: curX, y: curY, size, font, color });
        curX += font.widthOfTextAtSize(text, size);
      }

      // Inter-line gap beyond the fontSize already consumed.
      curY -= lineHeight - rowFontSize;
    }
  } else {
    // Simple fallback: single font size, split on \n.
    const lines      = e.newText.split("\n");
    const fontSize   = Math.max(e.fontSize, 4);
    const lineHeight = fontSize * 1.2;

    // Same 0.82 cap-height correction for the fallback path.
    let curY = r.y + r.height - fontSize * 0.82;

    for (const line of lines) {
      if (line.trim()) {
        page.drawText(line, { x: r.x, y: curY, size: fontSize, font, color });
      }
      curY -= lineHeight;
    }
  }
}

// ---------------------------------------------------------------------------
// Main entry point.
// ---------------------------------------------------------------------------
export async function buildDocument(
  rawBytes: Uint8Array,
  pageOrder: number[],
  edits: Record<string, EditRecord>
): Promise<Uint8Array> {
  const srcDoc = await PDFDocument.load(rawBytes);
  const outDoc = await PDFDocument.create();

  const copiedPages = await outDoc.copyPages(srcDoc, pageOrder);
  for (const page of copiedPages) outDoc.addPage(page);

  const helvetica     = await outDoc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await outDoc.embedFont(StandardFonts.HelveticaBold);

  const pages = outDoc.getPages();

  const originalToNew = new Map<number, number>();
  pageOrder.forEach((origIdx, newIdx) => originalToNew.set(origIdx, newIdx));

  for (const edit of Object.values(edits)) {
    const newPageIdx = originalToNew.get(edit.pageIndex);
    if (newPageIdx === undefined) continue;
    const page: PDFPage = pages[newPageIdx];

    if (edit.type === "text-replacement") {
      drawTextReplacement(page, edit as TextEdit, helvetica);

    } else if (edit.type === "new-text") {
      const e = edit as NewTextBox;
      if (e.text.trim()) {
        const font     = e.fontFamily === "Helvetica-Bold" ? helveticaBold : helvetica;
        const fontSize = Math.max(e.fontSize, 4);
        page.drawText(e.text, {
          x: e.rect.x,
          y: e.rect.y,
          size: fontSize,
          font,
          color: colorTuple(e.color),
          maxWidth:   e.rect.width > 10 ? e.rect.width : undefined,
          lineHeight: fontSize * 1.2,
        });
      }

    } else if (edit.type === "highlight") {
      const e = edit as Highlight;
      for (const r of e.rects) {
        page.drawRectangle({
          x: r.x, y: r.y,
          width: r.width, height: r.height,
          color: colorTuple(e.color),
          opacity: e.opacity,
          borderWidth: 0,
        });
      }
    }
  }

  return outDoc.save();
}
