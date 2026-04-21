import { useEffect, useRef, useState } from "react";
import { pdfjs } from "../lib/pdfjs";
import type { PDFDocumentProxy } from "pdfjs-dist";

export function usePdfLoader(rawBytes: Uint8Array | null) {
  const docRef = useRef<PDFDocumentProxy | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!rawBytes) {
      docRef.current?.destroy();
      docRef.current = null;
      setPageCount(0);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    const copy = rawBytes.slice();
    pdfjs
      .getDocument({ data: copy })
      .promise.then((doc) => {
        if (cancelled) {
          doc.destroy();
          return;
        }
        docRef.current?.destroy();
        docRef.current = doc;
        setPageCount(doc.numPages);
        setLoading(false);
      })
      .catch((e) => {
        if (!cancelled) {
          setError(String(e));
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [rawBytes]);

  return { docRef, pageCount, loading, error };
}
