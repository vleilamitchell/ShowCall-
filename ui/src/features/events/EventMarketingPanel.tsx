import { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { ExternalLink, ClipboardCopy, Pencil } from 'lucide-react';
import type { EventRecord } from '@/lib/serverComm';
import { updateEvent } from '@/lib/serverComm';
import { useDebouncedPatch } from '@/features/listDetail';
import { Rollup } from '@/components/ui/rollup';

type Props = {
  event: EventRecord;
  onPatch: (patch: Partial<EventRecord>) => Promise<EventRecord> | EventRecord | void;
  mutateItems: (updater: (prev: EventRecord[]) => EventRecord[]) => void;
};

type FieldKey = 'ticketUrl' | 'eventPageUrl' | 'promoAssetsUrl';

export function EventMarketingPanel({ event, onPatch, mutateItems }: Props) {
  // open state handled by Rollup
  const [editing, setEditing] = useState<FieldKey | null>(null);
  const [errors, setErrors] = useState<Partial<Record<FieldKey, string>>>({});

  const fields: Array<{ key: FieldKey; label: string; placeholder: string; value: string | null | undefined }>= useMemo(() => ([
    { key: 'ticketUrl', label: 'Ticket', placeholder: 'Add ticket link', value: event.ticketUrl },
    { key: 'eventPageUrl', label: 'Event Page', placeholder: 'Add event page link', value: event.eventPageUrl },
    { key: 'promoAssetsUrl', label: 'Promo Assets', placeholder: 'Add promo assets link', value: event.promoAssetsUrl },
  ]), [event.ticketUrl, event.eventPageUrl, event.promoAssetsUrl]);

  const { onChange } = useDebouncedPatch<Partial<EventRecord>>({
    applyPatch: async (patch) => {
      const updated = await updateEvent(event.id, patch);
      mutateItems(prev => prev.map(i => (i.id === updated.id ? updated : i)));
    }
  });

  const handleEdit = (key: FieldKey) => setEditing(key);
  const handleOpen = (url?: string | null) => { if (url) window.open(url, '_blank'); };
  const handleCopy = async (url?: string | null) => { if (!url) return; try { await navigator.clipboard.writeText(url); } catch {} };

  const onChangeValue = (key: FieldKey, next: string) => {
    setErrors(prev => ({ ...prev, [key]: undefined }));
    mutateItems(prev => prev.map(i => (i.id === event.id ? ({ ...i, [key]: next || null }) as EventRecord : i)));
    onChange({ [key]: next || undefined } as Partial<EventRecord>);
  };

  const onBlurField = async () => {
    const key = editing;
    if (!key) { setEditing(null); return; }
    const value = (event as any)[key] as string | null | undefined;
    try {
      const patch: Partial<EventRecord> = { [key]: (value == null || String(value).trim() === '') ? null : String(value) } as any;
      await Promise.resolve(onPatch(patch));
      setEditing(null);
      setErrors(prev => ({ ...prev, [key]: undefined }));
    } catch (e: any) {
      setErrors(prev => ({ ...prev, [key]: 'Must be a valid http(s) URL or leave blank' }));
    }
  };

  const Row = ({ k, label, value, placeholder }: { k: FieldKey; label: string; value?: string | null; placeholder: string }) => (
    <div className="flex items-start gap-3">
      <div className="w-28 text-xs text-muted-foreground pt-2">{label}</div>
      <div className="flex-1">
        {editing === k ? (
          <div>
            <Input
              autoFocus
              value={String(value || '')}
              onChange={(e) => onChangeValue(k, e.target.value)}
              onBlur={onBlurField}
              onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') setEditing(null); }}
            />
            {errors[k] && <div className="mt-1 text-xs text-destructive">{errors[k]}</div>}
          </div>
        ) : (
          <div className="flex items-center justify-between gap-2">
            <div className="text-sm truncate text-left">
              {value ? (
                <a className="underline underline-offset-2" href={value} target="_blank" rel="noreferrer">{truncateMiddle(value, 64)}</a>
              ) : (
                <span className="text-muted-foreground">{placeholder}</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={value ? 'default' : 'secondary'} className="text-xs">{value ? 'Set' : 'Unset'}</Badge>
              <Button size="icon" variant="ghost" aria-label={`Open ${label}`} disabled={!value} onClick={() => handleOpen(value)}>
                <ExternalLink className="h-4 w-4" />
              </Button>
              <Button size="icon" variant="ghost" aria-label={`Copy ${label}`} disabled={!value} onClick={() => handleCopy(value)}>
                <ClipboardCopy className="h-4 w-4" />
              </Button>
              <Button size="icon" variant="ghost" aria-label={`Edit ${label}`} onClick={() => handleEdit(k)}>
                <Pencil className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="mt-6">
      <Rollup
        title="Marketing"
        summaryText={['ticketUrl','eventPageUrl','promoAssetsUrl'].filter((k) => (event as any)[k]).length}
        storageKey="eventMarketingRollupOpen"
      >
        <Card className="p-3 bg-muted/30">
          <div className="space-y-3">
            {fields.map((f, i) => (
              <div key={f.key}>
                <Row k={f.key} label={f.label} value={f.value} placeholder={f.placeholder} />
                {i < fields.length - 1 ? <Separator className="mt-3" /> : null}
              </div>
            ))}
          </div>
        </Card>
      </Rollup>
    </div>
  );
}

function truncateMiddle(s: string, max: number): string {
  if (s.length <= max) return s;
  const half = Math.floor((max - 3) / 2);
  return `${s.slice(0, half)}...${s.slice(-half)}`;
}

export default EventMarketingPanel;


