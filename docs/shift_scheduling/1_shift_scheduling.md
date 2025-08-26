# Phase 1 — Data Layer: Schemas, Migrations, Seed, and Minimal CRUD

Source: docs/features/0030_PLAN.md (Phase 1)

## Goal
Establish the core data to express coverage needs and constraints, and enable deterministic scheduling runs. Provide minimal CRUD for `shift_requirements` and seed test data to unblock API and algorithm work.

## Deliverables
- Drizzle schemas and migrations for:
  - `shift_requirements`
  - `employee_availability`
  - `employee_limits`
  - `scheduling_runs`
- Exports wired into `server/src/schema/index.ts`
- Minimal CRUD API for `shift_requirements`
- Seed data for a small test department with employees, positions, events, shifts, and requirements

## Schemas (Drizzle)
### shift_requirements
- id (pk)
- shiftId (fk → shifts.id, cascade on delete)
- departmentId (fk → departments.id)
- requiredPositionId (fk → positions.id)
- needCount (int, >= 1)
- leadRequired (boolean, default false)
- areaId (nullable fk → areas.id)
- Unique index on (shiftId, requiredPositionId, areaId)

### employee_availability
- id (pk)
- employeeId (fk → employees.id)
- departmentId (fk → departments.id)
- day (ISO date) or ruleType (e.g., weekly)
- startTime, endTime
- recurrenceRule (nullable text)

### employee_limits
- id (pk)
- employeeId (fk → employees.id)
- departmentId (fk → departments.id)
- maxHoursPerWeek (int; minutes or hours consistently)
- minRestMinutes (int)
- targetHoursPerWeek (int)
- effectiveFrom (date)

### scheduling_runs
- id (pk)
- departmentId (fk → departments.id)
- scheduleId (nullable) or eventId (nullable)
- algorithm ('heuristic' | 'ilp')
- rngSeed (text)
- startedAt, finishedAt (timestamps)
- objective (numeric)
- status ('pending' | 'succeeded' | 'failed')
- params (json)
- diffs (json)

## Migrations
- Create all four tables
- Add FKs and cascade rules
- Add unique composite index on `shift_requirements (shiftId, requiredPositionId, areaId)`
- Add secondary indexes for common lookups:
  - `shift_requirements.shiftId`
  - `employee_availability.employeeId`
  - `employee_limits.employeeId`

## Minimal CRUD for shift_requirements
Routes (Phase 1 minimal):
- GET `/departments/:departmentId/shifts/:shiftId/requirements`
- POST `/departments/:departmentId/shifts/:shiftId/requirements`
- PATCH `/shift-requirements/:id`
- DELETE `/shift-requirements/:id`

Validation:
- Enforce unique (shiftId, requiredPositionId, areaId)
- `needCount >= 1`
- Optional: ensure `requiredPositionId` belongs to department

## Seed Data
Create a small dataset to support Phase 2 tests:
- 1 department with 2–3 events of varying `events.priority`
- 6–10 employees with `employee_positions.priority` across the spectrum; some `isLead=true`
- Several shifts with overlapping times
- `shift_requirements` for each shift; include some with `leadRequired=true`
- Minimal `employee_availability` and `employee_limits` entries

## Acceptance Criteria
- Schemas compile; exported from `server/src/schema/index.ts`
- Migrations run on clean and existing dev DBs
- CRUD endpoints function end-to-end with validation
- Seed allows at least 6 requirement rows across multiple shifts

## Notes
- `events.priority` (1–5) normalized at scoring time; no schema change
- `employee_positions` remains the source of skill priority and `isLead`

## Risks/Mitigations
- Time zone handling: store UTC; convert at UI boundaries
- Duplicate requirements: unique index + controller checks
- Recurrence format churn: keep `recurrenceRule` as opaque text for now
