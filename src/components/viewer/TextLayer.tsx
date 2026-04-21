import { useEffect, useRef } from "react";
import type { PDFPageProxy } from "pdfjs-dist";
import type { TextItem as PdfjsTextItem } from "pdfjs-dist/types/src/display/api";
import { usePdfStore } from "../../store/usePdfStore";
import { textItemToPdfRect } from "../../lib/coordinateUtils";

interface Props {
  page: PDFPageProxy;
  pageIndex: number;
  scale: number;
  width: number;
  height: number;
}

export function TextLayer({ page, pageIndex, scale, width, height }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const toolMode = usePdfStore((s) => s.toolMode);
  const beginTextEdit = usePdfStore((s) => s.beginTextEdit);
  const addHighlight = usePdfStore((s) => s.addHighlight);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    container.innerHTML = "";

    const viewport = page.getViewport({ scale });

    page.getTextContent().then((tc) => {
      if (!containerRef.current) return;

      for (const item of tc.items as PdfjsTextItem[]) {
        if (!item.str.trim()) continue;

        const span = document.createElement("span");
        span.textContent = item.str;

        const [a, b, , , e, f] = item.transform;
        const tx = viewport.transform;
        const canvasX = tx[0] * e + tx[2] * f + tx[4];
        const canvasY = tx[1] * e + tx[3] * f + tx[5];
        const fontSize = Math.sqrt(a * a + b * b) * scale;

        span.style.cssText = `
          position: absolute;
          left: ${canvasX}px;
          top: ${canvasY - fontSize}px;
          font-size: ${fontSize}px;
          font-family: sans-serif;
          white-space: pre;
          color: transparent;
          cursor: ${toolMode === "select" ? "text" : toolMode === "highlight" ? "crosshair" : "default"};
          user-select: ${toolMode === "highlight" ? "text" : "none"};
          pointer-events: auto;
          transform-origin: 0 100%;
        `;

        span.addEventListener("click", (ev) => {
          ev.stopPropagation();
          if (toolMode !== "select") return;
          const rect = textItemToPdfRect(item.transform, item.width);
          beginTextEdit(
            {
              str: item.str,
              transform: item.transform,
              width: item.width,
              height: item.height ?? fontSize / scale,
              fontName: item.fontName ?? "",
            },
            pageIndex,
            rect
          );
        });

        container.appendChild(span);
      }
    });
  }, [page, scale, toolMode]);

  // Highlight on mouse up
  useEffect(() => {
    if (toolMode !== "highlight") return;
    const container = containerRef.current;
    if (!container) return;

    const pageHeightPt = page.getViewport({ scale: 1 }).height;

    const onMouseUp = () => {
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) return;
      const range = sel.getRangeAt(0);
      const domRects = Array.from(range.getClientRects());
      if (domRects.length === 0) return;

      const containerBound = container.getBoundingClientRect();
      const pdfRects = domRects.map((dr) => ({
        x: (dr.left - containerBound.left) / scale,
        y: pageHeightPt - (dr.bottom - containerBound.top) / scale,
        width: dr.width / scale,
        height: dr.height / scale,
      }));

      addHighlight({
        type: "highlight",
        pageIndex,
        rects: pdfRects,
        color: [1, 0.85, 0],
        opacity: 0.4,
      });

      sel.removeAllRanges();
    };

    container.addEventListener("mouseup", onMouseUp);
    return () => container.removeEventListener("mouseup", onMouseUp);
  }, [toolMode, page, scale, pageIndex, addHighlight]);

  return (
    <div
      ref={containerRef}
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width,
        height,
        overflow: "hidden",
        pointerEvents: toolMode === "select" || toolMode === "highlight" ? "auto" : "none",
      }}
    />
  );
}
