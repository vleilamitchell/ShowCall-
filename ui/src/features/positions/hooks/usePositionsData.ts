import { useEffect, useMemo, useState } from 'react';
import { listEmployees, listEmployeePositions, listPositions, type EmployeeRecord, type EmployeePositionRecord, type PositionRecord } from '@/lib/serverComm';

export function usePositionsData(departmentId: string) {
  const [positions, setPositions] = useState<PositionRecord[] | null>(null);
  const [employees, setEmployees] = useState<EmployeeRecord[] | null>(null);
  const [employeePositions, setEmployeePositions] = useState<EmployeePositionRecord[] | null>(null);

  const loadAll = async (opts?: { q?: string }) => {
    const [pos, emps, eps] = await Promise.all([
      listPositions(departmentId, opts?.q ? { q: opts.q } : undefined),
      listEmployees(departmentId),
      listEmployeePositions(departmentId),
    ]);
    setPositions(pos);
    setEmployees(emps);
    setEmployeePositions(eps);
  };

  useEffect(() => { void loadAll(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [departmentId]);

  const mappingsByPosition = useMemo(() => {
    const map = new Map<string, EmployeePositionRecord[]>();
    (employeePositions || []).forEach((ep) => {
      const arr = map.get(ep.positionId) || [];
      arr.push(ep);
      map.set(ep.positionId, arr);
    });
    return map;
  }, [employeePositions]);

  return {
    positions,
    employees,
    employeePositions,
    setPositions,
    setEmployees,
    setEmployeePositions,
    mappingsByPosition,
    reload: loadAll,
  } as const;
}


