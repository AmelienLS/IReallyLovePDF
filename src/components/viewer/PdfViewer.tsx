import { useEffect } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { usePdfStore } from "../../store/usePdfStore";
import { PageRenderer } from "./PageRenderer";

interface Props {
  doc: PDFDocumentProxy;
}

export function PdfViewer({ doc }: Props) {
  const pageOrder = usePdfStore((s) => s.pageOrder);
  const zoom = usePdfStore((s) => s.zoom);
  const activeEditId = usePdfStore((s) => s.activeEditId);
  const edits = usePdfStore((s) => s.edits);
  const removeEdit = usePdfStore((s) => s.removeEdit);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Delete" && e.key !== "Backspace") return;
      if (!activeEditId) return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "TEXTAREA" || tag === "INPUT") return;
      const ed = edits[activeEditId];
      if (!ed) return;
      if (ed.type === "text-replacement" || ed.type === "new-text" || ed.type === "highlight") {
        e.preventDefault();
        removeEdit(activeEditId);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [activeEditId, edits, removeEdit]);

  return (
    <div style={{
      flex: 1,
      overflowY: "auto",
      background: "var(--bg-grouped)",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: 28,
      padding: "28px 24px 64px",
    }}>
      {pageOrder.map((origIdx, displayIdx) => (
        <PageRenderer
          key={`${origIdx}-${displayIdx}`}
          doc={doc}
          pageIndex={displayIdx}
          pdfPageNumber={origIdx + 1}
          scale={zoom}
        />
      ))}
    </div>
  );
}
