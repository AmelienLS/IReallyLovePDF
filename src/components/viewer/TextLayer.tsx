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

interface ItemRecord {
  el: HTMLSpanElement;
  item: PdfjsTextItem;
  fontSize: number;
}

export function TextLayer({ page, pageIndex, scale, width, height }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const recordsRef = useRef<ItemRecord[]>([]);
  const toolMode = usePdfStore((s) => s.toolMode);
  const beginTextEdit = usePdfStore((s) => s.beginTextEdit);
  const addHighlight = usePdfStore((s) => s.addHighlight);

  // Build/rebuild spans when page or scale change (NOT on every toolMode change)
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    container.innerHTML = "";
    recordsRef.current = [];

    const viewport = page.getViewport({ scale });
    let cancelled = false;

    page.getTextContent().then((tc) => {
      if (cancelled || !containerRef.current) return;

      for (const item of tc.items as PdfjsTextItem[]) {
        if (!item.str || !item.str.trim()) continue;

        const [a, b, , , e, f] = item.transform;
        const tx = viewport.transform;
        const canvasX = tx[0] * e + tx[2] * f + tx[4];
        const canvasY = tx[1] * e + tx[3] * f + tx[5];
        const fontSize = Math.sqrt(a * a + b * b) * scale;
        const spanWidth = item.width * scale;

        const span = document.createElement("span");
        span.textContent = item.str;
        span.className = "pdf-text-span";
        span.style.cssText = `
          position: absolute;
          left: ${canvasX}px;
          top: ${canvasY - fontSize}px;
          width: ${spanWidth}px;
          height: ${fontSize * 1.2}px;
          font-size: ${fontSize}px;
          line-height: 1;
          font-family: sans-serif;
          white-space: pre;
          color: transparent;
          transform-origin: 0 0;
        `;

        container.appendChild(span);
        recordsRef.current.push({ el: span, item, fontSize });
      }
    });

    return () => { cancelled = true; };
  }, [page, scale]);

  // Update cursor / user-select / hover effect based on toolMode (no rebuild)
  useEffect(() => {
    for (const { el } of recordsRef.current) {
      el.style.cursor =
        toolMode === "select" ? "text" :
        toolMode === "highlight" ? "text" : "default";
      el.style.userSelect = toolMode === "highlight" ? "text" : "none";
      el.style.background = "transparent";
    }
  }, [toolMode]);

  // Click handler via event delegation — uses event.target at call time (fresh toolMode)
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const onClick = (ev: MouseEvent) => {
      if (toolMode !== "select") return;
      const target = ev.target as HTMLElement;
      const rec = recordsRef.current.find((r) => r.el === target);
      if (!rec) return;
      ev.stopPropagation();
      ev.preventDefault();
      const rect = textItemToPdfRect(rec.item.transform, rec.item.width);
      beginTextEdit(
        {
          str: rec.item.str,
          transform: rec.item.transform,
          width: rec.item.width,
          height: rec.item.height ?? rec.fontSize / scale,
          fontName: rec.item.fontName ?? "",
        },
        pageIndex,
        rect
      );
    };

    const onOver = (ev: MouseEvent) => {
      if (toolMode !== "select") return;
      const target = ev.target as HTMLElement;
      if (recordsRef.current.some((r) => r.el === target)) {
        target.style.background = "rgba(0,122,255,0.15)";
      }
    };
    const onOut = (ev: MouseEvent) => {
      const target = ev.target as HTMLElement;
      if (recordsRef.current.some((r) => r.el === target)) {
        target.style.background = "transparent";
      }
    };

    container.addEventListener("click", onClick);
    container.addEventListener("mouseover", onOver);
    container.addEventListener("mouseout", onOut);
    return () => {
      container.removeEventListener("click", onClick);
      container.removeEventListener("mouseover", onOver);
      container.removeEventListener("mouseout", onOut);
    };
  }, [toolMode, pageIndex, scale, beginTextEdit]);

  // Highlight via text selection
  useEffect(() => {
    if (toolMode !== "highlight") return;
    const container = containerRef.current;
    if (!container) return;

    const pageHeightPt = page.getViewport({ scale: 1 }).height;

    const onMouseUp = () => {
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return;
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
        zIndex: 12,
      }}
    />
  );
}
