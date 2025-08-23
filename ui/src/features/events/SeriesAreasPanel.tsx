import { useEffect, useState } from 'react';
import { listAreas, getEventSeriesAreas, putEventSeriesAreas, type Area } from '@/lib/serverComm';
import { Button } from '@/components/ui/button';

export function SeriesAreasPanel({ seriesId }: { seriesId: string }) {
  const [allAreas, setAllAreas] = useState<Area[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let ignore = false;
    (async () => {
      try {
        setLoading(true);
        const [areas, current] = await Promise.all([
          listAreas({ active: true }),
          getEventSeriesAreas(seriesId),
        ]);
        if (ignore) return;
        setAllAreas(areas);
        setSelected(current.map((a) => a.id));
      } finally {
        if (!ignore) setLoading(false);
      }
    })();
    return () => { ignore = true; };
  }, [seriesId]);

  const toggle = (id: string) => {
    setSelected((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  };

  const onSave = async () => {
    setSaving(true);
    try {
      await putEventSeriesAreas(seriesId, selected);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-md border p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm font-medium">Series areas</div>
        <Button size="sm" onClick={onSave} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
      </div>
      {loading ? (
        <div className="text-xs text-muted-foreground">Loading…</div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {allAreas.map((a) => (
            <label key={a.id} className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={selected.includes(a.id)} onChange={() => toggle(a.id)} />
              <span>{a.name}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}


