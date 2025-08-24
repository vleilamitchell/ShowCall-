## Feature 0025 — Address Entity: Code Review

### Summary
- The feature is largely implemented per plan: new `addresses` table and Drizzle model, SQL migration with required constraints and indexes, and CRUD API routes with validation and normalization. Exports are wired in `server/src/schema/index.ts`, and routes are mounted under `/api/v1/addresses`.
- Notable gaps: missing code-level whitelist for `status`, premature allowance of `entityType = 'organization'` in API before an organizations table exists, and PATCH route does not proactively validate `validFrom <= validTo` (relies on DB CHECK only).

### Data Layer (Drizzle schema + SQL migration)
- Drizzle model `server/src/schema/addresses.ts` defines all fields per plan, including `numeric(9,6)` for geospatial values and default values for booleans and timestamps.
- SQL migration `server/drizzle/0029_addresses.sql`:
  - Creates table with appropriate column types (`char(2)` state, `char(5)` zip, `char(4)` plus4).
  - Adds index on `(entity_type, entity_id)` and a unique partial index on `(entity_type, entity_id, role)` WHERE `is_primary = true`.
  - CHECK constraint enforces `(valid_from <= valid_to)` when both present.
- Export from `server/src/schema/index.ts` includes `addresses` as required.

Observations:
- ORM uses `text('state')` while DB column is `char(2)`. This is acceptable; API validators enforce format. No action required.
- `createdAt`/`updatedAt` have defaults in DB; not marked `.notNull()` in Drizzle. Optional improvement only.

### API Layer (Hono routes)
Coverage:
- Routes implemented: GET list with filters (`entityType`, `entityId`, `role`, `status`, `isPrimary`, `q`), POST, GET by id, PATCH, DELETE.
- Search `q` matches `city` and `addressLine1`; default sort by `isPrimary DESC`, `updatedAt DESC`.
- Mounted under `/api/v1` via `api.route('/addresses', addressesRoutes)` and protected by `authMiddleware`.

Validation/Normalization:
- Uses `normalizeState`, `isValidState`, `normalizeZip5`, `isValidZip5`, `normalizeZip4`, `isValidZip4` per plan.
- Latitude/longitude validators constrain to [-90,90] and [-180,180].
- Required fields enforced: `entityType`, `entityId`, `addressLine1`, `city`, `state`, `zipCode`.
- Accepts snake_case aliases for `address_line_1`, `address_line_2`, `zip_code`, `zip_plus4`.

Entity existence checks:
- POST checks existence for `contact` and `employee`; PATCH revalidates when changing `entityType`/`entityId`.
- Organization is not validated (table not present yet).

Primary uniqueness and errors:
- Unique partial index handles primary-per-role. Conflicts surface as 409 with `PrimaryExists` — matches plan.

Gaps vs Plan:
1) Status whitelist missing:
   - Plan: constrain `status` to `active | inactive | pending_verification` in code.
   - Current: accepts any string; default `active`.
   - Impact: inconsistent states may be stored.

2) Organization allowance premature:
   - Plan: initial supported types are `contact`, `employee`; allow `organization` once table exists.
   - Current: API allows `entityType = 'organization'` already but does not validate existence.
   - Impact: orphaned references possible; deviates from staged rollout.

3) PATCH date ordering check:
   - Plan: apply same validations, including `validFrom <= validTo`.
   - Current: validates individual date formats but does not proactively check ordering; relies on DB CHECK to reject.
   - Impact: returns generic 500 on constraint violation instead of 400 with a clear message.

Minor notes:
- Latitude/longitude are sent to DB as strings (consistent with `numeric` handling in Drizzle). Acceptable.
- GET `isPrimary` filter parses `'true'`/`'false'`; empty value would be treated as false — acceptable but could be tightened.

### Acceptance Checks
- Create/fetch/patch/delete for `contact` and `employee`: Implemented; should pass with correct inputs.
- Primary uniqueness: Enforced via unique partial index and mapped to 409.
- Field validations: State/ZIP/ZIP4 and geospatial ranges enforced; date formats enforced; date ordering enforced in POST but not proactively in PATCH.

### Recommendations (Action Items)
1. Enforce status whitelist in POST and PATCH:
   - Accept only `active`, `inactive`, `pending_verification`. Return 400 otherwise.

2. Remove `organization` from allowed `entityType` until orgs table exists, or keep it but return 400 with a clear message (feature not enabled yet).

3. Add PATCH-level `validFrom <= validTo` validation:
   - When either date changes, fetch current record (or include both in request) and validate ordering; return 400 with a clear error.
   - Optionally, catch DB CHECK violations and map to 400 with a specific message.

4. Optional: mark `createdAt`/`updatedAt` as `.notNull()` in Drizzle to reflect DB defaults.

Overall, the implementation is solid and close to spec; addressing the above items will align it fully with the plan and improve error clarity.


