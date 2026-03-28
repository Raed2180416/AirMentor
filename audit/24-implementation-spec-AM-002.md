# AirMentor Implementation Spec AM-002

## Problem statement
Meaningful runtime state is split across React state, backend tables, localStorage, and sessionStorage, creating hidden restore behavior and unclear source of truth.

## Exact code locations
- `src/repositories.ts`
- `src/portal-routing.ts`
- `src/proof-playback.ts`
- `src/system-admin-live-app.tsx`
- `src/App.tsx`
- backend sync in `air-mentor-api/src/modules/academic.ts`

## Root cause
The product migrated from local-first behavior to backend-backed behavior without fully retiring the original persistence model.

## Full dependency graph
- portal routing <- localStorage faculty/admin hints
- proof playback <- localStorage checkpoint selection <- academic bootstrap
- admin route restore <- sessionStorage <- `system-admin-live-app.tsx`
- runtime slices <- `repositories.ts` <- backend sync endpoints and browser cache

## Affected user journeys
- portal reopen and workspace recovery
- admin detail restore after reload
- proof checkpoint reuse after reload
- task/calendar/workflow persistence

## Risk if left unfixed
- hidden navigation behavior
- state overwrite bugs
- harder debugging
- lower user trust in proof and admin flows

## Target future architecture or behavior
- explicit state-ownership matrix
- browser storage limited to low-risk convenience state
- user-visible restore/reset affordances
- proof checkpoint state treated as explicit session context, not hidden ambient state

## Concrete refactor or fix plan
1. Define ownership for every persisted slice:
   - browser only
   - backend only
   - browser cache of backend truth
2. Remove redundant writes for server-owned slices.
3. Move restore logic into one small state-restoration service per portal.
4. Add explicit restore banners with reset actions.
5. Tighten proof-playback invalidation and cross-tab sync behavior behind tested helpers.

## Sequencing plan
- complete after AM-001 shell extraction starts
- align with AM-003 sync-contract narrowing
- coordinate with AM-014 request/restore UX changes

## Migration strategy
- keep current keys readable during migration
- write both old and new representations temporarily if needed
- remove unused keys only after telemetry and acceptance runs confirm no regressions

## Testing plan
- portal routing tests
- repository tests
- multi-tab proof-playback tests
- reload/restore browser smoke assertions
- explicit regression tests for invalid checkpoint fallback

## Rollout plan
- ship visible restore banners first
- migrate one storage family at a time
- keep old keys readable for one release cycle

## Fallback / rollback plan
- keep backward-compatible key readers
- if a restore migration fails, revert writers but keep new UI explanation banners

## Acceptance criteria
- documented ownership matrix exists in code and audit
- restore behavior is visible to users
- at least one redundant browser/server persistence path is removed
- proof-playback fallback remains deterministic and tested

## Open questions
- Which stored slices still deliver enough value to keep?
- Should admin route restore be preserved at all beyond faculties?

## Complexity and change risk
- Complexity: L
- Risk of change: High
- Prerequisite issues: AM-001, AM-003
- Downstream issues unblocked: AM-014, AM-012, AM-015

