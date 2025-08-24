import { useEffect, useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Clock } from 'lucide-react';
import { Link } from 'react-router-dom';
import { listShiftsForEvent, type ShiftRecord, type DepartmentRecord, listDepartments } from '@/lib/serverComm';
import { formatTimeTo12Hour } from '@/lib/time';
import { Rollup } from '@/components/ui/rollup';

export function EventShiftsPanel({ eventId }: { eventId: string }) {
  // open state handled by Rollup
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

  const sortedShifts = useMemo(() => {
    const copy = [...shifts];
    return copy.sort((a, b) => {
      const aDept = departments[a.departmentId || 'unknown']?.name || a.departmentId || 'unknown';
      const bDept = departments[b.departmentId || 'unknown']?.name || b.departmentId || 'unknown';
      return aDept.localeCompare(bDept)
        || a.date.localeCompare(b.date)
        || a.startTime.localeCompare(b.startTime);
    });
  }, [shifts, departments]);

  return (
    <div className="mt-6">
      <Rollup title="Shifts" summaryText={shifts.length} storageKey="eventShiftsRollupOpen">
        <div className="space-y-4">
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
              <div className="rounded-md border divide-y">
                {sortedShifts.map((s) => {
                  const deptName = departments[s.departmentId || 'unknown']?.name || 'Unknown Department';
                  return (
                    <Link
                      key={s.id}
                      to={`/departments/${s.departmentId}/scheduling/${s.id}`}
                      className="flex items-center justify-between p-3 hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="text-sm font-medium truncate">{deptName}</div>
                        <div className="text-xs text-muted-foreground inline-flex items-center gap-1">
                          <Clock className="h-3 w-3" />{formatTimeTo12Hour(s.startTime)}–{formatTimeTo12Hour(s.endTime)}
                        </div>
                      </div>
                      <Badge variant={s.derivedPublished ? 'default' : 'secondary'} className="text-xs">{s.derivedPublished ? 'Published' : 'Draft'}</Badge>
                    </Link>
                  );
                })}
              </div>
            )}
        </div>
      </Rollup>
    </div>
  );
}

export default EventShiftsPanel;


