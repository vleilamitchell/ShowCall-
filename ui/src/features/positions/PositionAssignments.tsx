import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { AssignmentPicker, type AssignmentItem } from '@/components/assignment-picker';
import { listEmployees, listEmployeePositions, createEmployeePosition, deleteEmployeePosition, type EmployeeRecord, type EmployeePositionRecord } from '@/lib/serverComm';

type Filter = 'all' | 'unassigned' | 'assigned';

export function PositionAssignments({ departmentId, positionId, onChanged }: { departmentId: string; positionId: string; onChanged?: () => void }) {
  const [employees, setEmployees] = useState<EmployeeRecord[] | null>(null);
  const [employeePositions, setEmployeePositions] = useState<EmployeePositionRecord[] | null>(null);
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
    });
    return list;
  }, [employees, assignedMap, filter]);

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

  const items: AssignmentItem[] = useMemo(() => {
    return (available || []).map((e) => ({ id: e.id, label: e.fullName || e.name }));
  }, [available]);

  const filterControls = (
    <div className="flex items-center gap-1 text-xs">
      <Button size="sm" variant={filter === 'all' ? 'default' : 'outline'} onClick={() => setFilter('all')}>All</Button>
      <Button size="sm" variant={filter === 'unassigned' ? 'default' : 'outline'} onClick={() => setFilter('unassigned')}>Unassigned</Button>
      <Button size="sm" variant={filter === 'assigned' ? 'default' : 'outline'} onClick={() => setFilter('assigned')}>Assigned</Button>
    </div>
  );

  // Bulk add removed in simplified UI

  return (
    <AssignmentPicker
      items={items}
      isSelected={(id) => assignedMap.has(id)}
      onAdd={(id) => mapEmployee(id)}
      onRemove={(id) => unmapEmployee(id)}
      searchPlaceholder="Search employees"
      filterControls={filterControls}
    />
  );
}

export default PositionAssignments;


