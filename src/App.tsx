import { usePdfStore } from "./store/usePdfStore";
import { usePdfLoader } from "./hooks/usePdfLoader";
import { Toolbar } from "./components/layout/Toolbar";
import { PdfViewer } from "./components/viewer/PdfViewer";
import { PageThumbnailList } from "./components/sidebar/PageThumbnailList";

export default function App() {
  const rawBytes = usePdfStore((s) => s.rawBytes);
  const { docRef, loading, error } = usePdfLoader(rawBytes);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden" }}>
      <Toolbar />

      {loading && <Center><Spinner /></Center>}

      {error && (
        <Center>
          <div style={{
            background: "var(--red-bg)",
            color: "var(--red)",
            borderRadius: "var(--radius-md)",
            padding: "12px 20px",
            fontSize: 13,
          }}>
            Erreur : {error}
          </div>
        </Center>
      )}

      {!loading && !error && !rawBytes && (
        <Center>
          <div style={{ textAlign: "center", color: "var(--text-tertiary)" }}>
            <div style={{ fontSize: 52, marginBottom: 12, opacity: 0.5 }}>📄</div>
            <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)", marginBottom: 6 }}>
              Ouvrez un PDF pour commencer
            </div>
            <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>
              Cliquez sur "Ouvrir" dans la barre d'outils
            </div>
          </div>
        </Center>
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

function Center({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      flex: 1,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "var(--bg-window)",
    }}>
      {children}
    </div>
  );
}

function Spinner() {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
      <div style={{
        width: 20, height: 20,
        border: "2px solid var(--border)",
        borderTop: "2px solid var(--accent)",
        borderRadius: "50%",
        animation: "spin 0.8s linear infinite",
      }} />
      <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>Chargement…</span>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
