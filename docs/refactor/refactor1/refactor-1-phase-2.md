### Refactor 1 — Phase 2: Authentication and Protected Route Boundary

Brief description: Introduce a dedicated auth controller/route for `/protected/me` while keeping response semantics identical to the legacy endpoint. Apply auth middleware at router boundaries.

### Files to add/edit
- `server/src/controllers/authController.ts` — `me()` reads `c.get('user')` and returns profile.
- `server/src/routes/auth.ts` — defines `GET /protected/me` using `authMiddleware` and `authController.me`.
- `server/src/middleware/auth.ts` — export types for `ContextVariableMap.user` for reuse in controllers (no behavior change).

### Algorithm
1. Ensure protected routers use `authMiddleware` at the router level (`router.use('*', authMiddleware)`).
2. Keep response shape and status codes identical to the legacy `me` endpoint.

### Tests-first plan (against existing functionality)
1. Golden-master integration tests from Phase T0 must already cover `/protected/me`:
   - Unauthenticated → 401
   - Authenticated → 200 with stable payload
2. Before implementing the new controller/route, add integration tests that assert both legacy and new routers (temporarily mounted side-by-side or toggled behind the same path) yield identical responses.

### Step-by-step
1. Implement `routes/auth.ts` and `controllers/authController.ts`; mount alongside `legacyRouter` without removing the legacy handler yet.
2. Run the full test suite; ensure both paths resolve to the same behavior under `/api/v1/protected/me`.
3. When parity is confirmed, remove the legacy `me` handler from `server/src/api.ts` and keep tests unchanged.

### Modify and re-verify tests along the way
- Keep existing golden-master tests unchanged and green throughout.
- After removing the legacy handler, re-run tests to confirm identical status/payload; do not relax assertions.

### Exit criteria
- `/protected/me` is served by `routes/auth.ts` + controller; all tests remain green with legacy-parity behavior.

