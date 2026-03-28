# AirMentor Performance Scalability And Reliability Audit

## What this area does
This document audits runtime cost, bootstrap behavior, payload size, worker reliability, and scaling limits in both the frontend and backend.

## Confirmed observations
- Frontend manual chunking in `vite.config.ts` separates React, motion, lucide, and shared app code, but the largest runtime components still remain large logical bundles.
- `src/App.tsx` and `src/system-admin-live-app.tsx` centralize a wide range of state and rendering concerns, increasing rerender and change-coupling cost.
- The backend proof worker in `air-mentor-api/src/lib/proof-run-queue.ts` polls every 5 seconds, uses a 60-second lease, and heartbeats every 15 seconds.
- Proof dashboard and checkpoint flows can trigger recompute or prewarm behavior, as seen both in code and in `scripts/system-admin-proof-risk-smoke.mjs`.
- Proof dashboard payloads now expose queue age, lease state, retry/failure state, and checkpoint-readiness diagnostics.
- Academic runtime still exposes full-slice sync endpoints, but additive narrow task, placement, and calendar-audit routes now also exist.
- Local live-stack verification uses embedded Postgres, dynamic port allocation, readiness-file polling, and same-origin Vite proxying, which improves local reproducibility but creates another parity layer to maintain.

## Key workflows and contracts
### Reliability-sensitive paths
- academic bootstrap
- admin workspace initial hydration
- proof dashboard and checkpoint materialization
- proof run queue claiming and lease management
- full-slice runtime sync from the frontend
- curriculum linkage regeneration and proof refresh enqueue behavior

## Current-state reconciliation (2026-03-28)
- Reliability observability is materially better than in the first pass:
  - queue/lease/retry/failure/checkpoint diagnostics now exist in the proof dashboard contract
  - startup diagnostics and structured telemetry now exist on both frontend and backend
  - scheduled proof/browser cadence now exists in CI
- The remaining Stage 5 performance/reliability risk is contract duplication: both the coarse `/sync` runtime writes and the narrower replacements are live.

## Findings
### Strengths
- The queue worker uses lease-based claiming and heartbeat renewal instead of a naive in-memory FIFO queue.
- Frontend build output already has some chunking awareness.
- Proof run recompute is exposed as an explicit endpoint rather than being silently triggered everywhere.

### Weaknesses
- Large orchestrator components and broad bootstrap responses will get progressively more expensive as more institutional data accumulates.
- Queue reliability is more observable than before, but still not fully operationalized outside the product surface. External metrics and alerting are still absent.
- Coarse full-slice sync contracts are simple to implement but scale poorly under larger or more concurrent runtime edits, and coexistence with the narrower routes creates temporary drift risk.

## Implications
- **Performance consequence:** current seeded data is manageable, but larger institutions will stress admin hydration and academic bootstrap more than the current tests reveal.
- **Reliability consequence:** queue failures may present as “proof data missing” in the UI without enough metadata to tell whether the issue is queue stall, recompute failure, or scope filtering.
- **Scalability consequence:** the current design is good enough for controlled demo and pilot scale, not obviously hardened for materially larger institutions or heavier concurrent proof usage.

## Recommendations
- Add per-surface loading telemetry and payload-size logging for admin and academic bootstrap endpoints.
- Keep tracking queue metrics and calibrate thresholds: queued runs, lease age, retry count, failure code distribution, checkpoint materialization time.
- Decompose broad bootstrap endpoints into cacheable domain segments where the user journey does not require a single all-in-one response.
- Finish the runtime-contract cutover so route and feature cost can be measured without dual-write ambiguity, and keep reducing giant UI orchestrators so rendering cost can be scoped by route and feature.

## Confirmed facts vs inference
### Confirmed facts
- Queue polling and lease timings are exactly as defined in `proof-run-queue.ts`.
- Academic runtime sync uses coarse endpoints for tasks, placements, and calendar audit.
- Proof smoke scripts explicitly prewarm imports, validate, review mappings, approve, and create runs when necessary.

### Reasonable inference
- Most performance pain today is likely cognitive and architectural rather than pure CPU or DB throughput, but the same design choices will become throughput problems at larger scale.

## Cross-links
- [03 Frontend Audit](./03-frontend-audit.md)
- [04 Backend Audit](./04-backend-audit.md)
- [08 State Management And Client Logic Audit](./08-state-management-and-client-logic-audit.md)
- [09 Testing Quality And Observability Audit](./09-testing-quality-and-observability-audit.md)
- [15 Issue Catalog Prioritized](./15-issue-catalog-prioritized.md)
- [19 Deterministic Rules And Operating Assumptions](./19-deterministic-rules-and-operating-assumptions.md)
- [41 Current-State Reconciliation And Gap Analysis](./41-current-state-reconciliation-and-gap-analysis.md)
