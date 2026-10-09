"use client";

import { useEffect, useState, useTransition, type DragEvent, type ReactNode } from "react";
import { ArrowDown, ArrowUp, GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Reorderable list: drag the handle (desktop) or use the arrows (touch,
 * keyboard). The new order saves right away via `onReorder`; on failure the
 * list snaps back.
 */
export function SortableList<T extends { id: string }>({
  items,
  canEdit,
  onReorder,
  renderItem,
}: {
  items: T[];
  canEdit: boolean;
  onReorder: (ids: string[]) => Promise<{ error: string | null }>;
  renderItem: (item: T) => ReactNode;
}) {
  const [order, setOrder] = useState(items);
  const [dragId, setDragId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, startSave] = useTransition();

  useEffect(() => setOrder(items), [items]);

  function commit(next: T[]) {
    const previous = order;
    setOrder(next);
    setError(null);
    startSave(async () => {
      const result = await onReorder(next.map((item) => item.id));
      if (result.error) {
        setOrder(previous);
        setError(result.error);
      }
    });
  }

  function move(index: number, delta: number) {
    const target = index + delta;
    if (target < 0 || target >= order.length) return;
    const next = [...order];
    const [moved] = next.splice(index, 1);
    if (!moved) return;
    next.splice(target, 0, moved);
    commit(next);
  }

  function dropOn(targetId: string) {
    if (!dragId || dragId === targetId) return;
    const from = order.findIndex((item) => item.id === dragId);
    const to = order.findIndex((item) => item.id === targetId);
    if (from < 0 || to < 0) return;
    const next = [...order];
    const [moved] = next.splice(from, 1);
    if (!moved) return;
    next.splice(to, 0, moved);
    commit(next);
  }

  return (
    <div className="flex flex-col gap-2">
      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
      <ul className={cn("divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white", isSaving && "opacity-80")}>
        {order.map((item, index) => (
          <li
            key={item.id}
            draggable={canEdit}
            onDragStart={() => setDragId(item.id)}
            onDragEnd={() => setDragId(null)}
            onDragOver={(event: DragEvent) => canEdit && event.preventDefault()}
            onDrop={() => dropOn(item.id)}
            className={cn("flex items-center gap-2 px-3 py-2.5", dragId === item.id && "bg-slate-50 opacity-60")}
          >
            {canEdit ? (
              <span className="hidden cursor-grab text-slate-300 hover:text-slate-500 active:cursor-grabbing sm:block" aria-hidden>
                <GripVertical className="size-4" />
              </span>
            ) : null}
            <div className="min-w-0 flex-1">{renderItem(item)}</div>
            {canEdit ? (
              <div className="flex shrink-0">
                <Button type="button" variant="ghost" size="icon" className="size-8" disabled={index === 0 || isSaving} onClick={() => move(index, -1)} aria-label="Move up">
                  <ArrowUp className="size-4" />
                </Button>
                <Button type="button" variant="ghost" size="icon" className="size-8" disabled={index === order.length - 1 || isSaving} onClick={() => move(index, 1)} aria-label="Move down">
                  <ArrowDown className="size-4" />
                </Button>
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
