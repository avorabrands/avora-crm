"use client";

import { useMemo, useState, useTransition } from "react";
import { DndContext, DragOverlay, PointerSensor, KeyboardSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent, type DragStartEvent } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import type { FormActionState } from "./form";

export type KanbanColumn = { id: string; title: string; accent?: string; footer?: React.ReactNode };

type Props<T extends { id: string }> = {
  columns: KanbanColumn[];
  items: T[];
  columnOf: (item: T) => string;
  renderCard: (item: T) => React.ReactNode;
  onMove: (id: string, toColumn: string) => Promise<FormActionState>;
  /** return an error message to block a move (validation before hitting the server) */
  canMove?: (item: T, toColumn: string) => string | null;
  columnSummary?: (items: T[]) => React.ReactNode;
};

export function KanbanBoard<T extends { id: string }>({ columns, items, columnOf, renderCard, onMove, canMove, columnSummary }: Props<T>) {
  // optimistic column overrides, discarded whenever the server sends fresh items
  const [override, setOverride] = useState<{ items: T[]; map: Record<string, string> }>({ items, map: {} });
  const local = useMemo(() => (override.items === items ? override.map : {}), [override, items]);
  const setLocal = (fn: (m: Record<string, string>) => Record<string, string>) => setOverride((o) => ({ items, map: fn(o.items === items ? o.map : {}) }));
  const [activeId, setActiveId] = useState<string | null>(null);
  const [, start] = useTransition();
  const router = useRouter();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(KeyboardSensor));


  const grouped = useMemo(() => {
    const g: Record<string, T[]> = Object.fromEntries(columns.map((c) => [c.id, []]));
    for (const it of items) (g[local[it.id] ?? columnOf(it)] ??= []).push(it);
    return g;
  }, [items, columns, columnOf, local]);

  const active = activeId ? items.find((i) => i.id === activeId) : undefined;

  const onDragStart = (e: DragStartEvent) => setActiveId(String(e.active.id));
  const onDragEnd = (e: DragEndEvent) => {
    setActiveId(null);
    const id = String(e.active.id);
    const to = e.over ? String(e.over.id) : null;
    const item = items.find((i) => i.id === id);
    if (!item || !to) return;
    const from = local[id] ?? columnOf(item);
    if (from === to) return;
    const blocked = canMove?.(item, to);
    if (blocked) { toast.error(blocked); return; }
    setLocal((l) => ({ ...l, [id]: to }));
    start(async () => {
      const res = await onMove(id, to);
      if (!res.ok) {
        toast.error(res.message ?? "Couldn't move card");
        setLocal((l) => { const n = { ...l }; delete n[id]; return n; });
      } else {
        if (res.message) toast.success(res.message);
        router.refresh();
      }
    });
  };

  return (
    <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setActiveId(null)}>
      <div className="flex gap-3 overflow-x-auto pb-3">
        {columns.map((col) => (
          <Column key={col.id} col={col} count={grouped[col.id]?.length ?? 0} summary={columnSummary?.(grouped[col.id] ?? [])}>
            {(grouped[col.id] ?? []).map((it) => (
              <Card key={it.id} id={it.id} hidden={activeId === it.id}>{renderCard(it)}</Card>
            ))}
          </Column>
        ))}
      </div>
      <DragOverlay>{active ? <div className="rotate-1 rounded-lg border bg-card p-3 shadow-lg">{renderCard(active)}</div> : null}</DragOverlay>
    </DndContext>
  );
}

function Column({ col, count, summary, children }: { col: KanbanColumn; count: number; summary?: React.ReactNode; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: col.id });
  return (
    <div ref={setNodeRef} className={cn("flex w-72 shrink-0 flex-col rounded-xl border bg-muted/50 transition-colors", isOver && "border-primary/50 bg-accent/60")}>
      <div className="flex items-center justify-between gap-2 px-3 pt-3 pb-2">
        <div className="flex items-center gap-2">
          <span className={cn("size-2 rounded-full bg-muted-foreground/40", col.accent)} />
          <p className="text-xs font-semibold">{col.title}</p>
          <span className="rounded-full bg-background px-1.5 text-[11px] text-muted-foreground tabular-nums">{count}</span>
        </div>
        {summary && <span className="text-[11px] text-muted-foreground tabular-nums">{summary}</span>}
      </div>
      <div className="flex min-h-24 flex-1 flex-col gap-2 px-2 pb-2">{children}</div>
    </div>
  );
}

function Card({ id, hidden, children }: { id: string; hidden?: boolean; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({ id });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform) }}
      {...listeners}
      {...attributes}
      className={cn("cursor-grab touch-none rounded-lg border bg-card p-3 shadow-[0_1px_2px_rgba(16,24,40,0.05)] hover:border-primary/40 active:cursor-grabbing", hidden && "opacity-30")}
    >
      {children}
    </div>
  );
}

export const COLUMN_ACCENT: Record<string, string> = {
  slate: "bg-slate-400", blue: "bg-blue-500", teal: "bg-teal-500", purple: "bg-violet-500", amber: "bg-amber-500", green: "bg-emerald-500", red: "bg-red-500", neutral: "bg-muted-foreground/40",
};
