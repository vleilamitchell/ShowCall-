### Refactor 1 — Phase 9: Pagination, Filtering, and Sorting Conventions

Brief description: Adopt consistent conventions for list endpoints using shared helpers, while maintaining legacy behavior until a domain is migrated.

### Files to add/edit
- Use `server/src/http/pagination.ts` and `server/src/http/query.ts` in migrated list endpoints.
- Keep legacy handlers unchanged until their domains migrate.

### Conventions
- Query params: `limit`, `offset` (or `cursor` later), `sort` (`field:asc|desc`), `q` for search.
- Defaults: `limit=25`, max `100`.

### Tests-first plan (against existing functionality)
1. Extend integration tests for list endpoints to assert default limits, max clamping, sorting, and `q` semantics as they behave today.
2. Unit tests for helpers to ensure consistent parsing/coercion and edge cases.

### Step-by-step
1. Introduce helpers into one migrated domain at a time (e.g., addresses), validating parity with golden-master tests.
2. Roll out to other migrated domains; do not alter legacy routers yet.

### Modify and re-verify tests along the way
- Keep golden-master assertions as parity guides; refine unit tests for helper edge cases as needed.

### Exit criteria
- Migrated list endpoints use shared helpers and pass both parity and helper unit tests.

