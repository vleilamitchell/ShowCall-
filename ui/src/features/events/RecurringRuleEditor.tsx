import { useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';
import { getEventSeriesRule, updateEventSeriesRule } from '@/lib/serverComm';

const weekdayLabels = ['Su','Mo','Tu','We','Th','Fr','Sa'];

export function RecurringRuleEditor({ seriesId }: { seriesId: string }) {
  const [interval, setInterval] = useState<number>(1);
  const [mask, setMask] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let ignore = false;
    (async () => {
      setLoading(true);
      try {
        const rule = await getEventSeriesRule(seriesId);
        if (!ignore && rule) {
          setInterval(rule.interval || 1);
          setMask(rule.byWeekdayMask || 0);
        }
      } catch {
        // no existing rule; keep defaults
      } finally {
        if (!ignore) setLoading(false);
      }
    })();
    return () => { ignore = true; };
  }, [seriesId]);

  const toggleDay = (day: number) => {
    setMask((prev) => (prev ^ (1 << day)) >>> 0);
  };

  const save = async () => {
    setSaving(true);
    try {
      await updateEventSeriesRule(seriesId, { frequency: 'WEEKLY', interval, byWeekdayMask: mask });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Every</span>
          <Input value={interval} onChange={(e) => setInterval(Math.max(1, Number(e.target.value || '1')))} className="w-16" />
          <span className="text-xs text-muted-foreground">week(s)</span>
        </div>
        <div className="flex items-center gap-1">
          {weekdayLabels.map((lbl, i) => {
            const on = (mask & (1 << i)) !== 0;
            return (
              <button key={i} type="button" onClick={() => toggleDay(i)} className={`px-2 py-1 rounded text-xs border ${on ? 'bg-primary/15 text-foreground border-primary/70' : 'border-border text-muted-foreground'}`}>{lbl}</button>
            );
          })}
        </div>
      </div>
      <div className="mt-2 flex items-center gap-2">
        <button type="button" onClick={save} disabled={saving || loading} className="px-2 py-1 text-xs rounded border">
          {saving ? 'Saving…' : 'Save rule'}
        </button>
        {loading ? <div className="text-xs text-muted-foreground">Loading…</div> : null}
      </div>
    </div>
  );
}


