import { useEffect, useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { type EventSeries, listEventSeries } from '@/lib/serverComm';

export function SeriesAutocomplete({
  value,
  onChange,
  placeholder = 'Search series',
  className,
}: {
  value?: string | null;
  onChange: (seriesId: string | null) => void;
  placeholder?: string;
  className?: string;
}) {
  const [q, setQ] = useState('');
  const [items, setItems] = useState<EventSeries[]>([]);
  const [selected, setSelected] = useState<EventSeries | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    listEventSeries({ q }).then((rows) => {
      if (!cancelled) setItems(rows);
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [q]);

  useEffect(() => {
    if (!value) { setSelected(null); return; }
    const found = items.find((i) => i.id === value) || null;
    setSelected(found);
  }, [value, items]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return items;
    return items.filter((i) => (i.name || '').toLowerCase().includes(needle));
  }, [items, q]);

  return (
    <div className={className}>
      <div className="flex items-center gap-2">
        <Input
          placeholder={placeholder}
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        {selected ? (
          <Button size="sm" variant="outline" onClick={() => onChange(null)}>Clear</Button>
        ) : null}
      </div>
      <div className="mt-2 rounded-md border">
        {loading ? (
          <div className="p-2 text-xs text-muted-foreground">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="p-2 text-xs text-muted-foreground">No results</div>
        ) : (
          <ScrollArea className="h-48">
            <div className="divide-y">
              {filtered.map((s) => {
                const isActive = value === s.id;
                return (
                  <button
                    key={s.id}
                    className={`w-full text-left p-2 hover:bg-muted/60 ${isActive ? 'bg-muted' : ''}`}
                    onClick={(e) => { e.preventDefault(); onChange(s.id); }}
                  >
                    <div className="text-sm font-medium truncate">{s.name}</div>
                    {(s.startDate || s.endDate) ? (
                      <div className="text-[11px] text-muted-foreground">{s.startDate || '—'} → {s.endDate || '—'}</div>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </div>
      {selected ? (
        <div className="mt-2 text-xs text-muted-foreground">Selected: {selected.name}</div>
      ) : null}
    </div>
  );
}

export default SeriesAutocomplete;


