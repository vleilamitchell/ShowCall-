export type PaginationParams = {
  limit?: string | number | null;
  page?: string | number | null;
};

export type Pagination = {
  limit: number;
  offset: number;
  page: number;
};

export function parsePagination(params: PaginationParams, defaults: { limit?: number } = {}): Pagination {
  const maxLimit = 100;
  const defaultLimit = defaults.limit ?? 25;
  const rawLimit = params.limit == null ? defaultLimit : Number(params.limit);
  const rawPage = params.page == null ? 1 : Number(params.page);

  const limit = Number.isFinite(rawLimit) ? Math.max(1, Math.min(maxLimit, Math.floor(rawLimit))) : defaultLimit;
  const page = Number.isFinite(rawPage) ? Math.max(1, Math.floor(rawPage)) : 1;
  const offset = (page - 1) * limit;

  return { limit, offset, page };
}


