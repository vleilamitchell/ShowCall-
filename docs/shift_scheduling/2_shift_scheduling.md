# Phase 2 — API: Scheduling Service (Heuristic), Run/Commit/Explain

Source: docs/features/0030_PLAN.md (Phase 2A)

## Goal
Provide server-side scheduling with a fast heuristic, expose endpoints to run previews, explain scores, and commit results to `assignments`.

## Deliverables
- New service module `server/src/services/scheduling/`:
  - `score.ts` — compute U(e,s)
  - `feasibility.ts` — eligibility and constraint checks
  - `heuristic.ts` — greedy + swap/anneal improvement
  - `run.ts` — orchestrate runs and persist `scheduling_runs`
- New routes/controllers:
  - `server/src/routes/scheduling.ts` → `server/src/controllers/schedulingController.ts`
- Wire routes in `server/src/routes/index.ts`
- Tests: unit + integration

## Endpoints
- POST `/api/v1/scheduling/run`
  - Body: `{ departmentId, scheduleId? | eventId?, algorithm?: 'heuristic', rngSeed?, weights? }`
  - Behavior: load window data, build candidates, run heuristic, write `scheduling_runs`, return preview
  - Response: `{ runId, objective, assignments: [{ shiftId, requiredPositionId, areaId?, assigneeEmployeeId }], diffs }`

- POST `/api/v1/scheduling/commit`
  - Body: `{ runId }` or `{ departmentId, scheduleId? | eventId?, result }`
  - Behavior: upsert/delete `assignments` to match result; return counts

- GET `/api/v1/scheduling/explain`
  - Query: `{ departmentId, shiftId }`
  - Behavior: list candidates and U(e,s) components for debug

## Service Details
### score.ts
`computeAssignmentScore({ employee, position, shift, event, weights, leadRequired, hoursToDate, restWindows }) -> number`
- Normalize: P_e from `employee_positions.priority` (0.0–9.9 → [0,1]); W_k from `events.priority` (1–5 → [0,1])
- U(e,s) = W_k * (α·P_e + β·LeadBonus) − γ·Fatigue − δ·Unfairness

### feasibility.ts
- `listEligibleCandidates(departmentId, requirementId)`
- `hasOverlap(assignments, employee, shift)`
- Enforce: skills, availability, one-at-a-time, lead coverage feasibility, hour caps/rest

### heuristic.ts
- Precompute candidates and scores
- Order requirements by: (-W_k, rarity, leadRequired first, earliest start)
- Greedy fill honoring constraints
- Improvement loop: single/pair swaps, limited reflow, simulated annealing (200–1000 iters), deterministic RNG seed
- Fairness polish without materially reducing objective

### run.ts
- `runScheduling({ departmentId, scheduleId|eventId, algorithm='heuristic', rngSeed, weights })`
- Persist `scheduling_runs`, return `{ objective, result }`

## Integration With Existing Modules
- Reuse `eventsRepo`, `assignmentsService`, `employeePositionsRepo` where possible
- Extend `routes/shifts.ts` publish confirmation to validate requirement coverage and lead presence, not raw assignment counts

## Configuration
Env flags (read at runtime):
- `SCHEDULER_DEFAULT_ALGORITHM=heuristic`
- `SCHEDULER_HEURISTIC_ITERS=500`
- `SCHEDULER_ENABLE_ILP=false` (ignored in this phase)

## Tests (Server)
- Unit:
  - `services/scheduling/score.test.ts`
  - `services/scheduling/heuristic.test.ts`
  - `services/scheduling/feasibility.test.ts`
- Integration:
  - `routes/scheduling.run.test.ts`
  - `routes/scheduling.commit.test.ts`
  - `routes/shiftRequirements.test.ts` (CRUD + unique index)

## Acceptance Criteria
- `run` returns full coverage where feasible and stable with same seed
- `commit` writes expected `assignments` rows; publish guard recognizes full confirmation
- Deterministic results given identical inputs and rngSeed

## Risks/Mitigations
- Infeasible coverage: report gracefully with diagnostics; consider future underfill slack
- Performance: cache candidate builds; efficient indexing
- Determinism: fix RNG seed and stable tie-breakers on `(employee_id, shift_id)`
