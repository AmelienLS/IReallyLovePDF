import { useEffect, useRef } from "react";
import { usePdfStore } from "../../store/usePdfStore";
import type { TextEdit } from "../../store/types";

interface Props {
  edit: TextEdit;
  scale: number;
  pageHeightPt: number;
}

/**
 * Éditeur de texte en place (input contrôlé). À chaque frappe, `updateEdit`
 * patche le store → l'aperçu WYSIWYG dans AnnotationLayer se met à jour en
 * direct (même police, même taille, fond blanc couvrant l'original).
 */
export function EditOverlay({ edit, scale, pageHeightPt }: Props) {
  const updateEdit = usePdfStore((s) => s.updateEdit);
  const commitTextEdit = usePdfStore((s) => s.commitTextEdit);
  const removeEdit = usePdfStore((s) => s.removeEdit);
  const inputRef = useRef<HTMLInputElement>(null);

  const r = edit.originalRect;
  const left = r.x * scale;
  const top = pageHeightPt * scale - (r.y + r.height) * scale;
  const width = Math.max(r.width * scale, 32);
  const height = r.height * scale;
  const fontSize = Math.max(edit.fontSize * scale, 8);
  const color = `rgb(${(edit.color[0] * 255).toFixed()},${(edit.color[1] * 255).toFixed()},${(edit.color[2] * 255).toFixed()})`;

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const handleKey = (e: React.KeyboardEvent) => {
    e.stopPropagation();
    if (e.key === "Escape") removeEdit(edit.id);
    if (e.key === "Enter") commitTextEdit(edit.id, edit.newText);
  };

  return (
    <input
      ref={inputRef}
      type="text"
      value={edit.newText}
      onChange={(e) => updateEdit(edit.id, { newText: e.target.value })}
      onBlur={() => commitTextEdit(edit.id, edit.newText)}
      onKeyDown={handleKey}
      onClick={(e) => e.stopPropagation()}
      style={{
        position: "absolute",
        left,
        top,
        width,
        height,
        fontSize,
        fontFamily: `"Helvetica Neue", Helvetica, Arial, sans-serif`,
        fontWeight: 400,
        letterSpacing: "0.01em",
        border: "1.5px solid var(--accent)",
        background: "#fff",
        borderRadius: 2,
        padding: 0,
        margin: 0,
        zIndex: 20,
        outline: "none",
        lineHeight: 1,
        color,
        boxShadow: "0 0 0 3px var(--accent-light)",
        userSelect: "text",
        textAlign: "left",
        boxSizing: "border-box",
      }}
    />
  );
}
