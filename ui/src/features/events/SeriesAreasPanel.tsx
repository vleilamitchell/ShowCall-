import { useEffect, useMemo, useState } from 'react';
import { listAreas, getEventSeriesAreas, addEventSeriesArea, removeEventSeriesArea, type Area } from '@/lib/serverComm';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, X } from 'lucide-react';

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

  return (
    <div className="mt-6">
      <Collapsible open={open} onOpenChange={(v) => { setOpen(v); try { localStorage.setItem('seriesAreasRollupOpen', v ? '1' : '0'); } catch {} }}>
        <CollapsibleTrigger asChild>
          <button
            className="w-full flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2 hover:bg-muted/50 transition-colors"
            aria-expanded={open}
          >
            <span className="text-sm font-semibold">Areas</span>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-xs">{attached.length}</Badge>
              <ChevronDown className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : 'rotate-0'}`} />
            </div>
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent className="overflow-hidden transition-[max-height,opacity] duration-400 ease-out data-[state=open]:opacity-100 data-[state=closed]:opacity-0 data-[state=open]:max-h-[2000px] data-[state=closed]:max-h-0" style={{ willChange: 'opacity, max-height' }}>
          {error ? (
            <div className="text-xs text-destructive mt-3">{error}</div>
          ) : (
            <div className="mt-3 space-y-3">
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
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}


