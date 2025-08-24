### Refactor 1 — Phase 1: Routing Composition and Legacy Adapter

Brief description: Split app construction from routes and mount a legacy router that preserves `server/src/api.ts` behavior while enabling incremental domain migrations.

### Files to add
- `server/src/routes/index.ts` — `mountV1Routers(api: Hono)` mounts domain routers, initially only `legacyRouter`.
- `server/src/routes/legacy.ts` — wraps/re-exports remaining routes from `server/src/api.ts` during migration.

### Files to edit
- `server/src/api.ts` — extract app creation concerns into `app.ts`; keep only route definitions temporarily.
- `server/src/app.ts` — call `mountV1Routers(api)` and `app.route('/api/v1', api)`.

### Algorithm
1. `buildApp()` creates root `app` and child `api` router.
2. `mountV1Routers(api)` mounts `legacyRouter` first; new domain routers will be added alongside as they migrate.

### Tests-first plan (against existing functionality)
1. Keep Phase T0 golden-master tests unchanged; they must pass when requests flow through `legacyRouter`.
2. Add a small integration test asserting that `/api/v1/*` paths are reachable and unchanged via the new app composition (no behavior or status changes).

### Step-by-step
1. Add `routes/index.ts` and `routes/legacy.ts` with pass-through behavior to legacy handlers.
2. Update `app.ts` to mount `legacyRouter` under `/api/v1`.
3. Ensure `server/src/api.ts` still exports all current handlers; do not remove any domain logic yet.
4. Run full test suite; confirm parity with golden-master tests.

### Modify and re-verify tests along the way
- Do not change golden-master assertions; re-run them to confirm the router split is transparent.
- If route prefixes or composition inadvertently change behavior, adjust router wiring (not tests) until parity is restored.

### Exit criteria
- All golden-master and router composition tests pass; legacy behavior is preserved via `legacyRouter`.

