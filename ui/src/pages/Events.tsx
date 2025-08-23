import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { DateField } from '@/components/date-field';
import { TimeField } from '@/components/time-field';
import { Button } from '@/components/ui/button';
import { listEvents, createEvent, updateEvent, type EventRecord, getEvent } from '@/lib/serverComm';
import { EventShiftsPanel } from '@/features/events/EventShiftsPanel';
import { ListDetailLayout, List, FilterBar, useListDetail, useDebouncedPatch, type ResourceAdapter } from '@/features/listDetail';
import { formatTimeTo12Hour } from '@/lib/time';

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
  const [draftOpen, setDraftOpen] = useState(false);
  const [draftForm, setDraftForm] = useState<CreateForm>(defaultCreate);
  const [draftSubmitting, setDraftSubmitting] = useState(false);
  const [draftError, setDraftError] = useState<string | null>(null);
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

  const onSaveDraft = async () => {
    if (!draftForm.title.trim() || draftSubmitting) return;
    setDraftSubmitting(true);
    setDraftError(null);
    try {
      const payload = {
        title: draftForm.title.trim(),
        status: draftForm.status,
        date: draftForm.date,
        startTime: draftForm.startTime,
        endTime: draftForm.endTime,
        promoter: draftForm.promoter || undefined,
        artists: draftForm.artists || undefined,
        description: draftForm.description || undefined,
      };
      await create(payload as any);
      setDraftOpen(false);
      setDraftForm(defaultCreate);
    } catch (err: any) {
      const message = err?.message || 'Failed to create event';
      setDraftError(message);
      console.error('Create event failed:', err);
    } finally {
      setDraftSubmitting(false);
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
          >
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={!!filterState.includePast} onChange={(e) => setFilterState(prev => ({ ...prev, includePast: e.target.checked }))} />
              Show past
            </label>
          </FilterBar>
          {/* Removed inline roll-down create UI */}
          <List<EventRecord>
            items={items}
            selectedId={selectedId}
            onSelect={select}
            loading={loading}
            renderItem={(ev) => (
              <>
                <div className="text-sm font-medium truncate">{ev.title}</div>
                <div className="text-xs text-muted-foreground">{ev.date} • {formatTimeTo12Hour(ev.startTime)}-{formatTimeTo12Hour(ev.endTime)}</div>
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
                  <h2 className="text-xl font-semibold">New Event</h2>
                ) : selected ? (
                  !editingTitle ? (
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
                  )
                ) : (
                  <div className="text-sm text-muted-foreground">Select an event to view details</div>
                )}
              </div>
              <div className="min-w-[140px]">
                <div className={`transition-all duration-300 ${draftOpen ? 'grid grid-rows-[0fr] opacity-0 -translate-y-1' : 'grid grid-rows-[1fr] opacity-100 translate-y-0'}`}>
                  <div className="overflow-hidden flex justify-end">
                    <Button size="sm" onClick={() => { setDraftOpen(true); setDraftForm(defaultCreate); }}>New Event</Button>
                  </div>
                </div>
                <div className={`transition-all duration-300 ${draftOpen ? 'grid grid-rows-[1fr] opacity-100 translate-y-0' : 'grid grid-rows-[0fr] opacity-0 -translate-y-1'}`}>
                  <div className="overflow-hidden flex justify-end">
                    <div className="flex gap-2">
                      <Button size="sm" onClick={onSaveDraft} disabled={!draftForm.title.trim() || draftSubmitting}>{draftSubmitting ? 'Saving…' : 'Save'}</Button>
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
                    <label className="block text-xs text-muted-foreground mb-1">Title</label>
                    <Input value={draftForm.title} onChange={(e) => setDraftForm({ ...draftForm, title: e.target.value })} />
                  </div>
                  <div>
                    <label className="block text-xs text-muted-foreground mb-1">Promoter</label>
                    <Input value={draftForm.promoter} onChange={(e) => setDraftForm({ ...draftForm, promoter: e.target.value })} />
                  </div>
                  <div>
                    <label className="block text-xs text-muted-foreground mb-1">Status</label>
                    <Input value={draftForm.status} onChange={(e) => setDraftForm({ ...draftForm, status: e.target.value })} />
                  </div>
                  <div>
                    <label className="block text-xs text-muted-foreground mb-1">Date</label>
                    <DateField value={draftForm.date} onChange={(v) => setDraftForm({ ...draftForm, date: v || '' })} />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs text-muted-foreground mb-1">Start</label>
                      <TimeField value={draftForm.startTime} onChange={(v) => setDraftForm({ ...draftForm, startTime: v || '' })} />
                    </div>
                    <div>
                      <label className="block text-xs text-muted-foreground mb-1">End</label>
                      <TimeField value={draftForm.endTime} onChange={(v) => setDraftForm({ ...draftForm, endTime: v || '' })} />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-muted-foreground mb-1">Artists</label>
                    <Input value={draftForm.artists} onChange={(e) => setDraftForm({ ...draftForm, artists: e.target.value })} />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs text-muted-foreground mb-1">Description</label>
                    <Input value={draftForm.description} onChange={(e) => setDraftForm({ ...draftForm, description: e.target.value })} />
                  </div>
                </div>
              </>
            ) : selected ? (
              <>
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
              </>
            ) : null}
          </div>
        </div>
      )}
    />
  );
}

export default Events;


