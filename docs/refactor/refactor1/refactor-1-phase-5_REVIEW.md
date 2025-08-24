### Refactor 1 — Phase 5 Review: Events, Event Areas, Recurring Series

#### Scope recap
- Extracted domains with controllers/repos/routes: `events`, `event areas`, `recurring series`.
- Preserved recurrence semantics and introduced preview/generate endpoints.
- Mounted new modular routers alongside legacy routes.

#### What was implemented
- Controllers added: `server/src/controllers/eventsController.ts`, `eventAreasController.ts`, `recurringSeriesController.ts`.
- Repositories added: `server/src/repositories/eventsRepo.ts`, `eventAreasRepo.ts`, `recurringSeriesRepo.ts`.
- Routes added: `server/src/routes/events.ts`, `eventAreas.ts`, `recurringSeries.ts` and composed via `server/src/routes/index.ts` under `/api/v1` in `server/src/app.ts`.
- Recurrence logic: `server/src/services/events/recurrence.ts` with `computeOccurrences`, `buildEventTemplate`, `applyTemplateToEvent`, `upsertEventsForSeries`.
- Golden-master tests present: `server/src/test/integration/eventSeries.int.ts` and existing test harness.

#### Plan alignment
- Controllers validate inputs and map to HTTP responses: ✅ (date/time/weekday mask checks are in controllers via `validators.ts`).
- Occurrence computation kept in services: ✅ `computeOccurrences` resides in `services/events/recurrence.ts` and is used by controller and legacy route for parity.
- Upsert/generation logic extracted: ✅ `upsertEventsForSeries` encapsulates upsert behavior and area propagation semantics.
- New routers mounted while legacy remains: ✅ `routes/index.ts` mounts `/events`, `/events` (areas), and `/event-series` before legacy router.
- Remove legacy handlers post-parity: ⏳ Legacy `api.ts` still contains event-series and events handlers and `mountEventSeriesRoutes`. Removal is pending once parity confidence is high.

#### Findings
- Validations
  - Date/time format validation is consistent (`isValidDateStr`, `isValidTimeStr`).
  - Frequency limited to WEEKLY as intended; `byWeekdayMask` range enforced (0..127).
  - URL validation added to event create/patch: ✅ prevents malformed links.

- Repositories
  - `eventsRepo.listEvents` mirrors legacy filtering (future-or-current window when `includePast` is false), supports areaId filtering efficiently by preselecting IDs.
  - `recurringSeriesRepo` cleanly separates series/rules/areas operations with simple CRUD.
  - `eventAreasRepo` handles replace/add/remove with clear error signaling (`UnknownAreaIds`, `AreaNotFound`).

- Controllers
  - Input normalization is reasonable and avoids empty-string persistence.
  - Error mapping: repo-coded errors are translated to HTTP 400/404 where applicable.
  - `recurringSeriesController.preview` returns both `dates` and the effective template, matching plan.

- Recurrence service
  - `computeOccurrences`: weekly with anchor at start-of-week of `series.startDate` (or `start`); respects `interval` and `byWeekdayMask`; clamps by `startDate`/`endDate` and requested window.
  - `upsertEventsForSeries`: builds template, inserts new events, updates existing when `overwriteExisting`, and applies areas with `replace` or skip semantics; returns `{ created, updated, skipped, eventIds }`.
  - Note: Implementation executes per-day queries in a loop (N dates) rather than batching; acceptable for small windows but may warrant batching later.

- Routing and composition
  - `routes/index.ts` mounts modular routers under `/api/v1` and then legacy. Order should allow new handlers to shadow legacy endpoints where paths overlap.
  - Both new `/event-series` and legacy `mountEventSeriesRoutes(api)` still exist. Duplicated surface until legacy removed.

- Tests
  - `eventSeries.int.ts` provides minimal golden-master checks (list and preview validation error). More parity tests for create/patch/delete/areas/generate would increase confidence before removing legacy.

#### Risks / Edge cases
- Upsert not transactional across multiple inserts/updates and area link mutations. A failure mid-loop could leave partial state. Consider wrapping per-date changes or the whole run in a transaction when DB adapter/plugins allow.
- Timezone: date math uses UTC anchors; UI/server must agree on date boundaries. If inputs are local dates, behavior is stable but needs documentation.
- Template merge strategies: only specific fields included. If `templateJson` includes additional keys, they are not applied automatically; this is by design but should be documented.
- Area propagation on update only occurs when `overwriteExisting` is true and `setAreasMode==='replace'`. This matches intent but callers should be aware.

#### Over-engineering / Style
- Files are small and cohesive. Controllers are thin, business logic pushed to repos/services: ✅
- Naming and guards are clear; validators centralized.
- Some duplication remains between new controllers and legacy route implementations (expected during transition).

#### Recommendations
- Add integration tests for series CRUD, areas replace/add/remove, preview happy-path, and generate with both overwrite modes; verify payload shape parity with legacy endpoints.
- Consider transactional wrapper in `upsertEventsForSeries` if Drizzle/driver supports it to ensure atomicity per-run.
- After tests are comprehensive and green, remove legacy series handlers and `mountEventSeriesRoutes` from `api.ts` to eliminate duplication.
- Optionally batch fetch existing events by dates set to reduce N+1 queries in `upsertEventsForSeries` for larger windows.
- Document timezone expectations for date strings in API docs and ensure UI uses the same convention.

#### Conclusion
Implementation aligns with the plan. Main follow-ups are expanded parity tests, optional transactional batching for generation, and removing legacy routes once parity is proven.


