import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { listEmployees, listEmployeePositions, createEmployeePosition, deleteEmployeePosition, updateEmployeePositionsBatch, type EmployeeRecord, type EmployeePositionRecord } from '@/lib/serverComm';

type Filter = 'all' | 'unassigned' | 'assigned';

export function PositionAssignments({ departmentId, positionId, onChanged }: { departmentId: string; positionId: string; onChanged?: () => void }) {
  const [employees, setEmployees] = useState<EmployeeRecord[] | null>(null);
  const [employeePositions, setEmployeePositions] = useState<EmployeePositionRecord[] | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());
  const [q, setQ] = useState('');

  const load = async () => {
    // Prime UI fast with employees; hydrate mappings just after to reduce jank
    const emps = await listEmployees(departmentId);
    setEmployees(emps);
    queueMicrotask(async () => {
      const eps = await listEmployeePositions(departmentId);
      setEmployeePositions(eps);
    });
  };

  useEffect(() => { void load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [departmentId]);

  // No eligible panel in simplified UI

  const assignedMap = useMemo(() => {
    const map = new Map<string, EmployeePositionRecord>();
    (employeePositions || []).forEach((ep) => {
      if (ep.positionId === positionId) map.set(ep.employeeId, ep);
    });
    return map;
  }, [employeePositions, positionId]);

  const available = useMemo(() => {
    const list = (employees || []).filter((e) => {
      if (filter === 'assigned') return assignedMap.has(e.id);
      if (filter === 'unassigned') return !assignedMap.has(e.id);
      return true;
    });
    const needle = q.trim().toLowerCase();
    if (!needle) return list;
    return list.filter((e) => (e.fullName || e.name || '').toLowerCase().includes(needle));
  }, [employees, assignedMap, filter, q]);

  const mapEmployee = async (employeeId: string) => {
    if (assignedMap.has(employeeId)) return;
    // Initialize new priority as (max existing + 1) which corresponds to +0.1 on the display scale
    const currentForPos = (employeePositions || []).filter(ep => ep.positionId === positionId);
    const maxPriority = currentForPos.reduce((m, ep) => Math.max(m, Number(ep.priority || 0)), 0);
    const created = await createEmployeePosition({ departmentId, employeeId, positionId, priority: (maxPriority + 1), isLead: false });
    setEmployeePositions(prev => prev ? [created, ...prev] : [created]);
    onChanged?.();
  };

  const unmapEmployee = async (employeeId: string) => {
    const existing = assignedMap.get(employeeId);
    if (!existing) return;
    await deleteEmployeePosition(existing.id);
    setEmployeePositions(prev => (prev || []).filter(ep => ep.id !== existing.id));
    onChanged?.();
  };

  const onToggleLead = async (employeeId: string, next: boolean) => {
    const existing = assignedMap.get(employeeId);
    if (!existing) return;
    setSavingIds(prev => new Set(prev).add(existing.id));
    try {
      const updated = await updateEmployeePositionsBatch(positionId, [{ id: existing.id, priority: Number(existing.priority || 0), isLead: next }]);
      if (updated && updated[0]) {
        setEmployeePositions(prev => (prev || []).map(ep => ep.id === existing.id ? { ...ep, isLead: updated[0].isLead } : ep));
      }
      onChanged?.();
    } finally {
      setSavingIds(prev => { const n = new Set(prev); n.delete(existing.id); return n; });
    }
  };

  const setPriorityDisplay = async (employeeId: string, nextDisplay: number) => {
    const existing = assignedMap.get(employeeId);
    if (!existing) return;
    const nextInt = Math.max(0, Math.round((Number.isFinite(nextDisplay) ? nextDisplay : 0) * 10));
    setSavingIds(prev => new Set(prev).add(existing.id));
    try {
      const updated = await updateEmployeePositionsBatch(positionId, [{ id: existing.id, priority: nextInt, isLead: existing.isLead }]);
      if (updated && updated[0]) {
        setEmployeePositions(prev => (prev || []).map(ep => ep.id === existing.id ? { ...ep, priority: updated[0].priority } : ep));
      }
      onChanged?.();
    } finally {
      setSavingIds(prev => { const n = new Set(prev); n.delete(existing.id); return n; });
    }
  };

  const stepPriority = async (employeeId: string, delta: number) => {
    const existing = assignedMap.get(employeeId);
    if (!existing) return;
    const currentInt = Number(existing.priority || 0);
    const nextInt = Math.max(0, currentInt + delta);
    setSavingIds(prev => new Set(prev).add(existing.id));
    try {
      const updated = await updateEmployeePositionsBatch(positionId, [{ id: existing.id, priority: nextInt, isLead: existing.isLead }]);
      if (updated && updated[0]) {
        setEmployeePositions(prev => (prev || []).map(ep => ep.id === existing.id ? { ...ep, priority: updated[0].priority } : ep));
      }
      onChanged?.();
    } finally {
      setSavingIds(prev => { const n = new Set(prev); n.delete(existing.id); return n; });
    }
  };

  const filterControls = (
    <div className="flex items-center gap-1 text-xs">
      <Button size="sm" variant={filter === 'all' ? 'default' : 'outline'} onClick={() => setFilter('all')}>All</Button>
      <Button size="sm" variant={filter === 'unassigned' ? 'default' : 'outline'} onClick={() => setFilter('unassigned')}>Unassigned</Button>
      <Button size="sm" variant={filter === 'assigned' ? 'default' : 'outline'} onClick={() => setFilter('assigned')}>Assigned</Button>
    </div>
  );

  // Render table-style list with header and conditional Lead/Priority controls
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Input placeholder="Search employees" value={q} onChange={(e) => setQ(e.target.value)} />
        {filterControls}
      </div>
      <div className="rounded-md border">
        <div className="grid grid-cols-[40px_25%_100px_1fr] items-center px-3 py-2 text-xs font-medium text-muted-foreground border-b bg-muted/30">
          <div />
          <div>Team Member</div>
          <div className="text-center">Lead</div>
          <div className="text-center">Priority</div>
        </div>
        {(available || []).length === 0 ? (
          <div className="p-3 text-sm text-muted-foreground">No results</div>
        ) : (
          <div className="divide-y">
            {(available || []).map((e) => {
              const ep = assignedMap.get(e.id);
              const isSaving = ep ? savingIds.has(ep.id) : false;
              const displayVal = ep ? (Number(ep.priority || 0) / 10).toFixed(1) : '';
              return (
                <div key={e.id} className="grid grid-cols-[40px_25%_100px_1fr] items-center gap-2 px-3 py-2">
                  <div className="flex items-center justify-center">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-muted-foreground/40 text-primary focus:ring-2 focus:ring-ring"
                      checked={!!ep}
                      onChange={(ev) => {
                        if (ev.target.checked) void mapEmployee(e.id); else void unmapEmployee(e.id);
                      }}
                      aria-label="Assign to position"
                      disabled={!!ep && savingIds.has(ep.id)}
                    />
                  </div>
                  <div className="truncate text-sm">
                    {e.fullName || e.name}
                  </div>
                  <div className="flex items-center justify-center">
                    {ep ? (
                      <Switch
                        checked={!!ep.isLead}
                        onCheckedChange={(v) => void onToggleLead(e.id, Boolean(v))}
                        disabled={isSaving}
                        aria-label="Lead"
                      />
                    ) : null}
                  </div>
                  <div className="flex items-center justify-end gap-1">
                    {ep ? (
                      <>
                        <Button size="sm" variant="outline" disabled={isSaving} onClick={() => void stepPriority(e.id, -1)} aria-label="Decrease priority">-</Button>
                        <Input
                          className="w-[64px] text-center"
                          type="text"
                          inputMode="decimal"
                          value={displayVal}
                          onChange={(ev) => {
                            const v = ev.target.value.trim();
                            const num = Number(v);
                            if (!v) return; // ignore empty intermediate
                            if (isNaN(num)) return;
                            void setPriorityDisplay(e.id, Math.round(num * 10) / 10);
                          }}
                          disabled={isSaving}
                        />
                        <Button size="sm" variant="outline" disabled={isSaving} onClick={() => void stepPriority(e.id, +1)} aria-label="Increase priority">+</Button>
                      </>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default PositionAssignments;


