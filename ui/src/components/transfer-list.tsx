import { useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';

export type TransferItem = {
  id: string;
  label: string;
};

export function TransferList({
  available,
  selected,
  onAdd,
  onRemove,
  leftTitle = 'Available',
  rightTitle = 'Selected',
  searchPlaceholder = 'Search',
  filterControls,
}: {
  available: TransferItem[];
  selected: TransferItem[];
  onAdd: (id: string) => void | Promise<void>;
  onRemove: (id: string) => void | Promise<void>;
  leftTitle?: string;
  rightTitle?: string;
  searchPlaceholder?: string;
  filterControls?: React.ReactNode;
}) {
  const [q, setQ] = useState('');

  const filteredAvailable = useMemo(() => {
    if (!q.trim()) return available;
    const needle = q.toLowerCase();
    return available.filter((i) => i.label.toLowerCase().includes(needle));
  }, [available, q]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div>
        <div className="text-xs text-muted-foreground mb-2">{leftTitle}</div>
        <div className="flex items-center gap-2 mb-2">
          <Input placeholder={searchPlaceholder} value={q} onChange={(e) => setQ(e.target.value)} />
          {filterControls}
        </div>
        <div className="rounded-md border h-[420px]">
          {filteredAvailable.length === 0 ? (
            <div className="p-3 text-sm text-muted-foreground">No results</div>
          ) : (
            <ScrollArea className="h-[420px]">
              <div className="divide-y">
                {filteredAvailable.map((i) => (
                  <button
                    key={i.id}
                    className="w-full text-left flex items-center gap-2 p-2 hover:bg-muted/50 cursor-pointer"
                    onClick={(e) => { e.preventDefault(); void onAdd(i.id); }}
                    aria-label={`Add ${i.label}`}
                  >
                    <div className="flex-1">
                      <div className="text-sm font-medium truncate">{i.label}</div>
                    </div>
                  </button>
                ))}
              </div>
            </ScrollArea>
          )}
        </div>
      </div>
      <div>
        <div className="text-xs text-muted-foreground mb-2">{rightTitle}</div>
        <div className="rounded-md border h-[420px]">
          {selected.length === 0 ? (
            <div className="p-3 text-sm text-muted-foreground">None selected</div>
          ) : (
            <ScrollArea className="h-[420px]">
              <div className="divide-y">
                {selected.map((i) => (
                  <button
                    key={i.id}
                    className="w-full text-left flex items-center gap-2 p-2 hover:bg-muted/50 cursor-pointer"
                    onClick={(e) => { e.preventDefault(); void onRemove(i.id); }}
                    aria-label={`Remove ${i.label}`}
                  >
                    <div className="flex-1">
                      <div className="text-sm font-medium truncate">{i.label}</div>
                    </div>
                  </button>
                ))}
              </div>
            </ScrollArea>
          )}
        </div>
      </div>
    </div>
  );
}

export default TransferList;


