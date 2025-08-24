### Refactor 1 — Phase 3: Addresses Domain Migration — Review

#### Summary
- New modularized addresses stack added: controller, service, repository, route; mounted before legacy to shadow it under `/api/v1/addresses`.
- Core validations, normalization, and filtering implemented per plan; DB constraint conflict handled.
- Main parity risk: error response envelope differs from legacy handlers.
- Tests cover basic happy path and auth; missing filter/error coverage as planned.

#### Plan vs Implementation
- Files present and wired:
  - `routes/addresses.ts` exports protected router with CRUD methods.
  - `controllers/addressesController.ts` parses DTOs (camel and snake), calls service, returns JSON.
  - `services/addressesService.ts` validates, normalizes, enforces date ordering, maps DB conflicts to domain errors.
  - `repositories/addressesRepo.ts` performs Drizzle CRUD and filtered list with intended order.
  - Router mount sequence ensures shadowing legacy first:

```10:16:server/src/routes/index.ts
export function mountV1Routers(api: Hono) {
  // Mount new modular routers first so they can shadow legacy routes with identical behavior
  api.route('/addresses', addressesRouter);
  api.route('/', legacyRouter);
  // Mount new auth router under /protected alongside legacy routes
  api.route('/protected', authRouter);
}
```

- Legacy handlers remain in `api.ts` (per plan, to be removed post-parity).

#### HTTP Parity Analysis
- Legacy error bodies use a flat `{ error: string }` shape (e.g., conflict):

```2334:2339:server/src/api.ts
    try {
      const inserted = await db.insert(schema.addresses).values(record).returning();
      return c.json(inserted[0], 201);
    } catch (e: any) {
      const msg = String(e?.message || '');
      if (msg.includes('uniq_addresses_primary_per_role')) return c.json({ error: 'PrimaryExists' }, 409);
      throw e;
    }
```

- New stack throws domain errors caught by global error handler, producing `{ error: { code, message } }`:

```55:65:server/src/errors/index.ts
export function mapErrorToResponse(err: unknown) {
  if (err instanceof AppError) {
    return {
      status: err.status,
      body: { error: { code: err.code, message: err.message, details: err.details } },
    } as const;
  }
  return {
    status: 500,
    body: { error: { code: 'internal', message: 'Internal Server Error' } },
  } as const;
}
```

- Controllers don’t override this to legacy shape; errors will differ even if status codes match. Integration tests don’t assert body shape, so this isn’t currently caught.

Recommendation: Until cutover, map known domain errors in `addressesController` to the legacy `{ error: string }` envelope (and avoid throwing), or use a route-local error mapper to preserve legacy shape on `/addresses` only.

#### Validation, Normalization, and Rules
- Create validation mirrors legacy, including date-string messages and state/zip rules. Patch uses selective validation. Lat/long optional and range-checked.
- Status whitelist implemented with default `active`.
- ID generation matches legacy fallback strategy.
- On conflict of primary-per-role, service maps DB error text to domain ConflictError("PrimaryExists"):

```138:144:server/src/services/addressesService.ts
  try {
    return await repo.insertAddress(db, record);
  } catch (e: any) {
    const msg = String(e?.message || '');
    if (msg.includes('uniq_addresses_primary_per_role')) throw new ConflictError('PrimaryExists');
    throw e;
  }
```

- List filters and ordering implemented as specified.

Data alignment:
- Inputs accept camelCase and legacy snake_case for key fields in controller create/patch.
- Outputs remain camelCase via Drizzle schema mapping; matches legacy responses.
- Latitude/longitude are serialized as strings (legacy-compatible).

#### Potential Issues / Risks
- Error envelope mismatch (see above) will change HTTP bodies for error cases.
- Emulator token verification uses `atob`, which may not exist in Node runtimes; recommend safer decode:

```42:55:server/src/lib/firebase-auth.ts
      const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
      // ...
    } catch (error) {
      throw new Error('Invalid emulator token');
    }
```

Suggestion: use `Buffer.from(parts[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8')` to avoid `atob` dependency.

- Service and legacy both normalize/validate state and zip, but service uses centralized validators; keep messages exactly matching legacy text (they currently do).
- Minor: `addressesRepo.listAddresses` passes an `undefined as any` where-clause when no filters; Drizzle tolerates it, but could skip `.where` entirely for clarity.

#### Tests Coverage
- `server/src/test/integration/addresses.int.ts` covers:
  - 401 on unauthenticated list
  - Create → Get → Patch happy path

Gaps (per plan):
- Missing list filter assertions (`entityType`, `entityId`, `role`, `status`, `isPrimary`, `q`).
- Missing error cases:
  - Invalid state/zip/date/lat/long
  - Date ordering violation on create and patch
  - Primary-per-role conflict (expect 409)
  - Not-found on GET/DELETE/PATCH

Recommendations:
- Add golden-master tests for above against current legacy endpoints; then ensure new router remains green.

#### Over-engineering / Style
- Code size and separation look appropriate. Naming, guards, and normalization are clear and consistent with codebase style.
- Consider centralizing error-to-HTTP mapping for the addresses routes to ensure legacy envelope compatibility without try/catch duplication in each handler.

#### Conclusion
- Functionally, the new modular addresses stack aligns with the plan and preserves behavior in success paths and status codes.
- To fully satisfy “identical responses,” address the error envelope mismatch, and extend tests to cover filters and error scenarios.

#### Action Items
- Map `ValidationError`/`ConflictError`/`NotFoundError` to legacy `{ error: string }` body for `/addresses` routes during parity window.
- Replace `atob` with Buffer-based base64url decoding in emulator verification.
- Add missing integration tests for list filters and error cases.
- Optionally tidy `listAddresses` where-clause when no filters.


