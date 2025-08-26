import { useEffect, useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';
import { Rollup } from '@/components/ui/rollup';
import { addEventArea, getEventAreas, listAreas, type Area } from '@/lib/serverComm';

export function EventAreasPanel({ eventId }: { eventId: string }) {
  
  const [error, setError] = useState<string | null>(null);
  const [areas, setAreas] = useState<Area[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [allAreas, setAllAreas] = useState<Area[]>([]);

  useEffect(() => {
    let ignore = false;
    setError(null);
    const boot: any = (window as any).__bootstrap || {};
    const preAttached: Area[] | undefined = (boot.areasByEvent && boot.areasByEvent[eventId]) || undefined;
    const preActive: Area[] | undefined = boot.areasActive;

    const loadAttached = preAttached ? Promise.resolve(preAttached) : getEventAreas(eventId);
    const loadActive = preActive ? Promise.resolve(preActive) : listAreas({ active: true });

    Promise.all([loadAttached, loadActive])
      .then(([attached, all]) => {
        if (ignore) return;
        setAreas(attached);
        setAllAreas(all);
      })
      .catch((e: any) => {
        if (ignore) return;
        setError(e?.message || 'Failed to load areas');
      });
    return () => { ignore = true; };
  }, [eventId]);

  const available = useMemo(() => {
    const attachedIds = new Set(areas.map(a => a.id));
    return allAreas.filter(a => !attachedIds.has(a.id));
  }, [allAreas, areas]);

  const onRemove = async (areaId: string) => {
    if (submitting) return;
    setSubmitting(true);
    try {
      // Optimistic update; server call handled elsewhere now
      setAreas(prev => {
        const next = prev.filter(a => a.id !== areaId);
        try {
          window.dispatchEvent(new CustomEvent('event-areas-updated', { detail: { eventId, areas: next } }));
        } catch {}
        return next;
      });
      // Fire-and-forget to server for removal
      try { (await import('@/lib/serverComm')).removeEventArea(eventId, areaId); } catch {}
    } catch (e: any) {
      alert(e?.message || 'Failed to remove area');
    } finally {
      setSubmitting(false);
    }
  };

  const summaryChips = (
    <div className="flex items-center gap-1.5 max-w-[360px] overflow-hidden">
      {areas.length === 0 ? (
        <Badge variant="secondary" className="text-xs">0</Badge>
      ) : (
        <>
          {areas.slice(0, 6).map((a) => (
            <span key={a.id} className="inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] text-foreground/80 bg-muted/30">
              {a.color ? <span className="inline-block w-2 h-2 rounded-full mr-1.5" style={{ backgroundColor: a.color }} /> : null}
              <span className="truncate max-w-[80px]">{a.name}</span>
            </span>
          ))}
          {areas.length > 6 ? (
            <Badge variant="secondary" className="text-[10px]">+{areas.length - 6}</Badge>
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
        storageKey="eventAreasRollupOpen"
      >
        {error ? (
          <div className="text-xs text-destructive">{error}</div>
        ) : (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {areas.length === 0 ? (
                <div className="text-xs text-muted-foreground">No areas attached yet</div>
              ) : (
                areas.map((a) => (
                  <Badge key={a.id} variant="secondary" className="inline-flex items-center gap-1">
                    {a.color ? <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ backgroundColor: a.color }} /> : null}
                    <span>{a.name}</span>
                    <button className="ml-1 inline-flex" onClick={() => onRemove(a.id)} aria-label={`Remove ${a.name}`}>
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))
              )}
            </div>
            {available.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {available.slice(0, 12).map((a) => (
                  <Button key={a.id} variant="outline" size="sm" onClick={async () => {
                    if (submitting) return; setSubmitting(true);
                    try {
                      const updated = await addEventArea(eventId, a.id);
                      setAreas(updated);
                      try {
                        window.dispatchEvent(new CustomEvent('event-areas-updated', { detail: { eventId, areas: updated } }));
                      } catch {}
                    }
                    catch (e: any) { alert(e?.message || 'Failed to add area'); }
                    finally { setSubmitting(false); }
                  }} disabled={submitting}>
                    {a.color ? <span className="inline-block w-2.5 h-2.5 rounded-full mr-2" style={{ backgroundColor: a.color }} /> : null}
                    {a.name}
                  </Button>
                ))}
              </div>
            ) : null}
          </div>
        )}
      </Rollup>
    </div>
  );
}

export default EventAreasPanel;


