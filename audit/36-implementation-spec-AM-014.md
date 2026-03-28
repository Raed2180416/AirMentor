# AirMentor Implementation Spec AM-014

## Problem statement
The admin request workflow functions end to end, but it exposes backend process mechanics more than user intent, and its route persistence and deep-link behavior increase cognitive load on already dense admin surfaces.

## Exact code locations
- Backend transition engine:
  - `air-mentor-api/src/modules/admin-requests.ts`
  - `allowedTransitions`
  - `transitionRequest`
  - `/api/admin/requests/:requestId/request-info`
  - `/api/admin/requests/:requestId/approve`
  - `/api/admin/requests/:requestId/reject`
  - `/api/admin/requests/:requestId/mark-implemented`
  - `/api/admin/requests/:requestId/close`
- Shared support helpers:
  - `air-mentor-api/src/modules/support.ts`
  - `getAdminRequestTransitions`
  - `createAdminRequestTransition`
  - `getAuditEventsForEntity`
- Frontend detail and restore behavior:
  - `src/system-admin-live-app.tsx`
  - `route.requestId`
  - request detail loading
  - workspace history and route persistence
- Acceptance evidence:
  - `scripts/system-admin-live-request-flow.mjs`
  - `scripts/system-admin-live-acceptance.mjs`

## Root cause
The workflow was modeled around a status machine first and only later wrapped in UI copy, so the system is technically explicit but not always user-explanatory.

## Full dependency graph
- request creation and listing -> `admin-requests.ts`
- request detail -> notes + transitions + audit history from `support.ts`
- system-admin route state -> selected request and persisted workspace context
- acceptance scripts -> validate happy-path transitions and persistence

## Affected user journeys
- creating and processing admin requests
- reopening request detail from deep links or restored route state
- understanding next actions on requests in `New`, `In Review`, `Needs Info`, `Approved`, `Rejected`, and `Implemented`
- interpreting audit and note history during operations work

## Risk if left unfixed
- operators keep relying on process memory rather than clear UI guidance
- route restoration continues to feel like hidden state instead of explicit continuity
- request actions remain semantically correct but cognitively heavier than necessary

## Target future architecture or behavior
- request actions are framed around user outcomes and next steps, not only status verbs
- restored request context is explicit
- the detail view emphasizes what to do now, what happened previously, and what each action will change

## Concrete refactor or fix plan
1. Add a frontend action model that maps each status to:
   - available actions
   - consequence text
   - next-step summary
2. Add explicit restore-state messaging when request detail is reopened from persisted context.
3. Reorder request detail so operational summary and next actions appear before long-form audit detail.
4. Preserve the backend transition graph while simplifying UI language.
5. Add status-specific help text for:
   - `Needs Info`
   - `Approved`
   - `Implemented`
   - `Closed`

## Sequencing plan
- Can run in parallel with AM-009 once the route/state model from AM-002 is understood.
- Keep backend status transitions stable while improving frontend framing.

## Migration strategy
- UI-first change for labels, section order, and consequence copy.
- Defer any status-model changes unless user research proves the current graph itself is wrong.

## Testing plan
- Extend the existing request-flow script to validate the new consequence and restore messaging.
- Add frontend tests for request action availability by status.
- Keep backend transition tests stable to prove no process regression.

## Rollout plan
- Ship read-only explanatory UI first.
- Then ship action-label and section-order improvements.
- If needed later, revisit whether status names themselves should change.

## Fallback / rollback plan
- Backend contract remains unchanged, so rollback is mostly UI-only.
- If operators dislike the new copy, revert labels and section ordering without touching transitions.

## Acceptance criteria
- Every request action shows a clear consequence or next-step explanation.
- Restored request detail is visibly identified as restored context.
- The request happy-path script remains green.
- Operators can distinguish status history from current next step without reading the full audit trail.

## Open questions
- Are current status names institutionally fixed, or can they be renamed later?
- Should some request classes get custom next-step language instead of one global mapping?

## Complexity and change risk
- Complexity: M
- Risk of change: Medium
- Prerequisite issues: AM-002
- Downstream issues unblocked: AM-009
