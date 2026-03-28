# AirMentor Implementation Spec AM-006

## Problem statement
`msruas-proof-control-plane.ts` is a mega-module owning proof execution, payload shaping, student shell, risk explorer, and HoD analytics.

## Exact code locations
- `air-mentor-api/src/lib/msruas-proof-control-plane.ts`
- `air-mentor-api/src/modules/admin-proof-sandbox.ts`
- `air-mentor-api/src/modules/academic.ts`
- supporting proof libs: `proof-run-queue.ts`, `proof-risk-model.ts`, `inference-engine.ts`, `monitoring-engine.ts`

## Root cause
The proof system grew around one successful orchestration layer instead of around smaller service boundaries.

## Full dependency graph
- admin proof routes -> proof-control-plane
- academic proof routes -> proof-control-plane
- queue worker -> proof-control-plane run execution
- student shell / risk explorer / HoD analytics -> proof-control-plane payload builders

## Affected user journeys
- proof import/run/retry/restore
- faculty proof panel
- HoD proof analytics
- student shell
- risk explorer

## Risk if left unfixed
- highest architectural bottleneck in the repo
- slow proof feature delivery
- high regression risk in trust-sensitive surfaces

## Target future architecture or behavior
- separate proof services for:
  - run execution
  - checkpoint assembly
  - HoD analytics
  - faculty proof payloads
  - risk explorer payloads
  - student shell composition

## Concrete refactor or fix plan
1. Freeze proof payload and route contracts with tests.
2. Extract read-only builders first:
   - risk explorer
   - student shell
   - HoD analytics
3. Extract execution/orchestration:
   - run start/rebuild
   - checkpoint assembly
4. Leave a façade module temporarily to keep call sites stable.

## Sequencing plan
- after AM-008 and AM-013
- in parallel with AM-001 backend split
- before deeper proof trust/operability refinements

## Migration strategy
- extract pure builders first
- route modules continue calling the façade until all builders are moved
- keep deterministic outputs identical during the split

## Testing plan
- `msruas-proof-engines.test.ts`
- `proof-risk-model.test.ts`
- `policy-phenotypes.test.ts`
- `proof-queue-governance.test.ts`
- proof smoke
- risk explorer and student shell tests

## Rollout plan
- merge one builder/service at a time
- gate behavior-preserving refactors behind unchanged route outputs

## Fallback / rollback plan
- retain façade and old implementations until parity is proven
- revert specific extracted services independently if output drift appears

## Acceptance criteria
- proof-control-plane loses at least three distinct feature responsibilities
- proof smoke remains green
- student shell and risk explorer outputs stay stable or intentionally improved
- route modules no longer rely on one mega-module for all proof behavior

## Open questions
- Which service split should come first: execution or read-model composition?
- Should proof model artifact access remain in admin-proof-sandbox or move beside proof services?

## Complexity and change risk
- Complexity: XL
- Risk of change: High
- Prerequisite issues: AM-008, AM-013
- Downstream issues unblocked: AM-005, AM-007, AM-011

