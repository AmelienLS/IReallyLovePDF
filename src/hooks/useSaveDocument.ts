import { useCallback, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";
import { usePdfStore } from "../store/usePdfStore";
import { buildDocument } from "../lib/pdfSaver";

export function useSaveDocument() {
  const { filePath, rawBytes, pageOrder, edits, isDirty, markClean } =
    usePdfStore();

  const doSave = useCallback(
    async (saveAs = false) => {
      if (!rawBytes) return;

      let targetPath = filePath;

      if (saveAs || !targetPath) {
        const chosen = await save({
          filters: [{ name: "PDF", extensions: ["pdf"] }],
          defaultPath: filePath ?? undefined,
        });
        if (!chosen) return;
        targetPath = chosen;
      }

      try {
        const bytes = await buildDocument(rawBytes, pageOrder, edits);
        await invoke("save_pdf", {
          path: targetPath,
          bytes: Array.from(bytes),
        });
        markClean();
      } catch (e) {
        console.error("Save failed:", e);
        alert(`Sauvegarde échouée : ${e}`);
      }
    },
    [filePath, rawBytes, pageOrder, edits, markClean]
  );

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        doSave(e.shiftKey);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [doSave]);

  return { doSave, isDirty };
}
