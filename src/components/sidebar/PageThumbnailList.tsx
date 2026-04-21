import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  closestCenter,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { usePdfStore } from "../../store/usePdfStore";
import { PageThumbnail } from "./PageThumbnail";

interface Props {
  doc: PDFDocumentProxy;
}

export function PageThumbnailList({ doc }: Props) {
  const pageOrder = usePdfStore((s) => s.pageOrder);
  const reorderPages = usePdfStore((s) => s.reorderPages);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = pageOrder.findIndex((p) => String(p) === active.id);
    const newIndex = pageOrder.findIndex((p) => String(p) === over.id);
    reorderPages(arrayMove(pageOrder, oldIndex, newIndex));
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={pageOrder.map(String)} strategy={verticalListSortingStrategy}>
        <div style={{
          width: "var(--sidebar-width)",
          minWidth: "var(--sidebar-width)",
          height: "100%",
          background: "var(--bg-sidebar)",
          backdropFilter: "blur(20px) saturate(180%)",
          WebkitBackdropFilter: "blur(20px) saturate(180%)",
          borderRight: "0.5px solid var(--border)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          padding: "12px 0 16px",
          overflowY: "auto",
          gap: 2,
        }}>
          <span style={{
            fontSize: 11,
            fontWeight: 600,
            color: "var(--text-secondary)",
            textTransform: "uppercase",
            letterSpacing: "0.04em",
            marginBottom: 8,
            alignSelf: "flex-start",
            paddingLeft: 12,
          }}>
            Pages
          </span>
          {pageOrder.map((origIdx, displayIdx) => (
            <PageThumbnail
              key={origIdx}
              doc={doc}
              origPageIndex={origIdx}
              displayIndex={displayIdx}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
