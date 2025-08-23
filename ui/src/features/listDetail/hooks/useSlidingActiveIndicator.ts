import { useEffect, useLayoutEffect, useState } from 'react';

export function useSlidingActiveIndicator(containerRef: React.RefObject<HTMLElement>, activeSelector: string) {
  const [indicatorTop, setIndicatorTop] = useState(0);
  const [indicatorHeight, setIndicatorHeight] = useState(0);
  const [hasActive, setHasActive] = useState(false);

  const measure = (doNotHide?: boolean) => {
    const container = containerRef.current;
    if (!container) return;
    const activeEl = container.querySelector(activeSelector) as HTMLElement | null;
    if (!activeEl) { if (!doNotHide) setHasActive(false); return; }
    const containerRect = container.getBoundingClientRect();
    const rect = activeEl.getBoundingClientRect();
    setIndicatorTop(rect.top - containerRect.top + container.scrollTop);
    setIndicatorHeight(rect.height);
    setHasActive(true);
  };

  useLayoutEffect(() => {
    measure();
    const raf = requestAnimationFrame(() => measure());
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [containerRef.current]);

  useEffect(() => {
    let rafId: number | null = null;
    const onResize = () => {
      if (rafId != null) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => measure(true));
    };
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      if (rafId != null) cancelAnimationFrame(rafId);
    };
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onScroll = () => measure(true);
    el.addEventListener('scroll', onScroll);
    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(() => measure(true));
      ro.observe(el);
    }
    return () => {
      el.removeEventListener('scroll', onScroll);
      if (ro) ro.disconnect();
    };
  }, [containerRef]);

  return { indicatorTop, indicatorHeight, hasActive, measure } as const;
}


