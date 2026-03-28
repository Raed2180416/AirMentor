# AirMentor Implementation Spec AM-004

## Problem statement
Authorization and scope logic are correct in many places, but spread across helpers, route modules, proof helpers, and UI visibility code.

## Exact code locations
- `air-mentor-api/src/modules/support.ts`
- `air-mentor-api/src/modules/academic.ts`
- `air-mentor-api/src/modules/admin-control-plane.ts`
- `air-mentor-api/src/lib/msruas-proof-control-plane.ts`
- `src/system-admin-live-data.ts`

## Root cause
Scope constraints evolved feature-by-feature instead of being centralized in reusable domain access evaluators.

## Full dependency graph
- session grants -> `resolveRequestAuth` / `requireRole`
- route-specific scope checks -> academic/admin-control-plane routes
- proof visibility helpers -> proof-control-plane
- frontend empty-state and visibility helpers -> `system-admin-live-data.ts`

## Affected user journeys
- faculty profile access
- HoD proof analytics
- student shell and risk explorer
- admin hierarchy visibility
- faculty calendar writes

## Risk if left unfixed
- access drift
- inconsistent empty states
- harder security review
- harder product reasoning around who should see what

## Target future architecture or behavior
- central access-evaluator layer for:
  - hierarchy visibility
  - proof access
  - faculty/student record visibility
  - calendar workspace editing
- shared policy object for backend enforcement and frontend messaging

## Concrete refactor or fix plan
1. Define access-evaluator interfaces per domain.
2. Move route-local scope checks behind those evaluators.
3. Replace duplicate UI visibility logic with the same policy outputs.
4. Add matrix tests for actor x scope x route family.

## Sequencing plan
- begin after AM-001 creates clearer route boundaries
- tackle proof access first, then admin hierarchy, then UI visibility reuse

## Migration strategy
- wrap existing checks in evaluator functions before deleting old code
- return explicit decision reasons to preserve clear forbidden/empty-state behavior

## Testing plan
- session/auth tests
- proof access tests
- faculty-profile access tests
- new permission matrix tests by role and scope

## Rollout plan
- proof routes first
- then faculty calendar and faculty profile
- then admin hierarchy visibility

## Fallback / rollback plan
- keep old route-local checks available behind feature flags until evaluator parity is proven

## Acceptance criteria
- central evaluator layer exists
- route-local scope code is materially reduced
- UI empty states can cite the same policy decisions as backend enforcement
- access-control tests remain green and expand in coverage

## Open questions
- Should evaluator outputs include user-facing explanation strings directly?
- Which scope domains need separate ownership?

## Complexity and change risk
- Complexity: L
- Risk of change: High
- Prerequisite issues: AM-001
- Downstream issues unblocked: AM-005, AM-016

