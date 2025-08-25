import { useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { ArrowUpDown, Plus } from 'lucide-react';
import { listDepartments, listEmployees, createEmployee, updateEmployee, type EmployeeRecord, type DepartmentRecord } from '@/lib/serverComm';
import { ListDetailLayout, List, CreateInline, useListDetail, useDebouncedPatch, type ResourceAdapter } from '@/features/listDetail';
import { useParams } from 'react-router-dom';

type EmployeeFilters = { departmentId: string; sort?: 'name_asc' | 'name_desc' | 'priority_desc' | 'priority_asc' };
type EmployeeQuery = { q?: string };

export default function Employees() {
  const params = useParams<{ departmentId?: string }>();
  const [departments, setDepartments] = useState<DepartmentRecord[]>([]);
  const [selectedDeptId, setSelectedDeptId] = useState<string>('');
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<{ name: string; email: string }>({ name: '', email: '' });
  const [submitting, setSubmitting] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const employeesAdapter: ResourceAdapter<EmployeeRecord, EmployeeFilters, EmployeeQuery> = {
    list: async (query, filters) => {
      if (!filters?.departmentId) return [];
      let rows: EmployeeRecord[] = [];
      if (filters.departmentId === '-') {
        const depts = await listDepartments();
        const all = await Promise.all(depts.map(d => listEmployees(d.id)));
        rows = all.flat();
      } else {
        rows = await listEmployees(filters.departmentId);
      }
      const needle = (query?.q || '').trim().toLowerCase();
      if (needle) {
        rows = rows.filter(e => {
          const values = [e.fullName, e.name, e.email, e.primaryPhone, e.firstName, e.lastName].filter(Boolean).map(v => String(v).toLowerCase());
          return values.some(v => v.includes(needle));
        });
      }
      const getName = (e: EmployeeRecord) => (e.fullName || e.name || [e.firstName, e.lastName].filter(Boolean).join(' ')).trim().toLowerCase();
      switch (filters?.sort) {
        case 'name_desc':
          rows = [...rows].sort((a, b) => getName(b).localeCompare(getName(a)));
          break;
        case 'priority_desc':
          rows = [...rows].sort((a, b) => (Number(b.priority ?? -1) - Number(a.priority ?? -1)) || getName(a).localeCompare(getName(b)));
          break;
        case 'priority_asc':
          rows = [...rows].sort((a, b) => (Number(a.priority ?? Number.MAX_SAFE_INTEGER) - Number(b.priority ?? Number.MAX_SAFE_INTEGER)) || getName(a).localeCompare(getName(b)));
          break;
        case 'name_asc':
        default:
          rows = [...rows].sort((a, b) => getName(a).localeCompare(getName(b)));
      }
      return rows;
    },
    get: async (id) => {
      if (!selectedDeptId) throw new Error('No department selected');
      let pool: EmployeeRecord[] = [];
      if (selectedDeptId === '-') {
        const depts = await listDepartments();
        const all = await Promise.all(depts.map(d => listEmployees(d.id)));
        pool = all.flat();
      } else {
        pool = await listEmployees(selectedDeptId);
      }
      const found = pool.find(r => String(r.id) === String(id));
      if (!found) throw new Error('Employee not found');
      return found;
    },
    create: async (partial) => {
      if (!selectedDeptId || selectedDeptId === '-') throw new Error('No department selected');
      return createEmployee(selectedDeptId, partial as any);
    },
    update: async (id, patch) => updateEmployee(String(id), patch as any),
    searchableFields: ['name', 'fullName', 'email', 'primaryPhone', 'firstName', 'lastName']
  };

  const {
    items,
    loading,
    selectedId,
    selected,
    select,
    mutateItems,
    queryState,
    setQueryState,
    filterState,
    setFilterState,
    create,
  } = useListDetail<EmployeeRecord, EmployeeFilters, EmployeeQuery>({
    resourceKey: 'employees',
    adapter: employeesAdapter,
  });

  useEffect(() => {
    (async () => {
      const depts = await listDepartments();
      setDepartments(depts);
      if (depts.length) {
        const fromRoute = (params.departmentId && depts.some(d => String(d.id) === String(params.departmentId))) ? String(params.departmentId) : undefined;
        const initial = fromRoute || '-';
        setFilterState(prev => prev.departmentId ? prev : { ...prev, departmentId: initial });
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const id = String((filterState as EmployeeFilters).departmentId || '');
    if (id !== selectedDeptId) setSelectedDeptId(id);
  }, [filterState, selectedDeptId]);

  const onCreate = async () => {
    if (!form.name.trim() || submitting) return;
    setSubmitting(true);
    setCreateError(null);
    try {
      const payload = {
        name: form.name.trim(),
        email: form.email.trim() || null,
      } as Partial<EmployeeRecord>;
      await create(payload as any);
      setCreating(false);
      setForm({ name: '', email: '' });
    } catch (err: any) {
      const message = err?.message || 'Failed to create employee';
      setCreateError(message);
      console.error('Create employee failed:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const { onChange: onNameChange, onBlurFlush: onNameBlur } = useDebouncedPatch<{ name: string}>({
    applyPatch: async (patch) => {
      if (!selected) return;
      const updated = await updateEmployee(selected.id, patch);
      mutateItems(prev => prev.map(i => (i.id === updated.id ? updated : i)));
    }
  });

  const onDepartmentChange = async (newDeptId: string) => {
    if (!selected) return;
    const prevDeptId = selected.departmentId;
    try {
      const updated = await updateEmployee(selected.id, { departmentId: newDeptId });
      mutateItems(prev => {
        const next = prev.map(i => (i.id === updated.id ? updated : i));
        const currentFilterDept = (filterState as EmployeeFilters).departmentId;
        if (currentFilterDept && currentFilterDept !== '-' && currentFilterDept !== newDeptId) {
          return next.filter(i => i.id !== updated.id);
        }
        return next;
      });
    } catch (e) {
      console.error('Failed to update department', e);
    }
  };

  return (
    <ListDetailLayout
      left={(
        <>
          <div className="p-3 border-b">
            <div className="mb-2">
              <Input placeholder="Search employees" value={queryState.q || ''} onChange={(e) => setQueryState(prev => ({ ...prev, q: e.target.value }))} />
            </div>
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-2 text-sm">
                <span>Department</span>
                <select
                  className="border rounded px-2 py-1 max-w-[180px]"
                  value={(filterState as EmployeeFilters).departmentId || ''}
                  onChange={(e) => setFilterState(prev => ({ ...prev, departmentId: e.target.value }))}
                >
                  <option value="-">All</option>
                  {departments.map(d => (<option key={d.id} value={d.id}>{d.name}</option>))}
                </select>
              </label>
            </div>
            <div className="flex justify-end mt-2">
              <Button size="sm" onClick={() => setCreating(v => !v)} disabled={!selectedDeptId} className="gap-1">
                <Plus className="w-4 h-4" />
                {creating ? 'Close' : 'New'}
              </Button>
            </div>
          </div>
          {!departments.length ? (
            <div className="px-3 py-2 text-xs text-muted-foreground">No departments found. Create a department first.</div>
          ) : null}
          <div className="px-3">
            <CreateInline open={creating} onOpenChange={setCreating} toggleLabel={{ open: 'Close', closed: 'New Employee' }}>
              <Input placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              <Input placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              {createError && (
                <div className="text-xs text-destructive">{createError}</div>
              )}
              <div className="flex gap-2">
                <Button size="sm" onClick={onCreate} disabled={!form.name.trim() || !selectedDeptId || submitting}>{submitting ? 'Creating…' : 'Create'}</Button>
                <Button size="sm" variant="outline" onClick={() => { setCreating(false); setForm({ name: '', email: '' }); setCreateError(null); }}>Cancel</Button>
              </div>
            </CreateInline>
          </div>
          <List<EmployeeRecord>
            items={items}
            selectedId={selectedId}
            onSelect={select}
            loading={loading}
            header={(
              <div className="flex items-center justify-between gap-2">
                <div className="text-xs text-muted-foreground">{items.length} {items.length === 1 ? 'employee' : 'employees'}</div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="sm" variant="outline" className="gap-1">
                      <ArrowUpDown className="w-4 h-4" />
                      Sort
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuLabel>Sort by</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onSelect={() => setFilterState(prev => ({ ...prev, sort: 'name_asc' }))}>Name A→Z</DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => setFilterState(prev => ({ ...prev, sort: 'name_desc' }))}>Name Z→A</DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => setFilterState(prev => ({ ...prev, sort: 'priority_desc' }))}>Priority High→Low</DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => setFilterState(prev => ({ ...prev, sort: 'priority_asc' }))}>Priority Low→High</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )}
            renderItem={(emp) => (
              <>
                <div className="text-sm font-medium truncate">{emp.fullName || emp.name}</div>
                <div className="text-xs text-muted-foreground">{emp.email || '—'}{emp.primaryPhone ? ` • ${emp.primaryPhone}` : ''}</div>
              </>
            )}
          />
        </>
      )}
      right={(
        <div key={selected?.id || 'none'} className="routeFadeItem detailPaneAccent">
          {!selected ? (
            <div className="text-sm text-muted-foreground">Select an employee to view details</div>
          ) : (
            <div className="max-w-3xl space-y-3">
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Name</label>
                <Input value={selected.name} onChange={(e) => { mutateItems(prev => prev.map(i => (i.id === selected.id ? { ...i, name: e.target.value } : i))); onNameChange({ name: e.target.value }); }} onBlur={() => onNameBlur()} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Email</label>
                  <Input value={selected.email || ''} readOnly />
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Phone</label>
                  <Input value={selected.primaryPhone || ''} readOnly />
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Department</label>
                  <select
                    className="border rounded px-2 py-1 w-full"
                    value={selected.departmentId}
                    onChange={(e) => onDepartmentChange(e.target.value)}
                  >
                    {departments.map(d => (<option key={d.id} value={d.id}>{d.name}</option>))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Priority</label>
                  <Input value={String(selected.priority ?? '')} readOnly />
                </div>
                <div className="col-span-2 grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs text-muted-foreground mb-1">Address 1</label>
                    <Input value={selected.address1 || ''} readOnly />
                  </div>
                  <div>
                    <label className="block text-xs text-muted-foreground mb-1">Address 2</label>
                    <Input value={selected.address2 || ''} readOnly />
                  </div>
                  <div>
                    <label className="block text-xs text-muted-foreground mb-1">City</label>
                    <Input value={selected.city || ''} readOnly />
                  </div>
                  <div>
                    <label className="block text-xs text-muted-foreground mb-1">State</label>
                    <Input value={selected.state || ''} readOnly />
                  </div>
                  <div>
                    <label className="block text-xs text-muted-foreground mb-1">ZIP</label>
                    <Input value={selected.postalCode || ''} readOnly />
                  </div>
                  <div>
                    <label className="block text-xs text-muted-foreground mb-1">+4</label>
                    <Input value={selected.postalCode4 || ''} readOnly />
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Emergency Contact</label>
                  <Input value={selected.emergencyContactName || ''} readOnly />
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Emergency Phone</label>
                  <Input value={selected.emergencyContactPhone || ''} readOnly />
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    />
  );
}

