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

export function AnnotationLayer({ pageIndex, scale, pageHeightPt, width, height }: Props) {
  const edits = usePdfStore((s) => s.edits);
  const toolMode = usePdfStore((s) => s.toolMode);
  const activeEditId = usePdfStore((s) => s.activeEditId);
  const addNewTextBox = usePdfStore((s) => s.addNewTextBox);
  const updateEdit = usePdfStore((s) => s.updateEdit);
  const removeEdit = usePdfStore((s) => s.removeEdit);
  const layerRef = useRef<HTMLDivElement>(null);

  const pageEdits = Object.values(edits).filter((e) => e.pageIndex === pageIndex);

  const handleLayerClick = (e: React.MouseEvent) => {
    if (toolMode !== "text") return;
    const rect = layerRef.current!.getBoundingClientRect();
    const pdfX = (e.clientX - rect.left) / scale;
    const pdfY = pageHeightPt - (e.clientY - rect.top) / scale;
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
        top: 0, left: 0,
        width, height,
        pointerEvents: toolMode === "text" ? "auto" : "none",
        zIndex: 10,
      }}
    >
      {pageEdits.map((edit) => {
        /* ── Highlight ── */
        if (edit.type === "highlight") {
          const h = edit as Highlight;
          return h.rects.map((r, i) => (
            <div
              key={`${h.id}-${i}`}
              title="Double-clic pour supprimer"
              onDoubleClick={() => removeEdit(h.id)}
              style={{
                position: "absolute",
                left: r.x * scale,
                top: (pageHeightPt - r.y - r.height) * scale,
                width: r.width * scale,
                height: r.height * scale,
                background: `rgba(${(h.color[0]*255).toFixed()},${(h.color[1]*255).toFixed()},${(h.color[2]*255).toFixed()},${h.opacity})`,
                pointerEvents: "auto",
                cursor: "pointer",
                mixBlendMode: "multiply",
              }}
            />
          ));
        }

        /* ── Nouvelle zone de texte ── */
        if (edit.type === "new-text") {
          const nb = edit as NewTextBox;
          const r = nb.rect;
          const isActive = activeEditId === nb.id;
          return (
            <textarea
              key={nb.id}
              defaultValue={nb.text}
              placeholder="Tapez ici…"
              onChange={(e) => updateEdit(nb.id, { text: e.target.value } as Partial<NewTextBox>)}
              onDoubleClick={(e) => e.stopPropagation()}
              style={{
                position: "absolute",
                left: r.x * scale,
                top: (pageHeightPt - r.y - r.height) * scale,
                width: r.width * scale,
                minHeight: r.height * scale,
                fontSize: nb.fontSize * scale,
                fontFamily: "var(--font-sans)",
                border: isActive ? "1.5px solid var(--accent)" : "1px dashed var(--border-input)",
                borderRadius: "var(--radius-sm)",
                background: "var(--bg-card)",
                padding: "3px 6px",
                resize: "both",
                pointerEvents: "auto",
                zIndex: 15,
                outline: "none",
                boxShadow: isActive ? "0 0 0 3px var(--accent-light)" : "none",
                color: `rgb(${(nb.color[0]*255).toFixed()},${(nb.color[1]*255).toFixed()},${(nb.color[2]*255).toFixed()})`,
                userSelect: "text",
              }}
            />
          );
        }

        /* ── Remplacement de texte (indicateur visuel) ── */
        if (edit.type === "text-replacement") {
          const te = edit as TextEdit;
          const r = te.originalRect;
          return (
            <div
              key={te.id}
              title={`"${te.originalText}" → "${te.newText}" — double-clic pour annuler`}
              onDoubleClick={() => removeEdit(te.id)}
              style={{
                position: "absolute",
                left: r.x * scale,
                top: (pageHeightPt - r.y - r.height) * scale,
                width: r.width * scale,
                height: r.height * scale,
                background: "var(--accent-light)",
                border: "1px solid var(--accent)",
                borderRadius: 2,
                opacity: 0.6,
                pointerEvents: "auto",
                cursor: "pointer",
                zIndex: 5,
              }}
            />
          );
        }

        return null;
      })}
    </div>
  );
}
