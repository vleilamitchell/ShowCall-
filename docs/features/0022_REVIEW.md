### Review: Recurring Events – series, templating, and auto-generation (0022)

#### Summary
- Migrations, schema, API routes, client methods, services, and UI routing were implemented per plan. Core generation logic and preview endpoints exist and follow the WEEKLY interval+mask model. New UI route `/events/recurring` and sidebar nav are added.

#### What’s implemented correctly
- Data model
  - Tables `event_series`, `event_series_rules`, `event_series_areas` created with expected columns and constraints; `events.series_id` added with index on (`series_id`,`date`).
  - Drizzle schema added: `eventSeries`, `eventSeriesRules`, `eventSeriesAreas`; `events` extended with `seriesId`.
- Server API
  - CRUD for `/api/v1/event-series` with validation for dates/times and frequency/weekmask.
  - Series areas routes: GET/PUT/POST/DELETE under `/api/v1/event-series/:seriesId/areas` with idempotent replace and add flows.
  - Preview `/api/v1/event-series/:seriesId/preview` returns dates + template; Generate `/generate` performs create/update with counts and IDs.
  - Routes are mounted under `/api/v1` and protected by `authMiddleware`.
- Services
  - `computeOccurrences` implements WEEKLY generation with Sunday anchor-of-week; window bounded by series dates and requested untilDate.
  - `buildEventTemplate` + `applyTemplateToEvent` implement maintainable merge strategies (overwrite/fillEmpty/append).
  - `upsertEventsForSeries` handles idempotency via lookup (`seriesId`,`date`), insert-or-update, and area replace semantics.
- UI & Client
  - New page `EventsRecurring` using ListDetail pattern with filters (q, from/to, active-only), basics editor, templates inputs, rule editor placeholder, series areas panel, and preview/generate controls.
  - `serverComm` types and methods for EventSeries, rules, areas, preview, and generate align with backend routes.
  - App route and sidebar link for Recurring are present.

#### Issues and risks
1) Rule editing not persisted
   - `RecurringRuleEditor` maintains local `interval` and `mask` only and does not persist to the server. The backend also lacks a route to update an existing rule. Preview/Generate use the stored rule, so UI edits have no effect on results. This makes preview/generation effectively static after creation.
   - Impact: Users cannot configure weekdays/interval after creating the series. New series currently default to mask `0` (no days), so preview/generate will return empty until a rule exists server-side.

2) Initial rule defaults
   - Creating a new series with `rule: { frequency:'WEEKLY', interval:1, byWeekdayMask:0 }` yields zero occurrences. Either require a non-zero mask on create or default to a sensible weekday preset to avoid confusion.

3) Event title default on generation
   - When creating events, if `titleTemplate` is absent, the service inserts `title: ''` to satisfy not-null. Consider defaulting to the series `name` or a generated label (e.g., `${series.name} ${date}`) to avoid empty titles.

4) Drizzle table keys
   - `eventSeriesAreas` Drizzle mapping lacks an explicit composite primary key. The DB migration sets the PK (`series_id`,`area_id`), so runtime constraints are enforced, but adding a Drizzle `primaryKey` improves type-safety and prevents accidental duplicates in code using ORM metadata.

5) UI filters semantics
   - “Active only” currently filters by `!endDate || endDate >= today`. The planned definition suggested active means “current date within start/end or no end.” To align fully, also check `(startDate == null || startDate <= today)`.

6) API file size and cohesion
   - `server/src/api.ts` is very large and now includes sizable series/areas logic. Consider extracting `event-series` and `series-areas` into separate route modules for maintainability.

7) Minor consistency nits
   - `preview` returns a template with possibly undefined keys; fine for v1, but documenting the shape in the API doc would help the UI render future previews better.
   - Frequency validator only accepts `WEEKLY`; error messages reflect that.

#### Subtle data alignment checks
- DB↔API↔UI naming: DB uses snake_case; Drizzle maps to camelCase; client types use camelCase. Confirmed consistent for all series fields and areas. No nested `{data:{}}` wrappers observed.
- Time/date formats: API validates `YYYY-MM-DD` and `HH:mm`; UI uses `DateField` and simple `Input`, sends strings as expected.

#### Recommendations (v1 fixes)
- Add server routes to get/update a series rule: `GET /event-series/:seriesId/rule`, `PATCH /event-series/:seriesId/rule` (validate `interval >= 1` and non-negative mask). Wire `RecurringRuleEditor` to load and persist.
- Alternatively (quick): allow `preview` and `generate` to accept an optional `rule` override to unblock UI until full rule CRUD exists.
- Default event title in generation to series `name` when `titleTemplate` is empty.
- Add Drizzle composite PK to `eventSeriesAreas` mapping.
- Update “Active only” filter to also apply `startDate <= today` when present.
- Consider extracting event-series routes into a separate module for readability.

#### Conclusion
The foundation matches the plan and is structurally sound. The key functional gap is non-persistent rule editing, which blocks the primary user workflow. Addressing rule persistence (or a short-term override) plus the minor quality-of-life fixes will make the feature usable and maintainable.


