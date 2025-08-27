import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ListDetailLayout } from '@/features/listDetail/components/ListDetailLayout';
import { List } from '@/features/listDetail';
import { api, type ScheduleRecord, type ShiftRecord, type DepartmentRecord, type Area } from '@/lib/serverComm';
import { formatTimeTo12Hour } from '@/lib/time';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { MoreVertical, Trash2 } from 'lucide-react';
import { buildAssignedByShift } from './Schedules.utils';

function formatScheduleRange(startISO: string, endISO: string) {
  const start = new Date(startISO + 'T00:00:00');
  const end = new Date(endISO + 'T00:00:00');
  const sameMonth = start.getFullYear() === end.getFullYear() && start.getMonth() === end.getMonth();
  if (sameMonth) {
    const monthFull = start.toLocaleString(undefined, { month: 'long' });
    return `${monthFull} ${start.getDate()}-${end.getDate()}, ${start.getFullYear()}`;
  }
  const startStr = start.toLocaleString(undefined, { month: 'long', day: 'numeric' });
  const endStr = end.toLocaleString(undefined, { month: 'long', day: 'numeric', year: 'numeric' });
  return `${startStr} - ${endStr}`;
}

export default function Schedules() {
  const params = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [schedules, setSchedules] = useState<ScheduleRecord[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(params.scheduleId || null);
  const [loadingSchedules, setLoadingSchedules] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [departments, setDepartments] = useState<DepartmentRecord[]>([]);

  const departmentId = useMemo(() => {
    const fromSearch = searchParams.get('departmentId') || undefined;
    if (fromSearch) return fromSearch;
    try { return localStorage.getItem('sc_sched_departmentId') || undefined; } catch { return undefined; }
  }, [searchParams]);

  const updateQuery = (next: { departmentId?: string }) => {
    const sp = new URLSearchParams(searchParams.toString());
    if (next.departmentId == null || next.departmentId === '') sp.delete('departmentId');
    else sp.set('departmentId', String(next.departmentId));
    setSearchParams(sp, { replace: true });
    try {
      if (next.departmentId) localStorage.setItem('sc_sched_departmentId', next.departmentId);
      else localStorage.removeItem('sc_sched_departmentId');
    } catch {}
  };

  useEffect(() => {
    let cancelled = false;
    setLoadingSchedules(true);
    (async () => {
      try {
        const rows = await api.listSchedules?.();
        if (!cancelled) setSchedules(rows || []);
      } catch (e: any) {
        if (!cancelled) setError(e?.message || 'Failed to load schedules');
      } finally {
        if (!cancelled) setLoadingSchedules(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const rows = await api.listDepartments?.();
        if (!cancelled) setDepartments(rows || []);
      } catch {}
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => { setSelectedId(params.scheduleId || null); }, [params.scheduleId]);

  const onSelect = (id: string) => {
    setSelectedId(id);
    navigate(`/schedules/${id}`);
  };

  const selected = useMemo(() => schedules.find(s => s.id === selectedId) || null, [schedules, selectedId]);

  return (
    <ListDetailLayout
      left={(
        <div className="space-y-3">
          <div className="p-3 border-b">
            <div className="flex items-center justify-between gap-2">
              <label className="flex items-center gap-2 text-sm shrink-0">
                <span>Department</span>
                <select
                  className="border rounded px-2 py-1"
                  value={departmentId || ''}
                  onChange={(e) => updateQuery({ departmentId: e.target.value })}
                >
                  <option value="">All</option>
                  {departments.map(d => (<option key={d.id} value={d.id}>{d.name}</option>))}
                </select>
              </label>
            </div>
          </div>
          <List<ScheduleRecord>
            items={schedules}
            selectedId={selectedId}
            onSelect={onSelect}
            loading={loadingSchedules}
            emptyText="No schedules"
            renderItem={(s) => (
              <>
                <div className="font-medium text-sm">{s.name || 'Schedule'}</div>
                <div className="text-xs text-muted-foreground">{formatScheduleRange(s.startDate, s.endDate)}</div>
                {s.isPublished ? (
                  <div className="text-[10px] inline-flex px-1.5 py-0.5 rounded bg-green-100 text-green-700">Published</div>
                ) : null}
              </>
            )}
            renderActions={(s) => (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="size-7 inline-flex items-center justify-center rounded hover:bg-accent">
                    <MoreVertical className="size-4" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem className="text-red-600" onClick={async () => {
                    const ok = window.confirm('Delete this schedule and all related shifts and assignments? This cannot be undone.');
                    if (!ok) return;
                    try {
                      await (api as any).deleteSchedule?.(s.id);
                      const rows = await api.listSchedules?.();
                      setSchedules(rows || []);
                      if (selectedId === s.id) setSelectedId(null);
                    } catch (e: any) {
                      alert(e?.message || 'Failed to delete schedule');
                    }
                  }}>
                    <Trash2 className="mr-2 h-4 w-4" /> Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          />
        </div>
      )}
      right={(
        <ScheduleDetail schedule={selected} departmentId={departmentId} />
      )}
    />
  );
}

function ScheduleDetail({ schedule, departmentId }: { schedule: ScheduleRecord | null; departmentId?: string }) {
  const [shifts, setShifts] = useState<ShiftRecord[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [eventTitles, setEventTitles] = useState<Record<string, string>>({});
  const [assignedByShift, setAssignedByShift] = useState<Record<string, Array<{ areaName?: string; positionName?: string; employeeName?: string }>>>({});
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!schedule) { setShifts([]); return; }
      setLoading(true); setError(null);
      try {
        const payload = await api.getScheduleDetail?.({ scheduleId: schedule.id, departmentId });
        if (!payload) { if (!cancelled) { setShifts([]); setAssignedByShift({}); setEventTitles({}); } return; }
        if (!cancelled) setShifts(payload.shifts || []);

        const eventsMap: Record<string, string> = {};
        const eventsById = payload.eventsById || {};
        Object.keys(eventsById).forEach((id) => { eventsMap[id] = eventsById[id]!.title || id; });
        if (!cancelled) setEventTitles(eventsMap);

        const grouped = buildAssignedByShift(
          payload.assignments || [],
          payload.areasByEvent || {},
          payload.positionsByDept || {},
          payload.employeesByDept || {},
          (payload.shifts || []).map(s => ({ id: s.id, departmentId: s.departmentId, eventId: s.eventId }))
        );
        if (!cancelled) setAssignedByShift(grouped);
      } catch (e: any) {
        if (!cancelled) setError(e?.message || 'Failed to load schedule');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [schedule?.id, departmentId]);

  if (!schedule) return <div className="p-4 text-sm text-muted-foreground">Select a schedule</div>;
  if (loading) return <div className="p-4 text-sm text-muted-foreground">Loading…</div>;

  return (
    <div className="routeFadeItem detailPaneAccent space-y-3 p-3">
      {error ? <div className="text-sm text-red-600">{error}</div> : null}
      <div className="text-sm">
        <div className="font-medium">{schedule.name || 'Schedule'}</div>
        <div className="text-muted-foreground">{formatScheduleRange(schedule.startDate, schedule.endDate)}</div>
      </div>
      <div className="border rounded divide-y">
        {shifts.length === 0 ? (
          <div className="p-3 text-sm text-muted-foreground">No shifts for this schedule</div>
        ) : (
          shifts.map(shift => (
            <div
              key={shift.id}
              className="p-3 text-sm space-y-1 hover:bg-muted/50 cursor-pointer"
              onClick={() => {
                const target = shift.departmentId ? `/departments/${shift.departmentId}/scheduling/${shift.id}` : `/scheduling/${shift.id}`;
                navigate(target);
              }}
            >
              <div className="font-medium">{shift.title || 'Shift'} — {shift.date} | {formatTimeTo12Hour(shift.startTime)} – {formatTimeTo12Hour(shift.endTime)}</div>
              <div>Event: {shift.eventId ? (eventTitles[shift.eventId] || shift.eventId) : 'None'}</div>
              {(() => {
                const items = assignedByShift[shift.id] || [];
                if (items.length === 0) return <div>Employees: None</div>;
                const byArea = new Map<string, Array<{ positionName?: string; employeeName?: string }>>();
                items.forEach(it => {
                  const key = it.areaName || 'Unassigned Area';
                  if (!byArea.has(key)) byArea.set(key, []);
                  byArea.get(key)!.push({ positionName: it.positionName, employeeName: it.employeeName });
                });
                return (
                  <div className="space-y-1">
                    {Array.from(byArea.entries()).map(([areaName, list]) => (
                      <div key={areaName}>
                        <div className="text-muted-foreground">{areaName}</div>
                        <div>
                          {list.length > 0 ? list.map((it, idx) => (
                            <span key={idx}>
                              {it.positionName ? it.positionName : 'Position'}{it.employeeName ? ` - ${it.employeeName}` : ''}{idx < list.length - 1 ? ', ' : ''}
                            </span>
                          )) : 'None'}
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
          ))
        )}
      </div>
    </div>
  );
}


