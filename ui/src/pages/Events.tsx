import { useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';
import { DateField } from '@/components/date-field';
import { TimeField } from '@/components/time-field';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { listEvents, createEvent, updateEvent, deleteEvent, type EventRecord, getEvent, getEventAreas, getAreasForEvents, type Area } from '@/lib/serverComm';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { MoreHorizontal, Trash2 } from 'lucide-react';
import { EventShiftsPanel } from '@/features/events/EventShiftsPanel';
import { EventAreasPanel } from '@/features/events/EventAreasPanel';
import { EventMarketingPanel } from '@/features/events/EventMarketingPanel';
import { ListDetailLayout, List, FilterBar, useListDetail, useDebouncedPatch, type ResourceAdapter } from '@/features/listDetail';
// removed time formatting from list row

// Cache event areas in-memory to avoid repeated fetches while navigating
const eventAreasCache = new Map<string, Area[]>();

function formatDateMMDD(dateStr: string): string {
  // Expecting YYYY-MM-DD; fallback to original if unexpected
  if (!dateStr || dateStr.length < 10 || dateStr[4] !== '-' || dateStr[7] !== '-') return dateStr;
  const mm = dateStr.slice(5, 7);
  const dd = dateStr.slice(8, 10);
  return `${mm}/${dd}`;
}

function EventAreaChips({ eventId }: { eventId: string }) {
  const [areas, setAreas] = useState<Area[] | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let ignore = false;
    const onAreasUpdated = (e: Event) => {
      try {
        const detail = (e as CustomEvent).detail as { eventId: string; areas: Area[] } | undefined;
        if (detail && detail.eventId === eventId) {
          eventAreasCache.set(eventId, detail.areas);
          if (!ignore) setAreas(detail.areas);
        }
      } catch {}
    };
    window.addEventListener('event-areas-updated', onAreasUpdated as EventListener);
    const cached = eventAreasCache.get(eventId);
    if (cached) {
      setAreas(cached);
      return () => {
        ignore = true;
        window.removeEventListener('event-areas-updated', onAreasUpdated as EventListener);
      };
    }
    setLoading(true);
    getEventAreas(eventId)
      .then((res) => {
        if (ignore) return;
        eventAreasCache.set(eventId, res);
        setAreas(res);
      })
      .catch(() => {
        if (ignore) return;
        setAreas([]);
      })
      .finally(() => {
        if (ignore) return;
        setLoading(false);
      });
    return () => {
      ignore = true;
      window.removeEventListener('event-areas-updated', onAreasUpdated as EventListener);
    };
  }, [eventId]);

  if (loading && !areas) {
    return (
      <span className="inline-flex h-4 w-4 animate-pulse rounded-full bg-muted" />
    );
  }

  if (!areas || areas.length === 0) return null;

  const visible = areas.slice(0, 5);
  const remaining = areas.length - visible.length;

  return (
    <>
      {visible.map((a) => {
        const initial = (a.name || '').trim().charAt(0).toUpperCase();
        const bg = a.color || 'var(--secondary)';
        return (
          <span
            key={a.id}
            className="inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-semibold text-white ring-1 ring-black/10 shadow-sm"
            style={{ backgroundColor: bg }}
            title={a.name}
          >
            {initial || '?'}
          </span>
        );
      })}
      {remaining > 0 ? (
        <span className="inline-flex h-5 min-w-5 px-1 items-center justify-center rounded-full bg-muted text-[10px] font-semibold text-foreground/70 ring-1 ring-black/5">
          +{remaining}
        </span>
      ) : null}
    </>
  );
}

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

  // Prefetch area chips in bulk to avoid N requests on first render
  useEffect(() => {
    if (!items || items.length === 0) return;
    const idsToFetch = items
      .map((e) => e.id)
      .filter((id) => !eventAreasCache.has(id));
    if (idsToFetch.length === 0) return;
    getAreasForEvents(idsToFetch)
      .then((map) => {
        Object.entries(map).forEach(([eventId, areas]) => {
          eventAreasCache.set(eventId, areas);
          const evt = new CustomEvent('event-areas-updated', { detail: { eventId, areas } });
          window.dispatchEvent(evt);
        });
      })
      .catch(() => { /* ignore; per-item components will fallback to individual fetch */ });
  }, [items]);

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
            actions={(
              <div className="flex items-center justify-between rounded-md border bg-card/50 px-3 py-2">
                <div>
                  <div className="text-sm font-medium">Show past events</div>
                </div>
                <Switch
                  checked={!!filterState.includePast}
                  onCheckedChange={(checked) => setFilterState(prev => ({ ...prev, includePast: !!checked }))}
                />
              </div>
            )}
          />
          {/* Removed inline roll-down create UI */}
          <List<EventRecord>
            items={items}
            selectedId={selectedId}
            onSelect={select}
            loading={loading}
            renderActions={(ev) => (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="size-6 inline-flex items-center justify-center rounded hover:bg-accent">
                    <MoreHorizontal className="size-4" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    variant="destructive"
                    onClick={async () => {
                      const confirmed = window.confirm('Delete this event and all associated shifts?');
                      if (!confirmed) return;
                      try {
                        await deleteEvent(ev.id);
                        mutateItems(prev => prev.filter(i => i.id !== ev.id));
                      } catch (err) {
                        console.error('Delete event failed', err);
                        alert('Failed to delete event');
                      }
                    }}
                  >
                    <Trash2 className="size-4" /> Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            renderItem={(ev) => (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[11px] px-1.5 py-0.5 rounded-md bg-primary/20 text-foreground border border-primary/40 shadow-sm">
                    {formatDateMMDD(ev.date)}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <EventAreaChips eventId={ev.id} />
                  </div>
                </div>
                <div className="mt-1 text-sm font-medium truncate">{ev.title}</div>
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
                <EventMarketingPanel
                  event={selected}
                  onPatch={async (patch) => updateEvent(selected.id, patch)}
                  mutateItems={mutateItems as any}
                />
                <EventAreasPanel eventId={selected.id} />
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


