### Refactor 1 — Phase 7: Validation Standardization (DTOs)

Brief description: Introduce request DTO parsing/coercion/validation per domain while preserving legacy behavior at the HTTP layer. Keep Ajv JSON-Schema for dynamic inventory attributes.

### Files to add
- `server/src/validation/<domain>.ts` — DTO schemas and coercion for each domain; colocate with controllers.

### Approach
- Keep JSON-Schema/Ajv for inventory attributes.
- For query/body DTOs, use TypeScript-first schemas and lightweight manual validation initially.

### Algorithms
1. Parse → Coerce → Validate → Transform to service input.
2. On validation failure, throw `ValidationError({ field, reason })`.

### Tests-first plan (against existing functionality)
1. Extend unit tests to cover DTO parsing/coercion/validation per domain; baseline against current accepted inputs.
2. Keep golden-master integration tests unchanged to assert HTTP payloads and status codes do not change.

### Step-by-step
1. Add DTO modules for targeted domains (starting with addresses and auth) without altering accepted input semantics.
2. Wire controllers to use DTO parsing; ensure identical outputs to services.
3. Run all tests; fix any coercion differences that would change behavior.

### Modify and re-verify tests along the way
- Update unit tests to cover edge coercions and failure cases; never relax integration parity assertions.

### Exit criteria
- Controllers use standardized DTOs; unit tests cover DTO behavior; integration parity remains intact.

