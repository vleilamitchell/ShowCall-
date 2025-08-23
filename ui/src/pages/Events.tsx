import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { DateField } from '@/components/date-field';
import { TimeField } from '@/components/time-field';
import { Button } from '@/components/ui/button';
import { listEvents, createEvent, updateEvent, type EventRecord, getEvent } from '@/lib/serverComm';
import { EventShiftsPanel } from '@/features/events/EventShiftsPanel';
import { ListDetailLayout, List, FilterBar, CreateInline, useListDetail, useDebouncedPatch, type ResourceAdapter } from '@/features/listDetail';

type CreateForm = {
  title: string;
  status: string;
  date: string;
  startTime: string;
  endTime: string;
  promoter: string;
  artists: string;
  description: string;
};

const defaultCreate: CreateForm = {
  title: '',
  status: 'planned',
  date: new Date().toISOString().slice(0, 10),
  startTime: '00:00',
  endTime: '23:59',
  promoter: '',
  artists: '',
  description: '',
};

export function Events() {
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<CreateForm>(defaultCreate);
  const [submitting, setSubmitting] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');

  const eventsAdapter: ResourceAdapter<EventRecord, { includePast: boolean }, { q?: string }> = {
    list: async (query, filters) => listEvents({ q: query?.q, includePast: filters?.includePast }),
    get: async (id) => getEvent(String(id)),
    create: async (partial) => createEvent(partial as any),
    update: async (id, patch) => updateEvent(String(id), patch as any),
    searchableFields: ['title', 'promoter', 'artists']
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
  } = useListDetail<EventRecord, { includePast: boolean }, { q?: string}>({
    resourceKey: 'events',
    adapter: eventsAdapter,
  });

  const onCreate = async () => {
    if (!form.title.trim() || submitting) return;
    setSubmitting(true);
    setCreateError(null);
    try {
      const payload = {
        title: form.title.trim(),
        status: form.status,
        date: form.date,
        startTime: form.startTime,
        endTime: form.endTime,
        promoter: form.promoter || undefined,
        artists: form.artists || undefined,
        description: form.description || undefined,
      };
      await create(payload as any);
      setCreating(false);
      setForm(defaultCreate);
    } catch (err: any) {
      const message = err?.message || 'Failed to create event';
      setCreateError(message);
      // Still keep the form open for correction
      console.error('Create event failed:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const { onChange: onTitleChange, onBlurFlush: onTitleBlur } = useDebouncedPatch<{ title: string}>({
    applyPatch: async (patch) => {
      if (!selected) return;
      const updated = await updateEvent(selected.id, patch);
      mutateItems(prev => prev.map(i => (i.id === updated.id ? updated : i)));
    }
  });

  const { onChange: onPromoterChange, onBlurFlush: onPromoterBlur } = useDebouncedPatch<Partial<EventRecord>>({
    applyPatch: async (patch) => {
      if (!selected) return;
      const updated = await updateEvent(selected.id, patch);
      mutateItems(prev => prev.map(i => (i.id === updated.id ? updated : i)));
    }
  });
  const { onChange: onStatusChange, onBlurFlush: onStatusBlur } = useDebouncedPatch<Partial<EventRecord>>({
    applyPatch: async (patch) => {
      if (!selected) return;
      const updated = await updateEvent(selected.id, patch);
      mutateItems(prev => prev.map(i => (i.id === updated.id ? updated : i)));
    }
  });
  const { onChange: onDateChange, onBlurFlush: onDateBlur } = useDebouncedPatch<Partial<EventRecord>>({
    applyPatch: async (patch) => {
      if (!selected) return;
      const updated = await updateEvent(selected.id, patch);
      mutateItems(prev => prev.map(i => (i.id === updated.id ? updated : i)));
    }
  });
  const { onChange: onStartChange, onBlurFlush: onStartBlur } = useDebouncedPatch<Partial<EventRecord>>({
    applyPatch: async (patch) => {
      if (!selected) return;
      const updated = await updateEvent(selected.id, patch);
      mutateItems(prev => prev.map(i => (i.id === updated.id ? updated : i)));
    }
  });
  const { onChange: onEndChange, onBlurFlush: onEndBlur } = useDebouncedPatch<Partial<EventRecord>>({
    applyPatch: async (patch) => {
      if (!selected) return;
      const updated = await updateEvent(selected.id, patch);
      mutateItems(prev => prev.map(i => (i.id === updated.id ? updated : i)));
    }
  });
  const { onChange: onArtistsChange, onBlurFlush: onArtistsBlur } = useDebouncedPatch<Partial<EventRecord>>({
    applyPatch: async (patch) => {
      if (!selected) return;
      const updated = await updateEvent(selected.id, patch);
      mutateItems(prev => prev.map(i => (i.id === updated.id ? updated : i)));
    }
  });
  const { onChange: onDescriptionChange, onBlurFlush: onDescriptionBlur } = useDebouncedPatch<Partial<EventRecord>>({
    applyPatch: async (patch) => {
      if (!selected) return;
      const updated = await updateEvent(selected.id, patch);
      mutateItems(prev => prev.map(i => (i.id === updated.id ? updated : i)));
    }
  });

  return (
    <ListDetailLayout
      left={(
        <>
          <FilterBar<{ includePast: boolean}>
            q={queryState.q}
            onQChange={(v) => setQueryState(prev => ({ ...prev, q: v }))}
            actions={(
              <Button size="sm" onClick={() => setCreating(v => !v)}>{creating ? 'Close' : 'New Event'}</Button>
            )}
          >
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={!!filterState.includePast} onChange={(e) => setFilterState(prev => ({ ...prev, includePast: e.target.checked }))} />
              Show past
            </label>
          </FilterBar>
          <div className="px-3">
            <CreateInline open={creating} onOpenChange={setCreating} toggleLabel={{ open: 'Close', closed: 'New Event' }}>
              <Input placeholder="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
              <div className="grid grid-cols-2 gap-2">
                <Input placeholder="Status" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} />
                <DateField value={form.date} onChange={(v) => setForm({ ...form, date: v || '' })} />
                <TimeField value={form.startTime} onChange={(v) => setForm({ ...form, startTime: v || '' })} />
                <TimeField value={form.endTime} onChange={(v) => setForm({ ...form, endTime: v || '' })} />
              </div>
              <Input placeholder="Promoter" value={form.promoter} onChange={(e) => setForm({ ...form, promoter: e.target.value })} />
              <Input placeholder="Artists" value={form.artists} onChange={(e) => setForm({ ...form, artists: e.target.value })} />
              <Input placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              {createError && (
                <div className="text-xs text-destructive">{createError}</div>
              )}
              <div className="flex gap-2">
                <Button size="sm" onClick={onCreate} disabled={!form.title.trim() || submitting}>{submitting ? 'Creating…' : 'Create'}</Button>
                <Button size="sm" variant="outline" onClick={() => { setCreating(false); setForm(defaultCreate); setCreateError(null); }}>Cancel</Button>
              </div>
            </CreateInline>
          </div>
          <List<EventRecord>
            items={items}
            selectedId={selectedId}
            onSelect={select}
            loading={loading}
            renderItem={(ev) => (
              <>
                <div className="text-sm font-medium truncate">{ev.title}</div>
                <div className="text-xs text-muted-foreground">{ev.date} • {ev.startTime}-{ev.endTime}</div>
              </>
            )}
          />
        </>
      )}
      right={(
        <div key={selected?.id || 'none'} className="routeFadeItem detailPaneAccent">
          {!selected ? (
            <div className="text-sm text-muted-foreground">Select an event to view details</div>
          ) : (
            <div className="max-w-3xl space-y-6">
              <div>
                {!editingTitle ? (
                  <h2
                    className="text-xl font-semibold cursor-text hover:opacity-90"
                    onClick={() => { setEditingTitle(true); setTitleDraft(selected.title as string); }}
                  >
                    {selected.title || 'Untitled Event'}
                  </h2>
                ) : (
                  <Input
                    autoFocus
                    value={titleDraft}
                    onChange={(e) => {
                      setTitleDraft(e.target.value);
                      mutateItems(prev => prev.map(i => (i.id === selected.id ? { ...i, title: e.target.value } : i)));
                      onTitleChange({ title: e.target.value });
                    }}
                    onBlur={() => { onTitleBlur(); setEditingTitle(false); }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        (e.target as HTMLInputElement).blur();
                      } else if (e.key === 'Escape') {
                        setEditingTitle(false);
                      }
                    }}
                    className="text-xl font-semibold"
                  />
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Promoter</label>
                  <Input value={selected.promoter || ''} onChange={(e) => { mutateItems(prev => prev.map(i => (i.id === selected.id ? { ...i, promoter: e.target.value } : i))); onPromoterChange({ promoter: e.target.value || undefined }); }} onBlur={() => onPromoterBlur()} />
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Status</label>
                  <Input value={selected.status} onChange={(e) => { mutateItems(prev => prev.map(i => (i.id === selected.id ? { ...i, status: e.target.value } : i))); onStatusChange({ status: e.target.value }); }} onBlur={() => onStatusBlur()} />
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Date</label>
                  <DateField value={selected.date} onChange={(v) => { const val = v || ''; mutateItems(prev => prev.map(i => (i.id === selected.id ? { ...i, date: val } : i))); onDateChange({ date: val }); onDateBlur(); }} />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs text-muted-foreground mb-1">Start</label>
                    <TimeField value={selected.startTime} onChange={(v) => { const val = v || ''; mutateItems(prev => prev.map(i => (i.id === selected.id ? { ...i, startTime: val } : i))); onStartChange({ startTime: val }); onStartBlur(); }} />
                  </div>
                  <div>
                    <label className="block text-xs text-muted-foreground mb-1">End</label>
                    <TimeField value={selected.endTime} onChange={(v) => { const val = v || ''; mutateItems(prev => prev.map(i => (i.id === selected.id ? { ...i, endTime: val } : i))); onEndChange({ endTime: val }); onEndBlur(); }} />
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Artists</label>
                  <Input value={selected.artists || ''} onChange={(e) => { mutateItems(prev => prev.map(i => (i.id === selected.id ? { ...i, artists: e.target.value } : i))); onArtistsChange({ artists: e.target.value || undefined }); }} onBlur={() => onArtistsBlur()} />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs text-muted-foreground mb-1">Description</label>
                  <Input value={selected.description || ''} onChange={(e) => { mutateItems(prev => prev.map(i => (i.id === selected.id ? { ...i, description: e.target.value } : i))); onDescriptionChange({ description: e.target.value || undefined }); }} onBlur={() => onDescriptionBlur()} />
                </div>
              </div>
              <EventShiftsPanel eventId={selected.id} />
            </div>
          )}
        </div>
      )}
    />
  );
}

export default Events;


