### Refactor 1 — Phase 4 Review: Inventory Domain Alignment

#### Summary
- Controllers, repositories, and modular routes for inventory have been added and are mounted under `/api/v1/inventory/*` via `routes/index.ts`. Legacy routes in `api.ts` remain mounted under the legacy router for parity, as intended by the plan.
- Services now accept an explicit `dbOrTx` parameter and, where appropriate, use `withTransaction` from `lib/db.ts`. Reservations uses `withTransaction`; `postTransaction` executes atomically via a local `run` function that can be passed a transaction if the caller provides one; projections are refreshed after writes.
- Error handling is centralized with `mapErrorToResponse()` and middleware; `ValidationError`/`ConflictError` mapping exists. Controllers consistently catch `AppError` and return proper status codes.
- Ajv validator caching is implemented for item attribute schemas.

#### Evidence
- Controllers: `server/src/controllers/inventory/{itemsController.ts,transactionsController.ts,reservationsController.ts}`
- Repositories: `server/src/repositories/inventory/{itemsRepo.ts,transactionsRepo.ts,reservationsRepo.ts}` (present but currently unused by services; services query directly)
- Routes: `server/src/routes/inventory/{items.ts,transactions.ts,reservations.ts}` and mounting in `server/src/routes/index.ts`
- Transaction helper: `server/src/lib/db.ts` `withTransaction()` with postgres-js support and neon fallback
- Services updated signatures: 
  - Items: `services/inventory/items.ts` (accepts `dbOrTx`)
  - Transactions: `services/inventory/transactions.ts` (accepts `dbOrTx`)
  - Reservations: `services/inventory/reservations.ts` (uses `withTransaction`)
  - Post transaction orchestration: `services/inventory/postTransaction.ts`
- Error mapping: `server/src/errors/index.ts`, middleware in `server/src/middleware/errorHandler.ts` and usage in `server/src/app.ts`
- Tests: `server/src/test/integration/inventory.int.ts` exercises CRUD, transactions, reservations and asserts legacy parity for locations

#### Correctness vs Plan
- Plan: "Align services to accept explicit dbOrTx and use withTransaction where appropriate." 
  - Status: Implemented. `reservations.ts` wraps mutations in `withTransaction`; other services accept `dbOrTx` and are ready for transaction scoping by callers.
- Plan: "Post Transaction: perform writes in a single withTransaction; update projections; map constraints to Validation/Conflict."
  - Status: Partially aligned. `postTransaction.ts` groups all inserts and valuation updates in a single `run(db)` call. If invoked with a tx `dbOrTx`, it will be fully transactional. When not provided, it acquires a plain connection and performs writes without explicitly wrapping in `withTransaction`. Projections are refreshed at the end (twice: once inside `run`, then again after). Error mapping is handled by global middleware, and policies are enforced prior to inserts.
- Plan: "Reservations mutual exclusion in withTransaction."
  - Status: Implemented. Overlap detection and insert are performed within a `withTransaction` scope when no `dbOrTx` is provided.
- Plan: "Item CRUD validate attribute schemas via Ajv, cache validators."
  - Status: Implemented in `validation.ts`, used in create/patch.
- Plan: "Remove legacy inventory handlers in api.ts after parity."
  - Status: Not yet. Legacy inventory subrouter remains mounted; new routers coexist and should shadow identical paths under `/api/v1/inventory/*`.

#### Notable Findings
- Repository layer is present but not used by services. Services continue to query directly against Drizzle. This may be by design during transition; consider moving data access to repositories or removing the repository folder to avoid confusion.
- `postTransaction.ts` refreshes projections twice: once inside `run` and again after returning. The comment suggests doing the refresh outside transactions; consider keeping only the outside refresh to avoid duplicate work.
- `postTransaction.ts` does not call `withTransaction` when `dbOrTx` is absent. If atomicity across inserts and valuation updates is required for parity, wrap the `run` call in `withTransaction` when no `dbOrTx` is provided.
- `transactions.ts` service and repos both implement list logic. Prefer a single source of truth (service depends on repo) to reduce duplication.
- Controllers catch `AppError` and return the embedded status. Global error handler also maps errors; ensure no double-wrapping or inconsistent envelopes across endpoints.

#### Data alignment and API surface
- Controllers normalize incoming payloads (e.g., string trims, type coercions). Response structures mirror legacy behavior in integration tests.
- Query params: `items` supports `q`, `item_type` (mapped to `itemType` internally), and `active`.
- Transactions list accepts `eventType` as CSV or array, `order`, `limit` with bounds; matches legacy semantics.

#### Over-engineering / Refactor opportunities
- Consolidate service data access via repositories or remove repos if not adopting the pattern now.
- Ensure all multi-statement inventory writes use `withTransaction` to guarantee atomicity under postgres-js drivers.
- Deduplicate projection refresh in `postTransaction.ts`.

#### Recommendations
1. In `postTransaction.ts`, when `dbOrTx` is not provided, wrap `run` with `withTransaction(run)` to satisfy the "single transaction" goal.
2. Remove the inner `refreshOnHandMaterializedView()` call and retain only the post-commit refresh to avoid duplicate refreshes.
3. Decide on repository usage: either have services call the repos or remove the repos for now to reduce confusion.
4. When parity is confirmed by tests, remove legacy inventory routes from `api.ts` and rely exclusively on the modular routers.

#### Test Coverage
- Integration suite `inventory.int.ts` covers: auth gating, items CRUD happy path, receipt and transfer transactions, and reservation mutual exclusion. Consider adding a test for `COUNT_ADJUST` negative/positive handling and valuation updates parity.

#### Conclusion
Overall, Phase 4 is largely implemented and functional with parity maintained. Address the transactional wrapping in `postTransaction`, projection refresh duplication, and repository usage consistency to fully meet the plan’s intent and improve maintainability.


