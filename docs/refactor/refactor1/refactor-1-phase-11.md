### Refactor 1 — Phase 11: Observability and Logging

Brief description: Add structured logs at controller boundaries and optionally request timing middleware; include `requestId` on error payloads.

### Files to add/edit
- Add structured logging in controllers: `{ requestId, userId?, path, method, durationMs }`.
- Optionally add request timing middleware.

### Tests-first plan (against existing functionality)
1. Integration tests assert `requestId` is present on standardized error payloads.
2. No changes to success payloads; existing golden-master tests remain unchanged.

### Step-by-step
1. Introduce request timing and structured logging without altering responses.
2. Ensure error handler includes `requestId` in error envelope.
3. Run tests; verify presence and stability of fields.

### Modify and re-verify tests along the way
- Update only tests that check error envelopes to include `requestId`; do not change any other assertions.

### Exit criteria
- Observability fields are emitted; error payloads include `requestId`; all tests pass.

