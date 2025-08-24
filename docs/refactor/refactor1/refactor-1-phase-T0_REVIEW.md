### Refactor 1 — Phase T0 Review
### Review: Refactor 1 — Phase 0 (Scaffolding and Cross-Cutting Infrastructure)

Summary: The Phase 0 scaffolding largely matches the plan. Core files were introduced (`server/src/app.ts`, `errors`, `middleware`, `http` helpers, `repositories/README.md`), and `server/src/server.ts` now boots via `buildApp()`. No behavior changes at HTTP boundaries were introduced intentionally; tests infra supports auth stubbing. A few small gaps and consistency issues are noted below.

What matches the plan
- `buildApp()` exists and mounts legacy routes without behavior changes
  - File: `server/src/app.ts` — wires `hono`, `cors`, optional `logger`, env context; mounts legacy `api`.
  - Supports test injection via `options.injectAuth` by adding `x-test-user` header.
- Errors and mapping
  - File: `server/src/errors/index.ts` — `AppError` base + `ValidationError`, `AuthError`, `ForbiddenError`, `NotFoundError`, `ConflictError`, `RateLimitError`, `InternalError`, and `mapErrorToResponse` present.
- Middleware
  - `server/src/middleware/errorHandler.ts` catches and formats errors via `mapErrorToResponse`.
  - `server/src/middleware/requestContext.ts` adds `requestId` and `startedAt` to `c.var`.
  - Legacy `auth.ts` enhanced with test stub path; does not alter behavior for non-test.
- HTTP helpers
  - `server/src/http/pagination.ts` parses and clamps `limit`, computes `offset`.
  - `server/src/http/query.ts` provides coercion helpers and `ilikePattern`.
  - `server/src/http/responses.ts` returns `{ data, meta? }` and standardized `error()` shape.
- Repositories conventions
  - `server/src/repositories/README.md` documents thin repository rules.
- Edits to existing files
  - `server/src/server.ts` now imports `buildApp()` and serves `app.fetch` with CLI arg parsing and DB log messages.
  - `server/src/lib/db.ts` adds `withTransaction<T>(fn)` with neon fallback; caching retained.
  - `server/src/lib/validators.ts` includes latitude/longitude and other validators.

Gaps / issues
- Global wiring not applied yet in `buildApp()`
  - Plan mentions global `onError` and `notFound`; file comment says they will be added later. Acceptable for Phase 0, but ensure a follow-up phase adds these and integrates `errorHandler` and `requestContext` into the app pipeline.
- `requestContext` middleware defined but not mounted in `buildApp()`
  - Mounting is deferred. Track this for the subsequent phase to ensure `requestId` is available to logs and error responses.
- Test helper duplication
  - `server/src/test/testApp.ts` wraps `api` directly to inject `x-test-user`, while `buildApp()` also supports `injectAuth`. Consider consolidating on `buildApp({ injectAuth })` in tests to keep a single path.
- Minor consistency: error payloads between `errorHandler` and `http/responses.ts`
  - Both use `{ error: { code, message, details? } }` which is consistent; ensure future routes avoid returning `{ error: '...' }` as still present in parts of `auth.ts`.
- Auth middleware fallbacks
  - `auth.ts` returns `{ error: 'Unauthorized' }` instead of standardized shape. Non-blocking for Phase 0, but switching to `AppError` (or using `error()` helper) will align with the new error format once global handler is wired.

Data/shape alignment checks
- Response envelopes from helper functions match the planned `{ data, meta? }` structure.
- Pagination defaults: `limit=25`, max `100`, `page>=1` and `offset=(page-1)*limit` — matches the plan.
- Query coercion handles strings, numbers, booleans, arrays; `ilikePattern('%q%')` helper provided.

Over-engineering / size
- Files are small and focused. No over-engineering observed. `server.ts` includes some environment logging that’s acceptable.

Recommendations (next phase work)
- Mount `requestContext` and `errorHandler` in `buildApp()` and add `notFound`/`onError` handlers.
- Standardize error responses in `auth.ts` by throwing `AuthError` or using `error()` helper.
- Unify test harnesses to prefer `buildApp({ injectAuth })` for consistency.

Conclusion
- Phase 0 scaffolding is implemented correctly with no intentional behavior changes. Minor consistency items are identified for the next iteration.
#### Verdict
Mostly implemented. Core test platform, Vitest config, and initial golden-master tests are in place. A few gaps/mismatches remain (env example file, script patterns, DB URL alignment, fixtures depth, CI).

