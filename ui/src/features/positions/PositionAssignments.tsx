import { useEffect, useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { listEmployees, listEmployeePositions, createEmployeePosition, deleteEmployeePosition, type EmployeeRecord, type EmployeePositionRecord } from '@/lib/serverComm';

type Filter = 'all' | 'unassigned' | 'assigned';

export function PositionAssignments({ departmentId, positionId, onChanged }: { departmentId: string; positionId: string; onChanged?: () => void }) {
  const [employees, setEmployees] = useState<EmployeeRecord[] | null>(null);
  const [employeePositions, setEmployeePositions] = useState<EmployeePositionRecord[] | null>(null);
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<Filter>('all');

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
    }).filter((e) => {
      const name = (e.fullName || e.name || '').toLowerCase();
      return name.includes(q.toLowerCase());
    });
    return list;
  }, [employees, assignedMap, filter, q]);

  const assignedCount = useMemo(() => (employeePositions || []).filter((ep) => ep.positionId === positionId).length, [employeePositions, positionId]);

  const mapEmployee = async (employeeId: string) => {
    if (assignedMap.has(employeeId)) return;
    const created = await createEmployeePosition({ departmentId, employeeId, positionId, priority: (assignedCount + 1), isLead: false });
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

  // Bulk add removed in simplified UI

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Input placeholder="Search employees" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="flex items-center gap-1 text-xs">
          <Button size="sm" variant={filter === 'all' ? 'default' : 'outline'} onClick={() => setFilter('all')}>All</Button>
          <Button size="sm" variant={filter === 'unassigned' ? 'default' : 'outline'} onClick={() => setFilter('unassigned')}>Unassigned</Button>
          <Button size="sm" variant={filter === 'assigned' ? 'default' : 'outline'} onClick={() => setFilter('assigned')}>Assigned</Button>
        </div>
      </div>
      <div className="rounded-md border h-[420px]">
        {!employees && (<div className="p-3 text-sm text-muted-foreground">Loading…</div>)}
        {employees && employees.length === 0 && (<div className="p-3 text-sm text-muted-foreground">No employees yet</div>)}
        {employees && employees.length > 0 && (
          <ScrollArea className="h-[420px]">
            <div className="divide-y">
              {available.map((e) => {
                const isMapped = assignedMap.has(e.id);
                return (
                  <div key={e.id} className="flex items-center gap-2 p-2 hover:bg-muted/50">
                    <div className="flex-1">
                      <div className="text-sm font-medium truncate">{e.fullName || e.name}</div>
                    </div>
                    <Button size="sm" variant={isMapped ? 'secondary' : 'outline'} onClick={(ev) => { ev.preventDefault(); void (isMapped ? unmapEmployee(e.id) : mapEmployee(e.id)); }}>{isMapped ? 'Remove' : 'Add'}</Button>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </div>
    </div>
  );
}

export default PositionAssignments;


