import type { PDFDocumentProxy } from "pdfjs-dist";
import { usePdfStore } from "../../store/usePdfStore";
import { PageRenderer } from "./PageRenderer";

interface Props {
  doc: PDFDocumentProxy;
}

export function PdfViewer({ doc }: Props) {
  const pageOrder = usePdfStore((s) => s.pageOrder);
  const zoom = usePdfStore((s) => s.zoom);

  return (
    <div
      style={{
        flex: 1,
        overflowY: "auto",
        background: "#e2e8f0",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 32,
        padding: "32px 24px 64px",
      }}
    >
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
