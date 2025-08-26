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
import { bootstrapEvents, type EventRecord, getEventAreas, type Area } from '@/lib/serverComm';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { formatTimeTo12Hour } from '@/lib/time';

function formatYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export default function EventsCalendar() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [visibleMonth, setVisibleMonth] = useState<Date>(() => {
    // Prefer URL
    const yStr = typeof window !== 'undefined' ? searchParams.get('y') : null;
    const mStr = typeof window !== 'undefined' ? searchParams.get('m') : null;
    const yUrl = yStr ? Number(yStr) : NaN;
    const mUrl = mStr ? Number(mStr) : NaN;
    if (Number.isFinite(yUrl) && Number.isFinite(mUrl) && mUrl >= 1 && mUrl <= 12) {
      return startOfMonth(new Date(yUrl, mUrl - 1, 1));
    }
    // Fallback to localStorage (store as YYYY-MM)
    try {
      const ym = localStorage.getItem('eventsCalendarVisibleYm');
      if (ym && /^(\d{4})-(\d{2})$/.test(ym)) {
        const [yy, mm] = ym.split('-').map(Number);
        return startOfMonth(new Date(yy, mm - 1, 1));
      }
      // Back-compat: older key stored full date string which can be timezone-sensitive
      const legacy = localStorage.getItem('eventsCalendarVisibleMonth');
      if (legacy && /^(\d{4})-(\d{2})-\d{2}$/.test(legacy)) {
        const [yy, mm] = legacy.split('-');
        const yyN = Number(yy);
        const mmN = Number(mm);
        if (Number.isFinite(yyN) && Number.isFinite(mmN)) {
          return startOfMonth(new Date(yyN, mmN - 1, 1));
        }
      }
    } catch {}
    return startOfMonth(new Date());
  });
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
  const [areaColors, setAreaColors] = useState<Map<string, string>>(new Map());

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
        const boot = await bootstrapEvents({ from: fromStr, to: toStr, includePast: true });
        if (aborted) return;
        setEvents(boot.events);
        // Seed area color map from active areas
        const colorMap = new Map<string, string>();
        for (const a of boot.areasActive || []) colorMap.set(a.id, a.color || 'var(--secondary)');
        setAreaColors(colorMap);
        // Seed areas-by-event cache and notify listeners
        Object.entries(boot.areasByEvent || {}).forEach(([eventId, areas]) => {
          eventAreasCache.set(eventId, areas);
          try { window.dispatchEvent(new CustomEvent('event-areas-updated', { detail: { eventId, areas } })); } catch {}
        });
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

  // Area colors now come from bootstrap; no extra call needed

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

  // Sync from URL -> state when y/m params are present or change (e.g., back/forward nav)
  useEffect(() => {
    const yStr = searchParams.get('y');
    const mStr = searchParams.get('m');
    const y = yStr ? Number(yStr) : NaN;
    const m = mStr ? Number(mStr) : NaN;
    if (Number.isFinite(y) && Number.isFinite(m) && m >= 1 && m <= 12) {
      const d = startOfMonth(new Date(y, m - 1, 1));
      if (d.getTime() !== visibleMonth.getTime()) {
        setVisibleMonth(d);
      }
    }
  }, [searchParams]);

  // Persist state -> localStorage and reflect in URL (y,m) for deep linking
  useEffect(() => {
    try {
      const y = String(getYear(visibleMonth));
      const m = String(getMonth(visibleMonth) + 1).padStart(2, '0');
      localStorage.setItem('eventsCalendarVisibleYm', `${y}-${m}`);
    } catch {}
    const y = String(getYear(visibleMonth));
    const m = String(getMonth(visibleMonth) + 1);
    const curY = searchParams.get('y');
    const curM = searchParams.get('m');
    if (curY !== y || curM !== m) {
      setSearchParams({ y, m }, { replace: true });
    }
  }, [visibleMonth, setSearchParams]);

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
    <div ref={containerRef} className="routeFadeItem relative flex flex-col gap-3 px-2 pb-2 md:px-3 min-h-0">
      <div ref={toolbarRef} className="pageHeader pageHeader--flush pageHeader--calendar relative rounded-t-none attachedBelowTopbar">
        <div className="toolbar">
          <div className="flex items-center gap-2 -translate-y-[5px]">
            <Button
              size="sm"
              variant="outline"
              className="h-8 px-2.5 py-0 leading-none text-foreground hover:bg-accent/20 shadow-xs"
              onClick={goPrev}
              aria-label="Previous month"
            >
              <span className="material-symbols-outlined text-base leading-none">chevron_left</span>
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-8 px-2.5 py-0 leading-none text-foreground hover:bg-accent/20 shadow-xs"
              onClick={goToday}
              aria-label="Go to today"
            >
              Today
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-8 px-2.5 py-0 leading-none text-foreground hover:bg-accent/20 shadow-xs"
              onClick={goNext}
              aria-label="Next month"
            >
              <span className="material-symbols-outlined text-base leading-none">chevron_right</span>
            </Button>
          </div>
          <div className="spacer" />
          {editingCaption ? (
            <div className="absolute left-1/2 bottom-[2px] -translate-x-1/2 h-8 flex items-center gap-2">
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
              <Button size="sm" variant="outline" className="h-8 px-2 py-0 leading-none" onClick={() => setEditingCaption(false)}>Done</Button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setEditingCaption(true)}
              className="absolute left-1/2 bottom-[2px] -translate-x-1/2 h-8 flex items-center text-base font-semibold leading-none px-1 py-0 rounded hover:bg-[color-mix(in_oklch,var(--foreground)_6%,transparent)]"
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
            const todayTint = isToday ? ' ring-2 ring-primary/70 bg-primary/15 ring-offset-1 ring-offset-white dark:ring-offset-[#0a0f1c]' : '';
            return (
              <div
                key={idx}
                className={`${baseCell}${bgMuted}${monthTint}${todayTint}`}
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
                <div className="flex items-center justify-between">
                  <div className="text-xs font-medium inline-flex items-center gap-1">
                    <span
                      className={`inline-flex items-center justify-center h-5 min-w-5 px-1.5 rounded-md text-[11px] ml-1 mt-0.5 ring-1 transition-colors
                        ${isToday
                          ? 'bg-primary/30 text-foreground font-semibold ring-primary/70 dark:bg-primary/35 dark:text-foreground'
                          : 'bg-muted text-muted-foreground ring-black/5 dark:bg-white/5 dark:text-foreground/80 dark:ring-white/10'
                        }`}
                    >
                      {day.getDate()}
                    </span>
                  </div>
                </div>
                <div className="space-y-[1px] overflow-auto pr-0.5">
                  {dayEvents.map((ev) => {
                    const color = ev.status === 'cancelled' || ev.status === 'canceled'
                      ? 'bg-destructive/10 text-destructive hover:bg-destructive/40 hover:ring-2 hover:ring-destructive/60 hover:shadow focus:ring-destructive/60'
                      : ev.status === 'confirmed' || ev.status === 'active'
                      ? 'bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/40 hover:ring-2 hover:ring-emerald-500/60 hover:shadow focus:ring-emerald-500/60 dark:text-emerald-400'
                      : 'bg-primary/10 text-foreground dark:text-primary hover:bg-primary/40 hover:ring-2 hover:ring-primary/60 hover:shadow focus:ring-primary/60';
                    const timePrefix = (ev.startTime ? `${formatTimeTo12Hour(ev.startTime)} ` : '');
                    const showTime = Boolean(timePrefix) && String(ev.title || '').length <= 20;
                    return (
                      <button
                        key={ev.id}
                        type="button"
                        onClick={() => {
                          const urlId = String(ev.id).replace(/^legacy-ev:/, '');
                          navigate(`/events/${encodeURIComponent(urlId)}`);
                        }}
                        className={`relative w-full text-left text-[11px] leading-tight truncate rounded px-[4px] pt-0.5 pb-[3px] focus:outline-none focus:ring-2 hover:ring-2 ring-offset-1 ring-offset-white dark:ring-offset-[#0a0f1c] transition ${color}`}
                        title={`${ev.title}`}
                      >
                        <span className="inline-flex items-center gap-1 w-full">
                          <span className="flex-1 min-w-0 truncate">{ev.title}</span>
                          {showTime ? (
                            <span className="opacity-80 shrink-0">{timePrefix.trim()}</span>
                          ) : null}
                          <span className="inline-block size-1.5 rounded-full bg-current opacity-70 shrink-0" />
                        </span>
                        <EventAreasGradientBar eventId={ev.id} areaColors={areaColors} />
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

// Cache event areas to reduce duplicate fetches in calendar
const eventAreasCache = new Map<string, Area[]>();

function buildHardStopGradient(colors: string[]): string {
  const palette = colors.length > 0 ? colors : ['var(--secondary)'];
  const total = palette.length;
  const stops: string[] = [];
  for (let i = 0; i < total; i++) {
    const start = (i / total) * 100;
    const end = ((i + 1) / total) * 100;
    const color = palette[i] || 'var(--secondary)';
    stops.push(`${color} ${start}%`, `${color} ${end}%`);
  }
  return `linear-gradient(90deg, ${stops.join(', ')})`;
}

function EventAreasGradientBar({ eventId, areaColors }: { eventId: string; areaColors: Map<string, string> }) {
  const [areaIds, setAreaIds] = useState<string[] | null>(null);

  useEffect(() => {
    let ignore = false;
    const onAreasUpdated = (e: Event) => {
      try {
        const detail = (e as CustomEvent).detail as { eventId: string; areas: Area[] } | undefined;
        if (detail && detail.eventId === eventId) {
          eventAreasCache.set(eventId, detail.areas);
          if (!ignore) setAreaIds((detail.areas || []).map(a => a.id));
        }
      } catch {}
    };
    window.addEventListener('event-areas-updated', onAreasUpdated as EventListener);

    const cached = eventAreasCache.get(eventId);
    if (cached) {
      setAreaIds((cached || []).map(a => a.id));
    } else {
      getEventAreas(eventId)
        .then((res) => {
          if (ignore) return;
          eventAreasCache.set(eventId, res);
          setAreaIds((res || []).map(a => a.id));
        })
        .catch(() => {
          if (ignore) return;
          setAreaIds([]);
        });
    }
    return () => {
      ignore = true;
      window.removeEventListener('event-areas-updated', onAreasUpdated as EventListener);
    };
  }, [eventId]);

  const colors: string[] | null = useMemo(() => {
    if (!areaIds) return null;
    return areaIds.map(id => areaColors.get(id) || 'var(--secondary)');
  }, [areaIds, areaColors]);

  if (!colors || colors.length === 0) return null;
  const gradient = buildHardStopGradient(colors);
  return (
    <span
      className="pointer-events-none absolute left-0 right-0 bottom-0 h-[3px] rounded-b-[inherit]"
      style={{ background: gradient }}
    />
  );
}


