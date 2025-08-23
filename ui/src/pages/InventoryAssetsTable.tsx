import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Filter as FilterIcon, Pencil, X } from 'lucide-react';
import { AssetsFilters, type AssetsFiltersValue } from '@/features/inventory/components/AssetsFilters';
import { AssetsTable, type SortState } from '@/features/inventory/components/AssetsTable';
import { listInventoryItems, listInventorySchemas, type InventoryItemRecord } from '@/lib/serverComm';

function useSearchParamsState() {
  const location = useLocation();
  const navigate = useNavigate();

  const parse = useCallback((): AssetsFiltersValue => {
    const sp = new URLSearchParams(location.search);
    const q = sp.get('q') || undefined;
    const itemType = sp.get('itemType') || undefined;
    const activeRaw = sp.get('active');
    const active: AssetsFiltersValue['active'] = activeRaw === 'true' || activeRaw === 'false' ? (activeRaw as any) : 'all';
    return { q, itemType, active };
  }, [location.search]);

  const [filters, setFilters] = useState<AssetsFiltersValue>(parse);

  useEffect(() => {
    setFilters(parse());
  }, [parse]);

  const setUrl = useCallback((next: AssetsFiltersValue, replace?: boolean) => {
    const sp = new URLSearchParams();
    if (next.q) sp.set('q', next.q);
    if (next.itemType) sp.set('itemType', next.itemType);
    if (next.active && next.active !== 'all') sp.set('active', next.active);
    const qs = sp.toString();
    const url = `${location.pathname}${qs ? `?${qs}` : ''}`;
    if (replace) navigate(url, { replace: true }); else navigate(url);
  }, [location.pathname, navigate]);

  return { filters, setFilters, setUrl } as const;
}

export default function InventoryAssetsTable() {
  const { filters, setFilters, setUrl } = useSearchParamsState();
  const [open, setOpen] = useState(false);
  const [itemTypeOptions, setItemTypeOptions] = useState<string[]>([]);
  const [rows, setRows] = useState<InventoryItemRecord[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [editable, setEditable] = useState(false);

  const [sort, setSort] = useState<SortState>({ by: 'name', dir: 'asc' });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Debounced q state shared with header input
  const [qDraft, setQDraft] = useState(filters.q || '');
  useEffect(() => setQDraft(filters.q || ''), [filters.q]);
  useEffect(() => {
    const id = setTimeout(() => setFilters({ ...filters, q: qDraft || undefined }), 300);
    return () => clearTimeout(id);
  }, [qDraft]);

  // Load item type options once
  useEffect(() => {
    (async () => {
      try {
        const schemas = await listInventorySchemas();
        const unique = Array.from(new Set(schemas.map((s) => s.itemType))).sort();
        setItemTypeOptions(unique);
      } catch {
        setItemTypeOptions([]);
      }
    })();
  }, []);

  // Fetch data when filters change
  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const activeParam = filters.active === 'true' ? true : filters.active === 'false' ? false : undefined;
        const data = await listInventoryItems({ q: filters.q, itemType: filters.itemType, active: activeParam });
        setRows(data);
      } catch (e: any) {
        setError(e?.message || 'Failed to load');
        setRows([]);
      } finally {
        setLoading(false);
      }
    })();
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.q, filters.itemType, filters.active]);

  // Reset to page 1 on filters change
  useEffect(() => { setPage(1); }, [filters.q, filters.itemType, filters.active]);

  const onApply = () => {
    setUrl(filters);
    setOpen(false);
  };
  const onClear = () => {
    const cleared: AssetsFiltersValue = { q: undefined, itemType: undefined, active: 'all' };
    setFilters(cleared);
    setUrl(cleared);
  };

  const onHeaderSearchChange = (v: string) => {
    setQDraft(v);
  };

  const empty = useMemo(() => (rows && rows.length === 0 && !loading), [rows, loading]);
  const AssetsTableAny = AssetsTable as any;

  return (
    <div className="routeFadeItem relative flex flex-col gap-3 p-3 min-h-[calc(100vh-3rem)]">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Input
            placeholder="Search"
            value={qDraft}
            onChange={(e) => onHeaderSearchChange(e.target.value)}
            className="h-9 w-56"
          />
          <Button size="icon" variant="outline" aria-label="Open filters" onClick={() => setOpen(true)}>
            <FilterIcon className="w-4 h-4" />
          </Button>
        </div>
        <div className="flex items-center gap-1">
          <h1 className="text-lg font-semibold text-right">Assets Table</h1>
          <Button
            size="icon"
            variant="ghost"
            aria-label={editable ? 'Exit edit mode' : 'Enter edit mode'}
            onClick={() => setEditable((v) => !v)}
          >
            {editable ? <X className="w-4 h-4" /> : <Pencil className="w-4 h-4" />}
          </Button>
        </div>
      </div>

      {error ? (
        <div className="text-sm text-destructive">{error}</div>
      ) : null}

      {empty ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3 border rounded-md">
          <div className="text-sm text-muted-foreground">No assets match your filters</div>
          <Button onClick={() => setOpen(true)} size="sm">Open Filters</Button>
        </div>
      ) : (
        <AssetsTableAny
          rows={rows || []}
          sort={sort}
          onSortChange={setSort}
          page={page}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
          loading={loading}
          editable={editable}
        />
      )}

      <AssetsFilters
        open={open}
        onOpenChange={setOpen}
        value={filters}
        onChange={setFilters}
        onApply={onApply}
        onClear={onClear}
        itemTypeOptions={itemTypeOptions}
      />
    </div>
  );
}


