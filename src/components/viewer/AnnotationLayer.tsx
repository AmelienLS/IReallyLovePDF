import { useRef } from "react";
import { usePdfStore } from "../../store/usePdfStore";
import type { NewTextBox, Highlight, TextEdit } from "../../store/types";

interface Props {
  pageIndex: number;
  scale: number;
  pageHeightPt: number;
  width: number;
  height: number;
}

export function AnnotationLayer({
  pageIndex,
  scale,
  pageHeightPt,
  width,
  height,
}: Props) {
  const edits = usePdfStore((s) => s.edits);
  const toolMode = usePdfStore((s) => s.toolMode);
  const activeEditId = usePdfStore((s) => s.activeEditId);
  const addNewTextBox = usePdfStore((s) => s.addNewTextBox);
  const updateEdit = usePdfStore((s) => s.updateEdit);
  const removeEdit = usePdfStore((s) => s.removeEdit);
  const layerRef = useRef<HTMLDivElement>(null);

  const pageEdits = Object.values(edits).filter(
    (e) => e.pageIndex === pageIndex
  );

  const handleLayerClick = (e: React.MouseEvent) => {
    if (toolMode !== "text") return;
    const rect = layerRef.current!.getBoundingClientRect();
    const canvasX = e.clientX - rect.left;
    const canvasY = e.clientY - rect.top;
    const pdfX = canvasX / scale;
    const pdfY = pageHeightPt - canvasY / scale;

    addNewTextBox({
      type: "new-text",
      pageIndex,
      rect: { x: pdfX, y: pdfY - 14, width: 200, height: 20 },
      text: "",
      fontSize: 14,
      fontFamily: "Helvetica",
      color: [0, 0, 0],
    });
  };

  return (
    <div
      ref={layerRef}
      onClick={handleLayerClick}
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width,
        height,
        pointerEvents: toolMode === "text" ? "auto" : "none",
        zIndex: 10,
      }}
    >
      {pageEdits.map((edit) => {
        if (edit.type === "highlight") {
          const h = edit as Highlight;
          return h.rects.map((r, i) => (
            <div
              key={`${h.id}-${i}`}
              style={{
                position: "absolute",
                left: r.x * scale,
                top: (pageHeightPt - r.y - r.height) * scale,
                width: r.width * scale,
                height: r.height * scale,
                background: `rgba(${(h.color[0] * 255).toFixed()},${(h.color[1] * 255).toFixed()},${(h.color[2] * 255).toFixed()},${h.opacity})`,
                pointerEvents: "auto",
                cursor: "pointer",
              }}
              onDoubleClick={() => removeEdit(h.id)}
              title="Double-clic pour supprimer"
            />
          ));
        }

        if (edit.type === "new-text") {
          const nb = edit as NewTextBox;
          const r = nb.rect;
          const top = (pageHeightPt - r.y - r.height) * scale;
          const isActive = activeEditId === nb.id;
          return (
            <textarea
              key={nb.id}
              defaultValue={nb.text}
              placeholder="Tapez ici..."
              onChange={(e) =>
                updateEdit(nb.id, { text: e.target.value } as Partial<NewTextBox>)
              }
              onDoubleClick={(e) => e.stopPropagation()}
              style={{
                position: "absolute",
                left: r.x * scale,
                top,
                width: r.width * scale,
                minHeight: r.height * scale,
                fontSize: nb.fontSize * scale,
                fontFamily: "Helvetica, Arial, sans-serif",
                border: isActive ? "2px solid #2563eb" : "1px dashed #94a3b8",
                background: "rgba(255,255,255,0.9)",
                padding: "2px 4px",
                resize: "both",
                pointerEvents: "auto",
                zIndex: 15,
                outline: "none",
                color: `rgb(${(nb.color[0] * 255).toFixed()},${(nb.color[1] * 255).toFixed()},${(nb.color[2] * 255).toFixed()})`,
              }}
            />
          );
        }

        // text-replacement: show a subtle indicator on the original position
        if (edit.type === "text-replacement") {
          const te = edit as TextEdit;
          const r = te.originalRect;
          return (
            <div
              key={te.id}
              title={`"${te.originalText}" → "${te.newText}"`}
              style={{
                position: "absolute",
                left: r.x * scale,
                top: (pageHeightPt - r.y - r.height) * scale,
                width: r.width * scale,
                height: r.height * scale,
                background: "rgba(37,99,235,0.08)",
                border: "1px solid rgba(37,99,235,0.3)",
                pointerEvents: "auto",
                cursor: "pointer",
                zIndex: 5,
              }}
              onDoubleClick={() => removeEdit(te.id)}
            />
          );
        }

        return null;
      })}
    </div>
  );
}
