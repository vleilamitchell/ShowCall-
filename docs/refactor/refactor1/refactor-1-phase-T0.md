### Refactor 1 — Phase T0: Test Platform Enablement and Golden-Master Capture

Brief description: Stand up the testing workflow and guardrails that will protect the refactor and enable safe iteration, then freeze current API behavior with golden-master tests before refactoring.

### Files and scripts to add
- `server/vitest.config.ts` — Vitest config (node env, tsconfig alias support, coverage via V8).
- `server/src/test/setup.ts` — global test setup (env loading, timers, matchers, cleanup hooks).
- `server/src/test/testDb.ts` — test DB harness: create/reset schema, run Drizzle migrations, truncate tables, seed fixtures.
- `server/src/test/testApp.ts` — `buildTestApp(options)` wrapper: stub/emulator auth injection, toggle request logging.
- `server/src/test/fixtures/*` — minimal fixtures per domain (addresses, inventory, events, etc.).
- `server/.env.test.example` — document required test env vars.
- CI config to run tests with coverage.
- `server/package.json` scripts:
  - `test` → `vitest run`
  - `test:watch` → `vitest`
  - `test:unit` → `vitest run --dir src --include "**/*.unit.{ts,tsx}"`
  - `test:integration` → `vitest run --dir src --include "**/*.int.{ts,tsx}"`
  - `test:ci` → `vitest run --coverage`

### Files to review/edit (no behavior changes)
- `server/src/lib/db.ts` — ensure test DB connection support; utilities for reset/truncate.
- `server/src/server.ts` — no changes required now; only ensure test runner can import HTTP app entry.

### Algorithms and harness behavior
1. Test DB harness initializes Postgres schema and runs Drizzle migrations before tests; truncates between test files.
2. `buildTestApp({ stubAuth })` injects a synthetic `user` into `c.var` for protected endpoints.
3. Coverage thresholds enforced in CI (e.g., 80%+ statements/branches overall and per changed file).

### Tests-first plan (against existing functionality)
1. Add golden-master integration tests that hit current monolith endpoints in `server/src/api.ts`:
   - `GET /api/v1/protected/me` (401 unauthenticated, 200 authenticated with stable shape)
   - Addresses CRUD endpoints
   - Inventory transactions/reservations flows
   - Event series endpoints
2. Add unit tests for existing validators/services where present (no implementation changes yet).
3. Ensure tests use deterministic fixtures from `server/src/test/fixtures/*`.

### Golden-master endpoint selection and prioritization
- Objectives:
  - Freeze externally observable behavior for highest-risk and highest-impact endpoints before refactor begins.
  - Capture both success and representative failure modes (400/401/403/404/409) and list/pagination semantics.
- How to enumerate current endpoints:
  - Review `server/src/api.ts` and any existing `server/src/routes/*` (e.g., `routes/eventSeries.ts`) for `GET/POST/PATCH/PUT/DELETE` registrations.
  - Optionally run a quick route inventory locally to cross-check your manual scan.
- Prioritization criteria (test these first):
  - Business-critical flows with side effects: inventory transactions, reservations.
  - Recently modified or unstable areas: addresses, event series.
  - Protected routes and auth boundary: `/protected/me`.
  - Endpoints with complex filtering/pagination/sorting.
- Minimum must-cover set mapped to early phases:
  - Auth: `GET /api/v1/protected/me` (401 unauthenticated, 200 authenticated payload shape).
  - Addresses: `POST /api/v1/addresses`, `PATCH /api/v1/addresses/:id`, `GET /api/v1/addresses`, `GET /api/v1/addresses/:id`.
  - Inventory: `POST /api/v1/inventory/transactions`, `POST /api/v1/inventory/reservations`, `PATCH /api/v1/inventory/reservations/:id`, `GET /api/v1/inventory/items`, `GET /api/v1/inventory/transactions`, `GET /api/v1/inventory/reservations`.
  - Events/Series: series create/update/list endpoints and any occurrence-compute reads currently exposed.
- Failure-mode catalog per endpoint (assert status + stable payload fields):
  - 400 Validation: missing/invalid fields; type coercion failures.
  - 401/403 Auth: unauthenticated access to protected routes; forbidden where applicable.
  - 404 Not Found: non-existent resource ids.
  - 409 Conflict: unique/partial-unique violations (e.g., addresses primary-per-role; inventory constraints).
  - List semantics: default limit, max-limit clamping, sort default, `q` search behavior, deterministic ordering.
- Assertion guidance (keep golden-master resilient, not brittle):
  - Prefer explicit field assertions over full-response snapshots.
  - Assert presence and values of canonical fields; avoid asserting volatile fields like exact timestamps where unnecessary.
  - For lists, assert ordering, length, and stable subset of fields; include pagination meta if present.
  - For errors, assert `{ status, error.code, error.message }` and include `requestId` once standardized.
- Test structure and placement:
  - Place integration tests under `server/src/test/integration/` by domain: `auth.int.ts`, `addresses.int.ts`, `inventory.int.ts`, `events.int.ts`.
  - Use `buildTestApp({ stubAuth })` to exercise protected routes; seed deterministic fixtures via `server/src/test/fixtures/*`.
  - Ensure DB truncation/cleanup between files via `testDb.ts` to keep tests isolated and repeatable.

### Step-by-step
1. Create all test platform files listed above; commit.
2. Provide `.env.test.example` entries to be set locally:
   - `DATABASE_URL_TEST=postgres://.../showcall_test`
   - `FIREBASE_AUTH_EMULATOR_HOST=localhost:9099` (optional)
3. Write golden-master integration tests for high-risk endpoints against the current `server/src/api.ts`.
4. Write unit tests for existing validators/services referenced by those endpoints.
5. Run `pnpm -w test` locally; fix any harness issues until green.
6. Enable CI to run `pnpm -w test` with coverage; verify thresholds and artifacts work.

### Modify and re-verify tests along the way
- As subsequent phases introduce `app.ts`/routers, keep these golden-master tests unchanged and ensure they continue to pass (parity guard).
- When swapping auth/me or addresses routes later, augment tests with additional assertions for standardized envelopes, but keep legacy-parity assertions in place until cutover is complete.

### Exit criteria
- Local and CI test runs are green with coverage.
- Golden-master tests exist for the selected endpoints and pass against the monolith implementation.

