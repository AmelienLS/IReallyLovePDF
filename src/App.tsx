import { usePdfStore } from "./store/usePdfStore";
import { usePdfLoader } from "./hooks/usePdfLoader";
import { Toolbar } from "./components/layout/Toolbar";
import { PdfViewer } from "./components/viewer/PdfViewer";
import { PageThumbnailList } from "./components/sidebar/PageThumbnailList";

export default function App() {
  const rawBytes = usePdfStore((s) => s.rawBytes);
  const { docRef, loading, error } = usePdfLoader(rawBytes);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        fontFamily: "system-ui, sans-serif",
        overflow: "hidden",
      }}
    >
      <Toolbar />

      {loading && (
        <div style={centerStyle}>Chargement du PDF...</div>
      )}

      {error && (
        <div style={{ ...centerStyle, color: "#ef4444" }}>
          Erreur : {error}
        </div>
      )}

      {!loading && !error && !rawBytes && (
        <div style={centerStyle}>
          <div style={{ textAlign: "center", color: "#64748b" }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>📄</div>
            <div style={{ fontSize: 18, fontWeight: 600 }}>Ouvrez un PDF pour commencer</div>
            <div style={{ fontSize: 13, marginTop: 8 }}>
              Cliquez sur "📂 Ouvrir" dans la barre d'outils
            </div>
          </div>
        </div>
      )}

      {!loading && !error && rawBytes && docRef.current && (
        <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
          <PageThumbnailList doc={docRef.current} />
          <PdfViewer doc={docRef.current} />
        </div>
      )}
    </div>
  );
}

const centerStyle: React.CSSProperties = {
  flex: 1,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "#f8fafc",
};
