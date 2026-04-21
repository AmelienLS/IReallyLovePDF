import { useEffect, useRef } from "react";
import { usePdfStore } from "../../store/usePdfStore";
import type { TextEdit } from "../../store/types";

interface Props {
  edit: TextEdit;
  scale: number;
  pageHeightPt: number;
}

export function EditOverlay({ edit, scale, pageHeightPt }: Props) {
  const commitTextEdit = usePdfStore((s) => s.commitTextEdit);
  const removeEdit = usePdfStore((s) => s.removeEdit);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const r = edit.originalRect;
  const left = r.x * scale;
  const bottom = r.y * scale;
  const top = pageHeightPt * scale - bottom - r.height * scale;
  const width = Math.max(r.width * scale, 80);
  const fontSize = Math.max(r.height * scale * 0.9, 8);

  useEffect(() => {
    textareaRef.current?.focus();
    textareaRef.current?.select();
  }, []);

  const commit = () => {
    const val = textareaRef.current?.value ?? "";
    commitTextEdit(edit.id, val);
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      removeEdit(edit.id);
    }
    e.stopPropagation();
  };

  return (
    <textarea
      ref={textareaRef}
      defaultValue={edit.newText}
      onBlur={commit}
      onKeyDown={handleKey}
      style={{
        position: "absolute",
        left,
        top,
        width,
        minHeight: r.height * scale + 4,
        fontSize,
        fontFamily: "Helvetica, Arial, sans-serif",
        border: "2px solid #2563eb",
        background: "rgba(255,255,255,0.95)",
        padding: "1px 2px",
        resize: "both",
        zIndex: 20,
        outline: "none",
        lineHeight: 1.2,
        color: `rgb(${(edit.color[0] * 255).toFixed()},${(edit.color[1] * 255).toFixed()},${(edit.color[2] * 255).toFixed()})`,
        boxShadow: "0 0 0 3px rgba(37,99,235,0.2)",
      }}
    />
  );
}
