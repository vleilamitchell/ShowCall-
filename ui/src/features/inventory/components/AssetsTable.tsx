import { useMemo } from 'react';
import type { InventoryItemRecord } from '@/lib/serverComm';

export type SortState = { by: keyof InventoryItemRecord; dir: 'asc' | 'desc' };

export function AssetsTable(props: {
  rows: InventoryItemRecord[];
  sort: SortState;
  onSortChange(next: SortState): void;
  page: number;
  pageSize: number;
  onPageChange(n: number): void;
  onPageSizeChange?(n: number): void;
  loading?: boolean;
}) {
  const { rows, sort, onSortChange, page, pageSize, onPageChange, onPageSizeChange, loading } = props;

  const sortedRows = useMemo(() => {
    const copied = [...rows];
    const dir = sort.dir === 'asc' ? 1 : -1;
    copied.sort((a, b) => {
      const av = a[sort.by];
      const bv = b[sort.by];
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      const as = String(av).toLowerCase();
      const bs = String(bv).toLowerCase();
      if (as < bs) return -1 * dir;
      if (as > bs) return 1 * dir;
      return 0;
    });
    return copied;
  }, [rows, sort.by, sort.dir]);

  const start = (page - 1) * pageSize;
  const pageRows = sortedRows.slice(start, start + pageSize);
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));

  const setSort = (by: keyof InventoryItemRecord) => {
    if (sort.by === by) {
      onSortChange({ by, dir: sort.dir === 'asc' ? 'desc' : 'asc' });
    } else {
      onSortChange({ by, dir: 'asc' });
    }
  };

  return (
    <div className="flex flex-col">
      <div className="overflow-auto border rounded-md">
        <table className="min-w-full text-sm">
          <thead className="sticky top-0 bg-muted/50">
            <tr className="text-left">
              <Th label="SKU" active={sort.by === 'sku'} dir={sort.dir} onClick={() => setSort('sku')} />
              <Th label="Name" active={sort.by === 'name'} dir={sort.dir} onClick={() => setSort('name')} />
              <Th label="Item Type" active={sort.by === 'itemType'} dir={sort.dir} onClick={() => setSort('itemType')} />
              <Th label="Base Unit" active={sort.by === 'baseUnit'} dir={sort.dir} onClick={() => setSort('baseUnit')} />
              <Th label="Category" active={sort.by === 'categoryId'} dir={sort.dir} onClick={() => setSort('categoryId')} />
              <Th label="Active" active={sort.by === 'active'} dir={sort.dir} onClick={() => setSort('active')} />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: Math.min(pageSize, 10) }).map((_, i) => (
                <tr key={`skel-${i}`} className="border-t">
                  <td className="p-2"><div className="h-4 w-24 bg-muted animate-pulse rounded" /></td>
                  <td className="p-2"><div className="h-4 w-48 bg-muted animate-pulse rounded" /></td>
                  <td className="p-2"><div className="h-4 w-28 bg-muted animate-pulse rounded" /></td>
                  <td className="p-2"><div className="h-4 w-20 bg-muted animate-pulse rounded" /></td>
                  <td className="p-2"><div className="h-4 w-24 bg-muted animate-pulse rounded" /></td>
                  <td className="p-2"><div className="h-4 w-12 bg-muted animate-pulse rounded" /></td>
                </tr>
              ))
            ) : pageRows.length === 0 ? (
              <tr className="border-t">
                <td className="p-4 text-center text-muted-foreground" colSpan={6}>No results</td>
              </tr>
            ) : (
              pageRows.map((r) => (
                <tr key={r.itemId} className="border-t">
                  <td className="p-2 font-mono text-xs">{r.sku}</td>
                  <td className="p-2">{r.name}</td>
                  <td className="p-2">{r.itemType}</td>
                  <td className="p-2">{r.baseUnit}</td>
                  <td className="p-2">{r.categoryId || ''}</td>
                  <td className="p-2">{r.active ? 'Yes' : 'No'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between gap-3 py-3">
        <div className="text-xs text-muted-foreground">{rows.length} total</div>
        <div className="flex items-center gap-2">
          <button className="px-2 py-1 border rounded text-xs disabled:opacity-50" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>Prev</button>
          <div className="text-xs">Page {page} / {totalPages}</div>
          <button className="px-2 py-1 border rounded text-xs disabled:opacity-50" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>Next</button>
          <select
            className="ml-2 h-8 rounded border bg-background px-2 text-xs"
            value={pageSize}
            onChange={(e) => onPageSizeChange && onPageSizeChange(Number(e.target.value))}
          >
            {[25, 50, 100].map((n) => (
              <option key={n} value={n}>{n} / page</option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}

function Th(props: { label: string; active: boolean; dir: 'asc' | 'desc'; onClick(): void }) {
  const { label, active, dir, onClick } = props;
  return (
    <th className="p-2 text-xs font-semibold select-none">
      <button className={`inline-flex items-center gap-1 hover:underline ${active ? 'text-foreground' : 'text-muted-foreground'}`} onClick={onClick}>
        <span>{label}</span>
        {active ? <span className="text-[10px]">{dir === 'asc' ? '▲' : '▼'}</span> : null}
      </button>
    </th>
  );
}

export default AssetsTable;


