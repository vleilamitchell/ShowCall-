import { useEffect, useState, useRef } from 'react';
import { ListDetailLayout, List, useListDetail, type ResourceAdapter } from '@/features/listDetail';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { type EventTemplate, type EventTemplateVersion, listEventTemplates, createEventTemplate, getEventTemplate, updateEventTemplate, listTemplateVersions, createTemplateVersion, activateTemplateVersion, getTemplateRequirements, putTemplateRequirements, type TemplateRequirementRow, listDepartments, type DepartmentRecord, listPositions, type PositionRecord, getTemplateVersionAreas, type Area } from '@/lib/serverComm';
import { TemplateVersionAreasPanel } from '@/features/templates/TemplateVersionAreasPanel';
import { useDebouncedPatch } from '@/features/listDetail';
import { Rollup } from '@/components/ui/rollup';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { MoreVertical } from 'lucide-react';

type Filters = { active?: boolean };

export default function Templates() {
  const adapter: ResourceAdapter<EventTemplate, Filters, { q?: string }> = {
    list: async (query, filters) => {
      return listEventTemplates({ q: query?.q, active: filters?.active });
    },
    get: async (id) => getEventTemplate(String(id)) as any,
    create: async () => createEventTemplate({ name: 'New Template', titleTemplate: 'Event' }),
    update: async (id, patch) => updateEventTemplate(String(id), patch as any),
    searchableFields: ['name', 'description']
  };

  const { items, selected, selectedId, select, mutateItems, queryState, setQueryState, create } = useListDetail<EventTemplate, Filters, { q?: string }>({ resourceKey: 'events/templates', adapter });

  const [versions, setVersions] = useState<EventTemplateVersion[] | null>(null);
  const [requirements, setRequirements] = useState<TemplateRequirementRow[] | null>(null);
  const [departments, setDepartments] = useState<DepartmentRecord[]>([]);
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string>('');
  const [positions, setPositions] = useState<PositionRecord[]>([]);
  const [templateAreas, setTemplateAreas] = useState<Area[]>([]);
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);
  const [positionsById, setPositionsById] = useState<Record<string, PositionRecord>>({});

  // Persist Requirements Department selector (sticky across sessions)
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem('templates.requirements.departmentId');
      if (stored) setSelectedDepartmentId(stored);
    } catch {}
  }, []);

  useEffect(() => {
    try {
      if (selectedDepartmentId) {
        window.localStorage.setItem('templates.requirements.departmentId', selectedDepartmentId);
      }
    } catch {}
  }, [selectedDepartmentId]);

  useEffect(() => {
    if (!positions || positions.length === 0) return;
    setPositionsById((prev: Record<string, PositionRecord>) => {
      const next: Record<string, PositionRecord> = { ...prev };
      for (const p of positions) { next[p.id] = p; }
      return next;
    });
  }, [positions.map(p => p.id).join(',')]);

  // When viewing "- All -", load positions for all departments so names resolve
  useEffect(() => {
    if (selectedDepartmentId !== '__all__') return;
    if (!departments || departments.length === 0) return;
    let cancelled = false;
    (async () => {
      try {
        const lists = await Promise.all(
          departments.map((d) => listPositions(d.id).catch(() => [] as PositionRecord[]))
        );
        if (cancelled) return;
        const map: Record<string, PositionRecord> = {};
        for (const arr of lists) {
          for (const p of arr) map[p.id] = p;
        }
        setPositionsById(map);
      } catch {}
    })();
    return () => { cancelled = true; };
  }, [selectedDepartmentId, departments.map(d => d.id).join(',')]);
  // current version id is derived in versions block

  useEffect(() => {
    setVersions(null);
    setRequirements(null);
    if (!selectedId) return;
    listTemplateVersions(selectedId).then(setVersions).catch(() => setVersions([]));
  }, [selectedId]);

  useEffect(() => {
    setRequirements(null);
    const v = (versions || []).find(x => x.id === selectedVersionId) || versions?.find((x) => x.isCurrent) || (versions && versions[0]);
    if (v) getTemplateRequirements(v.id).then(setRequirements).catch(() => setRequirements([]));
  }, [selectedVersionId, versions?.map(v => v.id).join(',' )]);

  // Load areas for the current template version
  useEffect(() => {
    const v = (versions || []).find(x => x.id === selectedVersionId) || versions?.find((x) => x.isCurrent) || (versions && versions[0]);
    if (!v) { setTemplateAreas([]); return; }
    getTemplateVersionAreas(v.id).then(setTemplateAreas).catch(() => setTemplateAreas([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedVersionId, versions?.map(v => v.id).join(',')]);

  // Load departments once; default to first
  useEffect(() => {
    listDepartments().then((rows) => {
      setDepartments(rows);
      setSelectedDepartmentId((prev) => prev || rows[0]?.id || '');
    }).catch(() => setDepartments([]));
  }, []);

  // Validate stored selection against loaded departments; fallback to first if stale
  useEffect(() => {
    if (!departments || departments.length === 0) return;
    if (!selectedDepartmentId) { setSelectedDepartmentId(departments[0].id); return; }
    if (selectedDepartmentId !== '__all__' && !departments.some(d => d.id === selectedDepartmentId)) {
      setSelectedDepartmentId(departments[0].id);
    }
  }, [departments.map(d => d.id).join(','), selectedDepartmentId]);

  // Load positions whenever department changes
  useEffect(() => {
    if (!selectedDepartmentId || selectedDepartmentId === '__all__') { setPositions([]); return; }
    listPositions(selectedDepartmentId).then(setPositions).catch(() => setPositions([]));
  }, [selectedDepartmentId]);


  // Autosave requirements with debounce
  const saveTimerRef = useRef<number | null>(null);
  const savingRef = useRef<boolean>(false);
  useEffect(() => {
    const v = (versions || []).find(x => x.id === selectedVersionId) || versions?.find((x) => x.isCurrent) || (versions && versions[0]);
    if (!v) return;
    if (!requirements) return;
    if (saveTimerRef.current) { window.clearTimeout(saveTimerRef.current); saveTimerRef.current = null; }
    saveTimerRef.current = window.setTimeout(async () => {
      const items = requirements || [];
      // Allow save without areas; server supports empty allowedAreaIds
      const allValid = items.every(r => (r.requiredPositionId && r.requiredPositionId.length > 0) && (r.count >= 1));
      if (!allValid) return;
      if (savingRef.current) return;
      savingRef.current = true;
      try {
        await putTemplateRequirements(v.id, items.map(r => ({ requiredPositionId: r.requiredPositionId, count: r.count, allowedAreaIds: r.allowedAreaIds || [] })));
        const next = await getTemplateRequirements(v.id);
        setRequirements(next);
      } finally {
        savingRef.current = false;
      }
    }, 500);
    return () => { if (saveTimerRef.current) { window.clearTimeout(saveTimerRef.current); saveTimerRef.current = null; } };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedVersionId, versions?.map(v => v.id).join(','), JSON.stringify(requirements) ]);

  const { onChange: onNameChange, onBlurFlush: onNameBlur } = useDebouncedPatch<Partial<EventTemplate>>({
    applyPatch: async (patch) => { if (!selected) return; const updated = await updateEventTemplate(selected.id, patch); mutateItems(prev => prev.map(i => (i.id === updated.id ? updated : i))); },
  });

  // Buffer the template name locally while focused to avoid server-normalization fighting keystrokes
  const [localName, setLocalName] = useState<string>('');
  const [isNameFocused, setIsNameFocused] = useState<boolean>(false);
  useEffect(() => {
    if (!selected) return;
    if (!isNameFocused) {
      setLocalName(selected.name || '');
    }
  }, [selected?.id, selected?.name, isNameFocused]);

  const { onChange: onDescriptionChange, onBlurFlush: onDescriptionBlur } = useDebouncedPatch<Partial<EventTemplate>>({
    applyPatch: async (patch) => { if (!selected) return; const updated = await updateEventTemplate(selected.id, patch); mutateItems(prev => prev.map(i => (i.id === updated.id ? updated : i))); },
  });

  return (
    <ListDetailLayout
      left={(
        <>
          <div className="p-2">
            <Input placeholder="Search templates" value={queryState.q || ''} onChange={(e) => setQueryState(prev => ({ ...prev, q: e.target.value }))} />
            <div className="flex justify-end mt-2">
              <Button size="sm" onClick={async () => { const t = await create({} as any); select(t.id); }}>New Template</Button>
            </div>
          </div>
          <List<EventTemplate>
            items={items}
            selectedId={selectedId}
            onSelect={select}
            renderItem={(t) => (<><div className="text-sm font-medium truncate">{t.name}</div><div className="text-[11px] text-muted-foreground">{t.active ? 'Active' : 'Inactive'}</div></>)}
          />
        </>
      )}
      right={(
        <div key={selected?.id || 'none'} className="routeFadeItem detailPaneAccent">
          {selected ? (
            <div className="max-w-3xl space-y-6">
              <div className="flex items-start">
                <div className="flex-1">
                  <Input
                    value={localName}
                    onChange={(e) => {
                      const v = e.target.value;
                      setLocalName(v);
                      mutateItems(prev => prev.map(i => (i.id === selected.id ? { ...i, name: v } : i)));
                      onNameChange({ name: v });
                    }}
                    onFocus={() => setIsNameFocused(true)}
                    onBlur={() => { setIsNameFocused(false); onNameBlur(); }}
                    className="text-xl font-semibold"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 gap-3">
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Description</label>
                  <Input value={(selected as any).description || ''} onChange={(e) => { const v = e.target.value; mutateItems(prev => prev.map(i => (i.id === selected.id ? { ...i, description: v } : i))); onDescriptionChange({ description: v || null }); }} onBlur={() => onDescriptionBlur()} />
                </div>
              </div>
              {(() => {
                const v = (versions || []).find(x => x.id === selectedVersionId) || versions?.find((x) => x.isCurrent) || (versions && versions[0]);
                return v ? (
                  <TemplateVersionAreasPanel versionId={v.id} onAreasUpdated={(areas) => setTemplateAreas(areas)} />
                ) : null;
              })()}
              {(() => (
                  <Rollup
                    title="Requirements"
                    storageKey="tplRequirementsRollupOpen"
                    summary={(
                      <Badge variant="secondary" className="text-xs">{(requirements || []).length}</Badge>
                    )}
                  >
                <div className="space-y-2">
                  <div className="mb-2 grid grid-cols-6 gap-2 items-end">
                    <div className="col-span-3">
                      <label className="block text-xs text-muted-foreground mb-1">Department</label>
                      <select className="w-full h-9 rounded-md border bg-background px-3 text-sm" value={selectedDepartmentId} onChange={(e) => setSelectedDepartmentId(e.target.value)}>
                        <option value="__all__">- All -</option>
                        {departments.map((d) => (
                          <option key={d.id} value={d.id}>{d.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground mb-2">Add rows with required area, position, and count.</div>
                  <RequirementsTable
                    requirements={requirements || []}
                    templateAreas={templateAreas}
                    positions={positions}
                    positionsById={positionsById}
                    selectedDepartmentId={selectedDepartmentId}
                    onChangeRequirements={setRequirements}
                  />
                </div>
                  </Rollup>
              ))()}
              <Rollup
                title="Versions"
                storageKey="tplVersionsRollupOpen"
                summary={(
                  <div className="text-xs text-muted-foreground">Current: {versions?.find(v => v.isCurrent)?.versionNumber ?? '—'}</div>
                )}
              >
                <div className="mt-1 flex gap-2 flex-wrap items-center">
                  {(versions || []).map((v) => (
                    <Button
                      key={v.id}
                      size="sm"
                      variant={(selectedVersionId ? (selectedVersionId === v.id) : v.isCurrent) ? 'default' : 'outline'}
                      onClick={() => setSelectedVersionId(v.id)}
                      title={v.isCurrent ? 'Current' : 'Select version'}
                    >
                      {v.versionNumber}
                    </Button>
                  ))}
                  {(() => {
                    const sel = (versions || []).find(x => x.id === selectedVersionId);
                    if (!sel || sel.isCurrent) return null;
                    return (
                      <Button size="sm" variant="outline" onClick={async () => {
                        await activateTemplateVersion(sel.id);
                        const all = await listTemplateVersions(selected.id);
                        setVersions(all);
                      }}>Set Current</Button>
                    );
                  })()}
                </div>
                <div className="mt-3 flex justify-end">
                  <Button size="sm" onClick={async () => {
                    const base = (versions || []).find(x => x.id === selectedVersionId) || versions?.find((x) => x.isCurrent) || (versions && versions[0]);
                    await createTemplateVersion(selected.id, { cloneFromVersionId: base?.id });
                    const all = await listTemplateVersions(selected.id);
                    setVersions(all);
                    const newest = all.slice().sort((a, b) => b.versionNumber - a.versionNumber)[0];
                    if (newest) setSelectedVersionId(newest.id);
                  }}>New Version</Button>
                </div>
              </Rollup>
            </div>
          ) : (
            <div className="text-sm text-muted-foreground p-4">Select a template to edit</div>
          )}
        </div>
      )}
    />
  );
}


function RequirementsTable(props: {
  requirements: TemplateRequirementRow[];
  templateAreas: Area[];
  positions: PositionRecord[];
  positionsById: Record<string, PositionRecord>;
  selectedDepartmentId: string;
  onChangeRequirements(next: TemplateRequirementRow[] | null): void;
}) {
  const { requirements, templateAreas, positions, positionsById, selectedDepartmentId, onChangeRequirements } = props;
  const [editingQtyIndex, setEditingQtyIndex] = useState<number | null>(null);
  const [addReqInfoOpen, setAddReqInfoOpen] = useState<boolean>(false);
  const isAllDepartments = selectedDepartmentId === '__all__';
  const hasDeptPositions = !isAllDepartments && (positions || []).length > 0;
  const usedPositionIds = new Set<string>((requirements || [])
    .map(r => r.requiredPositionId)
    .filter(Boolean) as string[]);
  const allPositionsUsed = !isAllDepartments && hasDeptPositions && positions.every(p => usedPositionIds.has(p.id));
  const isAddDisabled = isAllDepartments || !hasDeptPositions || allPositionsUsed;
  const addReqDisabledReason = isAllDepartments
    ? 'Select a department to add requirements. The “- All -” view is read-only.'
    : (!hasDeptPositions
      ? 'This department has no positions yet. Add positions first.'
      : (allPositionsUsed ? 'All positions in this department are already in the requirements.' : ''));

  const visibleRequirements = (requirements || []).filter(r => {
    if (isAllDepartments) return true;
    // Show rows with no position yet so the user can select one
    if (!r.requiredPositionId) return true;
    return positions.some(p => p.id === r.requiredPositionId);
  });
  // Recompute used positions for the filtered view (used for rendering the select options)
  const usedPositionIdsForView = new Set<string>(visibleRequirements.map(r => r.requiredPositionId).filter(Boolean) as string[]);

  return (
    <div className="space-y-2">
      <div className="overflow-auto rounded-md border" style={{ borderColor: 'var(--border)' }}>
        <table className="min-w-full text-sm border-separate border-spacing-0">
          <thead className="bg-gradient-to-r from-[color-mix(in_oklch,var(--foreground)_3%,var(--content-surface))] to-[color-mix(in_oklch,var(--foreground)_8%,var(--content-surface))]">
            <tr className="text-left">
              <th className="px-2 py-2 w-[220px] border-r last:border-r-0" style={{ borderColor: 'color-mix(in oklch, var(--foreground) 8%, transparent)' }}>Area</th>
              <th className="px-2 py-2 w-[320px] border-r last:border-r-0" style={{ borderColor: 'color-mix(in oklch, var(--foreground) 8%, transparent)' }}>Position</th>
              <th className="px-2 py-2 w-[120px] text-right">Quantity</th>
              <th className="px-2 py-2 w-[48px] text-right"></th>
            </tr>
          </thead>
          <tbody>
            {visibleRequirements.length === 0 ? (
              <tr>
                <td className="p-4 text-center text-muted-foreground" colSpan={4}>No requirements</td>
              </tr>
            ) : (
              visibleRequirements.map((r) => {
                const baseIndex = (requirements || []).indexOf(r);
                const rowKey = (r as any).id ? String((r as any).id) : `tmp-${baseIndex}`;
                return (
                <tr key={rowKey + (isAllDepartments ? '-all' : '')} className="odd:bg-[color-mix(in_oklch,var(--foreground)_2%,var(--content-surface))] even:bg-[color-mix(in_oklch,var(--foreground)_4%,var(--content-surface))]">
                  <td className="px-2 py-1.5 align-top border-r" style={{ borderColor: 'color-mix(in oklch, var(--foreground) 8%, transparent)' }}>
                    <select
                      className="w-full h-8 bg-transparent px-1 text-sm outline-none focus:ring-1 focus:ring-ring rounded-[2px] border-none"
                      value={(r.allowedAreaIds && r.allowedAreaIds[0]) || ''}
                      onChange={(e) => {
                        const areaId = e.target.value;
                        onChangeRequirements((requirements || []).map((x, i) => (i === baseIndex ? { ...x, allowedAreaIds: areaId ? [areaId] : [] } : x)));
                      }}
                    >
                      {templateAreas.map((a) => (
                        <option key={a.id} value={a.id}>{a.name}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-2 py-1.5 align-top border-r" style={{ borderColor: 'color-mix(in oklch, var(--foreground) 8%, transparent)' }}>
                    {isAllDepartments ? (
                      <div className="h-8 flex items-center px-1 text-sm">
                        {r.requiredPositionId ? (positionsById as any)[r.requiredPositionId]?.name || r.requiredPositionId : 'Select position…'}
                      </div>
                    ) : (
                      <select className="w-full h-8 bg-transparent px-1 text-sm outline-none focus:ring-1 focus:ring-ring rounded-[2px] border-none" value={r.requiredPositionId || ''} onChange={(e) => {
                        const v = e.target.value; onChangeRequirements((requirements || []).map((x, i) => (i === baseIndex ? { ...x, requiredPositionId: v } : x)));
                      }}>
                        <option value="">Select position…</option>
                        {positions.filter(p => p.id === r.requiredPositionId || !usedPositionIdsForView.has(p.id)).map((p) => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </select>
                    )}
                  </td>
                  <td className="px-2 py-1.5 align-top text-right">
                    {editingQtyIndex === baseIndex ? (
                      <Input
                        className="w-20 h-8 bg-transparent border-none focus:ring-1 focus:ring-ring px-1 text-right"
                        type="number"
                        min={1}
                        autoFocus
                        value={String(r.count)}
                        onChange={(e) => {
                          const n = Math.max(1, Number(e.target.value || 1)); onChangeRequirements((requirements || []).map((x, i) => (i === baseIndex ? { ...x, count: n } : x)));
                        }}
                        onBlur={() => setEditingQtyIndex(null)}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === 'Escape') { (e.target as HTMLInputElement).blur(); } }}
                      />
                    ) : (
                      <button className="h-8 inline-flex items-center justify-end w-full px-1 text-sm hover:underline text-right" onClick={() => setEditingQtyIndex(baseIndex)} title="Edit quantity">{r.count}</button>
                    )}
                  </td>
                  <td className="px-2 py-1.5 align-top text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="inline-flex h-8 items-center justify-center rounded-md px-2 hover:bg-accent">
                          <MoreVertical className="h-4 w-4" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => {
                          const next = [...(requirements || [])];
                          next.splice(baseIndex + 1, 0, { ...r, id: undefined, requiredPositionId: '' } as any);
                          onChangeRequirements(next);
                        }}>Duplicate</DropdownMenuItem>
                        <DropdownMenuItem variant="destructive" onClick={() => onChangeRequirements((requirements || []).filter((_, i) => i !== baseIndex))}>Delete</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ); })
            )}
          </tbody>
        </table>
      </div>
      <div>
        {isAddDisabled ? (
          <Popover open={addReqInfoOpen} onOpenChange={setAddReqInfoOpen}>
            <PopoverTrigger asChild>
              <Button
                size="sm"
                variant="outline"
                className="opacity-60"
                aria-disabled
                onClick={(e) => {
                  e.preventDefault();
                  setAddReqInfoOpen(true);
                }}
              >
                Add requirement
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="text-xs max-w-[280px]">
              {addReqDisabledReason}
            </PopoverContent>
          </Popover>
        ) : (
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              onChangeRequirements([...(requirements || []), { requiredPositionId: '', count: 1, allowedAreaIds: templateAreas[0]?.id ? [templateAreas[0].id] : [] }]);
            }}
          >
            Add requirement
          </Button>
        )}
      </div>
    </div>
  );
}

