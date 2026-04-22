export interface PdfRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

// One word within a multi-word OCR cluster, preserving its original font size.
export interface OcrToken {
  text: string;
  fontSize: number; // PDF points
}

// One row of tokens (= one line within the cluster).
export type OcrRow = OcrToken[];

export interface TextEdit {
  id: string;
  type: "text-replacement";
  pageIndex: number;
  originalRect: PdfRect;
  originalText: string;
  newText: string;
  fontSize: number;
  fontFamily: string;
  color: [number, number, number];
  source?: "ocr" | "native";
  // When source === "ocr": structured rows preserving per-word font sizes.
  ocrRows?: OcrRow[];
}

export interface NewTextBox {
  id: string;
  type: "new-text";
  pageIndex: number;
  rect: PdfRect;
  text: string;
  fontSize: number;
  fontFamily: string;
  color: [number, number, number];
}

export interface Highlight {
  id: string;
  type: "highlight";
  pageIndex: number;
  rects: PdfRect[];
  color: [number, number, number];
  opacity: number;
}

export type EditRecord = TextEdit | NewTextBox | Highlight;

export type ToolMode = "select" | "text" | "highlight";

export interface TextItem {
  str: string;
  transform: number[];
  width: number;
  height: number;
  fontName: string;
}
