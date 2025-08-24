import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown } from 'lucide-react';

type RollupProps = {
  title: string | JSX.Element;
  summary?: JSX.Element | string | null;
  summaryText?: string | number | null;
  storageKey?: string;
  defaultOpen?: boolean;
  className?: string;
  headerClassName?: string;
  children: React.ReactNode;
};

export function Rollup({ title, summary, summaryText, storageKey, defaultOpen = true, className, headerClassName, children }: RollupProps) {
  const [open, setOpen] = useState<boolean>(() => {
    if (!storageKey) return defaultOpen;
    try { return localStorage.getItem(storageKey) === '1'; } catch { return defaultOpen; }
  });

  useEffect(() => {
    if (!storageKey) return;
    try { localStorage.setItem(storageKey, open ? '1' : '0'); } catch {}
  }, [open, storageKey]);

  return (
    <div className={className || ''}>
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger asChild>
          <button className={`rollupHeader ${headerClassName || ''}`} aria-expanded={open}>
            <span className="text-sm font-semibold">{title}</span>
            <div className="flex items-center gap-2">
              {summary != null ? (
                <span className="text-xs inline-flex items-center">{summary}</span>
              ) : summaryText != null ? (
                <Badge variant="secondary" className="text-xs">{String(summaryText)}</Badge>
              ) : null}
              <ChevronDown className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : 'rotate-0'}`} />
            </div>
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent className="overflow-hidden transition-[max-height,opacity] duration-400 ease-out data-[state=open]:opacity-100 data-[state=closed]:opacity-0 data-[state=open]:max-h-[2000px] data-[state=closed]:max-h-0" style={{ willChange: 'opacity, maxHeight' as any }}>
          <div className="mt-3">{children}</div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

export default Rollup;


