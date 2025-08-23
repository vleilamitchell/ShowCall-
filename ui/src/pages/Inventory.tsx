import { useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import DepartmentSelect from '@/components/DepartmentSelect';
import { ListDetailLayout, List, FilterBar, useListDetail, useDebouncedPatch, type ResourceAdapter, type ListItem } from '@/features/listDetail';
import {
  type InventoryItemRecord,
  listInventoryItems,
  createInventoryItem,
  getInventoryItem,
  patchInventoryItem,
  listInventorySchemas,
} from '@/lib/serverComm';

const allowedItemTypes = ['Consumable', 'ReturnableAsset', 'FixedAsset', 'Perishable', 'Rental', 'Kit'] as const;

type InventoryListItem = ListItem<string> & Omit<InventoryItemRecord, 'itemId'> & { id: string };

type CreateForm = {
  sku: string;
  name: string;
  itemType: string;
  baseUnit: string;
  attributesText: string;
  categoryId?: string;
  active: boolean;
};

const defaultCreate: CreateForm = {
  sku: '',
  name: '',
  itemType: '',
  baseUnit: '',
  attributesText: '{\n  \n}',
  categoryId: undefined,
  active: true,
};

export function Inventory() {
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<CreateForm>(defaultCreate);
  const [submitting, setSubmitting] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [schemaItemTypes, setSchemaItemTypes] = useState<string[] | null>(null);

  const adapter: ResourceAdapter<InventoryListItem, { itemType?: string; active?: boolean }, { q?: string }> = {
    list: async (query, filters) => {
      const rows = await listInventoryItems({ q: query?.q, itemType: filters?.itemType, active: filters?.active });
      return rows.map((r) => ({ id: r.itemId, sku: r.sku, name: r.name, itemType: r.itemType, baseUnit: r.baseUnit, categoryId: r.categoryId, schemaId: r.schemaId, attributes: r.attributes, active: r.active }));
    },
    get: async (id) => {
      const r = await getInventoryItem(String(id));
      return { id: r.itemId, sku: r.sku, name: r.name, itemType: r.itemType, baseUnit: r.baseUnit, categoryId: r.categoryId, schemaId: r.schemaId, attributes: r.attributes, active: r.active };
    },
    create: async (partial) => {
      const created = await createInventoryItem(partial as any);
      return { id: created.itemId, sku: created.sku, name: created.name, itemType: created.itemType, baseUnit: created.baseUnit, categoryId: created.categoryId, schemaId: created.schemaId, attributes: created.attributes, active: created.active };
    },
    update: async (id, patch) => {
      const updated = await patchInventoryItem(String(id), patch as any);
      return { id: updated.itemId, sku: updated.sku, name: updated.name, itemType: updated.itemType, baseUnit: updated.baseUnit, categoryId: updated.categoryId, schemaId: updated.schemaId, attributes: updated.attributes, active: updated.active };
    },
    searchableFields: ['name', 'sku', 'itemType'],
  };
  // Load available item types from server schemas
  useMemo(() => {
    (async () => {
      try {
        const rows = await listInventorySchemas();
        const unique = Array.from(new Set(rows.map((r) => r.itemType))).sort();
        setSchemaItemTypes(unique);
      } catch (e) {
        // ignore; fallback to static list
      }
    })();
  }, []);


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
  } = useListDetail<InventoryListItem, { itemType?: string; active?: boolean }, { q?: string }>({
    resourceKey: 'inventory',
    adapter,
  });

  const secondaryText = (it: InventoryListItem) => it.itemType || it.sku || '';

  const onSubmitCreate = async () => {
    if (!form.name.trim() || !form.sku.trim() || !form.itemType.trim() || !form.baseUnit.trim() || submitting) return;
    setSubmitting(true);
    setCreateError(null);
    try {
      let attributes: any = {};
      const text = form.attributesText.trim();
      if (text) {
        try {
          attributes = JSON.parse(text);
        } catch (e: any) {
          setCreateError('Attributes must be valid JSON');
          setSubmitting(false);
          return;
        }
      }
      const trimmedType = form.itemType.trim();
      const allowed = (schemaItemTypes && schemaItemTypes.length ? schemaItemTypes : (allowedItemTypes as unknown as string[]));
      if (!allowed.includes(trimmedType)) {
        setCreateError(`Item Type must be one of: ${allowed.join(', ')}`);
        setSubmitting(false);
        return;
      }
      const payload: any = {
        sku: form.sku.trim(),
        name: form.name.trim(),
        itemType: trimmedType,
        baseUnit: form.baseUnit.trim(),
        attributes,
        categoryId: form.categoryId || undefined,
        active: form.active,
      };
      const created = await create(payload as any);
      if (created) {
        setCreating(false);
        setForm(defaultCreate);
      }
    } catch (err: any) {
      const message = err?.message || 'Failed to create item';
      setCreateError(message);
      // eslint-disable-next-line no-console
      console.error('Create inventory item failed:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const { onChange: onNameChange, onBlurFlush: onNameBlur } = useDebouncedPatch<{ name: string }>({
    applyPatch: async (patch) => {
      if (!selected) return;
      const updated = await patchInventoryItem(selected.id, patch as any);
      mutateItems((prev) => prev.map((i) => (i.id === updated.itemId ? { ...i, name: updated.name } : i)));
    },
  });

  const { onChange: onBaseUnitChange, onBlurFlush: onBaseUnitBlur } = useDebouncedPatch<{ baseUnit: string }>({
    applyPatch: async (patch) => {
      if (!selected) return;
      const updated = await patchInventoryItem(selected.id, patch as any);
      mutateItems((prev) => prev.map((i) => (i.id === updated.itemId ? { ...i, baseUnit: updated.baseUnit } : i)));
    },
  });

  const onToggleActive = async (next: boolean) => {
    if (!selected) return;
    const updated = await patchInventoryItem(selected.id, { active: next } as any);
    mutateItems((prev) => prev.map((i) => (i.id === updated.itemId ? { ...i, active: updated.active } : i)));
  };

  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState('');

  const attributesPretty = useMemo(() => {
    try {
      return JSON.stringify(selected?.attributes ?? {}, null, 2);
    } catch {
      return '' + (selected?.attributes ?? '');
    }
  }, [selected]);

  return (
    <ListDetailLayout
      left={(
        <>
          <DepartmentSelect className="px-3 py-2" />
          <FilterBar<{ }>
            q={queryState.q}
            onQChange={(v) => setQueryState((prev) => ({ ...prev, q: v }))}
            actions={(
              <Button size="sm" onClick={() => { setCreating(true); setForm(defaultCreate); setCreateError(null); }}>+ New</Button>
            )}
          />
          <List<InventoryListItem>
            items={items}
            selectedId={selectedId}
            onSelect={select}
            loading={loading}
            renderItem={(it) => (
              <>
                <div className="text-sm font-medium truncate">{it.name}</div>
                <div className="text-xs text-muted-foreground truncate">{secondaryText(it)}</div>
              </>
            )}
          />
        </>
      )}
      right={(
        <div key={(creating ? 'creating' : selected?.id) || 'none'} className="routeFadeItem">
          {creating ? (
            <div className="max-w-3xl space-y-6">
              <h2 className="text-xl font-semibold">New Inventory Item</h2>
              <div className="grid grid-cols-2 gap-3 max-w-xl">
                <Input placeholder="SKU" value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} />
                <Input placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                <div>
                  <Input placeholder="Item Type" list="inventoryItemTypeOptions" value={form.itemType} onChange={(e) => setForm({ ...form, itemType: e.target.value })} />
                  <datalist id="inventoryItemTypeOptions">
                    {(schemaItemTypes && schemaItemTypes.length ? schemaItemTypes : (allowedItemTypes as unknown as string[])).map((t) => (
                      <option key={t} value={t} />
                    ))}
                  </datalist>
                </div>
                <Input placeholder="Base Unit" value={form.baseUnit} onChange={(e) => setForm({ ...form, baseUnit: e.target.value })} />
                <Input placeholder="Category ID (optional)" value={form.categoryId || ''} onChange={(e) => setForm({ ...form, categoryId: e.target.value || undefined })} />
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Attributes (JSON)</label>
                <textarea className="w-full h-48 border rounded px-2 py-1 font-mono text-xs"
                  value={form.attributesText}
                  onChange={(e) => setForm({ ...form, attributesText: e.target.value })}
                />
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={form.active} onCheckedChange={(v) => setForm({ ...form, active: !!v })} />
                <span className="text-sm">Active</span>
              </div>
              {createError && (
                <div className="text-xs text-destructive">{createError}</div>
              )}
              <div className="mt-6 flex gap-2">
                <Button onClick={onSubmitCreate} disabled={submitting || !form.name.trim() || !form.sku.trim() || !form.itemType.trim() || !form.baseUnit.trim()}>
                  {submitting ? 'Saving…' : 'Save'}
                </Button>
                <Button variant="outline" onClick={() => { setCreating(false); setForm(defaultCreate); setCreateError(null); }}>Cancel</Button>
              </div>
            </div>
          ) : !selected ? (
            <div className="text-sm text-muted-foreground">Select an inventory item to view details</div>
          ) : (
            <div className="max-w-3xl space-y-6">
              <div>
                {!editingName ? (
                  <h2
                    className="text-xl font-semibold cursor-text hover:opacity-90"
                    onClick={() => { setEditingName(true); setNameDraft(selected.name as string); }}
                  >
                    {selected.name || 'Untitled Item'}
                  </h2>
                ) : (
                  <Input
                    autoFocus
                    value={nameDraft}
                    onChange={(e) => {
                      setNameDraft(e.target.value);
                      mutateItems((prev) => prev.map((i) => (i.id === selected.id ? { ...i, name: e.target.value } : i)));
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

              <div className="grid grid-cols-2 gap-3 max-w-xl">
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Base Unit</label>
                  <Input value={String(selected.baseUnit || '')} onChange={(e) => { mutateItems((prev) => prev.map((i) => (i.id === selected.id ? { ...i, baseUnit: e.target.value } : i))); onBaseUnitChange({ baseUnit: e.target.value }); }} onBlur={() => onBaseUnitBlur()} />
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Item Type</label>
                  <Input value={String(selected.itemType || '')} readOnly />
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">SKU</label>
                  <Input value={String(selected.sku || '')} readOnly />
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Schema ID</label>
                  <Input value={String(selected.schemaId || '')} readOnly />
                </div>
              </div>

              <div>
                <label className="block text-xs text-muted-foreground mb-1">Attributes</label>
                <textarea className="w-full h-48 border rounded px-2 py-1 font-mono text-xs" readOnly value={attributesPretty} />
              </div>

              <div className="flex items-center gap-2">
                <Switch checked={!!selected.active} onCheckedChange={onToggleActive} />
                <span className="text-sm">Active</span>
              </div>
            </div>
          )}
        </div>
      )}
    />
  );
}

export default Inventory;


