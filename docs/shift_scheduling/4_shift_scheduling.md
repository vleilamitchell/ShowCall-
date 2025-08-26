# Phase 4 — Optional ILP: Exact Optimization Behind Feature Flag

Source: docs/features/0030_PLAN.md (Phase 3 — Optional)

## Goal
Introduce an exact ILP/CP-SAT model as a gold-standard solver behind a feature flag. Keep heuristic as default; enable nightly/batch usage.

## Deliverables
- `server/src/services/scheduling/ilp.ts`:
  - Build binary decision vars x_{e,s}
  - Constraints: coverage (exact `needCount`), eligibility/availability, one-at-a-time, lead coverage, hours cap/rest windows
  - Objective: maximize ∑ U(e,s) x_{e,s}
  - Deterministic tie-breaking where solver allows
- Optional dependency wiring (guarded by env flag), e.g., OR-Tools
- Batch/nightly job scaffolding to run ILP for target departments
- Tests (unit smoke + integration where feasible)

## Configuration
- `SCHEDULER_ENABLE_ILP=true|false`
- `SCHEDULER_DEFAULT_ALGORITHM=heuristic|ilp`

## Behavior
- If ILP enabled and selected, use ILP; otherwise fall back to heuristic
- For infeasible instances, return clear diagnostics; do not silently underfill unless explicitly configured

## Performance Considerations
- Limit problem size per run (time window, number of candidates)
- Warm starts from heuristic solution if supported
- Time limits and gap tolerances via env/config

## Tests
- Verify ILP solution objective ≥ heuristic on same instance
- Deterministic across runs with same data and seed (where solver supports)

## Acceptance Criteria
- ILP can solve small/medium instances within configured time limit
- Feature-flagged and safe to disable in production
- Nightly job produces stored `scheduling_runs` with reproducible results

## Risks/Mitigations
- Dependency size and platform issues: guard with env; document setup
- Solver timeouts: set pragmatic time limits; provide heuristic fallback
- Model drift vs heuristic scoring: reuse `score.ts` for consistency
