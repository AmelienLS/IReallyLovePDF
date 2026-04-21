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
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={pageOrder.map(String)}
        strategy={verticalListSortingStrategy}
      >
        <div
          style={{
            width: 130,
            minHeight: "100%",
            background: "#f8fafc",
            borderRight: "1px solid #e2e8f0",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            padding: "8px 0",
            overflowY: "auto",
            gap: 4,
          }}
        >
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
