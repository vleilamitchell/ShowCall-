import type { ReactNode } from 'react';

// Core generics and shared contracts for list–detail UI

export type IdType = string | number;

export type ListItem<TId extends IdType = string> = { id: TId } & Record<string, unknown>;

export type QueryState = { q?: string } & Record<string, unknown>;

export type FilterState = Record<string, unknown>;

export type ResourceAdapter<TItem extends ListItem, TFilters extends FilterState = FilterState, TQuery extends QueryState = QueryState> = {
  list: (query?: Partial<TQuery>, filters?: Partial<TFilters>) => Promise<TItem[]>;
  get: (id: TItem['id']) => Promise<TItem>;
  create: (partial: Partial<TItem>) => Promise<TItem>;
  update: (id: TItem['id'], patch: Partial<TItem>) => Promise<TItem>;
  searchableFields?: string[];
};

export type ListState<TItem extends ListItem> = {
  items: TItem[];
  loading: boolean;
};

// Presentation helpers
export type RenderItemFn<TItem extends ListItem> = (item: TItem, isActive: boolean) => ReactNode;


