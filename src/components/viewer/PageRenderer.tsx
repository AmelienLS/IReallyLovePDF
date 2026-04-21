import { useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy, PDFPageProxy } from "pdfjs-dist";
import { CanvasLayer } from "./CanvasLayer";
import { TextLayer } from "./TextLayer";
import { AnnotationLayer } from "./AnnotationLayer";
import { EditOverlay } from "./EditOverlay";
import { usePdfStore } from "../../store/usePdfStore";
import type { TextEdit } from "../../store/types";

interface Props {
  doc: PDFDocumentProxy;
  pageIndex: number;
  pdfPageNumber: number;
  scale: number;
}

export function PageRenderer({ doc, pageIndex, pdfPageNumber, scale }: Props) {
  const [page, setPage] = useState<PDFPageProxy | null>(null);
  const [canvasSize, setCanvasSize] = useState({ w: 0, h: 0 });
  const [pageHeightPt, setPageHeightPt] = useState(0);
  const activeEditId = usePdfStore((s) => s.activeEditId);
  const edits = usePdfStore((s) => s.edits);
  const prevPage = useRef<PDFPageProxy | null>(null);

  useEffect(() => {
    let cancelled = false;
    doc.getPage(pdfPageNumber).then((p) => {
      if (cancelled) { p.cleanup(); return; }
      prevPage.current?.cleanup();
      prevPage.current = p;
      setPage(p);
      setPageHeightPt(p.getViewport({ scale: 1 }).height);
    });
    return () => { cancelled = true; };
  }, [doc, pdfPageNumber]);

  if (!page) {
    return (
      <div style={{
        width: 595,
        height: 842,
        background: "var(--bg-card)",
        borderRadius: "var(--radius-lg)",
        boxShadow: "var(--shadow-card)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "var(--text-tertiary)",
        fontSize: 13,
      }}>
        Chargement…
      </div>
    );
  }

  const activeEdit =
    activeEditId && edits[activeEditId]?.type === "text-replacement"
      ? (edits[activeEditId] as TextEdit)
      : null;
  const isActiveOnThisPage = activeEdit?.pageIndex === pageIndex;

  return (
    <div style={{ position: "relative" }}>
      <div style={{
        position: "relative",
        width: canvasSize.w,
        height: canvasSize.h,
        boxShadow: "0 2px 16px rgba(0,0,0,0.10), 0 0.5px 1px rgba(0,0,0,0.06)",
        borderRadius: "var(--radius-sm)",
        background: "#fff",
        overflow: "hidden",
        flexShrink: 0,
      }}>
        <CanvasLayer page={page} scale={scale} onSize={(w, h) => setCanvasSize({ w, h })} />
        {canvasSize.w > 0 && (
          <>
            <TextLayer page={page} pageIndex={pageIndex} scale={scale} width={canvasSize.w} height={canvasSize.h} />
            <AnnotationLayer pageIndex={pageIndex} scale={scale} pageHeightPt={pageHeightPt} width={canvasSize.w} height={canvasSize.h} />
            {isActiveOnThisPage && activeEdit && (
              <EditOverlay edit={activeEdit} scale={scale} pageHeightPt={pageHeightPt} />
            )}
          </>
        )}
      </div>
      {/* Page number badge */}
      <div style={{
        textAlign: "center",
        marginTop: 8,
        fontSize: 11,
        color: "var(--text-tertiary)",
        fontVariantNumeric: "tabular-nums",
      }}>
        {pageIndex + 1}
      </div>
    </div>
  );
}
