import { useEffect, useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { DateField } from '@/components/date-field';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { ListDetailLayout, List, FilterBar, useListDetail, useDebouncedPatch, type ResourceAdapter } from '@/features/listDetail';
import { type EventSeries, listEventSeries, createEventSeries, getEventSeries, updateEventSeries, deleteEventSeries, getEventSeriesAreas, putEventSeriesAreas, previewEventSeries, generateEventSeries } from '@/lib/serverComm';
import { SeriesAreasPanel } from '@/features/events/SeriesAreasPanel';
import { Badge } from '@/components/ui/badge';
import { RecurringRuleEditor } from '@/features/events/RecurringRuleEditor';
import { Rollup } from '@/components/ui/rollup';
import { SeriesRecurringRulePanel } from '@/features/events/SeriesRecurringRulePanel';

type SeriesFilters = { activeOnly?: boolean; from?: string; to?: string };

export default function EventsRecurring() {
  const seriesAdapter: ResourceAdapter<EventSeries, SeriesFilters, { q?: string }> = {
    list: async (query, filters) => {
      const params: any = { q: query?.q };
      if (filters?.from) params.from = filters.from;
      if (filters?.to) params.to = filters.to;
      const rows = await listEventSeries(params);
      if (filters?.activeOnly) {
        const today = new Date().toISOString().slice(0, 10);
        return rows.filter((s) => (!s.endDate || String(s.endDate) >= today) && (!s.startDate || String(s.startDate) <= today));
      }
      return rows;
    },
    get: async (id) => getEventSeries(String(id)),
    create: async (partial) => createEventSeries(partial as any),
    update: async (id, patch) => updateEventSeries(String(id), patch as any),
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
  } = useListDetail<EventSeries, SeriesFilters, { q?: string}>({
    resourceKey: 'events/recurring',
    adapter: seriesAdapter,
  });

  const { onChange: onNameChange, onBlurFlush: onNameBlur } = useDebouncedPatch<{ name: string }>({
    applyPatch: async (patch) => {
      if (!selected) return;
      const updated = await updateEventSeries(selected.id, patch);
      mutateItems(prev => prev.map(i => (i.id === updated.id ? updated : i)));
    }
  });

  const [genOpen, setGenOpen] = useState(false);
  const [genUntil, setGenUntil] = useState<string>('');
  const [genOverwrite, setGenOverwrite] = useState<boolean>(false);
  const [genReplaceAreas, setGenReplaceAreas] = useState<boolean>(false);
  const [previewDates, setPreviewDates] = useState<string[] | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  useEffect(() => {
    setPreviewDates(null);
    setPreviewLoading(false);
  }, [selected?.id]);

  const onPreview = async () => {
    if (!selected || !genUntil) return;
    setPreviewLoading(true);
    try {
      const res = await previewEventSeries(selected.id, { untilDate: genUntil });
      setPreviewDates(res.dates);
    } finally {
      setPreviewLoading(false);
    }
  };

  const onGenerate = async () => {
    if (!selected || !genUntil) return;
    const res = await generateEventSeries(selected.id, { untilDate: genUntil, overwriteExisting: genOverwrite, setAreasMode: genReplaceAreas ? 'replace' : 'skip' });
    alert(`Created: ${res.created}, Updated: ${res.updated}, Skipped: ${res.skipped}`);
    setGenOpen(false);
  };

  return (
    <ListDetailLayout
      left={(
        <>
          <FilterBar<SeriesFilters>
            q={queryState.q}
            onQChange={(v) => setQueryState(prev => ({ ...prev, q: v }))}
          />
          <List<EventSeries>
            items={items}
            selectedId={selectedId}
            onSelect={select}
            loading={loading}
            renderItem={(s) => (
              <>
                <div className="text-sm font-medium truncate">{s.name}</div>
                <div className="text-[11px] text-muted-foreground">
                  {(() => {
                    // Render compact weekday mask if present on client later; for v1 leave blank
                    const start = s.startDate || '—';
                    const end = s.endDate || '—';
                    return `${start} → ${end}`;
                  })()}
                </div>
              </>
            )}
          />
        </>
      )}
      right={(
        <div key={selected?.id || 'none'} className="routeFadeItem detailPaneAccent">
          <div className="max-w-3xl space-y-6">
            <div className="flex items-start">
              <div className="flex-1">
                {selected ? (
                  <Input
                    value={selected.name}
                    onChange={(e) => { const v = e.target.value; mutateItems(prev => prev.map(i => (i.id === selected.id ? { ...i, name: v } : i))); onNameChange({ name: v }); }}
                    onBlur={() => onNameBlur()}
                    className="text-xl font-semibold"
                  />
                ) : (
                  <div className="text-sm text-muted-foreground">Select a series to view details</div>
                )}
              </div>
              <div className="min-w-[140px] flex justify-end">
                <Button size="sm" onClick={async () => { const created = await create({ name: 'New Series', rule: { frequency: 'WEEKLY', interval: 1, byWeekdayMask: 0 } } as any); select(created.id); }}>New Series</Button>
              </div>
            </div>

            {selected ? (
              <>
                <Rollup title="Details">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-muted-foreground mb-1">Description</label>
                      <Input value={selected.description || ''} onChange={(e) => { const v = e.target.value; mutateItems(prev => prev.map(i => (i.id === selected.id ? { ...i, description: v } : i))); updateEventSeries(selected.id, { description: v || null }); }} />
                    </div>
                    <div>
                      <label className="block text-xs text-muted-foreground mb-1">Default Status</label>
                      <Input value={selected.defaultStatus} onChange={(e) => { const v = e.target.value; mutateItems(prev => prev.map(i => (i.id === selected.id ? { ...i, defaultStatus: v } : i))); updateEventSeries(selected.id, { defaultStatus: v }); }} />
                    </div>
                    <div>
                      <label className="block text-xs text-muted-foreground mb-1">Start Date</label>
                      <DateField value={selected.startDate || ''} onChange={(v) => { mutateItems(prev => prev.map(i => (i.id === selected.id ? { ...i, startDate: v || null } : i))); updateEventSeries(selected.id, { startDate: v || null }); }} />
                    </div>
                    <div>
                      <label className="block text-xs text-muted-foreground mb-1">End Date</label>
                      <DateField value={selected.endDate || ''} onChange={(v) => { mutateItems(prev => prev.map(i => (i.id === selected.id ? { ...i, endDate: v || null } : i))); updateEventSeries(selected.id, { endDate: v || null }); }} />
                    </div>
                    <div>
                      <label className="block text-xs text-muted-foreground mb-1">Default Start</label>
                      <Input value={selected.defaultStartTime} onChange={(e) => { const v = e.target.value; mutateItems(prev => prev.map(i => (i.id === selected.id ? { ...i, defaultStartTime: v } : i))); updateEventSeries(selected.id, { defaultStartTime: v }); }} />
                    </div>
                    <div>
                      <label className="block text-xs text-muted-foreground mb-1">Default End</label>
                      <Input value={selected.defaultEndTime} onChange={(e) => { const v = e.target.value; mutateItems(prev => prev.map(i => (i.id === selected.id ? { ...i, defaultEndTime: v } : i))); updateEventSeries(selected.id, { defaultEndTime: v }); }} />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-xs text-muted-foreground mb-1">Title Template</label>
                      <Input value={selected.titleTemplate || ''} onChange={(e) => { const v = e.target.value; mutateItems(prev => prev.map(i => (i.id === selected.id ? { ...i, titleTemplate: v } : i))); updateEventSeries(selected.id, { titleTemplate: v || null }); }} />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-xs text-muted-foreground mb-1">Promoter</label>
                      <Input value={selected.promoterTemplate || ''} onChange={(e) => { const v = e.target.value; mutateItems(prev => prev.map(i => (i.id === selected.id ? { ...i, promoterTemplate: v } : i))); updateEventSeries(selected.id, { promoterTemplate: v || null }); }} />
                    </div>
                  </div>
                </Rollup>

                <SeriesRecurringRulePanel seriesId={selected.id} />

                <SeriesAreasPanel seriesId={selected.id} />

                <Rollup title="Generate" className="mt-6">
                  <div className="rounded-md border p-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-muted-foreground mb-1">Until date</label>
                        <DateField value={genUntil} onChange={(v) => setGenUntil(v || '')} />
                      </div>
                      <div className="flex items-center gap-3">
                        <label className="text-xs text-muted-foreground">Overwrite existing</label>
                        <Switch checked={genOverwrite} onCheckedChange={setGenOverwrite} />
                        <label className="text-xs text-muted-foreground">Replace areas</label>
                        <Switch checked={genReplaceAreas} onCheckedChange={setGenReplaceAreas} />
                      </div>
                      <div className="col-span-2 flex gap-2">
                        <Button size="sm" variant="outline" onClick={onPreview} disabled={!genUntil || previewLoading}>{previewLoading ? 'Previewing…' : 'Preview'}</Button>
                        <Button size="sm" onClick={onGenerate} disabled={!genUntil}>Generate</Button>
                      </div>
                    </div>
                    {previewDates && previewDates.length > 0 ? (
                      <div className="mt-3 text-xs text-muted-foreground">{previewDates.length} dates</div>
                    ) : null}
                  </div>
                </Rollup>
              </>
            ) : null}
          </div>
        </div>
      )}
    />
  );
}


