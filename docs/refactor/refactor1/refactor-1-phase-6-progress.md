### Refactor 1 — Phase 6 Progress (modularization of org domains)

Updated: 2025-08-24

#### Scope recap (from phase plan)
- Migrate: Areas, Departments, Employees, Positions, Assignments, Schedules, Shifts, Contacts
- Pattern: controllers/services/repos + modular routes; keep HTTP behavior unchanged; tests first; remove legacy per subdomain after parity.

#### Completed
- Areas modular routes implemented and mounted.
  - Added:
    - `server/src/repositories/areasRepo.ts`
    - `server/src/services/areasService.ts`
    - `server/src/controllers/areasController.ts`
    - `server/src/routes/areas.ts`
    - `server/src/test/integration/areas.int.ts` (golden-master)
  - Mounted: `server/src/routes/index.ts` (adds `api.route('/areas', areasRouter)`)
  - Legacy unmounted in `server/src/api.ts` (Areas + Event-Areas mounts removed). Handlers remain defined but unused; safe to delete post-parity.
  - Status: Areas tests pass when run cleanly; flakiness resolved by DB truncate improvements (see below).

- Employees & Positions modular routes implemented and mounted.
  - Added:
    - `server/src/repositories/employeesRepo.ts`
    - `server/src/repositories/positionsRepo.ts`
    - `server/src/repositories/employeePositionsRepo.ts`
    - `server/src/services/employeesService.ts`
    - `server/src/services/positionsService.ts`
    - `server/src/services/employeePositionsService.ts`
    - `server/src/controllers/employeesController.ts`
    - `server/src/controllers/positionsController.ts`
    - `server/src/controllers/employeePositionsController.ts`
    - `server/src/routes/employees.ts`
    - `server/src/routes/positions.ts`
    - `server/src/routes/employeePositions.ts`
    - `server/src/test/integration/employees_positions.int.ts` (golden-master)
  - Mounted: `server/src/routes/index.ts` (adds employees/positions/employee-positions routes under `/api/v1`)
  - Status: Test suite `employees_positions.int.ts` is green.

- Schedules / Shifts / Assignments modular routes implemented and mounted.
  - Added:
    - `server/src/repositories/schedulesRepo.ts`
    - `server/src/services/schedulesService.ts`
    - `server/src/services/shiftsService.ts`
    - `server/src/services/assignmentsService.ts`
    - `server/src/controllers/schedulesController.ts`
    - `server/src/controllers/shiftsController.ts`
    - `server/src/controllers/assignmentsController.ts`
    - `server/src/routes/schedules.ts`
    - `server/src/routes/shifts.ts`
    - `server/src/routes/assignments.ts`
    - `server/src/test/integration/schedules_shifts.int.ts` (golden-master)
    - `server/src/test/integration/assignments.int.ts` (golden-master)
  - Mounted: `server/src/routes/index.ts` (adds schedules/shifts/assignments routes under `/api/v1`)
  - Legacy: schedules handlers removed from `server/src/api.ts`; legacy `departmentsRoutes` remains mounted to preserve other nested endpoints until final cleanup.
  - Status: Both SSA suites are green.

#### In progress
- Departments modular routes added and mounted.
  - Added:
    - `server/src/repositories/departmentsRepo.ts`
    - `server/src/services/departmentsService.ts`
    - `server/src/controllers/departmentsController.ts`
    - `server/src/routes/departments.ts`
    - `server/src/test/integration/departments.int.ts` (golden-master)
  - Mounted: `server/src/routes/index.ts` (adds `api.route('/departments', departmentsRouter)`)
  - Legacy Departments handlers removed from `server/src/api.ts` (list/create/get/patch), since parity confirmed by tests.
  - Status: All Departments golden-master tests pass locally. Repo uses `or(...)` from `drizzle-orm` for `q` filter; POST returns body with `id`; auth via test stub works.

#### Test infrastructure
- `server/src/test/testDb.ts`: improved truncation to reduce deadlocks:
  - Uses advisory lock (`pg_advisory_lock`) and deterministic TRUNCATE order across `public` and `app` schemas, skipping Drizzle migration tables.
