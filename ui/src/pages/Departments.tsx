import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  type DepartmentRecord,
  listDepartments,
  getDepartment,
  createDepartment,
  updateDepartment,
  deleteDepartment,
} from '@/lib/serverComm';
import { ListDetailLayout, List, FilterBar, CreateInline, useListDetail, useDebouncedPatch, type ResourceAdapter } from '@/features/listDetail';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { MoreVertical } from 'lucide-react';

type CreateForm = {
  name: string;
  description: string;
};

const defaultCreate: CreateForm = {
  name: '',
  description: '',
};

export function Departments() {
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<CreateForm>(defaultCreate);
  const [submitting, setSubmitting] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState('');

  const departmentsAdapter: ResourceAdapter<DepartmentRecord, {}, { q?: string }> = {
    list: async (query) => listDepartments({ q: query?.q }),
    get: async (id) => getDepartment(String(id)),
    create: async (partial) => createDepartment(partial as any),
    update: async (id, patch) => updateDepartment(String(id), patch as any),
    searchableFields: ['name', 'description']
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
    create,
  } = useListDetail<DepartmentRecord, {}, { q?: string}>({
    resourceKey: 'departments',
    adapter: departmentsAdapter,
  });

  const onCreate = async () => {
    if (!form.name.trim() || submitting) return;
    setSubmitting(true);
    setCreateError(null);
    try {
      const payload = {
        name: form.name.trim(),
        description: form.description || undefined,
      };
      await create(payload as any);
      setCreating(false);
      setForm(defaultCreate);
    } catch (err: any) {
      const message = err?.message || 'Failed to create department';
      setCreateError(message);
      console.error('Create department failed:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const { onChange: onNameChange, onBlurFlush: onNameBlur } = useDebouncedPatch<{ name: string}>({
    applyPatch: async (patch) => {
      if (!selected) return;
      const updated = await updateDepartment(selected.id, patch);
      mutateItems(prev => prev.map(i => (i.id === updated.id ? updated : i)));
    }
  });

  const { onChange: onDescChange, onBlurFlush: onDescBlur } = useDebouncedPatch<{ description: string | null}>({
    applyPatch: async (patch) => {
      if (!selected) return;
      const updated = await updateDepartment(selected.id, patch);
      mutateItems(prev => prev.map(i => (i.id === updated.id ? updated : i)));
    }
  });

  return (
    <ListDetailLayout
      left={(
        <>
          <FilterBar<{ }>
            q={queryState.q}
            onQChange={(v) => setQueryState(prev => ({ ...prev, q: v }))}
            actions={(
              <Button size="sm" onClick={() => setCreating(v => !v)}>{creating ? 'Close' : 'New Department'}</Button>
            )}
          />
          <div className="px-3">
            <CreateInline open={creating} onOpenChange={setCreating} toggleLabel={{ open: 'Close', closed: 'New Department' }}>
              <Input placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              <Input placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              {createError && (
                <div className="text-xs text-destructive">{createError}</div>
              )}
              <div className="flex gap-2">
                <Button size="sm" onClick={onCreate} disabled={!form.name.trim() || submitting}>{submitting ? 'Creating…' : 'Create'}</Button>
                <Button size="sm" variant="outline" onClick={() => { setCreating(false); setForm(defaultCreate); setCreateError(null); }}>Cancel</Button>
              </div>
            </CreateInline>
          </div>
          <List<DepartmentRecord>
            items={items}
            selectedId={selectedId}
            onSelect={select}
            loading={loading}
            renderActions={(d) => (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="size-6 inline-flex items-center justify-center rounded hover:bg-accent">
                    <MoreVertical className="size-4" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    variant="destructive"
                    onClick={async () => {
                      const confirmed = window.confirm('Delete this department and cascade related records?');
                      if (!confirmed) return;
                      try {
                        await deleteDepartment(d.id);
                        mutateItems(prev => prev.filter(i => i.id !== d.id));
                        if (selectedId === d.id) select(undefined as any);
                      } catch (err) {
                        console.error('Delete department failed', err);
                        alert('Failed to delete department');
                      }
                    }}
                  >
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            renderItem={(d) => (
              <>
                <div className="text-sm font-medium truncate">{d.name}</div>
                <div className="text-xs text-muted-foreground truncate">{d.description || ''}</div>
              </>
            )}
          />
        </>
      )}
      right={(
        <div key={selected?.id || 'none'} className="routeFadeItem detailPaneAccent">
          {!selected ? (
            <div className="text-sm text-muted-foreground">Select a department to view details</div>
          ) : (
            <div className="max-w-3xl space-y-6">
              <div>
                {!editingName ? (
                  <h2
                    className="text-xl font-semibold cursor-text hover:opacity-90"
                    onClick={() => { setEditingName(true); setNameDraft(selected.name); }}
                  >
                    {selected.name || 'Untitled Department'}
                  </h2>
                ) : (
                  <Input
                    autoFocus
                    value={nameDraft}
                    onChange={(e) => {
                      setNameDraft(e.target.value);
                      mutateItems(prev => prev.map(i => (i.id === selected.id ? { ...i, name: e.target.value } : i)));
                      onNameChange({ name: e.target.value });
                    }}
                    onBlur={() => { onNameBlur(); setEditingName(false); }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        (e.target as HTMLInputElement).blur();
                      } else if (e.key === 'Escape') {
                        setEditingName(false);
                      }
                    }}
                    className="text-xl font-semibold"
                  />
                )}
              </div>
              
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Description</label>
                <Input value={selected.description || ''} onChange={(e) => { mutateItems(prev => prev.map(i => (i.id === selected.id ? { ...i, description: e.target.value } : i))); onDescChange({ description: e.target.value || null }); }} onBlur={() => onDescBlur()} />
              </div>

              {/* Positions redesigned panel */}
              <PositionsPanel departmentId={selected.id} />
            </div>
          )}
        </div>
      )}
    />
  );
}

export default Departments;

import { PositionsPanel } from '@/features/positions/PositionsPanel';
