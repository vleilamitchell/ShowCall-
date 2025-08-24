### Refactor 1 — Phase 8: Error Handling and Response Shapes

Brief description: Standardize HTTP error payloads and error mapping using `AppError` subclasses and formatting middleware while preserving legacy semantics until all domains adopt the new shape.

### Files to edit
- Replace ad-hoc `c.json({ error: ... }, code)` with throwing typed errors in migrated controllers/services.
- Ensure `server/src/middleware/errorHandler.ts` formats `{ error: { code, message, details?, requestId? } }`.

### Tests-first plan (against existing functionality)
1. Add unit tests for error mappers translating domain/DB errors to `AppError` subclasses.
2. Keep golden-master integration tests unchanged for legacy endpoints.
3. For migrated endpoints, add new integration tests asserting the standardized error envelope while retaining legacy-parity tests until full adoption.

### Step-by-step
1. Introduce typed error throws in controllers/services already migrated (auth, addresses, inventory) without changing success payloads.
2. Confirm error handler middleware captures and formats responses consistently.
3. Gradually expand to remaining domains.

### Modify and re-verify tests along the way
- Where new envelope is adopted, add parallel assertions for the standardized shape; keep legacy-parity tests for unaffected routes.

### Exit criteria
- Standardized error envelopes across migrated domains; all tests pass, with parity maintained where legacy routes remain.

