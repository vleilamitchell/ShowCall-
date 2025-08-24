### Refactor 1 — Phase 0: Scaffolding and Cross-Cutting Infrastructure

Brief description: Create core structure and shared utilities with no behavior changes. Prepare `buildApp()`, errors, middleware, and HTTP helpers to support subsequent migrations.

### Files to add
- `server/src/app.ts` — `buildApp()` configures Hono, `cors`, `logger`, env context, global `onError`, `notFound`, and mounts base routers.
- `server/src/errors/index.ts` — `AppError` base plus `ValidationError`, `AuthError`, `ForbiddenError`, `NotFoundError`, `ConflictError`, `RateLimitError`, `InternalError`, and error → HTTP mapper.
- `server/src/middleware/errorHandler.ts` — catch `AppError` and format `{ error: { code, message, details? } }`.
- `server/src/middleware/requestContext.ts` — attach `requestId`, `startedAt`, optional `userId` to `c.var`.
- `server/src/http/pagination.ts` — parse/clamp `limit`, compute `offset`.
- `server/src/http/query.ts` — coerce query params (string/number/boolean/array), ilike helpers.
- `server/src/http/responses.ts` — helpers for `{ data, meta }` envelopes and standardized errors.
- `server/src/repositories/README.md` — repository conventions.

### Files to edit
- `server/src/server.ts` — import `buildApp()` and serve `{ fetch: app.fetch }`.
- `server/src/lib/db.ts` — add `withTransaction<T>(fn)` helper (no breaking changes for existing callers).
- `server/src/lib/validators.ts` — optionally add `isValidLatitude`/`isValidLongitude` used by legacy address handlers.

### Algorithms
1. Global Error Mapping: thrown `AppError` subclasses map to correct HTTP status and standardized error payloads.
2. Request Context: generate `requestId` per request; include in logs and error responses.
3. Pagination: default `limit=25`, max `100`; standard ordering when none provided.

### Tests-first plan (against existing functionality)
1. Reuse Phase T0 golden-master tests unchanged; they must all pass after scaffolding.
2. Add unit tests for new helpers in isolation (e.g., pagination and query coercion). These unit tests encode current expectations without altering route behavior.

### Step-by-step
1. Add new files listed above with no route changes; wire `server/src/server.ts` to `buildApp()` that still mounts legacy behavior.
2. Implement `withTransaction` in `lib/db.ts` without refactoring any services yet.
3. Ensure `buildApp()` accepts test options (`injectAuth`, `disableLogger`) for `testApp.ts`.
4. Run the full test suite. Golden-master integration tests must remain green.

### Modify and re-verify tests along the way
- If helper utilities change response envelopes on new code paths, do not modify golden-master route assertions yet; only add unit tests for the helpers.
- After each edit, re-run tests to verify zero behavior change at HTTP boundaries.

### Exit criteria
- All golden-master and helper unit tests pass; no behavior changes at `/api/v1`.

