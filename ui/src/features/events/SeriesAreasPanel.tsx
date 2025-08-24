import { useEffect, useMemo, useState } from 'react';
import { listAreas, getEventSeriesAreas, addEventSeriesArea, removeEventSeriesArea, type Area } from '@/lib/serverComm';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';
import { Rollup } from '@/components/ui/rollup';

export function SeriesAreasPanel({ seriesId }: { seriesId: string }) {
  const [open, setOpen] = useState<boolean>(() => {
    try { return localStorage.getItem('seriesAreasRollupOpen') === '1'; } catch { return true; }
  });
  const [allAreas, setAllAreas] = useState<Area[]>([]);
  const [attached, setAttached] = useState<Area[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let ignore = false;
    setLoading(true);
    setError(null);
    Promise.all([
      listAreas({ active: true }),
      getEventSeriesAreas(seriesId),
    ]).then(([areas, current]) => {
      if (ignore) return;
      setAllAreas(areas);
      setAttached(current);
    }).catch((e: any) => {
      if (ignore) return;
      setError(e?.message || 'Failed to load areas');
    }).finally(() => {
      if (ignore) return;
      setLoading(false);
    });
    return () => { ignore = true; };
  }, [seriesId]);

  const available = useMemo(() => {
    const attachedIds = new Set(attached.map(a => a.id));
    return allAreas.filter(a => !attachedIds.has(a.id));
  }, [allAreas, attached]);

  const onRemove = async (areaId: string) => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const updated = await removeEventSeriesArea(seriesId, areaId);
      setAttached(updated);
    } catch (e: any) {
      alert(e?.message || 'Failed to remove area');
    } finally {
      setSubmitting(false);
    }
  };

  const onAdd = async (areaId: string) => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const updated = await addEventSeriesArea(seriesId, areaId);
      setAttached(updated);
    } catch (e: any) {
      alert(e?.message || 'Failed to add area');
    } finally {
      setSubmitting(false);
    }
  };

  const summaryChips = (
    <div className="flex items-center gap-1.5 max-w-[360px] overflow-hidden">
      {attached.length === 0 ? (
        <Badge variant="secondary" className="text-xs">0</Badge>
      ) : (
        <>
          {attached.slice(0, 6).map((a) => (
            <span key={a.id} className="inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] text-foreground/80 bg-muted/30">
              {a.color ? <span className="inline-block w-2 h-2 rounded-full mr-1.5" style={{ backgroundColor: a.color }} /> : null}
              <span className="truncate max-w-[80px]">{a.name}</span>
            </span>
          ))}
          {attached.length > 6 ? (
            <Badge variant="secondary" className="text-[10px]">+{attached.length - 6}</Badge>
          ) : null}
        </>
      )}
    </div>
  );

  return (
    <div className="mt-6">
      <Rollup
        title="Areas"
        summary={summaryChips}
        storageKey="seriesAreasRollupOpen"
      >
        {error ? (
          <div className="text-xs text-destructive">{error}</div>
        ) : (
          <div className="space-y-3">
            {loading ? (
              <div className="text-xs text-muted-foreground">Loading…</div>
            ) : (
              <>
                <div className="flex flex-wrap gap-2">
                  {attached.length === 0 ? (
                    <div className="text-xs text-muted-foreground">No areas attached yet</div>
                  ) : (
                    attached.map((a) => (
                      <Badge key={a.id} variant="secondary" className="inline-flex items-center gap-1">
                        {a.color ? <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ backgroundColor: a.color }} /> : null}
                        <span>{a.name}</span>
                        <button className="ml-1 inline-flex" onClick={() => onRemove(a.id)} aria-label={`Remove ${a.name}`} disabled={submitting}>
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))
                  )}
                </div>
                {available.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {available.slice(0, 12).map((a) => (
                      <Button key={a.id} variant="outline" size="sm" onClick={() => onAdd(a.id)} disabled={submitting}>
                        {a.color ? <span className="inline-block w-2.5 h-2.5 rounded-full mr-2" style={{ backgroundColor: a.color }} /> : null}
                        {a.name}
                      </Button>
                    ))}
                  </div>
                ) : null}
              </>
            )}
          </div>
        )}
      </Rollup>
    </div>
  );
}


