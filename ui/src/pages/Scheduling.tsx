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
import { Badge } from '@/components/ui/badge';
import { Rollup } from '@/components/ui/rollup';
import { AssignmentPicker } from '@/components/assignment-picker';

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
    departmentId: params.departmentId || searchParams.get('departmentId') || (typeof window !== 'undefined' ? localStorage.getItem('sc_sched_departmentId') || undefined : undefined),
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
          rows = [];
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
  
  const onDepartmentChange = (value: string) => {
    // Move department selection into the route path so it works from nested routes
    const sp = new URLSearchParams(searchParams.toString());
    sp.delete('departmentId');
    const qs = sp.toString();
    const suffix = qs ? `?${qs}` : '';
    if (value) {
      navigate(`/departments/${value}/scheduling${suffix}`);
    } else {
      navigate(`/scheduling${suffix}`);
    }
  };
  // Persist departmentId selection
  useEffect(() => {
    try {
      if (filters.departmentId) localStorage.setItem('sc_sched_departmentId', filters.departmentId);
      else localStorage.removeItem('sc_sched_departmentId');
    } catch {}
  }, [filters.departmentId]);
  
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
                  onChange={(e) => onDepartmentChange(e.target.value)}
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
  const [selectedPositionId, setSelectedPositionId] = useState<string>('');
  const [busy, setBusy] = useState<boolean>(false);
  const [err, setErr] = useState<string | null>(null);

  const load = async () => {
    try {
      const [rows, pos] = await Promise.all([
        api.listAssignments?.(departmentId, shiftId),
        api.listPositions?.(departmentId),
      ]);
      setAssignments((rows || []).map((r) => ({ id: r.id, requiredPositionId: r.requiredPositionId, assigneeEmployeeId: r.assigneeEmployeeId ?? null })));
      const ps = pos || [];
      setPositions(ps);
      // Default selected position: first with any assignment or first available
      setSelectedPositionId((prev) => {
        if (prev) return prev;
        const firstWithAssignment = (rows || []).find((r) => !!r.requiredPositionId)?.requiredPositionId;
        return firstWithAssignment || (ps[0]?.id || '');
      });
    } catch (e: any) {
      setErr(e?.message || 'Failed to load assignments');
    }
  };

  useEffect(() => { (async()=>{ if (!departmentId || !shiftId) return; await load(); })(); }, [departmentId, shiftId]);

  const ensureEligibleLoaded = async (positionId: string) => {
    if (!positionId) return;
    if (eligible[positionId]) return;
    try {
      const rows = await api.listEligibleEmployeesForPosition?.(departmentId, positionId);
      setEligible((prev) => ({ ...prev, [positionId]: rows || [] }));
    } catch {}
  };

  useEffect(() => { if (selectedPositionId) { void ensureEligibleLoaded(selectedPositionId); } }, [selectedPositionId]);

  const assignedForSelected = useMemo(() => assignments.filter(a => a.requiredPositionId === selectedPositionId), [assignments, selectedPositionId]);
  const assignedEmployeeIds = useMemo(() => new Set(assignedForSelected.filter(a => a.assigneeEmployeeId).map(a => a.assigneeEmployeeId as string)), [assignedForSelected]);
  const pickerItems = useMemo(() => {
    const elig = eligible[selectedPositionId] || [];
    return elig.map(e => ({ id: e.id, label: e.name }));
  }, [eligible, selectedPositionId]);

  const assignEmployee = async (employeeId: string) => {
    if (!selectedPositionId) return;
    setBusy(true);
    setErr(null);
    try {
      // Reuse an open slot if present; otherwise create one
      const open = assignments.find(a => a.requiredPositionId === selectedPositionId && !a.assigneeEmployeeId);
      if (open) {
        const updated = await api.updateAssignment?.(open.id, { assigneeEmployeeId: employeeId });
        if (updated) setAssignments(prev => prev.map(a => a.id === open.id ? { ...a, assigneeEmployeeId: updated.assigneeEmployeeId ?? null } : a));
      } else {
        const created = await api.createAssignment?.(departmentId, { shiftId, requiredPositionId: selectedPositionId, assigneeEmployeeId: employeeId });
        if (created) setAssignments(prev => [...prev, { id: created.id, requiredPositionId: created.requiredPositionId, assigneeEmployeeId: created.assigneeEmployeeId ?? null }]);
      }
    } catch (e: any) {
      setErr(e?.message || 'Failed to assign');
    } finally { setBusy(false); }
  };

  const unassignEmployee = async (employeeId: string) => {
    if (!selectedPositionId) return;
    setBusy(true);
    setErr(null);
    try {
      const row = assignments.find(a => a.requiredPositionId === selectedPositionId && a.assigneeEmployeeId === employeeId);
      if (!row) return;
      await api.deleteAssignment?.(row.id);
      setAssignments(prev => prev.filter(a => a.id !== row.id));
    } catch (e: any) {
      setErr(e?.message || 'Failed to unassign');
    } finally { setBusy(false); }
  };

  const addSlot = async () => {
    if (!selectedPositionId) return;
    setBusy(true);
    setErr(null);
    try {
      const created = await api.createAssignment?.(departmentId, { shiftId, requiredPositionId: selectedPositionId });
      if (created) {
        setAssignments(prev => [...prev, { id: created.id, requiredPositionId: created.requiredPositionId, assigneeEmployeeId: created.assigneeEmployeeId ?? null }]);
      }
    } catch (e: any) {
      setErr(e?.message || 'Failed to add slot');
    } finally {
      setBusy(false);
    }
  };

  // Stats and derived lists
  const totalSlots = assignments.length;
  const totalAssigned = assignments.filter(a => a.assigneeEmployeeId).length;
  const positionStats = useMemo(() => {
    const byId = new Map<string, { id: string; name: string; total: number; assigned: number; open: number }>();
    positions.forEach(p => byId.set(p.id, { id: p.id, name: p.name, total: 0, assigned: 0, open: 0 }));
    assignments.forEach(a => {
      const s = byId.get(a.requiredPositionId) || { id: a.requiredPositionId, name: positions.find(p => p.id === a.requiredPositionId)?.name || a.requiredPositionId, total: 0, assigned: 0, open: 0 };
      s.total += 1;
      if (a.assigneeEmployeeId) s.assigned += 1; else s.open += 1;
      byId.set(a.requiredPositionId, s);
    });
    // Ensure at least some positions exist
    return Array.from(byId.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [positions, assignments]);

  const [showOnlyUsed, setShowOnlyUsed] = useState<boolean>(false);
  const visiblePositions = useMemo(() => showOnlyUsed ? positionStats.filter(s => s.total > 0) : positionStats, [positionStats, showOnlyUsed]);

  const rollupSummary = (
    <div className="flex items-center gap-2">
      <span className="text-[11px] text-muted-foreground">Assigned</span>
      <Badge variant="secondary" className="text-[10px]">{totalAssigned}/{totalSlots}</Badge>
    </div>
  );

  return (
    <div className="mt-3">
      <Rollup title="Assignments" summary={rollupSummary} storageKey="assignmentsRollupOpen">
        <div className="px-3 pb-3 pt-2">
          {err ? <div className="text-xs text-red-600 mb-2">{err}</div> : null}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-1">
              <div className="flex items-center justify-between mb-2">
                <div className="text-xs text-muted-foreground">Positions</div>
                <Button size="sm" variant={showOnlyUsed ? 'default' : 'outline'} onClick={() => setShowOnlyUsed(v => !v)}>
                  {showOnlyUsed ? 'Showing used' : 'Show used'}
                </Button>
              </div>
              <div className="rounded-md border divide-y">
                {visiblePositions.length === 0 ? (
                  <div className="p-3 text-sm text-muted-foreground">No positions</div>
                ) : (
                  visiblePositions.map(s => (
                    <button
                      key={s.id}
                      className={`w-full text-left p-2 hover:bg-muted/50 ${selectedPositionId === s.id ? 'bg-muted/50' : ''}`}
                      onClick={() => setSelectedPositionId(s.id)}
                    >
                      <div className="flex items-center gap-2">
                        <div className="flex-1 truncate text-sm">{s.name}</div>
                        <Badge variant="secondary" className="text-[10px]">{s.assigned}/{s.total}</Badge>
                        {s.open > 0 ? <span className="text-[10px] text-amber-700">+{s.open}</span> : null}
                      </div>
                    </button>
                  ))
                )}
              </div>
              <div className="mt-2 flex items-center gap-2">
                <select
                  className="border rounded px-2 py-1 text-sm flex-1"
                  value={selectedPositionId}
                  onChange={(e) => setSelectedPositionId(e.target.value)}
                >
                  <option value="">Select position…</option>
                  {positions.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
                <Button size="sm" onClick={addSlot} disabled={busy || !selectedPositionId}>Add slot</Button>
              </div>
            </div>
            <div className="sm:col-span-2">
              {!selectedPositionId ? (
                <div className="p-3 text-sm text-muted-foreground border rounded-md">Select a position to manage assignments</div>
              ) : (
                <AssignmentPicker
                  items={pickerItems}
                  isSelected={(id) => assignedEmployeeIds.has(id)}
                  onAdd={assignEmployee}
                  onRemove={unassignEmployee}
                  searchPlaceholder="Search employees"
                />
              )}
            </div>
          </div>
        </div>
      </Rollup>
    </div>
  );
}


