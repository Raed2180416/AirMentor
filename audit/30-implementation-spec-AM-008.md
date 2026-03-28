# AirMentor Implementation Spec AM-008

## Problem statement
AirMentor lacks production-quality observability for login, bootstrap, proof, linkage, queue, and UX failure states.

## Exact code locations
- backend hotspots:
  - `air-mentor-api/src/app.ts`
  - `air-mentor-api/src/modules/session.ts`
  - `air-mentor-api/src/modules/academic.ts`
  - `air-mentor-api/src/modules/admin-proof-sandbox.ts`
  - `air-mentor-api/src/lib/proof-run-queue.ts`
- frontend hotspots:
  - `src/App.tsx`
  - `src/system-admin-live-app.tsx`
  - proof pages

## Root cause
The platform grew around seeded tests and smoke scripts rather than around runtime telemetry and operator dashboards.

## Full dependency graph
- auth -> session routes -> app logs
- bootstrap -> academic/admin shells -> user-visible load failures
- proof runs -> queue worker -> proof routes -> proof pages
- linkage -> admin-structure -> proof refresh side effects

## Affected user journeys
- login and restore session
- academic and admin initial load
- proof dashboard, student shell, risk explorer, HoD analytics
- linkage approval and proof refresh

## Risk if left unfixed
- weak incident detection
- weak prioritization data
- hard-to-verify refactors
- slower recovery when proof state degrades

## Target future architecture or behavior
- structured event stream for:
  - login failures
  - bootstrap failures
  - proof-run lifecycle
  - queue latency/stalls
  - shell/explorer load errors
  - linkage generation and approval outcomes

## Concrete refactor or fix plan
1. Define canonical telemetry event names and payload shape.
2. Instrument backend route hotspots and queue transitions.
3. Instrument frontend load failures and key user actions.
4. Add queue/bootstrapping dashboards and alert thresholds.
5. Feed acceptance and rollout criteria from observed metrics.

## Sequencing plan
- do first
- finish before large orchestrator and proof refactors

## Migration strategy
- additive only at first
- no behavior changes required to land instrumentation

## Testing plan
- unit tests for event emission helpers
- smoke assertions that instrumentation does not break routes
- manual verification of emitted events in dev/live runs

## Rollout plan
- land backend events first
- then frontend events
- then dashboards/alerts

## Fallback / rollback plan
- telemetry is additive; disable noisy events via config if needed without reverting functional changes

## Acceptance criteria
- key platform events are emitted for login, bootstrap, proof-run create/claim/fail/succeed, shell/risk-explorer load failure, and linkage approval
- at least one operator-facing queue or proof-health view exists
- execution specs can cite live metrics, not only narrative risk

## Open questions
- Which telemetry sink is the team willing to operate?
- What is the minimum viable alerting threshold for proof queue health?

## Complexity and change risk
- Complexity: M
- Risk of change: Medium
- Prerequisite issues: none
- Downstream issues unblocked: AM-001, AM-003, AM-006, AM-007, AM-011, AM-013, AM-015, AM-016

