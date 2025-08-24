### Refactor 1 — Phase 10: Transactions and Repository Boundaries

Brief description: Ensure services orchestrate multi-table operations with `withTransaction` and repositories operate with an explicit `dbOrTx` handle.

### Files to edit
- `server/src/lib/db.ts` — `withTransaction<T>(fn)` available and used by services as needed.
- Services: refactor multi-write logic to call `withTransaction` and pass `tx` to repositories.
- Repositories: accept `dbOrTx`; do not create connections internally.

### Algorithm
1. Controller resolves `db` per request.
2. Service calls `withTransaction` for atomic operations; passes `tx` to repos.
3. Repositories perform pure data mapping without business rules.

### Tests-first plan (against existing functionality)
1. Unit tests for services verifying commit/rollback behavior on success/failure (use test doubles or test DB harness hooks).
2. Integration tests for multi-step operations confirm external results match legacy behavior.

### Step-by-step
1. Identify services with multi-table writes (inventory transactions/reservations, event series upsert, assignments/shifts).
2. Write/extend tests to lock in current outcomes.
3. Refactor to use `withTransaction` and explicit `dbOrTx`.
4. Run tests; fix any transactional boundary issues.

### Modify and re-verify tests along the way
- After each service refactor, re-run both unit and integration suites; keep parity assertions unchanged.

### Exit criteria
- All multi-step services use `withTransaction`; repositories are pure and accept `dbOrTx`; tests confirm parity.

