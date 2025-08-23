import { useRef, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { ListDetailLayout, SortableList, FilterBar, useListDetail, useDebouncedPatch, type ResourceAdapter } from '@/features/listDetail';
import { listAreas, createArea, updateArea, deleteArea, reorderAreas, type Area } from '@/lib/serverComm';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Check } from 'lucide-react';

type CreateForm = {
  name: string;
  description: string;
  color: string;
  active: boolean;
};

const defaultCreate: CreateForm = {
  name: '',
  description: '',
  color: '',
  active: true,
};

const AREA_COLOR_SWATCHES: string[] = [
  '#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16', '#22c55e', '#10b981', '#14b8a6',
  '#06b6d4', '#0ea5e9', '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899',
  '#f43f5e', '#f87171', '#fb7185', '#94a3b8', '#64748b', '#475569', '#334155', '#111827'
];

export default function Areas() {
  const [draftOpen, setDraftOpen] = useState(false);
  const [draftForm, setDraftForm] = useState<CreateForm>(defaultCreate);
  const [draftSubmitting, setDraftSubmitting] = useState(false);
  const [draftError, setDraftError] = useState<string | null>(null);
  const draftColorRef = useRef<HTMLInputElement | null>(null);
  const [draftColorPickerOpen, setDraftColorPickerOpen] = useState(false);

  const areasAdapter: ResourceAdapter<Area, { activeOnly: boolean }, { q?: string }> = {
    list: async (query, filters) => listAreas({ q: query?.q, active: filters?.activeOnly }),
    get: async (id) => { const rows = await listAreas(); return rows.find(r => r.id === id)!; },
    create: async (partial) => createArea(partial as any),
    update: async (id, patch) => updateArea(String(id), patch as any),
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
    filterState,
    setFilterState,
    create,
  } = useListDetail<Area, { activeOnly: boolean }, { q?: string}>({
    resourceKey: 'areas',
    adapter: areasAdapter,
  });

  const onSaveDraft = async () => {
    if (!draftForm.name.trim() || draftSubmitting) return;
    setDraftSubmitting(true);
    setDraftError(null);
    try {
      const payload = {
        name: draftForm.name.trim(),
        description: draftForm.description || undefined,
        color: draftForm.color || undefined,
        active: !!draftForm.active,
      };
      await create(payload as any);
      setDraftOpen(false);
      setDraftForm(defaultCreate);
    } catch (err: any) {
      const message = err?.message || 'Failed to create area';
      setDraftError(message);
      console.error('Create area failed:', err);
    } finally {
      setDraftSubmitting(false);
    }
  };

  const { onChange: onNameChange, onBlurFlush: onNameBlur } = useDebouncedPatch<Partial<Area>>({
    applyPatch: async (patch) => {
      if (!selected) return;
      const updated = await updateArea(selected.id, patch);
      mutateItems(prev => prev.map(i => (i.id === updated.id ? updated : i)));
    }
  });
  // Description field temporarily removed from UI
  const { onChange: onColorChange, onBlurFlush: onColorBlur } = useDebouncedPatch<Partial<Area>>({
    applyPatch: async (patch) => {
      if (!selected) return;
      const updated = await updateArea(selected.id, patch);
      mutateItems(prev => prev.map(i => (i.id === updated.id ? updated : i)));
    }
  });
  const colorRef = useRef<HTMLInputElement | null>(null);
  const [colorPickerOpen, setColorPickerOpen] = useState(false);

  return (
    <ListDetailLayout
      left={(
        <>
          <FilterBar<{ activeOnly: boolean}>
            q={queryState.q}
            onQChange={(v) => setQueryState(prev => ({ ...prev, q: v }))}
            actions={(
              <div className="flex items-center justify-between rounded-md border bg-card/50 px-3 py-2">
                <div>
                  <div className="text-sm font-medium">Active only</div>
                </div>
                <Switch
                  checked={!!filterState.activeOnly}
                  onCheckedChange={(checked) => setFilterState(prev => ({ ...prev, activeOnly: !!checked }))}
                />
              </div>
            )}
          />
          <SortableList<Area>
            items={items}
            getId={(a) => a.id}
            selectedId={selectedId}
            onSelect={select}
            loading={loading}
            onReorder={async (ids) => {
              // optimistic update
              mutateItems(prev => ids.map(id => prev.find(p => p.id === id)!).filter(Boolean) as Area[]);
              try {
                const updated = await reorderAreas(ids);
                mutateItems(() => updated);
              } catch (e) {
                // on failure, refetch
                const rows = await listAreas();
                mutateItems(() => rows);
              }
            }}
            renderItem={(a) => (
              <>
                <div className="text-sm font-medium truncate inline-flex items-center gap-2">
                  {a.color ? <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: a.color }} /> : <span className="inline-block w-2 h-2 rounded-full bg-muted" />}
                  <span className="truncate">{a.name}</span>
                </div>
                <div className="text-xs text-muted-foreground truncate">{a.description || ' '}</div>
              </>
            )}
          />
        </>
      )}
      right={(
        <div key={(draftOpen ? 'draft' : selected?.id) || 'none'} className="routeFadeItem detailPaneAccent">
          <div className="max-w-3xl space-y-6">
            <div className="flex items-start">
              <div className="flex-1">
                {draftOpen ? (
                  <h2 className="text-xl font-semibold">New Area</h2>
                ) : selected ? (
                  <h2 className="text-xl font-semibold">{selected.name || 'Untitled Area'}</h2>
                ) : (
                  <div className="text-sm text-muted-foreground">Select an area to view details</div>
                )}
              </div>
              <div className="min-w-[140px]">
                <div className={`transition-all duration-300 ${draftOpen ? 'grid grid-rows-[0fr] opacity-0 -translate-y-1' : 'grid grid-rows-[1fr] opacity-100 translate-y-0'}`}>
                  <div className="overflow-hidden flex justify-end">
                    <Button size="sm" onClick={() => { setDraftOpen(true); setDraftForm(defaultCreate); }}>New Area</Button>
                  </div>
                </div>
                <div className={`transition-all duration-300 ${draftOpen ? 'grid grid-rows-[1fr] opacity-100 translate-y-0' : 'grid grid-rows-[0fr] opacity-0 -translate-y-1'}`}>
                  <div className="overflow-hidden flex justify-end">
                    <div className="flex gap-2">
                      <Button size="sm" onClick={onSaveDraft} disabled={!draftForm.name.trim() || draftSubmitting}>{draftSubmitting ? 'Saving…' : 'Save'}</Button>
                      <Button size="sm" variant="outline" onClick={() => { setDraftOpen(false); setDraftForm(defaultCreate); setDraftError(null); }}>Cancel</Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {draftOpen ? (
              <>
                {draftError && (
                  <div className="text-xs text-destructive">{draftError}</div>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <label className="block text-xs text-muted-foreground mb-1">Name</label>
                    <Input value={draftForm.name} onChange={(e) => setDraftForm({ ...draftForm, name: e.target.value })} />
                  </div>
                  <div>
                    <Popover open={draftColorPickerOpen} onOpenChange={setDraftColorPickerOpen}>
                      <PopoverTrigger asChild>
                        <button
                          type="button"
                          className="inline-flex items-center gap-2 rounded-md border p-1 hover:bg-muted/50"
                          aria-label="Pick color"
                        >
                          <span className="inline-block w-8 h-8 rounded-md" style={{ backgroundColor: draftForm.color || '#999999' }} />
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-72" align="start">
                        <div className="space-y-3">
                          <div className="grid grid-cols-6 gap-2">
                            {AREA_COLOR_SWATCHES.map((hex) => (
                              <button
                                key={hex}
                                type="button"
                                className="relative h-8 w-8 rounded-full border shadow-sm focus:outline-hidden focus:ring-2 focus:ring-ring"
                                style={{ backgroundColor: hex }}
                                aria-label={hex}
                                onClick={() => { setDraftForm({ ...draftForm, color: hex }); setDraftColorPickerOpen(false); }}
                              >
                                {draftForm.color === hex ? (
                                  <span className="absolute inset-0 grid place-items-center">
                                    <Check className="h-3 w-3 text-white drop-shadow" />
                                  </span>
                                ) : null}
                              </button>
                            ))}
                          </div>
                          <div className="flex items-center justify-between">
                            <button
                              type="button"
                              className="text-xs text-muted-foreground hover:text-foreground"
                              onClick={() => { setDraftForm({ ...draftForm, color: '' }); setDraftColorPickerOpen(false); }}
                            >
                              Clear color
                            </button>
                            <input
                              type="color"
                              aria-label="Choose custom color"
                              className="h-7 w-10 cursor-pointer rounded border"
                              value={draftForm.color || '#000000'}
                              onChange={(e) => setDraftForm({ ...draftForm, color: e.target.value })}
                            />
                          </div>
                        </div>
                      </PopoverContent>
                    </Popover>
                    <input
                      ref={draftColorRef}
                      type="color"
                      value={draftForm.color || '#000000'}
                      onChange={(e) => setDraftForm({ ...draftForm, color: e.target.value })}
                      className="hidden"
                    />
                  </div>
                </div>
              </>
            ) : selected ? (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <label className="block text-xs text-muted-foreground mb-1">Name</label>
                    <Input value={selected.name} onChange={(e) => { mutateItems(prev => prev.map(i => (i.id === selected.id ? { ...i, name: e.target.value } : i))); onNameChange({ name: e.target.value }); }} onBlur={() => onNameBlur()} />
                  </div>
                  <div>
                    <Popover open={colorPickerOpen} onOpenChange={setColorPickerOpen}>
                      <PopoverTrigger asChild>
                        <button
                          type="button"
                          className="inline-flex items-center gap-2 rounded-md border p-1 hover:bg-muted/50"
                          aria-label="Pick color"
                        >
                          <span className="inline-block w-8 h-8 rounded-md" style={{ backgroundColor: selected.color || '#999999' }} />
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-72" align="start">
                        <div className="space-y-3">
                          <div className="grid grid-cols-6 gap-2">
                            {AREA_COLOR_SWATCHES.map((hex) => (
                              <button
                                key={hex}
                                type="button"
                                className="relative h-8 w-8 rounded-full border shadow-sm focus:outline-hidden focus:ring-2 focus:ring-ring"
                                style={{ backgroundColor: hex }}
                                aria-label={hex}
                                onClick={() => {
                                  mutateItems(prev => prev.map(i => (i.id === selected.id ? { ...i, color: hex } : i)));
                                  onColorChange({ color: hex });
                                  onColorBlur();
                                  setColorPickerOpen(false);
                                }}
                              >
                                {selected.color === hex ? (
                                  <span className="absolute inset-0 grid place-items-center">
                                    <Check className="h-3 w-3 text-white drop-shadow" />
                                  </span>
                                ) : null}
                              </button>
                            ))}
                          </div>
                          <div className="flex items-center justify-between">
                            <button
                              type="button"
                              className="text-xs text-muted-foreground hover:text-foreground"
                              onClick={() => {
                                mutateItems(prev => prev.map(i => (i.id === selected.id ? { ...i, color: '' } : i)));
                                onColorChange({ color: '' });
                                onColorBlur();
                                setColorPickerOpen(false);
                              }}
                            >
                              Clear color
                            </button>
                            <input
                              type="color"
                              aria-label="Choose custom color"
                              className="h-7 w-10 cursor-pointer rounded border"
                              value={selected.color || '#000000'}
                              onChange={(e) => {
                                const val = e.target.value;
                                mutateItems(prev => prev.map(i => (i.id === selected.id ? { ...i, color: val } : i)));
                                onColorChange({ color: val });
                                onColorBlur();
                              }}
                            />
                          </div>
                        </div>
                      </PopoverContent>
                    </Popover>
                    <input
                      ref={colorRef}
                      type="color"
                      value={selected.color || '#000000'}
                      onChange={(e) => {
                        const val = e.target.value;
                        mutateItems(prev => prev.map(i => (i.id === selected.id ? { ...i, color: val } : i)));
                        onColorChange({ color: val });
                        onColorBlur();
                      }}
                      className="hidden"
                    />
                  </div>
                </div>
                <div className="pt-2">
                  <Button
                    variant="destructive"
                    onClick={async () => {
                      if (!selected) return;
                      const confirmed = window.confirm('Delete this area?');
                      if (!confirmed) return;
                      try {
                        await deleteArea(selected.id);
                        mutateItems(prev => prev.filter(i => i.id !== selected.id));
                        select(items[0]?.id || '');
                      } catch (err: any) {
                        const msg = err?.message || '';
                        alert(msg.includes('AreaInUse') ? 'Cannot delete: area is in use by events' : (msg || 'Failed to delete area'));
                      }
                    }}
                  >Delete Area</Button>
                </div>
              </>
            ) : null}
          </div>
        </div>
      )}
    />
  );
}