- `server/src/vitest.config.ts`: `singleThread: true` already set.
- Still observed: during runs that execute multiple suites together, SQL migrations log duplicate "already exists" notices and occasional deadlock messages. These stabilized when running suites individually.

#### Known failing suites (as of now)
- Departments: none; suite is green.
- Employees & Positions: none; suite is green.
- Schedules / Shifts / Assignments: none; suites are green.
- Event Series: several 401/404/500 mismatches. Tests use `buildTestApp({ stubAuth })`; ensure requests that require auth do not omit stub context (or pass Authorization with emulator env).
- Inventory: some 400/500 mismatches (outside Phase 6 scope). Leave as-is unless they interact with new domains.

#### What remains (per phase plan)
1) Departments
   - Done: Tests green; legacy handlers removed from `server/src/api.ts`.

2) Employees & Positions
   - Remove legacy handlers in `server/src/api.ts` after parity (next cleanup task).

3) Assignments / Schedules / Shifts
   - Done: Implemented modular repos/services/controllers/routes; added tests; parity confirmed.
   - Legacy schedules handlers removed from `server/src/api.ts`.

4) Contacts
   - Implement `routes/contacts.ts`, controller/service/repo.
   - Golden-master tests; remove legacy.

5) Final pass
   - Keep golden-master tests as parity gates; don’t relax HTTP contracts.
   - Delete remaining legacy handlers from `server/src/api.ts` once each subdomain passes.

#### Pointers and notes
- Routing composition:
  - All modular subdomains are mounted in `server/src/routes/index.ts` under `/api/v1`.
  - Legacy is still mounted at the end via `legacyRouter` to preserve behavior for unmigrated routes.
- Auth for tests:
  - Prefer `buildTestApp({ stubAuth })` which injects `x-test-user` for all requests.
  - If using Authorization bearer tokens, ensure emulator mode is active (`FIREBASE_AUTH_EMULATOR_HOST`) so `verifyFirebaseToken` accepts test payloads.
- DB access:
  - All services follow legacy pattern: `getDatabase(getDatabaseUrl() || process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5502/postgres')`.

#### Quick task list for the next agent
- Departments
  - [x] Ensure `departmentsRepo.ts` uses `or(...)` from `drizzle-orm` for `q` filters.
  - [x] Re-run `src/test/integration/departments.int.ts`; fix any remaining 404 by verifying POST/GET paths and service wiring.
  - [x] Remove legacy Departments handlers from `server/src/api.ts`.

- Employees & Positions
  - [x] Create `repositories`, `services`, `controllers`, `routes` mirroring legacy logic (joins, validations).
  - [x] Mount in `routes/index.ts`; add golden-master tests; ensure parity.
  - [ ] Remove legacy Employees/Positions handlers from `server/src/api.ts`.

- Assignments / Schedules / Shifts
  - [x] Implement modular routes/services/controllers/repos; add tests; ensure parity.
  - [x] Mount in `routes/index.ts` and remove legacy schedules handlers from `server/src/api.ts`.

- Contacts
  - [ ] Implement, test, cut legacy.

- Test stability
  - [ ] Run suites individually during development; keep `truncateAllTables` between tests only; avoid calling `resetTestDatabase` more than once per suite.

#### Files touched in this phase
- Areas: `server/src/repositories/areasRepo.ts`, `server/src/services/areasService.ts`, `server/src/controllers/areasController.ts`, `server/src/routes/areas.ts`, `server/src/routes/index.ts`, `server/src/test/integration/areas.int.ts`, legacy mounts removed in `server/src/api.ts`.
- Departments: `server/src/repositories/departmentsRepo.ts`, `server/src/services/departmentsService.ts`, `server/src/controllers/departmentsController.ts`, `server/src/routes/departments.ts`, `server/src/routes/index.ts`, `server/src/test/integration/departments.int.ts`, legacy mount removed in `server/src/api.ts`.
- Infra: `server/src/test/testDb.ts` (truncate fix).


