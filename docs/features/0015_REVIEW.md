### 0015 — Code Review: Fixes from 0013 Review (Inventory Core and Ledger)

Summary:
- Overall, most scope items from `0015_PLAN.md` are implemented: MV unique index, concurrent refresh usage, JSON Schema validation via Ajv, unit conversion helper, policy loading/enforcement, valuation updates, transactions listing, item summary with windowed reservations, API routes, and UI client helpers for transactions and summary.
- A few issues need attention for correctness and completeness (see below).

What was implemented per plan:
- Projections SQL (`server/drizzle/0010_inventory_projections.sql`)
  - Added UNIQUE index `ux_on_hand_identity` to support CONCURRENT refresh. OK.
  - Kept read index `idx_on_hand_item_loc`. OK.
  - `availability` view retained. OK (not used for windowing in services).
  - `valuation_avg` table defined. OK.
- Services
  - `refreshOnHandMaterializedView()` uses `CONCURRENTLY`. OK.
  - JSON Schema validation: `validateItemAttributes` with Ajv + formats; cached by `schemaId`. Used in create/patch. OK.
  - Unit conversion: `convertToBaseUnits(baseUnit, qty, unit)` queries `unit_conversion` direct/inverse. OK.
  - Policies: `loadPolicies` and `enforcePostingPolicies` implemented; checks allowed events, reservation, min_on_hand with optional enforcement. OK.
  - Valuation: rolling average adjustments and basic COGS behavior in `postTransaction`. Partially OK (see issues).
  - Transactions list: `listTransactions` with filters, ordering, limit. OK.
  - Item summary: `getItemSummary(itemId, { from?, to? })` aggregates `on_hand` and windowed reservations overlap. OK.
- API (`server/src/api.ts`)
  - Added `GET /api/v1/inventory/transactions` and `GET /api/v1/inventory/items/:itemId/summary`. OK.
  - `GET /api/v1/inventory/locations` accepts `department_id`. OK.
  - `POST /api/v1/inventory/transactions` supports `{ qtyBase }` or `{ qty, unit }`. OK.
- UI client (`ui/src/lib/serverComm.ts`)
  - Added `listInventoryTransactions`, `getInventoryItemSummary`. OK.
  - Locations helper exists, but does not yet accept `departmentId`. See issue.
- Dependencies
  - `ajv` and `ajv-formats` added at workspace root. OK.

Issues and recommendations:
1) Valuation negative-movement COGS not persisted
   - In `postTransaction`, for negative movements the code intends to use current average cost as COGS when not provided, but it does not persist `costPerBase` back to the inserted rows.
   - Impact: downstream reporting of COGS per transaction will be incomplete.
   - Fix: when `e.costPerBase == null` for negative events, set `e.costPerBase = avgCost` before insert. Given current structure builds `entries` then inserts, compute and assign per entry prior to `db.insert` loop.

2) Transfer-in quantity source
   - In transfer handling, the second entry uses `qtyBase: Math.abs(input.qtyBase)`. If the user posted `{ qty, unit }` and we computed `qtyBase` variable, but the original `input.qtyBase` was undefined, this can become `NaN`.
   - Impact: potential `NaN` qty for `TRANSFER_IN` when using unit conversion path.
   - Fix: use the computed `qtyBase` local variable, not `input.qtyBase`.

3) Policy allowed events coverage
   - `enforcePostingPolicies` checks against `policies.allowed_events` but the planner mentioned verifying base validity via `isValidEventType` and optionally restricting by policy.
   - Impact: If invalid event types are posted, they rely solely on DB constraints. Consider adding an `isValidEventType` guard or reuse existing validator if present.
   - Fix: Add a simple whitelist or shared enum validation before posting.

4) UI: locations filter not wired to `department_id`
   - `listInventoryLocations()` has no parameter; plan calls for optional `departmentId` filter passed as `department_id`.
   - Impact: UI cannot filter locations by department.
   - Fix: Update signature to `listInventoryLocations(params?: { departmentId?: string })` and pass through to query string. Also update `api.listInventoryLocations` typing.

5) Availability view comment vs behavior
   - SQL comment says window filter applied at query time; the service correctly computes windowed reservations, so this is fine. Just note that the `availability` view is a simple subtraction of total held and may mislead future readers.
   - Optional: Add a brief comment in projections service clarifying the view is not window-aware.

6) Error surfacing for attribute validation
   - `createInventoryItem`/`patchInventoryItem` throw generic Error. API routes return 500. Plan expected 400 on validation failure.
   - Impact: client receives 500 instead of 400 for user-errors.
   - Fix (API layer): Wrap service calls and map known validation error strings (e.g., starting with `attributes invalid:`) to 400 responses.

Other observations:
- `refreshOnHandMaterializedView` assumes UNIQUE index exists; migration adds it, so OK.
- SQL MV `on_hand` groups by `(item_id, location_id, lot_id)` matching index. OK.
- `getItemSummary` converts reservation window using `toISOString()`; relies on `ts` columns. OK.
- Drizzle schema column names align with service usage.

Actionable edits suggested:
- In `server/src/services/inventory/postTransaction.ts`:
  - Use computed `qtyBase` for transfer-in.
  - Assign COGS to negative entries when missing before inserts.
- In `server/src/api.ts` inventory item create/patch handlers:
  - Catch attribute validation errors and return 400 with message.
- In `ui/src/lib/serverComm.ts`:
  - Update `listInventoryLocations(params?: { departmentId?: string })` to pass `department_id` query param.

Overall status: Mostly implemented according to plan with a few correctness fixes recommended above.
