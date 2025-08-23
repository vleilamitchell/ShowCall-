import { useMemo } from 'react';
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

  return (
    <div className="z-30">
      <div
        className={
          "fixed left-[var(--sidebar-width)] right-0 top-12 bottom-0 bg-black/50 transition-opacity duration-300 z-30 " +
          (open ? "opacity-100" : "opacity-0 pointer-events-none")
        }
        onClick={() => onOpenChange(false)}
      />
      <div
        className={
          "fixed left-[var(--sidebar-width)] top-12 h-[calc((100vh-3rem)/2)] w-full max-w-sm bg-background shadow transition-transform transition-opacity duration-300 z-30 " +
          (open ? "translate-x-0 opacity-100" : "-translate-x-full opacity-0")
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


