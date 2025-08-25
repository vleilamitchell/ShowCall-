### Refactor 1 — Phase 6 REVIEW

Scope: Areas, Departments, Employees, Positions, Assignments, Schedules, Shifts, Contacts, Event-Areas, Events; migration to modular routes/controllers/services/repos, preserving HTTP behavior and semantics.

## Summary
- New modular routers are mounted under `/api/v1`, with legacy routes preserved under the legacy wrapper. Controllers/services/repos exist for the Phase 6 domains and mirror legacy behavior closely.
- Validations, error codes, and data normalization generally match the legacy endpoints. Addresses correctly support both camelCase and snake_case inputs.
- Remaining risks are mainly around transactional integrity for multi-row updates, duplicated DB URL fallback logic, and leaving legacy handlers active in `api.ts` longer than necessary.

## Parity snapshot
- Present and wired: `routes/{areas,addresses,events,eventAreas,departments,employees,positions,employeePositions,assignments,schedules,shifts,contacts}.ts` with corresponding controllers/services/repos.
- Legacy still present in `server/src/api.ts` for: Events, Areas, Event-Areas, Addresses, and some Shift handlers. New routers live under `/api/v1/*`; legacy remains under `/` via `routes/legacy.ts`. No direct path collision; transitional dual-stack is OK until cutover.
- Response shapes and status codes: 200/201 on success, 204 for deletes, 400 validation errors, 404 not found, 409 for unique/constraint conflicts — consistent with legacy.

## Findings and recommendations

1) Transactional integrity
- Issue: Multi-row updates are not wrapped in transactions.
  - `areasService.reorder` iterates updates in a loop.
  - `eventAreasRepo.replaceAreasForEvent` performs delete/insert sequences.
- Risk: Partial updates on failure can leave inconsistent ordering or associations.
- Recommend: Use `withTransaction` from `lib/db` to wrap these operations atomically.

2) Database connection fallback duplication
- Issue: Repeated patterns `getDatabase(getDatabaseUrl() || process.env.DATABASE_URL || 'postgresql://...')` in many services/controllers.
- Risk: Divergence and harder environment configuration.
- Recommend: Centralize defaulting in `getDatabase()` and pass no arg from callers; adjust `lib/db.ts` if any special-casing is needed.

3) Legacy endpoints still active in `api.ts`
- Issue: `api.ts` continues to host handlers for Events, Areas, Event-Areas, Addresses, and some Shifts.
- Risk: Two implementations can drift; maintenance overhead.
- Recommend: After golden-master tests confirm parity for each subdomain, remove the corresponding legacy handlers from `api.ts` per the plan.

4) Dead/duplicate route files
- Observation: `routes/eventSeries.ts` exists while `routes/index.ts` mounts `recurringSeriesRouter` at `/event-series` from `routes/recurringSeries.ts`.
- Recommend: Remove or consolidate to a single router filename and mount point to avoid confusion.

5) Error mapping consistency
- Observation: Controllers often map domain errors to HTTP codes locally while there is also a global `errorHandler` and `mapErrorToResponse`.
- Risk: Inconsistent envelopes if some errors bubble to the global handler while others are mapped inline.
- Recommend: Standardize: either rely on services throwing domain errors handled by the global error handler, or keep all mapping in controllers consistently. Prefer the global handler for uniform envelopes.

6) Input normalization/utilities duplication
- Observation: Repeated `normalize` helpers and string coercion across controllers/services.
- Recommend: Extract small shared helpers for common patterns (string-or-null, UUID generation fallback) to reduce duplication and drift.

7) Latitude/longitude typing
- Observation: Values are validated numeric but stored as strings via `String(Number(...))` (matching legacy schema).
- Recommend: Confirm schema intent. If long-term plan is numeric columns, add a tracked migration plan; otherwise document string storage and keep consistent.

8) Public `/db-test` route
- Observation: Unauthenticated and returns limited data; useful for dev.
- Recommend: Guard behind env check or remove in production builds to avoid exposure.

9) Event listing by areas performance
- Observation: For area filters, code performs a two-step ID fetch then event fetch.
- Recommend: Optional: single query with JOIN and DISTINCT could be used when performance becomes a concern; not required for parity.

## Data alignment checks
- Addresses: accepts `addressLine1`/`address_line_1`, `zipCode`/`zip_code`, `zipPlus4`/`zip_plus4`, preserving legacy compatibility.
- Status enumerations and validation messages match legacy semantics (400/409 codes consistent).
- Dates and times validations mirror legacy (`YYYY-MM-DD`, time ordering constraints).

## Over-engineering / file size
- `server/src/api.ts` remains very large; this is temporary. The modular split is otherwise clean and appropriately sized.

## Tests and cutover readiness
- Recommend adding/maintaining golden-master integration tests for endpoints across the migrated domains. Once green, remove the matching legacy handlers from `api.ts`.
- Unit tests: services-level validation rules (addresses, areas, events) and transactional behaviors (post-change) should be covered.

## Action items (priority)
- High: Wrap `areasService.reorder` and `eventAreasRepo.replaceAreasForEvent` in a transaction via `withTransaction`.
- High: Add/verify golden-master tests for each migrated domain; then remove corresponding legacy handlers from `api.ts`.
- Medium: Centralize DB URL defaulting in `lib/db.getDatabase()`; simplify callers.
- Medium: Remove/rename `routes/eventSeries.ts` or align with the mounted `recurringSeriesRouter` to avoid confusion.
- Medium: Consolidate common input normalization and UUID helpers.
- Low: Gate `/db-test` behind env guard in non-dev.
- Low: Consider DISTINCT query for event listings filtered by multiple area IDs.

## Exit criteria status
- Structure and routers for Phase 6 domains are in place and appear parity-aligned.
- Cutover not complete: legacy handlers remain in `api.ts` for multiple domains. Proceed with tests and remove legacy code per plan.


