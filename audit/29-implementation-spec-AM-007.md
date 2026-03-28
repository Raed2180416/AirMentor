# AirMentor Implementation Spec AM-007

## Problem statement
Curriculum linkage is useful but operationally brittle because it spans admin-structure logic, graph heuristics, optional Python, and optional local-model inference.

## Exact code locations
- `air-mentor-api/src/modules/admin-structure.ts`
- `air-mentor-api/src/lib/curriculum-linkage.ts`
- `air-mentor-api/src/lib/curriculum-linkage-python.ts`
- `air-mentor-api/scripts/curriculum_linkage_nlp.py`
- `air-mentor-api/src/lib/graph-summary.ts`

## Root cause
Linkage quality and automation were layered into the admin module without a separately monitored service boundary.

## Full dependency graph
- curriculum bootstrap/config -> admin-structure
- candidate generation/regeneration -> linkage helpers
- optional NLP/model assist -> Python wrapper / OLLAMA
- approval -> batch-side effects and possible proof refresh

## Affected user journeys
- curriculum bootstrap
- linkage candidate review
- candidate approval/rejection
- downstream proof refresh after approval

## Risk if left unfixed
- fragile candidate generation
- opaque failure modes
- weak operator trust in linkage quality

## Target future architecture or behavior
- isolated linkage service boundary
- explicit provenance and fallback reporting
- health and error telemetry
- clearer admin feedback on what will happen after approval

## Concrete refactor or fix plan
1. Extract linkage candidate generation into its own service module.
2. Standardize output provenance:
   - deterministic only
   - Python-assisted
   - local-model-assisted
3. Emit health and approval side-effect events.
4. Expose fallback state to the admin UI.

## Sequencing plan
- after AM-008 measurement work
- can proceed independently of most frontend refactors
- coordinate proof refresh side effects with AM-011

## Migration strategy
- keep current routes stable
- migrate internal generation pipeline behind unchanged route handlers
- preserve deterministic fallback at all times

## Testing plan
- curriculum feature config tests
- proof engine tests touching linkage
- targeted tests for fallback/provenance states
- admin workflow smoke around candidate review and approval

## Rollout plan
- release provenance/health visibility first
- isolate service boundary second
- optimize model-assisted path only after fallback confidence is high

## Fallback / rollback plan
- always retain deterministic candidate generation
- disable Python or model-assisted path without disabling linkage routes

## Acceptance criteria
- linkage service boundary exists outside `admin-structure.ts`
- admins can see provenance and fallback state
- approval side effects are observable
- deterministic fallback remains available

## Open questions
- What quality signal should decide whether model assistance is worth using?
- Should linkage approval block when proof refresh enqueue fails?

## Complexity and change risk
- Complexity: L
- Risk of change: Medium
- Prerequisite issues: AM-008
- Downstream issues unblocked: AM-011

