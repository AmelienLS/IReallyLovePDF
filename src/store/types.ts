export interface PdfRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

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
