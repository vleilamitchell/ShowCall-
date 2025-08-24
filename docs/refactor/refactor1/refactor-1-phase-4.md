### Refactor 1 — Phase 4: Inventory Domain Alignment

Brief description: Align inventory to the controller/repository split and standardize requests while preserving existing semantics for items, transactions, and reservations.

### Files to add
- `server/src/controllers/inventory/itemsController.ts`
- `server/src/controllers/inventory/transactionsController.ts`
- `server/src/controllers/inventory/reservationsController.ts`
- `server/src/repositories/inventory/itemsRepo.ts`
- `server/src/repositories/inventory/transactionsRepo.ts`
- `server/src/repositories/inventory/reservationsRepo.ts`
- `server/src/routes/inventory/items.ts`
- `server/src/routes/inventory/transactions.ts`
- `server/src/routes/inventory/reservations.ts`

### Files to edit
- Align services in `server/src/services/inventory/*` to accept explicit `dbOrTx` and use `withTransaction` where appropriate.
- Remove legacy inventory handlers from `server/src/api.ts` after parity confirmation.

### Algorithms
1. Post Transaction: perform writes in a single `withTransaction`; update projections; map constraint violations to `ValidationError`/`ConflictError`.
2. Reservations: enforce mutual exclusion rules with atomic updates inside `withTransaction`.
3. Item CRUD: validate attribute schemas via existing Ajv-based `validateItemAttributes()`; cache validators per `schemaId`.

### Tests-first plan (against existing functionality)
1. Golden-master integration tests for: item CRUD, posting transactions (end-to-end), reservation lifecycle, and list/filters.
2. Unit tests for: attribute validation, reservation/transaction rules, projections logic.

### Step-by-step
1. Author/extend tests above against current legacy handlers/services; get green.
2. Implement controllers/repos/routes, refactor services to accept `dbOrTx` and use `withTransaction`.
3. Mount new routers alongside legacy; maintain identical responses and status codes.
4. Run full tests; ensure parity.
5. Remove legacy inventory handlers from `server/src/api.ts` when tests are green.

### Modify and re-verify tests along the way
- Keep golden-master assertions as parity guards; add additional assertions for transaction boundaries only as unit tests in services.
- Re-run the full test suite after each service/controller swap to ensure no semantic drift.

### Exit criteria
- Inventory endpoints operate through controllers/repos with services using `withTransaction`; all tests pass with legacy parity.

