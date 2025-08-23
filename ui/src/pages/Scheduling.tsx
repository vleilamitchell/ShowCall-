import { useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams, useNavigate, useLocation } from 'react-router-dom';
import { api, DepartmentRecord, ScheduleRecord, ShiftRecord, PositionRecord, EligibleEmployee } from '@/lib/serverComm';
import { ListDetailLayout } from '@/features/listDetail/components/ListDetailLayout';
import { List } from '@/features/listDetail';
import { Input } from '@/components/ui/input';
import { DateField } from '@/components/date-field';
import { TimeField } from '@/components/time-field';
import { formatTimeTo12Hour } from '@/lib/time';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { ChevronDown, MoreVertical } from 'lucide-react';

type FilterState = { departmentId?: string; q?: string };

export default function Scheduling() {
  const params = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();

  const [departments, setDepartments] = useState<DepartmentRecord[]>([]);
  const [schedules, setSchedules] = useState<ScheduleRecord[]>([]);
  const [shifts, setShifts] = useState<ShiftRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedId, setSelectedId] = useState<string | null>(params.shiftId || null);
  // Inline new shift state
  const [creating, setCreating] = useState(false);
  // no-op flag removed
  const [newScheduleOpen, setNewScheduleOpen] = useState(false);
  const [newScheduleName, setNewScheduleName] = useState('');
  const [newScheduleStart, setNewScheduleStart] = useState('');
  const [newScheduleEnd, setNewScheduleEnd] = useState('');
  const [newScheduleBusy, setNewScheduleBusy] = useState(false);
  const [newScheduleMessage, setNewScheduleMessage] = useState<string | null>(null);
  const [creatingShift, setCreatingShift] = useState(false);
  const [newShiftDate, setNewShiftDate] = useState('');
  const [newShiftStart, setNewShiftStart] = useState('');
  const [newShiftEnd, setNewShiftEnd] = useState('');
  const [newShiftTitle, setNewShiftTitle] = useState('');
  const [createWarnings, setCreateWarnings] = useState<string[] | null>(null);

  const filters: FilterState = useMemo(() => ({
    departmentId: params.departmentId || searchParams.get('departmentId') || undefined,
    q: searchParams.get('q') || undefined,
  }), [params.departmentId, searchParams]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [depts, schs] = await Promise.all([
          api.listDepartments?.(),
          api.listSchedules?.(),
        ]);
        if (cancelled) return;
        setDepartments(depts || []);
        setSchedules(schs || []);
      } catch (e: any) {
        if (!cancelled) setError(e?.message || 'Failed to load');
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        let rows: ShiftRecord[] | undefined;
        if (!filters.departmentId) {
          rows = await (api as any).listAllShifts?.({ q: filters.q });
        } else {
          rows = await api.listShifts?.(filters.departmentId!, { q: filters.q });
        }
        if (!cancelled) setShifts(rows || []);
      } catch (e: any) {
        if (!cancelled) setError(e?.message || 'Failed to load shifts');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [filters.departmentId, filters.q]);

  useEffect(() => {
    setSelectedId(params.shiftId || null);
  }, [params.shiftId]);

  // Auto-select the first shift when none is selected
  useEffect(() => {
    if (!selectedId && shifts && shifts.length > 0) {
      onSelect(shifts[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, shifts]);

  const onSelect = (id: string) => {
    setSelectedId(id);
    const base = filters.departmentId ? `/departments/${filters.departmentId}/scheduling/${id}` : `/scheduling/${id}`;
    navigate(base + location.search);
  };

  const updateQuery = (next: Partial<FilterState>) => {
    const sp = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(next)) {
      if (v == null || v === '') sp.delete(k);
      else sp.set(k, String(v));
    }
    setSearchParams(sp, { replace: true });
  };
  
  const onCreateShift = async () => {
    if (!filters.departmentId) return;
    if (!newShiftDate || !newShiftStart || !newShiftEnd) return;
    setCreatingShift(true);
    setCreateWarnings(null);
    try {
      const res = await api.createShift?.(filters.departmentId!, {
        date: newShiftDate,
        startTime: newShiftStart,
        endTime: newShiftEnd,
        title: newShiftTitle || undefined,
      } as any);
      const rows = await (filters.departmentId
        ? api.listShifts?.(filters.departmentId!, { q: filters.q })
        : (api as any).listAllShifts?.({ q: filters.q }));
      setShifts(rows || []);
      if (res && (res as any).warnings && Array.isArray((res as any).warnings) && (res as any).warnings.length > 0) {
        setCreateWarnings((res as any).warnings);
      } else {
        setCreateWarnings(null);
      }
      setNewShiftTitle(''); setNewShiftDate(''); setNewShiftStart(''); setNewShiftEnd('');
    } catch (e: any) {
      setError(e?.message || 'Failed to create shift');
    } finally {
      setCreatingShift(false);
    }
  };

  return (
    <ListDetailLayout
      left={
        <div className="space-y-3">
          <div className="p-3 border-b">
            <div className="flex items-center justify-between gap-2">
              <div className="flex-1" />
              <Button size="sm" variant="secondary" onClick={() => setNewScheduleOpen(v => !v)} disabled={!filters.departmentId} className="gap-1">
                {newScheduleOpen ? 'Close' : 'Make schedule'}
              </Button>
            </div>
          </div>
          <div className="px-3">
            {newScheduleOpen && (
              <div className="border rounded p-2 mb-2 space-y-2">
                {!filters.departmentId ? (
                  <div className="text-xs text-muted-foreground">Select a department to create a schedule.</div>
                ) : (
                  <>
                    <div className="flex flex-wrap items-end gap-2">
                      <div>
                        <label className="block text-xs text-muted-foreground">Name</label>
                        <input className="border rounded px-2 py-1 text-sm" value={newScheduleName} onChange={(e) => setNewScheduleName(e.target.value)} placeholder="Schedule name" />
                      </div>
                      <div>
                        <label className="block text-xs text-muted-foreground">Start</label>
                        <DateField value={newScheduleStart} onChange={(v) => setNewScheduleStart(v || '')} />
                      </div>
                      <div>
                        <label className="block text-xs text-muted-foreground">End</label>
                        <DateField value={newScheduleEnd} onChange={(v) => setNewScheduleEnd(v || '')} />
                      </div>
                      <div className="flex items-center gap-1">
                        <Button size="sm" variant="outline" onClick={() => { if (!newScheduleStart) return; const d = new Date(newScheduleStart); d.setDate(d.getDate()+6); const y=d.getFullYear(); const m=String(d.getMonth()+1).padStart(2,'0'); const day=String(d.getDate()).padStart(2,'0'); setNewScheduleEnd(`${y}-${m}-${day}`); }}>Week</Button>
                        <Button size="sm" variant="outline" onClick={() => { if (!newScheduleStart) return; const d = new Date(newScheduleStart); const y=d.getFullYear(); const m=d.getMonth(); const last = new Date(y, m+1, 0); const yy=last.getFullYear(); const mm=String(last.getMonth()+1).padStart(2,'0'); const dd=String(last.getDate()).padStart(2,'0'); setNewScheduleEnd(`${yy}-${mm}-${dd}`); }}>Month</Button>
                      </div>
                      <Button size="sm" onClick={async () => {
                        if (!filters.departmentId) return;
                        if (!newScheduleName || !newScheduleStart || !newScheduleEnd) { setNewScheduleMessage('Fill name, start, end'); return; }
                        setNewScheduleBusy(true); setNewScheduleMessage(null);
                        try {
                          const sched = await api.createSchedule?.({ name: newScheduleName, startDate: newScheduleStart, endDate: newScheduleEnd });
                          if (!sched) throw new Error('Create schedule failed');
                          const existing = await api.listShifts?.(filters.departmentId!, { scheduleId: sched.id });
                          if (existing && existing.length > 0) {
                            const ok = window.confirm('Replace existing shifts for this schedule?');
                            if (!ok) { setNewScheduleBusy(false); return; }
                            await (api as any).generateShiftsForSchedule?.(sched.id, { departmentId: filters.departmentId!, regenerate: true });
                          } else {
                            await (api as any).generateShiftsForSchedule?.(sched.id, { departmentId: filters.departmentId! });
                          }
                          const [schs, rows] = await Promise.all([
                            api.listSchedules?.(),
                            api.listShifts?.(filters.departmentId!, { scheduleId: sched.id }),
                          ]);
                          setSchedules(schs || []);
                          setShifts(rows || []);
                          setNewScheduleMessage('Schedule created and shifts generated');
                          setNewScheduleName(''); setNewScheduleStart(''); setNewScheduleEnd(''); setNewScheduleOpen(false);
                        } catch (e: any) {
                          setNewScheduleMessage(e?.message || 'Failed to make schedule');
                        } finally { setNewScheduleBusy(false); }
                      }} disabled={newScheduleBusy}>{newScheduleBusy ? 'Working…' : 'Create & generate'}</Button>
                    </div>
                    {newScheduleMessage ? <div className="text-xs text-muted-foreground">{newScheduleMessage}</div> : null}
                  </>
                )}
              </div>
            )}
          </div>
          <div className="p-3 border-b">
            <div className="mb-2">
              <Input placeholder="Search shifts" value={filters.q || ''} onChange={(e) => updateQuery({ q: e.target.value || undefined })} />
            </div>
            <div className="flex items-center justify-between gap-2">
              <label className="flex items-center gap-2 text-sm shrink-0">
                <span>Department</span>
                <select
                  className="border rounded px-2 py-1"
                  value={filters.departmentId || ''}
                  onChange={(e) => updateQuery({ departmentId: e.target.value || undefined })}
                >
                  <option value="">All</option>
                  {departments.map(d => (<option key={d.id} value={d.id}>{d.name}</option>))}
                </select>
              </label>
            </div>
            <div className="mt-2 flex justify-end">
              <Button size="sm" onClick={() => setCreating(v => !v)} disabled={!filters.departmentId} className="gap-1">
                {creating ? 'Close' : 'New'}
              </Button>
            </div>
          </div>
          {error ? (<div className="text-xs text-red-600">{error}</div>) : null}
          <div className="px-3">
            {creating && filters.departmentId ? (
              <div className="border rounded p-2 flex flex-wrap gap-2 items-end">
                <div>
                  <label className="block text-xs text-muted-foreground">Date</label>
                  <DateField value={newShiftDate} onChange={(v) => setNewShiftDate(v || '')} />
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground">Start</label>
                  <TimeField value={newShiftStart} onChange={(v) => setNewShiftStart(v || '')} />
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground">End</label>
                  <TimeField value={newShiftEnd} onChange={(v) => setNewShiftEnd(v || '')} />
                </div>
                <div className="flex-1 min-w-[140px]">
                  <label className="block text-xs text-muted-foreground">Title</label>
                  <input className="border rounded px-2 py-1 text-sm w-full" value={newShiftTitle} onChange={(e) => setNewShiftTitle(e.target.value)} placeholder="Optional" />
                </div>
                <Button size="sm" onClick={onCreateShift} disabled={creatingShift}>{creatingShift ? 'Creating…' : 'Create'}</Button>
                {createWarnings && createWarnings.length > 0 ? (
                  <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1">{createWarnings.join(' • ')}</div>
                ) : null}
              </div>
            ) : null}
          </div>
          <List<ShiftRecord>
            items={shifts}
            selectedId={selectedId}
            onSelect={onSelect}
            loading={loading}
            emptyText="No shifts"
            renderItem={(s) => (
              <>
                <div className="flex items-center justify-between">
                  <div className="font-medium text-sm">{s.title || 'Shift'}</div>
                  {s.derivedPublished ? (
                    <span className="text-[10px] px-1.5 py-0.5 bg-green-100 text-green-700 rounded">Published</span>
                  ) : null}
                </div>
                <div className="text-xs text-muted-foreground">{s.date} {formatTimeTo12Hour(s.startTime)} – {formatTimeTo12Hour(s.endTime)}</div>
              </>
            )}
          />
        </div>
      }
      right={
        <ShiftDetail selectedId={selectedId} schedules={schedules} />
      }
    />
  );
}

function ShiftDetail({ selectedId, schedules }: { selectedId: string | null; schedules: ScheduleRecord[] }) {
  const [record, setRecord] = useState<ShiftRecord | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [eventTitle, setEventTitle] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!selectedId) { setRecord(null); return; }
    (async () => {
      try {
        const r = await api.getShift?.(selectedId);
        if (!cancelled) setRecord(r || null);
      } catch (e: any) {
        if (!cancelled) setError(e?.message || 'Failed to load shift');
      }
    })();
    return () => { cancelled = true; };
  }, [selectedId]);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (record?.eventId) {
        try {
          // Clear any previous value to avoid showing stale "name (id)" strings
          setEventTitle(null);
          const evt = await api.getEvent?.(record.eventId);
          if (!cancelled) setEventTitle(evt ? evt.title : null);
        } catch {
          if (!cancelled) setEventTitle(null);
        }
      } else {
        setEventTitle(null);
      }
    })();
    return () => { cancelled = true; };
  }, [record?.eventId]);

  // Save/Close removed; fields update immediately in local state, and can be persisted via other flows

  if (!selectedId) return <div className="p-4 text-sm text-muted-foreground">Select a shift</div>;
  if (!record) return <div className="p-4 text-sm text-muted-foreground">Loading…</div>;

  return (
    <div className="routeFadeItem detailPaneAccent space-y-3">
      {error ? <div className="text-sm text-red-600">{error}</div> : null}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="sm:col-span-2">
          <label className="block text-xs text-muted-foreground">Title</label>
          <input className="border rounded px-2 py-1 text-sm w-full" value={record.title || ''}
            onChange={(e) => setRecord({ ...record, title: e.target.value })} />
        </div>
        <div>
          <label className="block text-xs text-muted-foreground">Event</label>
          <div className="text-sm">{eventTitle ? eventTitle : 'None'}</div>
        </div>
        <div>
          <label className="block text-xs text-muted-foreground">Date</label>
          <DateField value={record.date} onChange={(v) => setRecord({ ...record!, date: v || '' })} />
        </div>
        <div>
          <label className="block text-xs text-muted-foreground">Start</label>
          <TimeField value={record.startTime} onChange={(v) => setRecord({ ...record!, startTime: v || '' })} />
        </div>
        <div>
          <label className="block text-xs text-muted-foreground">End</label>
          <TimeField value={record.endTime} onChange={(v) => setRecord({ ...record!, endTime: v || '' })} />
        </div>
        <div>
          <label className="block text-xs text-muted-foreground">Schedule</label>
          <div className="text-sm">
            {(() => {
              const sched = record.scheduleId ? schedules.find((s) => s.id === record.scheduleId) : null;
              return sched ? sched.name : 'None';
            })()}
          </div>
          {record.scheduleId ? (
            <div className="mt-1 flex items-center gap-2">
              {(() => {
                const sched = schedules.find((s) => s.id === record.scheduleId);
                const derived = Boolean(record.scheduleId && sched?.isPublished);
                return derived ? (
                  <span className="text-[10px] px-1.5 py-0.5 bg-green-100 text-green-700 rounded">Published</span>
                ) : (
                  <span className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-700 rounded">Unpublished</span>
                );
              })()}
              {(() => {
                const sched = schedules.find((s) => s.id === record.scheduleId);
                if (sched && (record.date < sched.startDate || record.date > sched.endDate)) {
                  return <span className="text-[10px] text-amber-700">Date is outside selected schedule</span>;
                }
                return null;
              })()}
            </div>
          ) : null}
        </div>
        <div className="sm:col-span-3">
          <label className="block text-xs text-muted-foreground">Notes</label>
          <textarea className="border rounded px-2 py-1 text-sm w-full" rows={3} value={record.notes || ''}
            onChange={(e) => setRecord({ ...record, notes: e.target.value })} />
        </div>
      </div>
      <div className="pt-2 border-t">
        <AssignmentsPanel departmentId={record.departmentId} shiftId={record.id} />
      </div>
    </div>
  );
}

