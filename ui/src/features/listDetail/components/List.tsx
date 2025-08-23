import { useEffect, useRef } from 'react';
import type { ListItem, RenderItemFn } from '../types';
import { useSlidingActiveIndicator } from '../hooks/useSlidingActiveIndicator';

type Props<TItem extends ListItem> = {
  items: TItem[];
  selectedId: TItem['id'] | null;
  onSelect: (id: TItem['id']) => void;
  renderItem: RenderItemFn<TItem>;
  loading?: boolean;
  emptyText?: string;
  header?: React.ReactNode;
  footer?: React.ReactNode;
};

export function List<TItem extends ListItem>(props: Props<TItem>) {
  const { items, selectedId, onSelect, renderItem, loading, emptyText = 'No items' } = props;
  const listContainerRef = useRef<HTMLDivElement | null>(null);
  const { indicatorTop, indicatorHeight, hasActive, measure } = useSlidingActiveIndicator(listContainerRef as any, '.listRowActive');

  // Re-measure when selection or list length changes to keep indicator in sync
  useEffect(() => {
    measure();
    const raf = requestAnimationFrame(() => measure());
    return () => cancelAnimationFrame(raf);
  }, [selectedId, items.length]);

  return (
    <div className="flex-1 overflow-auto">
      {loading ? (
        <div className="p-3 text-sm text-muted-foreground">Loading…</div>
      ) : (
        <>
          {props.header ? (
            <div className="sticky top-0 z-[2] bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b px-2 py-1">
              {props.header}
            </div>
          ) : null}
          <div ref={listContainerRef as any} style={{ position: 'relative' }}>
            <div className="listActiveIndicator" style={{ transform: `translateY(${indicatorTop}px)`, height: indicatorHeight, opacity: hasActive ? 1 : 0 }} />
            <ul className="p-1">
              {items.map(item => (
                <li key={String(item.id)}>
                  <button
                    className={`relative z-[1] w-full text-left px-3 py-2 rounded border transition-all listRow ${item.id === selectedId ? 'listRowActive' : ''}`}
                    onClick={() => onSelect(item.id)}
                  >
                    {renderItem(item, item.id === selectedId)}
                  </button>
                </li>
              ))}
              {!items.length && (
                <div className="p-3 text-sm text-muted-foreground">{emptyText}</div>
              )}
            </ul>
            {props.footer ? (
              <div className="px-3 py-2 text-xs text-muted-foreground">
                {props.footer}
              </div>
            ) : null}
          </div>
        </>
      )}
    </div>
  );
}

export default List;


