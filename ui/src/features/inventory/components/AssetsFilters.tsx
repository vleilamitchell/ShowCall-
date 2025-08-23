import { useEffect, useMemo, useRef, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export type AssetsFiltersValue = {
  q?: string;
  itemType?: string;
  active?: 'all' | 'true' | 'false';
};

export function AssetsFilters(props: {
  open: boolean;
  onOpenChange(open: boolean): void;
  value: AssetsFiltersValue;
  onChange(next: AssetsFiltersValue): void;
  onApply(): void;
  onClear(): void;
  itemTypeOptions: string[];
}) {
  const { open, onOpenChange, value, onChange, onApply, onClear, itemTypeOptions } = props;

  const activeOptions = useMemo(() => [
    { value: 'all', label: 'All' },
    { value: 'true', label: 'Active' },
    { value: 'false', label: 'Inactive' },
  ] as const, []);

  // Smooth open/close using CSS keyframe classes defined in index.css
  const [closing, setClosing] = useState(false);
  const [overlayStatic, setOverlayStatic] = useState(false);
  const prevOpen = useRef(open);
  useEffect(() => {
    if (prevOpen.current && !open) {
      setClosing(true);
      setOverlayStatic(true);
      const id = setTimeout(() => { setClosing(false); setOverlayStatic(false); }, 180);
      return () => clearTimeout(id);
    }
    prevOpen.current = open;
  }, [open]);

  const visible = open || closing;

  return (
    <div className="z-30">
      {/* Overlay */}
      <div
        className={
          visible
            ? `fixed left-[var(--sidebar-width)] right-0 top-12 bottom-0 z-30 ${overlayStatic ? 'drawerOverlayStatic' : (closing ? 'drawerOverlay--closing' : 'drawerOverlay')}`
            : 'hidden'
        }
        onClick={() => onOpenChange(false)}
      />
      {/* Panel */}
      <div
        className={
          visible
            ? `fixed left-[var(--sidebar-width)] top-12 z-30 h-[calc((100vh-3rem)/2)] w-full max-w-sm bg-background shadow ${closing ? 'drawerPanel--closing' : 'drawerPanel'}`
            : 'hidden'
        }
        role="dialog"
        aria-label="Filters"
      >
        <div className="flex h-full flex-col">
        <div className="p-4">
          <div className="text-sm font-semibold">Filters</div>
        </div>
        <div className="p-4 space-y-4 overflow-auto">
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Search</label>
          <Input
            placeholder="Search by name or SKU"
            value={value.q || ''}
            onChange={(e) => onChange({ ...value, q: e.target.value })}
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Item Type</label>
          <select
            className="w-full h-9 rounded border bg-background px-2 text-sm"
            value={value.itemType || ''}
            onChange={(e) => onChange({ ...value, itemType: e.target.value || undefined })}
          >
            <option value="">Any</option>
            {itemTypeOptions.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Active</label>
          <select
            className="w-full h-9 rounded border bg-background px-2 text-sm"
            value={value.active || 'all'}
            onChange={(e) => onChange({ ...value, active: (e.target.value as AssetsFiltersValue['active']) })}
          >
            {activeOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
        </div>
        <div className="mt-auto p-4">
          <div className="flex gap-2">
            <Button onClick={onApply}>Apply</Button>
            <Button variant="outline" onClick={onClear}>Clear</Button>
          </div>
        </div>
        </div>
      </div>
    </div>
  );
}

export default AssetsFilters;


