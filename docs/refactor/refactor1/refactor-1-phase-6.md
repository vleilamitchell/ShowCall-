### Refactor 1 — Phase 6: Areas, Departments, Employees, Positions, Assignments, Schedules, Shifts, Contacts

Brief description: Migrate remaining organization domains in manageable chunks per PR with controllers/services/repos/routes, preserving semantics and ensuring transactional integrity across multi-table writes.

### Domains and files to add (per subdomain)
1) Areas — `routes/areas.ts`, `areasController`, `areasRepo`.
2) Departments — `routes/departments.ts`, controller, repo.
3) Employees & Positions — separate controllers and repositories; migrate join queries into repositories.
4) Assignments/Schedules/Shifts — controllers/services/repos; ensure multi-table writes use transactions.
5) Contacts — `routes/contacts.ts`, controller/service/repo.

### Files to edit
- As each subdomain migrates, remove its legacy handlers from `server/src/api.ts` after parity is confirmed by tests.

### Tests-first plan (against existing functionality)
1. For each subdomain, extend golden-master integration tests to encode current behavior (CRUD, filters, typical errors).
2. Add unit tests for any non-trivial service rules and validators.

### Step-by-step
1. Select a subdomain; write/extend tests against legacy routes in `api.ts`; get them green.
2. Implement controller/service/repo/route for that subdomain; mount alongside legacy.
3. Run suite; maintain parity.
4. Remove legacy handlers for that subdomain; proceed to the next subdomain.

### Modify and re-verify tests along the way
- Keep golden-master tests unchanged; they act as parity gates per subdomain.
- Add new assertions in unit tests as internal logic is clarified, without relaxing HTTP-level parity until cutover.

### Exit criteria
- All listed subdomains are migrated with controllers/services/repos; all tests pass and confirm unchanged HTTP behavior.

