import type { ReactNode } from 'react';
import { Input } from '@/components/ui/input';

type Props<TFilters extends Record<string, unknown> = Record<string, unknown>> = {
  q?: string;
  onQChange?: (q: string) => void;
  filters?: Partial<TFilters>;
  onFiltersChange?: (next: Partial<TFilters>) => void;
  children?: ReactNode;
  actions?: ReactNode;
};

export function FilterBar<TFilters extends Record<string, unknown> = Record<string, unknown>>(
  props: Props<TFilters>
) {
  const { q, onQChange, children, actions } = props;
  return (
    <div className="p-3 border-b">
      <div className="flex gap-2">
        <Input placeholder="Search" value={q || ''} onChange={(e) => onQChange?.(e.target.value)} />
        {children}
      </div>
      {actions ? (
        <div className="mt-2">{actions}</div>
      ) : null}
    </div>
  );
}

export default FilterBar;


