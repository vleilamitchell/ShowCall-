import { useEffect, useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, X } from 'lucide-react';
import { addEventArea, getEventAreas, listAreas, removeEventArea, type Area } from '@/lib/serverComm';

export function EventAreasPanel({ eventId }: { eventId: string }) {
  const [open, setOpen] = useState<boolean>(() => {
    try { return localStorage.getItem('eventAreasRollupOpen') === '1'; } catch { return true; }
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [areas, setAreas] = useState<Area[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [allAreas, setAllAreas] = useState<Area[]>([]);

  useEffect(() => {
    let ignore = false;
    setLoading(true);
    setError(null);
    Promise.all([
      getEventAreas(eventId),
      listAreas({ active: true }),
    ]).then(([attached, all]) => {
      if (ignore) return;
      setAreas(attached);
      setAllAreas(all);
    }).catch((e: any) => {
      if (ignore) return;
      setError(e?.message || 'Failed to load areas');
    }).finally(() => {
      if (ignore) return;
      setLoading(false);
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
      await removeEventArea(eventId, areaId);
      setAreas(prev => {
        const next = prev.filter(a => a.id !== areaId);
        try {
          window.dispatchEvent(new CustomEvent('event-areas-updated', { detail: { eventId, areas: next } }));
        } catch {}
        return next;
      });
    } catch (e: any) {
      alert(e?.message || 'Failed to remove area');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mt-6">
      <Collapsible open={open} onOpenChange={(v) => { setOpen(v); try { localStorage.setItem('eventAreasRollupOpen', v ? '1' : '0'); } catch {} }}>
        <CollapsibleTrigger asChild>
          <button
            className="w-full flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2 hover:bg-muted/50 transition-colors"
            aria-expanded={open}
          >
            <span className="text-sm font-semibold">Areas</span>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-xs">{areas.length}</Badge>
              <ChevronDown className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : 'rotate-0'}`} />
            </div>
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent className="overflow-hidden transition-[max-height,opacity] duration-400 ease-out data-[state=open]:opacity-100 data-[state=closed]:opacity-0 data-[state=open]:max-h-[2000px] data-[state=closed]:max-h-0" style={{ willChange: 'opacity, max-height' }}>
          {error ? (
            <div className="text-xs text-destructive mt-3">{error}</div>
          ) : (
            <div className="mt-3 space-y-3">
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
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

export default EventAreasPanel;