function AssignmentsPanel({ departmentId, shiftId }: { departmentId: string; shiftId: string }) {
  const [assignments, setAssignments] = useState<Array<{ id: string; requiredPositionId: string; assigneeEmployeeId: string | null }>>([]);
  const [positions, setPositions] = useState<PositionRecord[]>([]);
  const [eligible, setEligible] = useState<Record<string, EligibleEmployee[]>>({});
  const [creating, setCreating] = useState(false);
  const [newPositionId, setNewPositionId] = useState('');
  const [newAssigneeId, setNewAssigneeId] = useState<string>('');
  const [err, setErr] = useState<string | null>(null);
  const [open, setOpen] = useState<boolean>(() => {
    try { return localStorage.getItem('assignmentsRollupOpen') === '1'; } catch { return false; }
  });

  const load = async () => {
    try {
      const [rows, pos] = await Promise.all([
        api.listAssignments?.(departmentId, shiftId),
        api.listPositions?.(departmentId),
      ]);
      setAssignments((rows || []).map((r) => ({ id: r.id, requiredPositionId: r.requiredPositionId, assigneeEmployeeId: r.assigneeEmployeeId ?? null })));
      setPositions(pos || []);
    } catch (e: any) {
      setErr(e?.message || 'Failed to load assignments');
    }
  };

  useEffect(() => { (async()=>{ if (!departmentId || !shiftId) return; await load(); })(); }, [departmentId, shiftId]);

  const onChangeAssignee = async (assignmentId: string, assigneeId: string | null) => {
    try {
      const updated = await api.updateAssignment?.(assignmentId, { assigneeEmployeeId: assigneeId });
      if (updated) setAssignments((prev) => prev.map((a) => a.id === assignmentId ? { ...a, assigneeEmployeeId: updated.assigneeEmployeeId ?? null } : a));
    } catch (e: any) {
      setErr(e?.message || 'Failed to update assignment');
    }
  };

  const onDelete = async (assignmentId: string) => {
    try { await api.deleteAssignment?.(assignmentId); setAssignments((prev)=>prev.filter(a=>a.id!==assignmentId)); } catch (e:any){ setErr(e?.message||'Failed to delete'); }
  };

  const onCreate = async () => {
    if (!newPositionId) return;
    setCreating(true);
    try {
      const created = await api.createAssignment?.(departmentId, { shiftId, requiredPositionId: newPositionId, assigneeEmployeeId: newAssigneeId || undefined });
      if (created) {
        setAssignments((prev) => [...prev, { id: created.id, requiredPositionId: created.requiredPositionId, assigneeEmployeeId: created.assigneeEmployeeId ?? null }]);
        setNewPositionId(''); setNewAssigneeId('');
      }
    } catch (e: any) {
      setErr(e?.message || 'Failed to create assignment');
    } finally { setCreating(false); }
  };

  const loadEligible = async (positionId: string) => {
    if (!positionId) return;
    if (eligible[positionId]) return;
    try {
      const rows = await api.listEligibleEmployeesForPosition?.(departmentId, positionId);
      setEligible((prev) => ({ ...prev, [positionId]: rows || [] }));
    } catch {}
  };

  useEffect(() => { if (newPositionId) { loadEligible(newPositionId); } }, [newPositionId]);

  useEffect(() => {
    try { localStorage.setItem('assignmentsRollupOpen', open ? '1' : '0'); } catch {}
  }, [open]);

  return (
    <div className="mt-3">
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger asChild>
          <button className="w-full flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2 hover:bg-muted/50 transition-colors">
            <span className="text-sm font-semibold">Assignments</span>
            <ChevronDown className="h-4 w-4 transition-transform data-[state=open]:rotate-180" />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent className="overflow-hidden transition-[max-height,opacity] duration-400 ease-out data-[state=open]:opacity-100 data-[state=closed]:opacity-0 data-[state=open]:max-h-[2000px] data-[state=closed]:max-h-0" style={{ willChange: 'opacity, max-height' }}>
          <div className="space-y-2 px-3 pb-3 pt-2">
            {err ? <div className="text-xs text-red-600">{err}</div> : null}
            <div className="flex items-center gap-3 px-2 text-[11px] uppercase tracking-wide text-muted-foreground">
              <span className="w-[200px]">Position</span>
              <span className="flex-1">Assignee</span>
            </div>
            {assignments.map((a) => (
              <div key={a.id} className="flex items-center gap-2 rounded border p-2">
                <span className="text-sm w-[200px] truncate">{positions.find((p) => p.id === a.requiredPositionId)?.name || a.requiredPositionId}</span>
                <select className="border rounded px-2 py-1 text-sm flex-1" value={a.assigneeEmployeeId || ''}
                  onChange={(e) => onChangeAssignee(a.id, e.target.value || null)}
                  onFocus={() => loadEligible(a.requiredPositionId)}>
                  <option value="">Unassigned</option>
                  {(eligible[a.requiredPositionId] || []).map((emp) => (
                    <option key={emp.id} value={emp.id}>{emp.name}{emp.priority != null ? ` (p${emp.priority})` : ''}</option>
                  ))}
                </select>
                <div className="ml-auto">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="icon" variant="ghost" aria-label="Assignment actions">
                        <MoreVertical className="size-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem className="text-destructive" onClick={() => onDelete(a.id)}>Delete</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            ))}
            <div className="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-2 items-end">
              <div>
                <label className="block text-xs text-muted-foreground">Position</label>
                <select className="border rounded px-2 py-1 text-sm w-full" value={newPositionId} onChange={(e) => setNewPositionId(e.target.value)}>
                  <option value="">Select…</option>
                  {positions.map((p) => (<option key={p.id} value={p.id}>{p.name}</option>))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-muted-foreground">Assignee</label>
                <select className="border rounded px-2 py-1 text-sm w-full" value={newAssigneeId} onChange={(e) => setNewAssigneeId(e.target.value)} onFocus={() => { if (newPositionId) loadEligible(newPositionId); }}>
                  <option value="">Unassigned</option>
                  {(eligible[newPositionId] || []).map((emp) => (<option key={emp.id} value={emp.id}>{emp.name}{emp.priority != null ? ` (p${emp.priority})` : ''}</option>))}
                </select>
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={onCreate} disabled={creating || !newPositionId}>{creating ? 'Adding…' : 'Add'}</Button>
              </div>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}


