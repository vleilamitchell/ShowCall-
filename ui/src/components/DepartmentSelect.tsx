import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api, type DepartmentRecord } from '@/lib/serverComm';

export default function DepartmentSelect({ className }: { className?: string }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [departments, setDepartments] = useState<DepartmentRecord[]>([]);
  const departmentId = searchParams.get('departmentId') || '';

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const rows = await api.listDepartments?.();
        if (!cancelled) setDepartments(rows || []);
      } catch {
        // ignore
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const onChange = (value: string) => {
    const next = new URLSearchParams(searchParams.toString());
    if (!value) next.delete('departmentId'); else next.set('departmentId', value);
    setSearchParams(next, { replace: true });
  };

  return (
    <label className={className ? className + ' flex items-center gap-2 text-sm' : 'flex items-center gap-2 text-sm'}>
      <span className="text-muted-foreground">Department</span>
      <select className="border rounded px-2 py-1"
        value={departmentId}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">All</option>
        {departments.map((d) => (
          <option key={d.id} value={d.id}>{d.name}</option>
        ))}
      </select>
    </label>
  );
}


