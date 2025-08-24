### Refactor 1 — Phase 12: Documentation and OpenAPI (Optional Later)

Brief description: Optional post-stabilization improvements to generate and publish OpenAPI docs.

### Files to add (optional)
- Adopt `@hono/zod-openapi` or `hono-openapi` and annotate controllers to generate OpenAPI.
- Publish `/api/openapi.json` and serve Swagger UI in dev.

### Tests-first plan (against existing functionality)
1. No behavior changes to HTTP responses; golden-master tests remain unchanged.
2. Add snapshot tests for generated OpenAPI schema if adopted.

### Step-by-step
1. Install schema libraries with `pnpm add` as needed in the `server` workspace.
2. Annotate controllers; expose OpenAPI route; verify schema generation.
3. Keep runtime behavior unchanged.

### Modify and re-verify tests along the way
- Run full test suite to ensure no HTTP-level regressions; add/update OpenAPI snapshot tests only.

### Exit criteria
- OpenAPI schema is generated and accessible in dev; no changes to API behavior; all tests pass.

