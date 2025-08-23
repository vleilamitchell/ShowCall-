import { useEffect, useMemo, useRef, useState } from 'react';

type SortableListProps<TItem> = {
  items: TItem[];
  getId: (item: TItem) => string;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onReorder: (idsInOrder: string[]) => Promise<void> | void;
  renderItem: (item: TItem, isSelected: boolean) => React.ReactNode;
  loading?: boolean;
  header?: React.ReactNode;
  footer?: React.ReactNode;
  emptyText?: string;
};

export function SortableList<TItem>(props: SortableListProps<TItem>) {
  const { items, getId, selectedId, onSelect, onReorder, renderItem, loading, header, footer, emptyText = 'No items' } = props;
  const [dragId, setDragId] = useState<string | null>(null);
  const [localOrder, setLocalOrder] = useState<string[]>(() => items.map(getId));
  const containerRef = useRef<HTMLUListElement | null>(null);

  useEffect(() => {
    setLocalOrder(items.map(getId));
  }, [items, getId]);

  const idToItem = useMemo(() => {
    const m = new Map<string, TItem>();
    for (const it of items) m.set(getId(it), it);
    return m;
  }, [items, getId]);

  const reorderedItems = useMemo(() => localOrder.map(id => idToItem.get(id)!).filter(Boolean) as TItem[], [localOrder, idToItem]);

  const onDragStart = (e: React.DragEvent<HTMLLIElement>, id: string) => {
    setDragId(id);
    e.dataTransfer.effectAllowed = 'move';
    try { e.dataTransfer.setData('text/plain', id); } catch {}
  };
  const onDragEnter = (overId: string) => {
    if (dragId == null || dragId === overId) return;
    setLocalOrder((prev) => {
      const next = prev.slice();
      const from = next.indexOf(dragId);
      const to = next.indexOf(overId);
      if (from === -1 || to === -1) return prev;
      next.splice(from, 1);
      next.splice(to, 0, dragId);
      return next;
    });
  };
  const finishDrag = async () => {
    if (dragId == null) return;
    const ids = localOrder;
    setDragId(null);
    try { await onReorder(ids); } catch { /* ignore */ }
  };

  return (
    <div className="flex-1 overflow-auto">
      {header ? (
        <div className="sticky top-0 z-[2] bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b px-2 py-1">
          {header}
        </div>
      ) : null}
      <ul ref={containerRef} className="p-2">
        {loading ? (
          <div className="p-3 text-sm text-muted-foreground">Loading…</div>
        ) : (
          reorderedItems.length ? (
            reorderedItems.map((item) => {
              const id = getId(item);
              const isSelected = id === selectedId;
              return (
                <li
                  key={id}
                  draggable
                  aria-grabbed={dragId === id}
                  onDragStart={(e) => onDragStart(e, id)}
                  onDragEnter={() => onDragEnter(id)}
                  onDragOver={(e) => e.preventDefault()}
                  onDragEnd={finishDrag}
                  onDrop={(e) => { e.preventDefault(); finishDrag(); }}
                >
                  <div className="relative">
                    <button
                      className={`relative z-[1] w-full text-left pr-10 pl-3 py-2 rounded border transition-all listRow ${isSelected ? 'listRowActive' : ''}`}
                      onClick={() => onSelect(id)}
                    >
                      {renderItem(item, isSelected)}
                    </button>
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 z-[2] text-muted-foreground select-none cursor-grab">⋮⋮</div>
                  </div>
                </li>
              );
            })
          ) : (
            <div className="p-3 text-sm text-muted-foreground">{emptyText}</div>
          )
        )}
      </ul>
      {footer ? (
        <div className="px-3 py-2 text-xs text-muted-foreground">
          {footer}
        </div>
      ) : null}
    </div>
  );
}

export default SortableList;


