# AirMentor Implementation Spec AM-001

## Problem statement
Runtime behavior is concentrated in four oversized orchestrators, which makes small changes cross-layer and hard to reason about.

## Exact code locations
- Frontend:
  - `src/App.tsx`
  - `src/system-admin-live-app.tsx`
- Backend:
  - `air-mentor-api/src/modules/academic.ts`
  - `air-mentor-api/src/lib/msruas-proof-control-plane.ts`
- Supporting dependencies:
  - `src/repositories.ts`
  - `src/api/client.ts`
  - `src/system-admin-live-data.ts`

## Root cause
Feature growth accumulated inside already-successful orchestration files instead of being extracted into bounded domain modules once the product model stabilized.

## Full dependency graph
- Academic shell -> repositories -> API client -> `academic.ts` -> proof/control-plane libs -> DB schema
- Admin shell -> `system-admin-live-data.ts` -> API client -> `admin-control-plane.ts` / `admin-structure.ts` / `admin-proof-sandbox.ts` -> DB schema
- Proof surfaces -> `App.tsx` / `system-admin-live-app.tsx` -> `academic.ts` / `admin-proof-sandbox.ts` -> `msruas-proof-control-plane.ts`

## Affected user journeys
- portal selection and login
- academic bootstrap and faculty profile
- task/calendar/workflow editing
- admin hierarchy drill-down
- proof dashboard and checkpoint playback
- HoD analytics, student shell, and risk explorer

## Risk if left unfixed
- higher regression rate
- slower feature delivery
- harder onboarding and code ownership
- wider blast radius for every proof or state change

## Target future architecture or behavior
- thin UI route shells
- domain-specific state loaders
- backend route registrars split by capability
- proof composition split into smaller services for checkpoint assembly, HoD analytics, risk explorer, and student shell

## Concrete refactor or fix plan
1. Freeze existing route and payload contracts with tests.
2. Extract pure selectors, serializers, and mappers from the giant files.
3. Introduce new frontend shells:
   - academic auth/bootstrap shell
   - teaching runtime shell
   - admin route/load shell
   - proof shell
4. Introduce new backend registrars/services:
   - academic bootstrap/faculty profile
   - proof endpoints
   - runtime sync
   - admin-style write surfaces currently hiding in `academic.ts`
5. Move proof composition out of `msruas-proof-control-plane.ts` behind unchanged function boundaries first, then collapse the old façade.

## Sequencing plan
- First: AM-008 and AM-013 guardrails in place.
- Then split `src/system-admin-live-app.tsx` and `src/App.tsx`.
- Then split `academic.ts`.
- Then split `msruas-proof-control-plane.ts`.

## Migration strategy
- Preserve existing route URLs and payload shapes during refactor.
- Add adapter exports so old call sites still compile while code moves.
- Migrate one domain slice at a time and keep compatibility wrappers until acceptance flows pass.

## Testing plan
- existing frontend tests
- existing backend route tests
- proof smoke
- live admin acceptance
- request flow
- admin-to-teaching parity smoke
- add file-boundary unit tests for extracted services

## Rollout plan
- merge in slices by domain, not one mega-refactor
- land frontend shell splits before backend contract changes
- keep proof behavior unchanged until dedicated proof extraction tests are green

## Fallback / rollback plan
- retain compatibility wrappers for extracted modules
- if a split causes functional drift, revert that slice while keeping measurement and test improvements

## Acceptance criteria
- no public route or payload regressions
- proof smoke, request flow, and parity smoke remain green
- `src/App.tsx`, `src/system-admin-live-app.tsx`, `academic.ts`, and `msruas-proof-control-plane.ts` each shed a meaningful domain slice
- new modules have clear ownership boundaries

## Open questions
- Which extracted service boundaries best match team ownership?
- Should proof payload shaping move before or after academic route splitting?

## Complexity and change risk
- Complexity: XL
- Risk of change: High
- Prerequisite issues: AM-008, AM-013
- Downstream issues unblocked: AM-002, AM-003, AM-004, AM-005, AM-006, AM-011, AM-014

