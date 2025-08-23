## 0009 Review — Scheduling (Shifts + Schedules)

### Summary
- **Data layer**: Implemented per plan (tables, columns, indexes). Drizzle schemas and SQL migrations align with requirements.
- **API**: Routes for schedules, shifts, assignments implemented with auth and validations. Derived publication handled on list; overlap warnings implemented. One notable bug on shift creation response.
- **UI**: Scheduling page, routes, and nav are wired. Filters and list work; basic detail edit exists. Several plan items not yet implemented (assignments panel, schedule management, create shift, schedule selector in detail, warnings surfacing).
- **Data alignment**: Types and server responses largely consistent. Minor inconsistencies noted below.

### What matches the plan
- Data layer (Drizzle + SQL):
  - `schedules`, `shifts`, `assignments` tables exist with correct fields and indexes.
  - Foreign keys and on-delete behaviors match intent (e.g., `shifts.scheduleId` nullable, `assignments.assigneeEmployeeId` nullable).
  - Exports added to `server/src/schema/index.ts`.
- API (Hono):
  - Schedules: `GET/POST/GET/:id/PATCH/:id`, `POST :id/publish`, `POST :id/unpublish` implemented with validations (name, dates, publish timestamps).
  - Shifts: Department-scoped `GET` with filters (`q`, `scheduleId`, `from`, `to`, `published`) and derived publication via schedule join; `POST` with date/time checks and non-blocking overlap warnings; item `GET/PATCH/DELETE` implemented.
  - Assignments: Department-scoped `GET`, `POST`; item `PATCH`, `DELETE` implemented.
  - Events bridging: `GET /api/v1/events/:eventId/shifts` returns linked shifts.
- UI:
  - Routes added: `/scheduling`, `/scheduling/:shiftId`, and department-scoped equivalents.
  - Sidebar includes "Scheduling" entry.
  - Scheduling page uses list/detail pattern with filter bar and derived Published badge in list.
- Client types and API helpers added in `ui/src/lib/serverComm.ts` for schedules/shifts/assignments, matching server shapes (camelCase).

### Issues and gaps
1) Shift create response `derivedPublished` is incorrect
   - Code: on create, server returns `derivedPublished: Boolean(created.scheduleId)`.
   - Impact: A shift attached to an unpublished schedule will appear as published in create response until list refetch.
   - Fix: After insert, either join schedule to compute `Boolean(created.scheduleId && schedule.isPublished)` or omit `derivedPublished` from create response and rely on list fetch.

2) "All" departments shows no results
   - UI offers `Department: All`, but listing shifts requires a department-scoped endpoint. When All is selected, the page clears the list.
   - Options:
     - Add an all-departments `GET /api/v1/shifts` endpoint to support the All filter, or
     - Remove the All option / default to first department, or
     - Change copy to require selecting a department.

3) Missing plan features in UI (Phase 3)
   - Assignments panel in shift detail: not present.
   - Schedule management affordances: quick create schedule; publish/unpublish in selector: not present.
   - Inline New Shift creation in list: not present.
   - Schedule selection in shift detail: no control to choose schedule; although `scheduleId` is sent on save, there is no selector.
   - Overlap warnings: server returns `warnings` on create, but UI does not surface them.
   - Schedule date containment warning (UX-only): not implemented.

4) Validation helpers duplication
   - Plan suggested reusing `validators.ts` where possible. API defines its own `isValidDateStr` and `isValidTimeStr`. Consider consolidating into shared helpers for consistency.

5) Derived publication on update
   - `PATCH /shifts/:id` returns the raw updated shift without `derivedPublished`. UI currently doesn’t display this in detail, so it’s fine, but if you intend to show a badge in detail, you’ll need to compute or fetch it.

6) Large `api.ts`
   - File is growing and mixes multiple feature areas. Consider refactoring into route modules (events, departments, schedules, shifts, assignments) for maintainability.

### Minor nits
- `eventsRoutes.get('/', ...)`: sorts by `desc(date), desc(startTime)` which lists most recent first; acceptable but inconsistent with shifts list (asc date/time). Not an issue, just a difference.
- In schedules list filters, date overlap logic uses `endDate >= from` and `startDate <= to` which returns schedules overlapping the range (good). Documented behavior could be clarified in UI.

### Recommendations
- Server
  - Fix `derivedPublished` on create: compute from schedule join or drop from create response.
  - Optionally add a cross-department shifts list to enable `Department: All` UX.
  - Move date/time validation helpers to `validators.ts` to avoid drift.
- UI
  - Add schedule selector and event link display in shift detail.
  - Implement assignments panel and wire to existing eligibility API.
  - Add inline New Shift creation and display overlap warnings.
  - Add quick schedule create and publish/unpublish controls in the filter bar.
  - Revisit Department "All" behavior per the chosen server/UX direction.

### Conclusion
Core data and API functionality align well with the plan, including derived publication on listing and overlap warnings. The UI lays the groundwork with filters and detail editing, but key Phase 3 affordances (assignments, schedule management, creation flows, warnings surfacing) remain to be implemented. Addressing the shift creation `derivedPublished` bug and the Department “All” behavior will improve correctness and UX consistency.


