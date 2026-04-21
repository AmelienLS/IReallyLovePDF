import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { usePdfStore } from "../../store/usePdfStore";
import { useSaveDocument } from "../../hooks/useSaveDocument";

export function Toolbar() {
  const toolMode = usePdfStore((s) => s.toolMode);
  const setToolMode = usePdfStore((s) => s.setToolMode);
  const zoom = usePdfStore((s) => s.zoom);
  const setZoom = usePdfStore((s) => s.setZoom);
  const loadFile = usePdfStore((s) => s.loadFile);
  const isDirty = usePdfStore((s) => s.isDirty);
  const { doSave } = useSaveDocument();
  // pageCount not directly available here, derive from pageOrder
  const pageCount = usePdfStore((s) => s.pageOrder.length);

  const handleOpen = async () => {
    const selected = await open({
      multiple: false,
      filters: [{ name: "PDF", extensions: ["pdf"] }],
    });
    if (!selected) return;
    const path = typeof selected === "string" ? selected : selected[0];
    const bytes: number[] = await invoke("open_pdf", { path });
    const uint8 = new Uint8Array(bytes);
    // We need page count before loading into store — let PDF.js tell us via the loader
    // Temporarily load to get page count
    const { pdfjs } = await import("../../lib/pdfjs");
    const doc = await pdfjs.getDocument({ data: uint8.slice() }).promise;
    const count = doc.numPages;
    doc.destroy();
    loadFile(path, uint8, count);
  };

  return (
    <div
      style={{
        height: 52,
        background: "#1e293b",
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "0 16px",
        flexShrink: 0,
        borderBottom: "1px solid #0f172a",
      }}
    >
      <span style={{ color: "#e2e8f0", fontWeight: 700, fontSize: 15, marginRight: 8 }}>
        IReallyLovePDF
      </span>

      <ToolbarBtn onClick={handleOpen} label="📂 Ouvrir" />
      <ToolbarBtn
        onClick={() => doSave(false)}
        label={isDirty ? "💾 Sauvegarder*" : "💾 Sauvegarder"}
        disabled={pageCount === 0}
        highlight={isDirty}
      />
      <ToolbarBtn
        onClick={() => doSave(true)}
        label="💾 Sauvegarder sous..."
        disabled={pageCount === 0}
      />

      <div style={{ width: 1, height: 28, background: "#334155", margin: "0 4px" }} />

      {(["select", "text", "highlight"] as const).map((mode) => (
        <ToolbarBtn
          key={mode}
          onClick={() => setToolMode(mode)}
          label={
            mode === "select" ? "↖ Sélection" : mode === "text" ? "T Texte" : "🖊 Surligner"
          }
          active={toolMode === mode}
          disabled={pageCount === 0}
        />
      ))}

      <div style={{ width: 1, height: 28, background: "#334155", margin: "0 4px" }} />

      <button
        onClick={() => setZoom(zoom - 0.25)}
        disabled={zoom <= 0.5}
        style={btnStyle}
      >
        −
      </button>
      <span style={{ color: "#94a3b8", fontSize: 12, minWidth: 40, textAlign: "center" }}>
        {Math.round(zoom * 100)}%
      </span>
      <button
        onClick={() => setZoom(zoom + 0.25)}
        disabled={zoom >= 3}
        style={btnStyle}
      >
        +
      </button>

      {pageCount > 0 && (
        <span style={{ color: "#64748b", fontSize: 11, marginLeft: "auto" }}>
          {pageCount} page{pageCount > 1 ? "s" : ""}
          {isDirty ? " · non sauvegardé" : ""}
        </span>
      )}
    </div>
  );
}

const btnStyle: React.CSSProperties = {
  background: "#334155",
  border: "none",
  borderRadius: 4,
  color: "#e2e8f0",
  padding: "4px 10px",
  cursor: "pointer",
  fontSize: 13,
};

function ToolbarBtn({
  onClick,
  label,
  active,
  disabled,
  highlight,
}: {
  onClick: () => void;
  label: string;
  active?: boolean;
  disabled?: boolean;
  highlight?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        ...btnStyle,
        background: active ? "#2563eb" : highlight ? "#b45309" : "#334155",
        opacity: disabled ? 0.4 : 1,
        cursor: disabled ? "default" : "pointer",
        fontWeight: active ? 600 : 400,
      }}
    >
      {label}
    </button>
  );
}
