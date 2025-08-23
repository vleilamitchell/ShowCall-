import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { FilterState, ListItem, QueryState, ResourceAdapter } from '../types';

export type UseListDetailOptions<TItem extends ListItem, TFilters extends FilterState, TQuery extends QueryState> = {
  resourceKey: string;
  adapter: ResourceAdapter<TItem, TFilters, TQuery>;
  preserveSelection?: boolean;
};

export function useListDetail<TItem extends ListItem, TFilters extends FilterState = FilterState, TQuery extends QueryState = QueryState>(
  options: UseListDetailOptions<TItem, TFilters, TQuery>
) {
  const { resourceKey, adapter, preserveSelection } = options;

  const [items, setItems] = useState<TItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [queryState, setQueryState] = useState<Partial<TQuery>>({});
  const [filterState, setFilterState] = useState<Partial<TFilters>>({});
  const [selectedId, setSelectedId] = useState<TItem['id'] | null>(null);
  const navigate = useNavigate();
  const params = useParams<{ id?: string }>();

  const selected = useMemo(() => items.find(i => i.id === selectedId) || null, [items, selectedId]);

  const loadRef = useRef(0);
  const reload = async () => {
    const ticket = ++loadRef.current;
    setLoading(true);
    try {
      const rows = await adapter.list(queryState, filterState);
      if (loadRef.current !== ticket) return;
      setItems(rows);

      // Try common param name patterns: singular form (e.g., itemId), generic id, or any *Id param
      const singularKey = `${resourceKey.slice(0, -1)}Id`;
      const anyIdKey = Object.keys(params || {}).find((k) => k.endsWith('Id') && (params as any)[k]);
      const routeId = (params as any)[singularKey] || (params as any)[anyIdKey as any] || (params as any).id; // attempt multiple forms
      const found = routeId ? rows.some(r => String(r.id) === String(routeId)) : false;

      if (routeId && found) {
        setSelectedId(routeId as any);
      } else if (rows.length) {
        if (preserveSelection && selectedId && rows.some(r => r.id === selectedId)) {
          // keep selection
        } else {
          setSelectedId(rows[0].id);
        }
      } else {
        setSelectedId(null);
        navigate(`/${resourceKey}`, { replace: true });
      }
    } finally {
      if (loadRef.current === ticket) setLoading(false);
    }
  };

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(queryState), JSON.stringify(filterState)]);

  // Sync selection from route without forcing a list reload to avoid flicker
  useEffect(() => {
    const singularKey = `${resourceKey.slice(0, -1)}Id`;
    const anyIdKey = Object.keys(params || {}).find((k) => k.endsWith('Id') && (params as any)[k]);
    const routeId = (params as any)[singularKey] || (params as any)[anyIdKey as any] || (params as any).id;
    if (!routeId) return;
    const exists = items.some(r => String(r.id) === String(routeId));
    if (exists) {
      if (String(selectedId) !== String(routeId)) setSelectedId(routeId as any);
    } else if (!loading) {
      // If current items are loaded and the id does not exist, navigate to base route
      navigate(`/${resourceKey}`, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [(params as any)[`${resourceKey.slice(0, -1)}Id`], params.id, items, loading]);

  useEffect(() => {
    if (!selectedId) return;
    const routeParamName = `${resourceKey.slice(0, -1)}Id`;
    const current = (params as any)[routeParamName] || params.id;
    if (String(current) !== String(selectedId)) {
      navigate(`/${resourceKey}/${encodeURIComponent(String(selectedId))}`, { replace: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  const select = (id: TItem['id']) => setSelectedId(id);

  const create = async (partial: Partial<TItem>) => {
    const created = await adapter.create(partial);
    setItems(prev => [created, ...prev]);
    setSelectedId(created.id);
    return created;
  };

  return {
    items,
    loading,
    selectedId,
    selected,
    select,
    reload,
    mutateItems: (updater: (prev: TItem[]) => TItem[]) => setItems(prev => updater(prev)),
    queryState,
    setQueryState,
    filterState,
    setFilterState,
    create,
  } as const;
}


