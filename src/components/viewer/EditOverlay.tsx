import { useEffect, useRef } from "react";
import { usePdfStore } from "../../store/usePdfStore";
import type { TextEdit } from "../../store/types";

interface Props {
  edit: TextEdit;
  scale: number;
  pageHeightPt: number;
}

export function EditOverlay({ edit, scale, pageHeightPt }: Props) {
  const updateEdit = usePdfStore((s) => s.updateEdit);
  const commitTextEdit = usePdfStore((s) => s.commitTextEdit);
  const removeEdit = usePdfStore((s) => s.removeEdit);
  const ref = useRef<HTMLTextAreaElement>(null);

  const r = edit.originalRect;
  const left = r.x * scale;
  const top  = pageHeightPt * scale - (r.y + r.height) * scale;
  const w    = Math.max(r.width  * scale, 32);
  const h    = Math.max(r.height * scale, 18);
  const fontSize = Math.max(edit.fontSize * scale, 8);
  const color    = `rgb(${(edit.color[0] * 255).toFixed()},${(edit.color[1] * 255).toFixed()},${(edit.color[2] * 255).toFixed()})`;

  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, []);

  const handleKey = (e: React.KeyboardEvent) => {
    e.stopPropagation();
    if (e.key === "Escape") removeEdit(edit.id);
    // Shift+Enter = newline (native); plain Enter = commit.
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      commitTextEdit(edit.id, edit.newText);
    }
  };

  return (
    <textarea
      ref={ref}
      value={edit.newText}
      onChange={(e) => updateEdit(edit.id, { newText: e.target.value })}
      onBlur={() => commitTextEdit(edit.id, edit.newText)}
      onKeyDown={handleKey}
      onClick={(e) => e.stopPropagation()}
      rows={Math.max((edit.newText.match(/\n/g)?.length ?? 0) + 1, 1)}
      style={{
        position: "absolute",
        left,
        top,
        width: w,
        minHeight: h,
        fontSize,
        fontFamily: `"Helvetica Neue", Helvetica, Arial, sans-serif`,
        fontWeight: 400,
        letterSpacing: "0.01em",
        lineHeight: 1.2,
        border: "1.5px solid var(--accent)",
        background: "#fff",
        borderRadius: 2,
        padding: 0,
        margin: 0,
        zIndex: 20,
        outline: "none",
        resize: "none",
        overflow: "hidden",
        color,
        boxShadow: "0 0 0 3px var(--accent-light)",
        userSelect: "text",
        boxSizing: "border-box",
        whiteSpace: "pre",
      }}
    />
  );
}
