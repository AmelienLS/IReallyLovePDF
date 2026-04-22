import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import { nanoid } from "./nanoid";
import type {
  EditRecord,
  TextEdit,
  NewTextBox,
  Highlight,
  ToolMode,
  PdfRect,
  TextItem,
} from "./types";
import type { OcrWord } from "../lib/ocr";

interface PdfState {
  filePath: string | null;
  rawBytes: Uint8Array | null;
  pageOrder: number[];
  edits: Record<string, EditRecord>;
  toolMode: ToolMode;
  currentPage: number;
  zoom: number;
  isDirty: boolean;
  activeEditId: string | null;
  ocrWords: Record<number, OcrWord[]>;
  ocrRunning: Record<number, boolean>;
}

interface PdfActions {
  loadFile(path: string, bytes: Uint8Array, pageCount: number): void;
  closeDocument(): void;
  reorderPages(newOrder: number[]): void;
  setToolMode(mode: ToolMode): void;
  setZoom(zoom: number): void;
  setCurrentPage(page: number): void;
  beginTextEdit(item: TextItem, pageIndex: number, rect: PdfRect): string;
  commitTextEdit(id: string, newText: string): void;
  addNewTextBox(data: Omit<NewTextBox, "id">): string;
  updateEdit(id: string, patch: Partial<EditRecord>): void;
  removeEdit(id: string): void;
  addHighlight(data: Omit<Highlight, "id">): string;
  setActiveEdit(id: string | null): void;
  markClean(): void;
  setOcrWords(pageIndex: number, words: OcrWord[]): void;
  setOcrRunning(pageIndex: number, running: boolean): void;
  importOcrAsEdits(pageIndex: number, words: OcrWord[]): void;
}

export const usePdfStore = create<PdfState & PdfActions>()(
  immer((set) => ({
    filePath: null,
    rawBytes: null,
    pageOrder: [],
    edits: {},
    toolMode: "select",
    currentPage: 0,
    zoom: 1.5,
    isDirty: false,
    activeEditId: null,
    ocrWords: {},
    ocrRunning: {},

    loadFile(path, bytes, pageCount) {
      set((s) => {
        s.filePath = path;
        s.rawBytes = bytes;
        s.pageOrder = Array.from({ length: pageCount }, (_, i) => i);
        s.edits = {};
        s.isDirty = false;
        s.activeEditId = null;
        s.currentPage = 0;
        s.ocrWords = {};
        s.ocrRunning = {};
      });
    },

    closeDocument() {
      set((s) => {
        s.filePath = null;
        s.rawBytes = null;
        s.pageOrder = [];
        s.edits = {};
        s.isDirty = false;
        s.activeEditId = null;
        s.ocrWords = {};
        s.ocrRunning = {};
      });
    },

    reorderPages(newOrder) {
      set((s) => {
        s.pageOrder = newOrder;
        s.isDirty = true;
      });
    },

    setToolMode(mode) {
      set((s) => {
        s.toolMode = mode;
        s.activeEditId = null;
      });
    },

    setZoom(zoom) {
      set((s) => {
        s.zoom = Math.max(0.5, Math.min(3, zoom));
      });
    },

    setCurrentPage(page) {
      set((s) => {
        s.currentPage = page;
      });
    },

    beginTextEdit(item, pageIndex, rect) {
      const id = nanoid();
      set((s) => {
        const fontSize = Math.abs(item.transform[3]) || 12;
        const edit: TextEdit = {
          id,
          type: "text-replacement",
          pageIndex,
          originalRect: rect,
          originalText: item.str,
          newText: item.str,
          fontSize,
          fontFamily: "Helvetica",
          color: [0, 0, 0],
        };
        s.edits[id] = edit;
        s.activeEditId = id;
        s.isDirty = true;
      });
      return id;
    },

    commitTextEdit(id, newText) {
      set((s) => {
        const edit = s.edits[id] as TextEdit;
        if (edit) {
          edit.newText = newText;
          // OCR-sourced edits are always kept (even if unchanged) to ensure
          // uniform typography across all scanned zones in the saved PDF.
          if (newText === edit.originalText && edit.source !== "ocr") {
            delete s.edits[id];
          }
        }
        if (s.activeEditId === id) s.activeEditId = null;
      });
    },

    addNewTextBox(data) {
      const id = nanoid();
      set((s) => {
        s.edits[id] = { ...data, id } as NewTextBox;
        s.activeEditId = id;
        s.isDirty = true;
      });
      return id;
    },

    updateEdit(id, patch) {
      set((s) => {
        if (s.edits[id]) {
          Object.assign(s.edits[id], patch);
          s.isDirty = true;
        }
      });
    },

    removeEdit(id) {
      set((s) => {
        delete s.edits[id];
        if (s.activeEditId === id) s.activeEditId = null;
        s.isDirty = true;
      });
    },

    addHighlight(data) {
      const id = nanoid();
      set((s) => {
        s.edits[id] = { ...data, id } as Highlight;
        s.isDirty = true;
      });
      return id;
    },

    setActiveEdit(id) {
      set((s) => {
        s.activeEditId = id;
      });
    },

    markClean() {
      set((s) => {
        s.isDirty = false;
      });
    },

    setOcrWords(pageIndex, words) {
      set((s) => {
        s.ocrWords[pageIndex] = words;
      });
    },

    setOcrRunning(pageIndex, running) {
      set((s) => {
        s.ocrRunning[pageIndex] = running;
      });
    },

    importOcrAsEdits(pageIndex, words) {
      set((s) => {
        s.ocrWords[pageIndex] = words;
        // Remove any previous OCR-sourced edits for this page before re-importing.
        for (const id of Object.keys(s.edits)) {
          const e = s.edits[id] as TextEdit;
          if (e.type === "text-replacement" && e.source === "ocr" && e.pageIndex === pageIndex) {
            delete s.edits[id];
          }
        }
        for (const w of words) {
          const id = nanoid();
          s.edits[id] = {
            id,
            type: "text-replacement",
            pageIndex,
            originalRect: w.rect,
            originalText: w.text,
            newText: w.text,
            fontSize: w.fontSize,
            fontFamily: "Helvetica",
            color: [0, 0, 0],
            source: "ocr",
          } as TextEdit;
        }
        s.isDirty = true;
      });
    },
  }))
);
