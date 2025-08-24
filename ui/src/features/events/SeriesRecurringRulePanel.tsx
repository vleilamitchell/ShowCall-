import { useEffect, useMemo, useState } from 'react';
import { Rollup } from '@/components/ui/rollup';
import { getEventSeriesRule, type EventSeriesRule } from '@/lib/serverComm';
import { RecurringRuleEditor } from '@/features/events/RecurringRuleEditor';

const weekdayLabels = ['Su','Mo','Tu','We','Th','Fr','Sa'];

export function SeriesRecurringRulePanel({ seriesId }: { seriesId: string }) {
  const [open, setOpen] = useState<boolean>(() => {
    try { return localStorage.getItem('seriesRuleRollupOpen') === '1'; } catch { return true; }
  });
  const [rule, setRule] = useState<EventSeriesRule | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let ignore = false;
    setLoading(true);
    getEventSeriesRule(seriesId)
      .then((r) => { if (!ignore) setRule(r || null); })
      .finally(() => { if (!ignore) setLoading(false); });
    return () => { ignore = true; };
  }, [seriesId]);

  const summary = useMemo(() => {
    if (!rule) return loading ? 'Loading…' : 'No rule';
    const interval = Math.max(1, rule.interval || 1);
    const days: string[] = [];
    const mask = rule.byWeekdayMask || 0;
    for (let i = 0; i < 7; i++) {
      if ((mask & (1 << i)) !== 0) days.push(weekdayLabels[i]);
    }
    const freqLabel = interval === 1 ? 'Every week' : `Every ${interval} weeks`;
    const daysLabel = days.length > 0 ? days.join(' ') : '—';
    return `${freqLabel} · ${daysLabel}`;
  }, [rule, loading]);

  return (
    <div className="mt-6">
      <Rollup
        title="Recurring Rule"
        summaryText={summary}
        storageKey="seriesRuleRollupOpen"
      >
        <RecurringRuleEditor seriesId={seriesId} />
      </Rollup>
    </div>
  );
}

export default SeriesRecurringRulePanel;


