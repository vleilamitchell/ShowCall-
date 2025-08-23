import { useEffect, useMemo, useRef, useState } from 'react';
import type { InventoryItemRecord } from '@/lib/serverComm';
import { patchInventoryItem } from '@/lib/serverComm';

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
  editable?: boolean;
}) {
  const { rows, sort, onSortChange, page, pageSize, onPageChange, onPageSizeChange, loading, editable } = props;

  const [editsById, setEditsById] = useState<Record<string, Partial<InventoryItemRecord>>>({});
  const timersRef = useRef<Record<string, number | null>>({});
  const pendingRef = useRef<Record<string, Partial<InventoryItemRecord>>>({});

  useEffect(() => {
    // Clear edits when the underlying dataset changes substantially
    // but preserve if same ids exist; keeping simple and clearing all for now
    setEditsById({});
    pendingRef.current = {};
    timersRef.current = {};
  }, [rows]);

  const schedulePatch = (itemId: string) => {
    if (timersRef.current[itemId]) {
      window.clearTimeout(timersRef.current[itemId]!);
    }
    timersRef.current[itemId] = window.setTimeout(async () => {
      const patch = pendingRef.current[itemId];
      if (!patch || Object.keys(patch).length === 0) return;
      try {
        await patchInventoryItem(itemId, patch);
        // keep local edits so UI reflects changes immediately
      } finally {
        pendingRef.current[itemId] = {};
        timersRef.current[itemId] = null;
      }
    }, 500);
  };

  const updateCell = <K extends keyof InventoryItemRecord>(row: InventoryItemRecord, key: K, value: InventoryItemRecord[K]) => {
    setEditsById((prev) => ({
      ...prev,
      [row.itemId]: { ...(prev[row.itemId] || {}), [key]: value },
    }));
    pendingRef.current[row.itemId] = { ...(pendingRef.current[row.itemId] || {}), [key]: value };
    schedulePatch(row.itemId);
  };

  const flushRow = async (itemId: string) => {
    if (timersRef.current[itemId]) {
      window.clearTimeout(timersRef.current[itemId]!);
      timersRef.current[itemId] = null;
    }
    const patch = pendingRef.current[itemId];
    if (!patch || Object.keys(patch).length === 0) return;
    try {
      await patchInventoryItem(itemId, patch);
    } finally {
      pendingRef.current[itemId] = {};
    }
  };

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
    <div className={`flex flex-col ${editable ? 'font-mono' : ''}`}>
      <div className={`overflow-auto border rounded-md ${editable ? 'bg-white text-black' : ''}`}>
        <table className={`min-w-full text-sm ${editable ? 'border-collapse' : ''}`}>
          <thead className={`sticky top-0 ${editable ? 'bg-white' : 'bg-muted/50'}`}>
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
              pageRows.map((r) => {
                const valueOf = <K extends keyof InventoryItemRecord>(k: K): any =>
                  (editsById[r.itemId]?.[k] as any) ?? r[k];
                return (
                  <tr key={r.itemId} className={`${editable ? 'border border-black' : 'border-t'}`}>
                    <td className={`${editable ? 'p-0 border border-black' : 'p-0'}`}>
                      {editable ? (
                        <input
                          className="w-full h-8 px-2 text-xs bg-transparent outline-none focus:ring-1 focus:ring-ring"
                          value={String(valueOf('sku') ?? '')}
                          onChange={(e) => updateCell(r, 'sku', e.target.value as any)}
                          onBlur={() => flushRow(r.itemId)}
                        />
                      ) : (
                        <div className="p-2 font-mono text-xs">{r.sku}</div>
                      )}
                    </td>
                    <td className={`${editable ? 'p-0 border border-black' : 'p-0'}`}>
                      {editable ? (
                        <input
                          className="w-full h-8 px-2 text-sm bg-transparent outline-none focus:ring-1 focus:ring-ring"
                          value={String(valueOf('name') ?? '')}
                          onChange={(e) => updateCell(r, 'name', e.target.value as any)}
                          onBlur={() => flushRow(r.itemId)}
                        />
                      ) : (
                        <div className="p-2">{r.name}</div>
                      )}
                    </td>
                    <td className={`${editable ? 'p-0 border border-black' : 'p-0'}`}>
                      {editable ? (
                        <input
                          className="w-full h-8 px-2 text-sm bg-transparent outline-none focus:ring-1 focus:ring-ring"
                          value={String(valueOf('itemType') ?? '')}
                          onChange={(e) => updateCell(r, 'itemType', e.target.value as any)}
                          onBlur={() => flushRow(r.itemId)}
                        />
                      ) : (
                        <div className="p-2">{r.itemType}</div>
                      )}
                    </td>
                    <td className={`${editable ? 'p-0 border border-black' : 'p-0'}`}>
                      {editable ? (
                        <input
                          className="w-full h-8 px-2 text-sm bg-transparent outline-none focus:ring-1 focus:ring-ring"
                          value={String(valueOf('baseUnit') ?? '')}
                          onChange={(e) => updateCell(r, 'baseUnit', e.target.value as any)}
                          onBlur={() => flushRow(r.itemId)}
                        />
                      ) : (
                        <div className="p-2">{r.baseUnit}</div>
                      )}
                    </td>
                    <td className={`${editable ? 'p-0 border border-black' : 'p-0'}`}>
                      {editable ? (
                        <input
                          className="w-full h-8 px-2 text-sm bg-transparent outline-none focus:ring-1 focus:ring-ring"
                          value={String(valueOf('categoryId') ?? '')}
                          onChange={(e) => updateCell(r, 'categoryId', (e.target.value || null) as any)}
                          onBlur={() => flushRow(r.itemId)}
                        />
                      ) : (
                        <div className="p-2">{r.categoryId || ''}</div>
                      )}
                    </td>
                    <td className={`${editable ? 'p-0 border border-black' : 'p-0'}`}>
                      {editable ? (
                        <div className="h-8 px-2 flex items-center">
                          <input
                            type="checkbox"
                            className="size-4"
                            checked={Boolean(valueOf('active'))}
                            onChange={(e) => updateCell(r, 'active', e.target.checked as any)}
                            onBlur={() => flushRow(r.itemId)}
                          />
                        </div>
                      ) : (
                        <div className="p-2">{r.active ? 'Yes' : 'No'}</div>
                      )}
                    </td>
                  </tr>
                );
              })
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


