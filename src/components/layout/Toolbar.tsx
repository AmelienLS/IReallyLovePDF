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
  const pageCount = usePdfStore((s) => s.pageOrder.length);
  const { doSave } = useSaveDocument();

  const handleOpen = async () => {
    const selected = await open({
      multiple: false,
      filters: [{ name: "PDF", extensions: ["pdf"] }],
    });
    if (!selected) return;
    const path = typeof selected === "string" ? selected : selected[0];
    const bytes: number[] = await invoke("open_pdf", { path });
    const uint8 = new Uint8Array(bytes);
    const { pdfjs } = await import("../../lib/pdfjs");
    const doc = await pdfjs.getDocument({ data: uint8.slice() }).promise;
    const count = doc.numPages;
    doc.destroy();
    loadFile(path, uint8, count);
  };

  const tools = [
    { id: "select"    as const, label: "Sélection",  icon: "↖" },
    { id: "text"      as const, label: "Texte",       icon: "T" },
    { id: "highlight" as const, label: "Surligner",   icon: "✦" },
  ];

  return (
    <div style={{
      height: "var(--titlebar-height)",
      background: "var(--bg-card)",
      borderBottom: "0.5px solid var(--separator)",
      display: "flex",
      alignItems: "center",
      gap: 6,
      padding: "0 16px",
      flexShrink: 0,
    }}>
      <span style={{
        fontSize: 13,
        fontWeight: 600,
        color: "var(--text-primary)",
        marginRight: 8,
        letterSpacing: "-0.01em",
      }}>
        IReallyLovePDF
      </span>

      <Sep />

      {/* File actions */}
      <div style={{ display: "flex", gap: 4 }}>
        <button className="btn-secondary" onClick={handleOpen}>
          Ouvrir
        </button>
        <button
          className="btn-secondary"
          onClick={() => doSave(false)}
          disabled={pageCount === 0}
          style={isDirty ? { color: "var(--accent)" } : {}}
        >
          {isDirty ? "Sauvegarder •" : "Sauvegarder"}
        </button>
        <button
          className="btn-secondary"
          onClick={() => doSave(true)}
          disabled={pageCount === 0}
        >
          Sauvegarder sous…
        </button>
      </div>

      {pageCount > 0 && (
        <>
          <Sep />

          {/* Tool mode — tab-bar style */}
          <div style={{
            display: "flex",
            background: "var(--bg-grouped)",
            borderRadius: "var(--radius-md)",
            padding: 3,
            gap: 2,
          }}>
            {tools.map(({ id, label, icon }) => (
              <button
                key={id}
                onClick={() => setToolMode(id)}
                style={{
                  background: toolMode === id ? "var(--accent)" : "transparent",
                  color: toolMode === id ? "#fff" : "var(--text-secondary)",
                  borderRadius: "var(--radius-sm)",
                  padding: "4px 12px",
                  fontSize: 12,
                  fontWeight: 500,
                  border: "none",
                  boxShadow: toolMode === id ? "0 1px 3px rgba(0,0,0,0.12)" : "none",
                  transition: "all 0.15s ease",
                  gap: 5,
                }}
              >
                <span style={{ fontSize: 11 }}>{icon}</span> {label}
              </button>
            ))}
          </div>
        </>
      )}

      <Sep />

      {/* Zoom */}
      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
        <button
          className="btn-secondary"
          style={{ padding: "4px 10px", fontSize: 15, lineHeight: 1 }}
          onClick={() => setZoom(zoom - 0.25)}
          disabled={zoom <= 0.5}
        >
          −
        </button>
        <span style={{ fontSize: 12, color: "var(--text-secondary)", minWidth: 36, textAlign: "center" }}>
          {Math.round(zoom * 100)}%
        </span>
        <button
          className="btn-secondary"
          style={{ padding: "4px 10px", fontSize: 15, lineHeight: 1 }}
          onClick={() => setZoom(zoom + 0.25)}
          disabled={zoom >= 3}
        >
          +
        </button>
      </div>

      {pageCount > 0 && (
        <span style={{
          marginLeft: "auto",
          fontSize: 11,
          color: "var(--text-tertiary)",
        }}>
          {pageCount} page{pageCount > 1 ? "s" : ""}
        </span>
      )}
    </div>
  );
}

function Sep() {
  return (
    <div style={{
      width: 1, height: 20,
      background: "var(--separator)",
      margin: "0 2px",
      flexShrink: 0,
    }} />
  );
}
