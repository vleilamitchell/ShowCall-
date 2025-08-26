import { useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Check } from 'lucide-react';

export type AssignmentItem = {
  id: string;
  label: string;
};

export function AssignmentPicker({
  items,
  isSelected,
  onAdd,
  onRemove,
  searchPlaceholder = 'Search',
  filterControls,
  heightPx = 420,
  rowClickMode = false,
}: {
  items: AssignmentItem[];
  isSelected: (id: string) => boolean;
  onAdd: (id: string) => void | Promise<void>;
  onRemove: (id: string) => void | Promise<void>;
  searchPlaceholder?: string;
  filterControls?: React.ReactNode;
  heightPx?: number;
  rowClickMode?: boolean;
}) {
  const [q, setQ] = useState('');

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return items;
    return items.filter((i) => i.label.toLowerCase().includes(needle));
  }, [items, q]);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Input placeholder={searchPlaceholder} value={q} onChange={(e) => setQ(e.target.value)} />
        {filterControls}
      </div>
      <div className="rounded-md border" style={{ height: `${heightPx}px` }}>
        {filtered.length === 0 ? (
          <div className="p-3 text-sm text-muted-foreground">No results</div>
        ) : (
          <ScrollArea className="h-full">
            <div className="divide-y">
              {filtered.map((i) => {
                const selected = isSelected(i.id);
                return (
                  <div
                    key={i.id}
                    className={`flex items-center gap-2 p-2 hover:bg-muted/50 ${rowClickMode ? 'cursor-pointer' : ''}`}
                    onClick={rowClickMode ? (e) => { e.preventDefault(); void (selected ? onRemove(i.id) : onAdd(i.id)); } : undefined}
                  >
                    <div className="flex-1">
                      <div className="text-sm font-medium truncate">{i.label}</div>
                    </div>
                    {rowClickMode ? (
                      selected ? <Check className="h-4 w-4 text-green-600" /> : null
                    ) : (
                      <Button
                        size="sm"
                        variant={selected ? 'secondary' : 'outline'}
                        onClick={(e) => {
                          e.preventDefault();
                          void (selected ? onRemove(i.id) : onAdd(i.id));
                        }}
                      >
                        {selected ? 'Remove' : 'Add'}
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </div>
    </div>
  );
}

export default AssignmentPicker;


