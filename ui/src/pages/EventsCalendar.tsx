import { useEffect, useMemo, useRef, useState } from 'react';
import {
  addDays,
  addMonths,
  endOfMonth,
  endOfWeek,
  format,
  getMonth,
  getYear,
  setMonth,
  setYear,
  startOfMonth,
  startOfWeek,
} from 'date-fns';
import { Button } from '@/components/ui/button';
import { listEvents, type EventRecord } from '@/lib/serverComm';
import { useNavigate } from 'react-router-dom';
import { formatTimeTo12Hour } from '@/lib/time';

function formatYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export default function EventsCalendar() {
  const navigate = useNavigate();
  const [visibleMonth, setVisibleMonth] = useState<Date>(startOfMonth(new Date()));
  const [events, setEvents] = useState<EventRecord[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingCaption, setEditingCaption] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const toolbarRef = useRef<HTMLDivElement | null>(null);
  const errorRef = useRef<HTMLDivElement | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const weekdayHeaderRef = useRef<HTMLDivElement | null>(null);
  const [rowHeightPx, setRowHeightPx] = useState<number>(110);

  const fromStr = useMemo(() => formatYmd(startOfMonth(visibleMonth)), [visibleMonth]);
  const toStr = useMemo(() => formatYmd(endOfMonth(visibleMonth)), [visibleMonth]);

  const eventsByDate = useMemo(() => {
    const map: Record<string, EventRecord[]> = {};
    for (const ev of events || []) {
      if (!map[ev.date]) map[ev.date] = [];
      map[ev.date].push(ev);
    }
    return map;
  }, [events]);

  useEffect(() => {
    let aborted = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const rows = await listEvents({ from: fromStr, to: toStr, includePast: true });
        if (!aborted) setEvents(rows);
      } catch (e: any) {
        if (!aborted) {
          setEvents([]);
          setError(e?.message || 'Failed to load events');
        }
      } finally {
        if (!aborted) setLoading(false);
      }
    })();
    return () => { aborted = true; };
  }, [fromStr, toStr]);

  const onMonthChange = (next: Date) => {
    setVisibleMonth(startOfMonth(next));
  };

  const goPrev = () => onMonthChange(addMonths(visibleMonth, -1));
  const goNext = () => onMonthChange(addMonths(visibleMonth, 1));
  const goToday = () => onMonthChange(startOfMonth(new Date()));

  // Build visible 6-week grid (42 days) starting Sunday
  const gridDates = useMemo(() => {
    const start = startOfWeek(startOfMonth(visibleMonth), { weekStartsOn: 0 });
    const end = endOfWeek(endOfMonth(visibleMonth), { weekStartsOn: 0 });
    const days: Date[] = [];
    let cur = start;
    while (cur <= end) {
      days.push(cur);
      cur = addDays(cur, 1);
    }
    // Ensure 42 cells (6 weeks)
    while (days.length < 42) days.push(addDays(days[days.length - 1], 1));
    return days;
  }, [visibleMonth]);

  const monthIndex = getMonth(visibleMonth);
  const yearValue = getYear(visibleMonth);

  const onMonthSelect = (m: number) => {
    setVisibleMonth(startOfMonth(setMonth(visibleMonth, m)));
  };
  const onYearSelect = (y: number) => {
    setVisibleMonth(startOfMonth(setYear(visibleMonth, y)));
  };

  // Dynamically size each calendar row to fit the visible container height (accounting for toolbar, error, paddings, and gaps)
  useEffect(() => {
    const ROW_GAP_PX = 8; // gap-2
    const OUTER_GAP_PX = 16; // approximate pageHeader margin-bottom between toolbar/error/wrapper
    const BOTTOM_MARGIN_PX = 4; // tiny safety margin to avoid vertical scrollbar
    const ROWS = 6;
    const compute = () => {
      const rect = containerRef.current?.getBoundingClientRect();
      const viewportAvailable = rect ? (window.innerHeight - rect.top - BOTTOM_MARGIN_PX) : (containerRef.current?.clientHeight || 0);
      const toolbarH = toolbarRef.current?.clientHeight || 0;
      const errorH = errorRef.current?.clientHeight || 0;
      const outerGaps = OUTER_GAP_PX * (1 + (errorH > 0 ? 1 : 0));
      const baseWrapperH = Math.max(0, viewportAvailable - toolbarH - errorH - outerGaps);
      if (wrapperRef.current) {
        wrapperRef.current.style.height = `${baseWrapperH}px`;
      }
      const weekdaysH = weekdayHeaderRef.current?.clientHeight || 0;
      const verticalGaps = (ROWS - 1) * ROW_GAP_PX;
      const available = Math.max(0, baseWrapperH - weekdaysH - verticalGaps);
      const perRow = available > 0 ? Math.floor(available / ROWS) : 110;
      setRowHeightPx(Math.max(72, perRow + 5));
    };
    compute();
    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined' && containerRef.current) {
      ro = new ResizeObserver(() => compute());
      ro.observe(containerRef.current);
    } else {
      const onResize = () => compute();
      window.addEventListener('resize', onResize);
      return () => window.removeEventListener('resize', onResize);
    }
    return () => ro?.disconnect();
  }, []);

  return (
    <div ref={containerRef} className="routeFadeItem relative flex flex-col gap-3 p-0 min-h-0 -mx-[18px] -mb-[18px]">
      <div ref={toolbarRef} className="pageHeader pageHeader--flush relative rounded-t-none attachedBelowTopbar">
        <div className="toolbar">
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              className="h-8 px-2.5 text-foreground hover:bg-accent/20 shadow-xs"
              onClick={goPrev}
              aria-label="Previous month"
            >
              Prev
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-8 px-2.5 text-foreground hover:bg-accent/20 shadow-xs"
              onClick={goToday}
              aria-label="Go to today"
            >
              Today
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-8 px-2.5 text-foreground hover:bg-accent/20 shadow-xs"
              onClick={goNext}
              aria-label="Next month"
            >
              Next
            </Button>
          </div>
          <div className="spacer" />
          {editingCaption ? (
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-8 flex items-center gap-2">
              <select
                className="select h-8 text-sm min-w-24"
                value={monthIndex}
                onChange={(e) => onMonthSelect(Number(e.target.value))}
                aria-label="Select month"
              >
                {Array.from({ length: 12 }).map((_, i) => (
                  <option key={i} value={i}>{format(setMonth(new Date(), i), 'MMM')}</option>
                ))}
              </select>
              <select
                className="select h-8 text-sm min-w-20"
                value={yearValue}
                onChange={(e) => onYearSelect(Number(e.target.value))}
                aria-label="Select year"
              >
                {Array.from({ length: 11 }).map((_, idx) => {
                  const base = getYear(new Date());
                  const y = base - 5 + idx;
                  return <option key={y} value={y}>{y}</option>;
                })}
              </select>
              <Button size="sm" variant="outline" className="h-8 px-2" onClick={() => setEditingCaption(false)}>Done</Button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setEditingCaption(true)}
              className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-8 flex items-center text-base font-semibold leading-none px-1 py-0 rounded hover:bg-[color-mix(in_oklch,var(--foreground)_6%,transparent)]"
              aria-label="Edit month and year"
            >
              <span className="align-middle">{format(visibleMonth, 'MMMM')}</span>
              <span className="align-middle opacity-80 ml-2">{yearValue}</span>
            </button>
          )}
        </div>
      </div>

      {error ? <div ref={errorRef} className="text-sm text-destructive">{error}</div> : null}

      <div ref={wrapperRef} className="w-full flex-1 min-h-0 overflow-hidden">
        {/* Weekday header */}
        <div ref={weekdayHeaderRef} className="grid grid-cols-7 text-[11px] uppercase tracking-wide text-muted-foreground px-0">
          {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map((d) => (
            <div key={d} className="px-1 py-1 select-none">{d}</div>
          ))}
        </div>
        {/* Month grid (6 rows x 7 columns) sized to container */}
        <div
          className="relative grid grid-cols-[repeat(7,minmax(0,1fr))] grid-rows-6 gap-0"
          style={{ gridTemplateRows: `repeat(6, ${rowHeightPx}px)` }}
        >
          {gridDates.map((day, idx) => {
            const inMonth = getMonth(day) === getMonth(visibleMonth);
            const key = formatYmd(day);
            const dayEvents = eventsByDate[key] || [];
            const isToday = key === formatYmd(new Date());
            const isWeekend = day.getDay() === 0 || day.getDay() === 6;
            const baseCell = 'relative rounded-none p-0.5 flex flex-col min-h-0 transition-colors backdrop-blur-[0.5px]';
            const bgMuted = isWeekend ? ' bg-muted/25' : '';
            const monthTint = '';
            const todayTint = isToday ? ' ring-2 ring-primary/40 bg-primary/5' : '';
            return (
              <div
                key={idx}
                className={`${baseCell}${bgMuted}${monthTint}${todayTint} hover:bg-accent/40`}
              >
                {/* Per-cell overlay: in-month gets noise, out-of-month gets darkening */}
                {inMonth ? (
                  <div
                    className="pointer-events-none absolute inset-0 rounded-md"
                    style={{
                      backgroundImage:
                        "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120' viewBox='0 0 120 120'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='120' height='120' filter='url(%23n)' opacity='0.035'/></svg>\")",
                      backgroundSize: '120px 120px',
                      backgroundRepeat: 'repeat',
                    }}
                  />
                ) : (
                  <div className="pointer-events-none absolute inset-0 rounded-md bg-black/10 dark:bg-black/40" />
                )}
                {/* Gradient border overlay (mask to show ring only) */}
                <div
                  className="pointer-events-none absolute inset-0 rounded-md"
                  style={{
                    padding: '1px',
                    background: 'linear-gradient(135deg, var(--btn-left), var(--btn-right))',
                    opacity: 0.85,
                    WebkitMask: 'linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)',
                    WebkitMaskComposite: 'xor',
                    maskComposite: 'exclude',
                  }}
                />
                <div className="flex items-center justify-between mb-3">
                  <div className="text-xs font-medium inline-flex items-center gap-1">
                    <span className={`inline-flex items-center justify-center h-5 w-5 rounded-full ${isToday ? 'bg-primary text-primary-foreground' : 'bg-black/70 text-white'} text-[11px] ml-1 mt-0.5`}>{day.getDate()}</span>
                  </div>
                </div>
                <div className="mt-1 space-y-1 overflow-auto pr-0.5">
                  {dayEvents.map((ev) => {
                    const color = ev.status === 'cancelled' || ev.status === 'canceled'
                      ? 'bg-destructive/10 text-destructive hover:bg-destructive/15 focus:ring-destructive/40'
                      : ev.status === 'confirmed' || ev.status === 'active'
                      ? 'bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/15 focus:ring-emerald-500/40 dark:text-emerald-400'
                      : 'bg-primary/10 text-primary hover:bg-primary/15 focus:ring-primary/40';
                    const timePrefix = (ev.startTime ? `${formatTimeTo12Hour(ev.startTime)} ` : '');
                    const showTime = Boolean(timePrefix) && String(ev.title || '').length <= 20;
                    return (
                      <button
                        key={ev.id}
                        type="button"
                        onClick={() => navigate(`/events/${encodeURIComponent(ev.id)}`)}
                        className={`w-full text-left text-[11px] leading-tight truncate rounded px-[4px] py-0.5 focus:outline-none focus:ring-2 ${color}`}
                        title={`${ev.title}`}
                      >
                        <span className="inline-flex items-center gap-1 w-full">
                          <span className="flex-1 min-w-0 truncate">{ev.title}</span>
                          {showTime ? (
                            <span className="opacity-80 shrink-0">{timePrefix.trim()}</span>
                          ) : null}
                          <span className="inline-block size-1.5 rounded-full bg-current opacity-70 shrink-0" />
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
        {loading ? (
          <div className="text-xs text-muted-foreground px-2 py-2">Loading…</div>
        ) : null}
      </div>
    </div>
  );
}


