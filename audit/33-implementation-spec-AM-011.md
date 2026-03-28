# AirMentor Implementation Spec AM-011

## Problem statement
The proof-run worker is a core subsystem for proof freshness and checkpoint availability, but its health is mostly inferred through code understanding, admin troubleshooting, and smoke-script prewarming instead of first-class operator visibility.

## Exact code locations
- Queue engine:
  - `air-mentor-api/src/lib/proof-run-queue.ts`
  - `WORKER_POLL_MS`
  - `WORKER_LEASE_MS`
  - `WORKER_HEARTBEAT_MS`
  - `enqueueProofSimulationRun`
  - `retryQueuedProofSimulationRun`
  - `startProofRunWorker`
- App lifecycle:
  - `air-mentor-api/src/app.ts`
  - `startProofRunWorker(...)`
- Operator-facing proof routes:
  - `air-mentor-api/src/modules/admin-proof-sandbox.ts`
  - `/api/admin/batches/:batchId/proof-dashboard`
  - `/api/admin/proof-runs/:simulationRunId/retry`
  - `/api/admin/proof-runs/:simulationRunId/recompute-risk`
  - `/api/admin/proof-runs/:simulationRunId/restore-snapshot`
- Operational evidence:
  - `scripts/system-admin-proof-risk-smoke.mjs`

## Root cause
The worker mechanics are implemented correctly enough to function, but the subsystem matured without equivalent investment in queue telemetry, stale-state UX, or operator dashboards.

## Full dependency graph
- admin proof actions -> `enqueueProofSimulationRun` / retry / recompute endpoints
- worker startup in `app.ts` -> claim / heartbeat / finalize / fail paths in `proof-run-queue.ts`
- completed or failed runs -> proof dashboard -> faculty proof panel / HoD analytics / student shell / risk explorer
- missing checkpoints -> smoke-script prewarm and admin intervention

## Affected user journeys
- proof import approval and proof run creation
- proof dashboard checkpoint playback
- faculty proof panel load
- student shell and risk explorer load on active run data
- HoD proof analytics based on active proof freshness

## Risk if left unfixed
- stuck or stale proof runs remain hard to diagnose
- proof pages present “missing data” symptoms that actually originate in queue state
- operators keep needing manual requeue and prewarm behavior
- flagship proof trust stays dependent on expert intervention

## Target future architecture or behavior
- queue lifecycle is observable with explicit age, phase, lease, retry, and checkpoint-readiness metrics
- admin proof UI surfaces stale or incomplete proof state directly
- worker failures are visible before users notice missing proof payloads

## Concrete refactor or fix plan
1. Instrument queue lifecycle events:
   - queued
   - claimed
   - heartbeat extended
   - completed
   - failed
   - retried
2. Add proof dashboard summary fields for:
   - queue age
   - last successful checkpoint materialization time
   - retry count
   - stale-state banner inputs
3. Distinguish “no proof exists” from “proof exists but checkpoint materialization is stalled.”
4. Add lightweight operator controls or diagnostics before deeper worker changes.
5. Update smoke scripts to assert the new operator signals rather than silently compensating for them.

## Sequencing plan
- Start after AM-008 telemetry scaffolding is available.
- Land queue metrics before any deeper queue-behavior refactor.
- Coordinate with AM-006 because proof control-plane extraction will depend on clearer worker contracts.

## Migration strategy
- Additive first:
  - metrics
  - dashboard fields
  - stale-state messaging
- Avoid changing worker timing constants until observability exists.

## Testing plan
- Unit tests for queue lifecycle emission and stale-state calculations.
- Backend tests for retry, failure, and recompute flows.
- Proof smoke updates to assert queue diagnostics and checkpoint readiness messaging.

## Rollout plan
- Ship backend metrics and dashboard fields first.
- Then ship UI stale-state banners and operator-facing queue diagnostics.
- Only then consider worker-timing or claim-policy changes.

## Fallback / rollback plan
- Observability changes are additive and can be dark-launched.
- If stale warnings are noisy, keep the metrics and roll back only the UI thresholds.

## Acceptance criteria
- Operators can distinguish queued, running, failed, and stale proof runs without reading raw DB state.
- Proof dashboard shows queue-health and checkpoint-readiness signals.
- Smoke scripts no longer need to be the first place where checkpoint absence is discovered.
- Queue retry and failure paths are covered by automated checks.

## Open questions
- Does the team want a dedicated queue page, or are proof dashboard diagnostics sufficient?
- Which stale threshold is operationally meaningful for seeded local runs versus production-like environments?

## Complexity and change risk
- Complexity: M
- Risk of change: Medium
- Prerequisite issues: AM-008
- Downstream issues unblocked: AM-006, AM-013
