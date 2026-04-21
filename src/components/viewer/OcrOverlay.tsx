import { useState } from "react";
import { usePdfStore } from "../../store/usePdfStore";

interface Props {
  pageIndex: number;
  scale: number;
  pageHeightPt: number;
  width: number;
  height: number;
}

/**
 * Affiche les zones OCR détectées comme des rectangles pointillés visibles,
 * cliquables pour ouvrir l'éditeur de texte. Rendu déclaratif en JSX — pas
 * de manipulation DOM asynchrone, donc pas de race condition sur les styles.
 */
export function OcrOverlay({ pageIndex, scale, pageHeightPt, width, height }: Props) {
  const ocrWords = usePdfStore((s) => s.ocrWords[pageIndex]);
  const toolMode = usePdfStore((s) => s.toolMode);
  const edits = usePdfStore((s) => s.edits);
  const beginTextEdit = usePdfStore((s) => s.beginTextEdit);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  if (!ocrWords || ocrWords.length === 0) return null;
  if (toolMode !== "select") return null;

  // Zones déjà transformées en text-replacement → on les cache pour éviter les doublons
  const consumed = new Set(
    Object.values(edits)
      .filter((e) => e.type === "text-replacement" && e.pageIndex === pageIndex)
      .map((e) => {
        const r = (e as { originalRect: { x: number; y: number; width: number; height: number } }).originalRect;
        return `${r.x.toFixed(2)},${r.y.toFixed(2)},${r.width.toFixed(2)},${r.height.toFixed(2)}`;
      })
  );

  const handleClick = (idx: number) => {
    const w = ocrWords[idx];
    beginTextEdit(
      {
        str: w.text,
        transform: [w.fontSize, 0, 0, w.fontSize, w.rect.x, w.rect.y],
        width: w.rect.width,
        height: w.rect.height,
        fontName: "ocr",
      },
      pageIndex,
      w.rect
    );
  };

  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width,
        height,
        pointerEvents: "none",
        zIndex: 14,
      }}
    >
      {ocrWords.map((w, i) => {
        const r = w.rect;
        const rectKey = `${r.x.toFixed(2)},${r.y.toFixed(2)},${r.width.toFixed(2)},${r.height.toFixed(2)}`;
        if (consumed.has(rectKey)) return null;
        const left = r.x * scale;
        const top = (pageHeightPt - r.y - r.height) * scale;
        const boxW = Math.max(r.width * scale, 6);
        const boxH = Math.max(r.height * scale, 10);
        const isHover = hoverIdx === i;

        return (
          <div
            key={i}
            role="button"
            tabIndex={0}
            title={`« ${w.text} » (OCR, ${Math.round(w.confidence)}%) — clic pour éditer`}
            onMouseEnter={() => setHoverIdx(i)}
            onMouseLeave={() => setHoverIdx((x) => (x === i ? null : x))}
            onClick={(e) => { e.stopPropagation(); handleClick(i); }}
            style={{
              position: "absolute",
              left,
              top,
              width: boxW,
              height: boxH,
              boxSizing: "border-box",
              border: isHover ? "2px solid #ff9500" : "1.5px dashed #ff9500",
              borderRadius: 2,
              background: isHover ? "rgba(255,149,0,0.38)" : "rgba(255,149,0,0.18)",
              boxShadow: isHover
                ? "0 0 0 3px rgba(255,149,0,0.25), 0 2px 8px rgba(255,149,0,0.35)"
                : "none",
              pointerEvents: "auto",
              cursor: "pointer",
              transition: "background 0.12s ease, border-color 0.12s ease, box-shadow 0.12s ease",
              zIndex: isHover ? 2 : 1,
            }}
          />
        );
      })}
    </div>
  );
}
