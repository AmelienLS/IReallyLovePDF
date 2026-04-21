import { useEffect, useRef } from "react";
import type { PDFPageProxy } from "pdfjs-dist";

interface Props {
  page: PDFPageProxy;
  scale: number;
  onSize?: (w: number, h: number) => void;
}

export function CanvasLayer({ page, scale, onSize }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const renderTaskRef = useRef<{ cancel: () => void } | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    renderTaskRef.current?.cancel();

    const viewport = page.getViewport({ scale });
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    onSize?.(viewport.width, viewport.height);

    const task = page.render({ canvas, viewport });
    renderTaskRef.current = task;

    task.promise.catch((e) => {
      if (e?.name !== "RenderingCancelledException") console.error(e);
    });

    return () => {
      renderTaskRef.current?.cancel();
    };
  }, [page, scale]);

  return <canvas ref={canvasRef} style={{ display: "block" }} />;
}
