import { useEffect, useRef } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { PDFDocumentProxy } from "pdfjs-dist";

interface Props {
  doc: PDFDocumentProxy;
  origPageIndex: number;
  displayIndex: number;
}

export function PageThumbnail({ doc, origPageIndex, displayIndex }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: String(origPageIndex) });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let cancelled = false;

    doc.getPage(origPageIndex + 1).then((page) => {
      if (cancelled) return;
      const viewport = page.getViewport({ scale: 0.18 });
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      page.render({ canvas, viewport }).promise.catch(() => {});
    });

    return () => {
      cancelled = true;
    };
  }, [doc, origPageIndex]);

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
        cursor: "grab",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 4,
        padding: "6px 4px",
        borderRadius: 6,
        background: isDragging ? "#dbeafe" : "transparent",
      }}
    >
      <canvas
        ref={canvasRef}
        style={{
          boxShadow: "0 1px 4px rgba(0,0,0,0.2)",
          borderRadius: 2,
          maxWidth: 110,
        }}
      />
      <span style={{ fontSize: 10, color: "#64748b" }}>{displayIndex + 1}</span>
    </div>
  );
}
