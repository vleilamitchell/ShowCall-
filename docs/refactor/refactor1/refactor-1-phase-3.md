### Refactor 1 — Phase 3: Addresses Domain Migration

Brief description: Extract addresses into controller/service/repository/route with standardized validation and filters while preserving HTTP behavior under `/api/v1/addresses` until cutover completes.

### Files to add
- `server/src/controllers/addressesController.ts` — parse DTOs, call service, map domain errors to HTTP.
- `server/src/services/addressesService.ts` — validations, primary-per-role enforcement.
- `server/src/repositories/addressesRepo.ts` — Drizzle CRUD and filtered list.
- `server/src/routes/addresses.ts` — router mounted under `/addresses` with `authMiddleware`.

### Files to edit
- Remove addresses handlers from `server/src/api.ts` only after parity is confirmed.
- Optionally augment `server/src/lib/validators.ts` for latitude/longitude and normalization.

### Algorithms
1. Create: normalize inputs (`state`, `zip`), validate lat/long and date ordering; map unique violations to 409.
2. Patch: selective validation; when `isPrimary` toggles true, rely on unique partial index; map conflicts.
3. List: filters for `entityType`, `entityId`, `role`, `status`, `isPrimary`, `q`; order by `is_primary DESC, updated_at DESC`.

### Tests-first plan (against existing functionality)
1. Extend golden-master integration tests to fully cover legacy addresses endpoints: create, patch, get, list with filters, and error cases.
2. Add unit tests for address validators/normalizers and service rules (primary-per-role) using current behavior as the source of truth.

### Step-by-step
1. Write/extend tests above against legacy `server/src/api.ts` handlers; ensure they pass.
2. Implement `addressesService`, `addressesRepo`, `addressesController`, and `routes/addresses.ts` behind the same paths.
3. Mount the new router alongside `legacyRouter`; route must produce identical responses.
4. Run test suite; both golden-master and unit tests must remain green.
5. Remove legacy address handlers from `server/src/api.ts` once parity is proven.

### Modify and re-verify tests along the way
- Keep golden-master assertions unchanged; they guard parity.
- If response envelopes are standardized in later phases, add new assertions in separate tests but retain legacy-parity tests until full cutover.

### Exit criteria
- Addresses are served by the new controller/service/repository/route; all tests pass with behavior identical to legacy at the HTTP layer.

