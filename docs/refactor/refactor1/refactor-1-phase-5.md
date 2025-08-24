### Refactor 1 — Phase 5: Events, Event Areas, Recurring Series

Brief description: Extract events-related domains with controllers/repos/routes and preserve existing recurrence and series semantics.

### Files to add
- `server/src/controllers/eventsController.ts`
- `server/src/controllers/eventAreasController.ts`
- `server/src/controllers/recurringSeriesController.ts`
- `server/src/repositories/eventsRepo.ts`
- `server/src/repositories/eventAreasRepo.ts`
- `server/src/repositories/recurringSeriesRepo.ts`
- `server/src/routes/events.ts` (mount `/events`)
- `server/src/routes/eventAreas.ts` (mount consistent with current paths)

### Files to edit
- Reuse or adapt `server/src/routes/eventSeries.ts` via controllers/services; or merge into `routes/recurringSeries.ts` with thin controller.
- Remove legacy handlers from `server/src/api.ts` after parity.

### Algorithms
1. Occurrence computation: keep `computeOccurrences` in services; controllers validate inputs, map errors to HTTP.
2. Upsert series: single transaction to update `eventSeries`, rules, and projected events; move direct Drizzle access into repositories.

### Tests-first plan (against existing functionality)
1. Golden-master integration tests for series CRUD/listing and occurrence generation; assert payloads and edge cases.
2. Unit tests for occurrence computation edge cases and upsert rules.

### Step-by-step
1. Write tests against current routes (`api.ts` and `routes/eventSeries.ts`); ensure green.
2. Implement controllers/repos/routes for events, areas, series; mount alongside legacy.
3. Run suite; confirm parity.
4. Remove legacy handlers after tests remain green on the new routes.

### Modify and re-verify tests along the way
- Keep golden-master tests unchanged for parity.
- New unit tests can assert internal algorithms while HTTP-level tests remain stable.

### Exit criteria
- Events and series are served by new controllers/services/repos; tests remain green with identical externally observable behavior.

