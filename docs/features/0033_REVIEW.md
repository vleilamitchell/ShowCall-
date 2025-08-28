## 0033 Review: Event Templates (versions, assignments, areas)

### Verdict
Baseline implementation lands the core data model, endpoints, and minimal UI. Template application to events and recurring integration exist and work in a basic flow. Several plan items are partially implemented or missing, and there are a few correctness issues to fix before shipping.

### Plan conformance
- Data model/migrations: Implemented per plan (templates, versions, requirements, allowed areas; event and assignment references). Indexes present.
- Drizzle schema: Matches migrations; camelCase fields map correctly.
- Server routes/controllers:
  - CRUD: list/create/get/patch for templates implemented.
  - Versions: list/create/activate implemented; cloning requirements supported.
  - Requirements: GET/PUT replace-all implemented with allowed areas.
  - Apply-to-event endpoint implemented.
- Services:
  - distributeCountsEvenly and applyTemplateToEvent implemented (even spread, replace/add modes, sets `sourceTemplateVersionId`).
  - Recurrence integration: generation applies template version when `series.templateVersionId` is set.
- UI:
  - Templates page exists using ListDetail; can create template, create versions, activate version, edit requirement rows.
  - Events page adds a minimal “Apply Template” button.
  - Recurring page adds a `templateVersionId` text input; preview/generate unchanged beyond dates.
- Client library: Endpoints added for templates, versions, requirements, and apply-to-event.

### Issues and risks
1) Apply-to-event controller uses an invalid filter
   - File: `server/src/controllers/templateApplicationController.ts`
   - Bug: Uses `(schema as any).eq(...)` instead of `eq(...)` import when fetching the event. This likely resolves to `undefined`, causing an unfiltered `select … limit 1` and potentially applying the template to the wrong event.
   - Fix: `import { eq } from 'drizzle-orm'` and use `where(eq(schema.events.id, eventId))`.

2) Events UI lacks template selection
   - Plan: Add a Template selector storing `templateId`/`templateVersionId` on the event and an Apply control.
   - Current: Only a single “Apply Template” button with no way to set `templateVersionId` on the event. The button calls the API without a `templateVersionId`, which will 400 unless the event already has it.
   - Fix: Add a selector (autocomplete by template + current version) and PATCH the event’s `templateVersionId`; or allow specifying a version in the Apply dialog.

3) Templates UI lacks Areas and Position UX
   - Plan: Requirements editor should include a searchable Position selector and an Allowed Areas multi-select.
   - Current: Text input for `requiredPositionId`, and a note “Areas selection pending.”
   - Fix: Add position autocomplete and allowed area multi-select; wire through to PUT requirements.

4) Recurring preview lacks assignment counts
   - Plan: Preview should include computed assignment totals per date based on requirements.
   - Current: Preview returns `{ dates, template }` only. UI shows only date count.
   - Fix: Compute counts from the current version’s requirements for the series’ `templateVersionId` and include them in the preview payload and UI.

5) Misleading warning when skipping assignment creation
   - Service: `applyTemplateToEvent` returns `warning: 'no_shifts'` when `createAssignments === false`, even if shifts exist.
   - Fix: Return a clearer sentinel (e.g., `assignments_not_created`) and only use `event_has_no_shifts` when the event truly has no shifts.

6) N+1 queries in requirements APIs
   - `getRequirements` queries areas per requirement in a loop.
   - Impact is minor at current scale; consider a join or batch if usage grows.

7) Aggressive, immediate PATCHes in Templates UI
   - Description and name fields PATCH on every keystroke. Elsewhere the app uses debounced patches.
   - Suggestion: Align with `useDebouncedPatch` to reduce API chatter.

8) Minor style inconsistencies
   - Mixed usage of type-safe imports vs. `(schema as any)` fallbacks (`ilike`, `eq`). Prefer consistent, typed imports.

### Subtle data-shape/alignment checks
- Column naming: Postgres snake_case mapped to Drizzle camelCase; UI consumes camelCase. Verified across templates, versions, requirements, areas, events, assignments.
- Requirements payload: UI sends `{ requiredPositionId, count, allowedAreaIds }` array; server interprets both array body and `{ items: [...] }`. Current UI sends array—OK.
- Apply-to-event body: UI sends `{ mode: 'replace', createAssignments: true }` without `templateVersionId`. Server falls back to event’s `templateVersionId`. With no selector, this errors; see Issue 2.

### Over-engineering risks
- Guarded `(schema as any).ilike` adds complexity for little benefit. Prefer explicit `ilike` import and rely on test/build to catch env mismatches.

### What’s missing vs plan
- Tests: No server or UI tests were added for this feature set.
- UI: Template selector on Events; allowed Areas multi-select; position autocomplete; richer Apply options (target shifts).
- Preview counts: Series preview does not return/visualize assignment counts derived from requirements.

### Recommendations (fix forward)
1) Correct the `eq` bug in `templateApplicationController.ts` and add a quick unit/integration test for the endpoint.
2) Add a Template selector on `Events` detail:
   - Autocomplete over templates, show current version; PATCH `templateVersionId` on the event.
   - Optionally allow choosing a specific version different from current.
3) Enhance Templates UI editor:
   - Position search/select; allowed Areas multi-select; save via PUT requirements.
4) Series preview counts:
   - If `series.templateVersionId` is set, load that version’s requirements, compute per-date totals, and include in the preview payload; visualize on UI.
5) Service warnings:
   - Use `assignments_not_created` when `createAssignments === false`; retain `event_has_no_shifts` only when no shifts are found.
6) Performance polish:
   - Batch area lookups in `getRequirements` with a join.
7) Tests:
   - Cover: create template auto-creates v1; requirements PUT/GET parity; version clone and activate; apply-to-event add/replace idempotency; series generation applies templates.

### Quick sanity checks performed
- Migrations apply cleanly and align with schema exports.
- Router mounted under `/api/v1` exposes planned endpoints.
- Distribution algorithm follows the deterministic even-spread described in the plan.

### Go/no-go
Proceed after fixing the apply-to-event controller bug and adding a minimal Event template selector. The remaining UI/preview enhancements can ship in a follow-up if needed, but tests are strongly recommended before rollout.


