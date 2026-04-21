import { useEffect, useRef } from "react";
import type { PDFPageProxy } from "pdfjs-dist";
import type { TextItem as PdfjsTextItem } from "pdfjs-dist/types/src/display/api";
import { usePdfStore } from "../../store/usePdfStore";
import { textItemToPdfRect } from "../../lib/coordinateUtils";
import type { ToolMode } from "../../store/types";

interface Props {
  page: PDFPageProxy;
  pageIndex: number;
  scale: number;
  width: number;
  height: number;
  onTextCount?: (count: number) => void;
}

interface ItemRecord {
  el: HTMLSpanElement;
  item: PdfjsTextItem;
  fontSize: number;
  isOcr: boolean;
}

function applyIdleStyle(el: HTMLElement, isOcr: boolean, mode: ToolMode) {
  el.style.transition = "background 0.12s ease, outline-color 0.12s ease, box-shadow 0.12s ease";
  el.style.borderRadius = "2px";
  el.style.boxShadow = "none";
  el.style.zIndex = "";
  if (mode === "select") {
    el.style.cursor = "pointer";
    el.style.userSelect = "none";
    el.style.background = isOcr ? "rgba(255,149,0,0.15)" : "rgba(0,122,255,0.10)";
    el.style.outline = isOcr ? "1.5px dashed #ff9500" : "1.5px dashed #007aff";
    el.style.outlineOffset = "1px";
  } else if (mode === "highlight") {
    el.style.cursor = "text";
    el.style.userSelect = "text";
    el.style.background = "transparent";
    el.style.outline = "none";
    el.style.outlineOffset = "0";
  } else {
    el.style.cursor = "default";
    el.style.userSelect = "none";
    el.style.background = "transparent";
    el.style.outline = "none";
    el.style.outlineOffset = "0";
  }
}

function applyHoverStyle(el: HTMLElement, isOcr: boolean) {
  el.style.background = isOcr ? "rgba(255,149,0,0.38)" : "rgba(0,122,255,0.28)";
  el.style.outline = isOcr ? "2px solid #ff9500" : "2px solid #007aff";
  el.style.boxShadow = isOcr
    ? "0 0 0 3px rgba(255,149,0,0.25), 0 2px 8px rgba(255,149,0,0.35)"
    : "0 0 0 3px rgba(0,122,255,0.20), 0 2px 8px rgba(0,122,255,0.30)";
  el.style.zIndex = "2";
}

export function TextLayer({ page, pageIndex, scale, width, height, onTextCount }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const recordsRef = useRef<ItemRecord[]>([]);
  const toolMode = usePdfStore((s) => s.toolMode);
  const toolModeRef = useRef(toolMode);
  toolModeRef.current = toolMode;
  const beginTextEdit = usePdfStore((s) => s.beginTextEdit);
  const addHighlight = usePdfStore((s) => s.addHighlight);

  // Build/rebuild spans when page or scale changes
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    container.innerHTML = "";
    recordsRef.current = [];

    const viewport = page.getViewport({ scale });
    let cancelled = false;

    const appendSpan = (
      left: number,
      top: number,
      w: number,
      h: number,
      fontSize: number,
      text: string,
      item: PdfjsTextItem,
      isOcr: boolean
    ) => {
      const span = document.createElement("span");
      span.textContent = text;
      span.title = isOcr ? `« ${text} » (OCR) — clic pour éditer` : `« ${text} » — clic pour éditer`;
      span.className = isOcr ? "pdf-text-span pdf-text-span--ocr" : "pdf-text-span";
      span.style.cssText = `
        position: absolute;
        left: ${left}px;
        top: ${top}px;
        width: ${w}px;
        height: ${h}px;
        font-size: ${fontSize}px;
        line-height: 1;
        font-family: sans-serif;
        white-space: pre;
        color: transparent;
        transform-origin: 0 0;
        box-sizing: border-box;
      `;
      // Apply the current-mode styling immediately so the outline is visible as soon as the span is in the DOM.
      applyIdleStyle(span, isOcr, toolModeRef.current);
      container.appendChild(span);
      recordsRef.current.push({ el: span, item, fontSize, isOcr });
    };

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

        appendSpan(canvasX, canvasY - fontSize, spanWidth, fontSize * 1.2, fontSize, item.str, item, false);
      }

      onTextCount?.(recordsRef.current.length);
    });

    return () => { cancelled = true; };
  }, [page, scale]);

  // Re-apply idle styling when toolMode changes (no rebuild)
  useEffect(() => {
    for (const { el, isOcr } of recordsRef.current) {
      applyIdleStyle(el, isOcr, toolMode);
    }
  }, [toolMode]);

  // Click / hover handlers via delegation — read latest toolMode at call time.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const onClick = (ev: MouseEvent) => {
      if (toolModeRef.current !== "select") return;
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
      if (toolModeRef.current !== "select") return;
      const target = ev.target as HTMLElement;
      const rec = recordsRef.current.find((r) => r.el === target);
      if (!rec) return;
      applyHoverStyle(target, rec.isOcr);
    };
    const onOut = (ev: MouseEvent) => {
      const target = ev.target as HTMLElement;
      const rec = recordsRef.current.find((r) => r.el === target);
      if (!rec) return;
      applyIdleStyle(target, rec.isOcr, toolModeRef.current);
    };

    container.addEventListener("click", onClick);
    container.addEventListener("mouseover", onOver);
    container.addEventListener("mouseout", onOut);
    return () => {
      container.removeEventListener("click", onClick);
      container.removeEventListener("mouseover", onOver);
      container.removeEventListener("mouseout", onOut);
    };
  }, [pageIndex, scale, beginTextEdit]);

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
