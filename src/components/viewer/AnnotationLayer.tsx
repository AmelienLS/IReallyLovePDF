import { useRef } from "react";
import { usePdfStore } from "../../store/usePdfStore";
import type { NewTextBox, Highlight, TextEdit, OcrRow } from "../../store/types";

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
  const setActiveEdit = usePdfStore((s) => s.setActiveEdit);
  const layerRef = useRef<HTMLDivElement>(null);

  const pageEdits = Object.values(edits).filter((e) => e.pageIndex === pageIndex);

  const handleLayerClick = (e: React.MouseEvent) => {
    if (toolMode !== "text") return;
    if (e.target !== layerRef.current) return;
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

  // Delete button shared style
  const deleteBtnStyle: React.CSSProperties = {
    position: "absolute",
    top: -10,
    right: -10,
    width: 20,
    height: 20,
    borderRadius: "50%",
    background: "var(--accent)",
    color: "#fff",
    border: "1.5px solid #fff",
    fontSize: 11,
    lineHeight: 1,
    cursor: "pointer",
    pointerEvents: "auto",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 0,
    boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
    zIndex: 2,
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
            <div
              key={nb.id}
              style={{
                position: "absolute",
                left: r.x * scale,
                top: (pageHeightPt - r.y - r.height) * scale,
                pointerEvents: "auto",
                zIndex: 15,
              }}
            >
              <textarea
                defaultValue={nb.text}
                placeholder="Tapez ici…"
                autoFocus={isActive && nb.text === ""}
                onFocus={() => setActiveEdit(nb.id)}
                onChange={(e) => updateEdit(nb.id, { text: e.target.value } as Partial<NewTextBox>)}
                onClick={(e) => e.stopPropagation()}
                onDoubleClick={(e) => e.stopPropagation()}
                style={{
                  width: r.width * scale,
                  minHeight: r.height * scale,
                  fontSize: nb.fontSize * scale,
                  fontFamily: "var(--font-sans)",
                  border: isActive ? "1.5px solid var(--accent)" : "1px dashed var(--border-input)",
                  borderRadius: "var(--radius-sm)",
                  background: "var(--bg-card)",
                  padding: "3px 6px",
                  resize: "both",
                  outline: "none",
                  boxShadow: isActive ? "0 0 0 3px var(--accent-light)" : "none",
                  color: `rgb(${(nb.color[0]*255).toFixed()},${(nb.color[1]*255).toFixed()},${(nb.color[2]*255).toFixed()})`,
                  userSelect: "text",
                  display: "block",
                }}
              />
              {isActive && (
                <button
                  type="button"
                  title="Supprimer cette zone"
                  onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); removeEdit(nb.id); }}
                  style={deleteBtnStyle}
                >
                  ×
                </button>
              )}
            </div>
          );
        }

        /* ── Remplacement de texte (aperçu WYSIWYG live) ── */
        if (edit.type === "text-replacement") {
          const te = edit as TextEdit;
          const r = te.originalRect;
          const isActive = activeEditId === te.id;
          const color = `rgb(${(te.color[0]*255).toFixed()},${(te.color[1]*255).toFixed()},${(te.color[2]*255).toFixed()})`;
          const rows: OcrRow[] | undefined = te.ocrRows;
          return (
            <div
              key={te.id}
              title={`"${te.originalText}" → "${te.newText}" — clic pour éditer`}
              style={{
                position: "absolute",
                left: r.x * scale,
                top: (pageHeightPt - r.y - r.height) * scale,
                width: r.width * scale,
                height: r.height * scale,
                background: "#fff",
                border: isActive ? "none" : "1px dashed var(--accent)",
                borderRadius: 2,
                pointerEvents: "auto",
                cursor: "pointer",
                zIndex: isActive ? 19 : 5,
                overflow: "hidden",
                fontFamily: `"Helvetica Neue", Helvetica, Arial, sans-serif`,
                fontWeight: 400,
                display: "flex",
                flexDirection: "column",
                justifyContent: "flex-start",
                padding: 0,
                boxSizing: "border-box",
              }}
              onClick={(e) => { e.stopPropagation(); setActiveEdit(te.id); }}
            >
              {!isActive && rows
                ? rows.map((row, ri) => (
                    <div key={ri} style={{ display: "flex", flexWrap: "nowrap", whiteSpace: "pre", lineHeight: 1.2 }}>
                      {row.map((token, ti) => (
                        <span key={ti} style={{ fontSize: Math.max(token.fontSize * scale, 8), color, letterSpacing: "0.01em" }}>
                          {ti > 0 ? " " : ""}{token.text}
                        </span>
                      ))}
                    </div>
                  ))
                : !isActive && (
                    <span style={{ fontSize: Math.max(te.fontSize * scale, 8), color, whiteSpace: "pre", lineHeight: 1.2 }}>
                      {te.newText}
                    </span>
                  )}
              {isActive && (
                <button
                  type="button"
                  title="Annuler cette modification"
                  onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); removeEdit(te.id); }}
                  style={deleteBtnStyle}
                >
                  ×
                </button>
              )}
            </div>
          );
        }

        return null;
      })}
    </div>
  );
}
