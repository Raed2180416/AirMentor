# AirMentor Implementation Spec AM-003

## Problem statement
AirMentor uses broad bootstrap payloads and coarse whole-slice sync endpoints for important runtime data, increasing drift and overwrite risk.

## Exact code locations
- `air-mentor-api/src/modules/academic.ts`
- `src/App.tsx`
- `src/api/client.ts`
- `src/repositories.ts`
- `air-mentor-api/src/db/schema.ts`

## Root cause
The system optimized for rapid parity between local behavior and live backend behavior instead of narrower operation-level contracts.

## Full dependency graph
- `/api/academic/bootstrap` -> `App.tsx` hydration -> selectors and proof views
- `/api/academic/runtime/:stateKey` and sync endpoints -> repositories -> local state merges
- runtime tables -> large shaped frontend objects -> browser persistence

## Affected user journeys
- academic portal load
- task and placement saves
- calendar audit persistence
- faculty-calendar workspace save

## Risk if left unfixed
- stale overwrites
- slower screens as data grows
- more difficult conflict handling
- harder reasoning about partial failures

## Target future architecture or behavior
- smaller domain loaders
- entity- or operation-scoped writes
- typed server-side ownership for runtime slices
- fewer all-or-nothing payload refreshes

## Concrete refactor or fix plan
1. Measure current bootstrap and sync payloads.
2. Split runtime sync into at least:
   - tasks
   - placements
   - calendar audit
   - faculty workspace
3. Add versioning or conflict metadata per narrower entity family.
4. Replace generic runtime bucket usage where practical.
5. Keep bootstrap composition but move toward route-specific loaders where UX allows it.

## Sequencing plan
- instrumentation first
- then introduce narrower backend contracts
- then migrate repositories/client calls
- then retire whole-slice endpoints where replaced

## Migration strategy
- dual-support old and new endpoints
- shadow-read from the new contract before removing the old one
- migrate one slice family at a time to isolate regressions

## Testing plan
- backend route tests for new contracts
- repository/http tests for partial updates
- seeded academic parity tests
- browser save/reload flows for tasks and calendar

## Rollout plan
- start with the least risky slice, likely calendar audit or task placements
- expand only after payload and regression telemetry are stable

## Fallback / rollback plan
- preserve old whole-slice endpoints until each new slice proves stable
- revert per-slice migration independently if save semantics drift

## Acceptance criteria
- at least one coarse sync endpoint replaced by narrower contracts
- bootstrap payload size measured and reduced for at least one major flow
- no loss of save/reload fidelity in acceptance checks

## Open questions
- Which runtime slice offers the best first migration target?
- How much bootstrap decomposition is acceptable without harming user flow?

## Complexity and change risk
- Complexity: XL
- Risk of change: High
- Prerequisite issues: AM-001, AM-008, AM-013
- Downstream issues unblocked: AM-002, AM-012, AM-010

