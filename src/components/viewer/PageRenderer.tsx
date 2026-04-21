import { useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy, PDFPageProxy } from "pdfjs-dist";
import { CanvasLayer } from "./CanvasLayer";
import { TextLayer } from "./TextLayer";
import { AnnotationLayer } from "./AnnotationLayer";
import { EditOverlay } from "./EditOverlay";
import { usePdfStore } from "../../store/usePdfStore";
import type { TextEdit } from "../../store/types";
import { runOcrOnPage } from "../../lib/ocr";

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
  const [textCount, setTextCount] = useState<number | null>(null);
  const [ocrProgress, setOcrProgress] = useState<number>(0);
  const toolMode = usePdfStore((s) => s.toolMode);
  const activeEditId = usePdfStore((s) => s.activeEditId);
  const edits = usePdfStore((s) => s.edits);
  const ocrWords = usePdfStore((s) => s.ocrWords[pageIndex]);
  const ocrRunning = usePdfStore((s) => s.ocrRunning[pageIndex]);
  const setOcrWords = usePdfStore((s) => s.setOcrWords);
  const setOcrRunning = usePdfStore((s) => s.setOcrRunning);
  const prevPage = useRef<PDFPageProxy | null>(null);

  const handleRunOcr = async () => {
    if (!page || ocrRunning) return;
    setOcrRunning(pageIndex, true);
    setOcrProgress(0);
    try {
      const words = await runOcrOnPage(page, "fra+eng", (p) => setOcrProgress(p));
      setOcrWords(pageIndex, words);
    } catch (e) {
      console.error("OCR failed:", e);
      alert("L'OCR a échoué : " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setOcrRunning(pageIndex, false);
    }
  };

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
            <AnnotationLayer pageIndex={pageIndex} scale={scale} pageHeightPt={pageHeightPt} width={canvasSize.w} height={canvasSize.h} />
            <TextLayer page={page} pageIndex={pageIndex} scale={scale} width={canvasSize.w} height={canvasSize.h} onTextCount={setTextCount} />
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
        {toolMode === "select" && textCount !== null && (
          <span style={{
            marginLeft: 8,
            color: textCount === 0 ? "var(--danger, #d32f2f)" : "var(--text-tertiary)",
          }}>
            · {textCount === 0
              ? "aucun texte extractible (PDF vectorisé / scanné)"
              : `${textCount} zone${textCount > 1 ? "s" : ""} éditable${textCount > 1 ? "s" : ""}`}
            {ocrWords && ocrWords.length > 0 && (
              <span style={{ marginLeft: 6, color: "#ff9500" }}>
                · OCR : {ocrWords.length} mot{ocrWords.length > 1 ? "s" : ""}
              </span>
            )}
          </span>
        )}
        {toolMode === "select" && (
          <div style={{ marginTop: 6, display: "flex", justifyContent: "center", gap: 8 }}>
            <button
              className="btn-secondary"
              onClick={handleRunOcr}
              disabled={ocrRunning}
              style={{ fontSize: 11, padding: "3px 10px" }}
              title="Détecte le texte par reconnaissance optique (utile pour PDF vectorisés / scannés)"
            >
              {ocrRunning
                ? `OCR… ${Math.round(ocrProgress * 100)}%`
                : ocrWords
                  ? "Relancer l'OCR"
                  : "Lancer l'OCR sur cette page"}
            </button>
            {ocrWords && !ocrRunning && (
              <button
                className="btn-secondary"
                onClick={() => setOcrWords(pageIndex, [])}
                style={{ fontSize: 11, padding: "3px 10px" }}
              >
                Effacer l'OCR
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
