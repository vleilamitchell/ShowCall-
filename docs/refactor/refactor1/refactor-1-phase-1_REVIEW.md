### Refactor 1 — Phase 1 Review: Routing Composition and Legacy Adapter

This review verifies that Phase 1 matches the plan, highlights issues/risks, and suggests follow-ups.

### Plan alignment
- **Added `server/src/routes/index.ts`**: `mountV1Routers(api)` mounts `legacyRouter` under `/`. Matches plan; enables parallel domain routers later.
- **Added `server/src/routes/legacy.ts`**: Wraps and re-exports legacy `api` router via `legacyRouter.route('/', api)`. Preserves existing behavior.
- **Created `server/src/app.ts`**: Builds root `app`, wires shared middleware (`requestContext`, optional `logger`, `cors`, `errorHandler`, `notFound`/`onError`), composes v1 router, and mounts at `/api/v1`. Matches plan.
- **Updated `server/src/server.ts`**: Uses `buildApp()` from `app.ts`. Correct.
- **Left `server/src/api.ts` for legacy routes**: Default export remains the `api` router with legacy endpoints (e.g., `/health`, `/db-test`, `/protected/*`, inventory, addresses, etc.). `legacyRouter` wraps this without behavioral change.
- **Tests**: Added `src/test/integration/health.int.ts` hitting `/api/v1/health` through the new composition. Golden-master style tests for inventory/addresses/auth remain targeting `/api/v1/*` and appear compatible.

Conclusion: Composition and legacy adapter are implemented as described and maintain legacy behavior under `/api/v1/*`.

### Notable findings
- **Duplicate import in `server/src/app.ts`**
  - There are two `import { Hono } from 'hono';` lines. Remove one to avoid linter/TS noise.

- **Dead/legacy scaffolding left in `server/src/api.ts`**
  - File declares an unused `app` instance and attaches `logger()` and `cors()` to it, while the exported value is `api`. Middleware on the unused `app` has no effect but is confusing. Recommend stripping `app` and related middleware and keeping only the legacy `api` router definitions to reduce cognitive load.
  - `setEnvContext` calls at module load may be redundant now that `app.ts` sets env context; safe but duplicative.

- **Middleware consistency**
  - Global middleware (`requestContext`, `logger`, `cors`, `errorHandler`, `notFound`/`onError`) is centralized in `app.ts`. The legacy `api` router does not re-apply these, avoiding double invocation. Good.
  - Error envelopes use `errors/mapErrorToResponse` and `http/responses.error` consistently for `onError` and `notFound` paths. Good.

- **Auth/test harness**
  - `buildApp` supports test injection by overriding `app.request` headers with `x-test-user`. Works with `authMiddleware` test path. This is pragmatic; consider documenting that it relies on Hono’s `app.request` stability.

### Behavioral parity spot-checks
- `/api/v1/health`: Still returns `{ status: 'ok', timestamp }` via legacy `api` router; integration test covers this.
- `/api/v1/protected/me`: Still enforces auth; emulator token path works via `verifyFirebaseToken` and test-mode header path (`x-test-user`) for tests.
- Inventory and addresses endpoints: Tests continue to target `/api/v1/*` and should flow through `legacyRouter` unchanged.

No response shape regressions were observed in the routes covered by tests. Legacy routes still return plain objects (not `{ data: ... }`), which is intentional for Phase 1.

### Risks and edge cases
- **`app.request` override fragility**: Future Hono changes could break this header-injection approach. Mitigate by keeping the override behind an option (already done) and adding a unit test to assert header injection behavior.
- **Environment context duplication**: Both `api.ts` and `app.ts` set env context. It’s harmless but can confuse readers. Consolidate in `app.ts`.
- **Default DB URL fallback**: Multiple places fall back to a local connection string. This is fine for dev, but ensure CI sets explicit `DATABASE_URL_TEST` to avoid flakiness.

### Suggested follow-ups (non-blocking for Phase 1)
1. Remove the duplicate `Hono` import in `server/src/app.ts`.
2. In `server/src/api.ts`, remove the unused `app` instance, the attached middleware, and redundant `setEnvContext` usage; keep only the `api` router.
3. Add a brief docstring to `routes/legacy.ts` clarifying that it should be emptied and removed as domains get migrated to their own routers.
4. Add a simple test asserting `/api/v1/hello` still responds to ensure all public legacy routes are wired through composition (optional).
5. Begin migrating cohesive route groups (e.g., inventory, addresses) to dedicated routers alongside `legacyRouter` as planned for later phases.

### Verdict
Phase 1 meets its goals: routing composition is introduced without changing behavior, and tests target the new mount path successfully. Address the minor cleanup items above to reduce confusion and keep momentum for Phase 2.


