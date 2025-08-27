import type { AssignmentRecord, Area, PositionRecord } from '@/lib/serverComm';

export function buildAssignedByShift(
  assignments: AssignmentRecord[],
  areasByEvent: Record<string, Area[]>,
  positionsByDept: Record<string, Array<{ id: string; name: string }>>,
  employeesByDept: Record<string, Array<{ id: string; name: string }>>,
  shifts: Array<{ id: string; departmentId: string; eventId?: string | null }>
): Record<string, Array<{ areaName?: string; positionName?: string; employeeName?: string }>> {
  const areaNameByEventAndId: Record<string, Record<string, string>> = {};
  for (const [eventId, list] of Object.entries(areasByEvent)) {
    areaNameByEventAndId[eventId] = Object.fromEntries(list.map((a) => [a.id, a.name] as const));
  }
  const positionNameByDeptAndId: Record<string, Record<string, string>> = {};
  for (const [deptId, list] of Object.entries(positionsByDept)) {
    positionNameByDeptAndId[deptId] = Object.fromEntries(list.map((p) => [p.id, p.name] as const));
  }
  const employeeNameByDeptAndId: Record<string, Record<string, string>> = {};
  for (const [deptId, list] of Object.entries(employeesByDept)) {
    employeeNameByDeptAndId[deptId] = Object.fromEntries(list.map((e) => [e.id, e.name] as const));
  }

  const shiftById = new Map(shifts.map((s) => [s.id, s] as const));
  const grouped: Record<string, Array<{ areaName?: string; positionName?: string; employeeName?: string }>> = {};
  for (const a of assignments) {
    const shift = shiftById.get(a.shiftId);
    if (!shift) continue;
    const deptId = shift.departmentId;
    const evtId = shift.eventId || undefined;
    const areaName = a.areaId && evtId ? areaNameByEventAndId[evtId]?.[a.areaId] : undefined;
    const positionName = positionNameByDeptAndId[deptId]?.[a.requiredPositionId];
    const employeeName = a.assigneeEmployeeId ? employeeNameByDeptAndId[deptId]?.[a.assigneeEmployeeId] : undefined;
    if (!grouped[a.shiftId]) grouped[a.shiftId] = [];
    grouped[a.shiftId].push({ areaName, positionName, employeeName });
  }
  return grouped;
}


