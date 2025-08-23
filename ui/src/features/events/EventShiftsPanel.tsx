import { useEffect, useMemo, useState } from 'react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { ChevronDown, Clock, CalendarDays } from 'lucide-react';
import { listShiftsForEvent, type ShiftRecord, type DepartmentRecord, listDepartments } from '@/lib/serverComm';
import { formatTimeTo12Hour } from '@/lib/time';

export function EventShiftsPanel({ eventId }: { eventId: string }) {
  const [open, setOpen] = useState<boolean>(() => {
    try { return localStorage.getItem('eventShiftsRollupOpen') === '1'; } catch { return true; }
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [shifts, setShifts] = useState<ShiftRecord[]>([]);
  const [departments, setDepartments] = useState<Record<string, DepartmentRecord>>({});

  useEffect(() => {
    let ignore = false;
    setLoading(true);
    setError(null);
    Promise.all([
      listShiftsForEvent(eventId),
      listDepartments(),
    ])
      .then(([s, deps]) => {
        if (ignore) return;
        setShifts(s);
        const byId: Record<string, DepartmentRecord> = {};
        deps.forEach((d) => { byId[d.id] = d; });
        setDepartments(byId);
      })
      .catch((e: any) => {
        if (ignore) return;
        setError(e?.message || 'Failed to load shifts');
      })
      .finally(() => {
        if (ignore) return;
        setLoading(false);
      });
    return () => { ignore = true; };
  }, [eventId]);

  const grouped = useMemo(() => {
    const groups: Record<string, ShiftRecord[]> = {};
    for (const s of shifts) {
      const key = s.departmentId || 'unknown';
      if (!groups[key]) groups[key] = [];
      groups[key].push(s);
    }
    // sort shifts in each group by date then startTime
    Object.values(groups).forEach(list => list.sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime)));
    return groups;
  }, [shifts]);

  const groupKeys = useMemo(() => Object.keys(grouped).sort((a, b) => {
    const an = departments[a]?.name || a;
    const bn = departments[b]?.name || b;
    return an.localeCompare(bn);
  }), [grouped, departments]);

  return (
    <div className="mt-6">
      <Collapsible open={open} onOpenChange={(v) => { setOpen(v); try { localStorage.setItem('eventShiftsRollupOpen', v ? '1' : '0'); } catch {} }}>
        <CollapsibleTrigger asChild>
          <button
            className="w-full flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2 hover:bg-muted/50 transition-colors"
            aria-expanded={open}
          >
            <span className="text-sm font-semibold">Shifts</span>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-xs">{shifts.length}</Badge>
              <ChevronDown className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : 'rotate-0'}`} />
            </div>
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent className="overflow-hidden transition-[max-height,opacity] duration-400 ease-out data-[state=open]:opacity-100 data-[state=closed]:opacity-0 data-[state=open]:max-h-[2000px] data-[state=closed]:max-h-0" style={{ willChange: 'opacity, max-height' }}>
          <div className="mt-3 space-y-4">
            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Card key={i} className="p-3">
                    <Skeleton className="h-4 w-1/3 mb-2" />
                    <Skeleton className="h-3 w-1/2 mb-2" />
                    <Skeleton className="h-3 w-2/3" />
                  </Card>
                ))}
              </div>
            ) : error ? (
              <div className="text-sm text-destructive">{error}</div>
            ) : shifts.length === 0 ? (
              <div className="text-sm text-muted-foreground">No shifts linked to this event yet</div>
            ) : (
              groupKeys.map((deptId) => {
                const deptName = departments[deptId]?.name || 'Unknown Department';
                const list = grouped[deptId] || [];
                return (
                  <div key={deptId}>
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-medium">{deptName}</div>
                      <Badge className="text-xs" variant="outline">{list.length} shift{list.length === 1 ? '' : 's'}</Badge>
                    </div>
                    <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-3">
                      {list.map((s) => (
                        <Card key={s.id} className="p-3 hover:shadow-sm transition-shadow">
                          <div className="flex items-center justify-between">
                            <div className="text-sm font-semibold truncate">{s.title || 'Untitled Shift'}</div>
                            <Badge variant={s.derivedPublished ? 'default' : 'secondary'} className="text-xs">{s.derivedPublished ? 'Published' : 'Draft'}</Badge>
                          </div>
                          <div className="mt-1 text-xs text-muted-foreground flex items-center gap-3">
                            <span className="inline-flex items-center gap-1"><CalendarDays className="h-3 w-3" />{s.date}</span>
                            <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" />{formatTimeTo12Hour(s.startTime)}–{formatTimeTo12Hour(s.endTime)}</span>
                          </div>
                          {s.notes ? (
                            <div className="mt-2 text-xs text-muted-foreground line-clamp-2">{s.notes}</div>
                          ) : null}
                        </Card>
                      ))}
                    </div>
                    <Separator className="mt-3" />
                  </div>
                );
              })
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

export default EventShiftsPanel;


