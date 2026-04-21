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
      if (cancelled) {
        p.cleanup();
        return;
      }
      prevPage.current?.cleanup();
      prevPage.current = p;
      setPage(p);
      const vp = p.getViewport({ scale: 1 });
      setPageHeightPt(vp.height);
    });
    return () => {
      cancelled = true;
    };
  }, [doc, pdfPageNumber]);

  if (!page) {
    return (
      <div
        style={{
          width: 600,
          height: 800,
          background: "#f1f5f9",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#94a3b8",
          fontSize: 14,
        }}
      >
        Chargement...
      </div>
    );
  }

  const activeEdit =
    activeEditId && edits[activeEditId]?.type === "text-replacement"
      ? (edits[activeEditId] as TextEdit)
      : null;

  const isActiveOnThisPage = activeEdit?.pageIndex === pageIndex;

  return (
    <div
      style={{
        position: "relative",
        width: canvasSize.w,
        height: canvasSize.h,
        boxShadow: "0 4px 24px rgba(0,0,0,0.18)",
        background: "#fff",
        flexShrink: 0,
      }}
    >
      <CanvasLayer
        page={page}
        scale={scale}
        onSize={(w, h) => setCanvasSize({ w, h })}
      />
      {canvasSize.w > 0 && (
        <>
          <TextLayer
            page={page}
            pageIndex={pageIndex}
            scale={scale}
            width={canvasSize.w}
            height={canvasSize.h}
          />
          <AnnotationLayer
            pageIndex={pageIndex}
            scale={scale}
            pageHeightPt={pageHeightPt}
            width={canvasSize.w}
            height={canvasSize.h}
          />
          {isActiveOnThisPage && activeEdit && (
            <EditOverlay
              edit={activeEdit}
              scale={scale}
              pageHeightPt={pageHeightPt}
            />
          )}
        </>
      )}
      <div
        style={{
          position: "absolute",
          bottom: -20,
          left: 0,
          right: 0,
          textAlign: "center",
          fontSize: 11,
          color: "#94a3b8",
        }}
      >
        {pageIndex + 1}
      </div>
    </div>
  );
}
