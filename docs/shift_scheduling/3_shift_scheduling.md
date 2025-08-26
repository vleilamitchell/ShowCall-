# Phase 3 — UI: Preview and Apply Workflow

Source: docs/features/0030_PLAN.md (Phase 2B)

## Goal
Enable planners to auto-assign via heuristic, review a diffed preview per requirement, make manual adjustments, and apply changes.

## Deliverables
- Update `ui/src/pages/Scheduling.tsx`:
  - Add an “Auto-Assign” button in the shift drawer header (visible when requirements exist)
- New component `ui/src/components/AssignmentPreviewDialog.tsx`:
  - Props: `{ departmentId, scheduleId|eventId, preview, onApply }`
  - Groups by shift → requirement; shows chosen candidate, change badge, coverage status, score deltas
  - Rows clickable to open existing assignment picker for overrides prior to apply
- Extend `ui/src/lib/serverComm.ts` with:
  - `runScheduling`
  - `commitScheduling`
  - `listShiftRequirements`
  - `createShiftRequirement`
  - `updateShiftRequirement`
  - `deleteShiftRequirement`
- Component tests

## UX Notes
- Only show “Auto-Assign” when there are `shift_requirements` for the selected shift(s)
- Offer “Regenerate” to run with a new rngSeed
- Offer “Export CSV” from the preview dialog
- Indicate feasibility errors and underfill clearly

## API Contracts (used by UI)
- Run: returns `{ runId, objective, assignments[], diffs }`
- Commit: accepts `{ runId }` or explicit `{ result }`
- Explain: per shift candidate lists with score breakdowns
- Requirements CRUD: as defined server-side

## Tests (UI)
- `AssignmentPreviewDialog` renders proposed changes and calls `commitScheduling`
- `Scheduling.tsx` shows Auto-Assign button only when requirements exist

## Acceptance Criteria
- End-to-end preview → apply works against dev server
- Manual overrides prior to apply are persisted correctly
- Coverage indicators reflect requirements satisfaction post-commit

## Risks/Mitigations
- Inconsistent time zones in display: ensure consistent formatting and server UTC
- Large previews: virtualize lists if needed; paginate by day or event
- Permissioning: reuse existing auth/role checks for assignments endpoints