#### What matches the plan
- Vitest config present with Node env, setup file, and V8 coverage.
```3:23:/Users/vlmitchell/dev/showcall/server/vitest.config.ts
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.{test,spec,int,unit}.ts'],
    setupFiles: ['src/test/setup.ts'],
    globals: true,
    singleThread: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      reportsDirectory: './coverage',
      all: false,
      thresholds: {
        lines: 0.8,
        statements: 0.8,
        branches: 0.8,
        functions: 0.8,
      },
    },
  },
});
```

- Test scaffolding files exist: `setup.ts`, `testDb.ts`, `testApp.ts`; integration tests for auth, addresses, inventory are present.
```1:13:/Users/vlmitchell/dev/showcall/server/src/test/testApp.ts
import app from '../api';
...
export function buildTestApp(_options: BuildOptions = {}) {
  return app;
}
```

- DB migration/reset scripts referenced by the harness exist.
```1:4:/Users/vlmitchell/dev/showcall/server/scripts/
apply-sql-migrations.mjs
db-connectivity-test.mjs
deploy-cloudflare.js
setup-private-schema.mjs
```

- Integration tests capture key endpoints (auth/me, addresses happy path and validations, inventory list auth boundary).
```1:16:/Users/vlmitchell/dev/showcall/server/src/test/integration/auth.int.ts
describe('GET /api/v1/protected/me', () => {
  ...
});
```

#### Gaps and variances
- .env.test.example missing (plan calls for documenting test env vars).
- `test:unit`/`test:integration` patterns differ from plan. Current:
```9:13:/Users/vlmitchell/dev/showcall/server/package.json
"test:unit": "vitest run src",
"test:integration": "vitest run src/test/integration",
```
  Recommended (closer to plan):
  - `test:unit`: `vitest run --dir src --include "**/*.unit.{ts,tsx}"`
  - `test:integration`: `vitest run --dir src --include "**/*.int.{ts,tsx}"`

- Coverage thresholds are specified as decimals (0.8). Vitest typically expects percentage integers. Recommend:
```ts
coverage: {
  provider: 'v8',
  reporter: ['text','json','html'],
  reportsDirectory: './coverage',
  all: false,
  thresholds: { lines: 80, statements: 80, branches: 80, functions: 80 }
}
```

- Test DB URL alignment: tests default to `5433` while default app local DB uses `5502`. This can cause non-determinism without explicit env config.
```5:8:/Users/vlmitchell/dev/showcall/server/src/test/integration/addresses.int.ts
const DB_URL = process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5433/postgres';
```
```33:36:/Users/vlmitchell/dev/showcall/server/src/lib/db.ts
const defaultLocalConnection = process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5502/postgres';
```
  Plan suggests `DATABASE_URL_TEST`. Recommend using `process.env.DATABASE_URL_TEST` in tests/harness and documenting it in `.env.test.example`.

- `buildTestApp({ stubAuth })` option not used; tests rely on emulator-style JWT. Acceptable variance, but adding `stubAuth` support would simplify tests and decouple from token generation.

- Fixtures: only a `README.md` in `src/test/fixtures/`; tests create data ad hoc. Plan calls for deterministic fixtures per domain.

- CI config not present; plan calls to run tests with coverage in CI and enforce thresholds.

- Golden-master coverage breadth: inventory focuses on `GET /inventory/items` only; plan prioritizes transactions/reservations flows too.

#### Recommendations
1. Add `server/.env.test.example` with:
   - `DATABASE_URL_TEST=postgres://.../showcall_test`
   - `FIREBASE_AUTH_EMULATOR_HOST=localhost:9099` (optional)
2. Update `package.json` scripts to use include patterns per plan for unit/integration separation.
3. Adjust coverage thresholds to integer percentages and confirm they fail CI when below target.
4. Standardize tests/harness on `DATABASE_URL_TEST` and remove hardcoded port fallbacks; require explicit env in test runs.
5. Implement `buildTestApp({ stubAuth })` to inject `c.var.user` for protected routes as an alternative to JWT.
6. Add minimal deterministic fixtures under `server/src/test/fixtures/*` for addresses, inventory, events, and use them in tests.
7. Add CI (e.g., GitHub Actions) to run `pnpm -w test` with coverage and enforce thresholds.
8. Expand golden-master tests to include:
   - Inventory: transactions create/list, reservations create/patch/list
   - Events/Series: series create/update/list and occurrence reads

#### Notable code references
```1:22:/Users/vlmitchell/dev/showcall/server/src/test/testDb.ts
export async function resetTestDatabase(connectionString: string) {
  ...
}
export async function truncateAllTables(connectionString: string) {
  ...
}
```

```18:27:/Users/vlmitchell/dev/showcall/server/src/server.ts
serve({
  fetch: app.fetch,
  port,
});
```

#### Conclusion
The T0 enablement is close to spec and usable today. Addressing the small configuration and documentation gaps will solidify parity guards for subsequent refactors.


