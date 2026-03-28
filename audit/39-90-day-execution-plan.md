# AirMentor 90-Day Execution Plan

## What this area does
This document turns the issue catalog and implementation specs into a 90-day delivery program with sequencing, parallel workstreams, owners, metrics, and expected outcomes.

## Confirmed observations
- AirMentor’s highest-risk issues are cross-layer amplifiers. The first 30 days should improve measurement and change safety before the riskiest refactors intensify.
- The program naturally separates into four workstreams:
  - platform observability and CI
  - frontend shell decomposition and state clarity
  - backend/proof modularization
  - UX/accessibility and workflow trust

## Current-state reconciliation (2026-03-28)
- This document is now best read as the original execution baseline, not the literal current plan.
- Current stage reality:
  - measurement/CI, restore-state clarity, frontend shell splits, backend academic route splits, and core session hardening are materially landed
  - proof-control-plane decomposition is partway through
  - runtime/proof normalization and full Stage 7 closeout are still open
- The active execution horizon is now better represented by:
  - [16 Recommended Remediation Roadmap](./16-recommended-remediation-roadmap.md)
  - [41 Current-State Reconciliation And Gap Analysis](./41-current-state-reconciliation-and-gap-analysis.md)

## Key workflows and contracts
### Suggested ownership model
- Platform / DevEx engineer: AM-008, AM-013, AM-015
- Frontend staff engineer: AM-001 frontend slice, AM-002, AM-009, AM-014
- Backend / systems engineer: AM-001 backend slice, AM-003, AM-004, AM-012, AM-016
- Proof / ML-platform engineer: AM-005, AM-006, AM-007, AM-011
- Product / design partner: AM-005, AM-009, AM-014 acceptance wording and trust framing

### Program scorecard
| Phase window | Primary issues | Suggested owners | Dependencies entering the phase | Measure before | Success metrics after |
| --- | --- | --- | --- | --- | --- |
| Weeks 1-2 | AM-008, AM-013, AM-015 | Platform / DevEx, backend, proof owner | none | current CI cadence, current proof smoke cadence, deploy skip/no-op visibility, startup failure modes | dedicated verification workflow exists, core telemetry lands, deploy skips are explicit |
| Weeks 3-4 | AM-001, AM-002, AM-014 | Frontend, backend, product/design | measurement and baseline suites from weeks 1-2 | restore-state surprises, request-flow friction points, giant-file touch frequency | restore behavior is visible, request-flow smoke stays green, first frontend shell seams are in place |
| Weeks 5-6 | AM-001, AM-006, AM-004 | Backend, proof/ML, frontend reviewer | stable telemetry and proof/admin baseline coverage | proof payload parity, access-denial behavior, module hotspot size | smaller route/proof boundaries exist, access behavior remains stable, proof smoke stays green |
| Weeks 7-8 | AM-003, AM-012, AM-002 | Backend, DB/migration owner, frontend | shell seams from weeks 3-6 | bootstrap payload size, sync payload size, save/reload fidelity | first narrow sync contracts land, one JSON family is no longer JSON-only authority |
| Weeks 9-10 | AM-005, AM-007, AM-011 | Proof/ML, backend, product/design | proof telemetry and service seams | queue freshness, run completion latency, linkage provenance visibility | queue-health surfacing exists, proof-limit messaging is clearer, linkage provenance is explicit |
| Weeks 11-12 | AM-009, AM-010, AM-016 | Frontend, platform, security-minded backend owner | CI and diagnostics in place | keyboard-path friction, repo drift inventory, current login/session posture | accessibility checks run regularly, repo drift is reduced, hardened session controls land safely |

### Operating cadence
- Weekly:
  - review telemetry, smoke failures, and blocked dependencies
  - update the feature matrix when a feature’s owner, endpoint, or risk profile changes
- Every 2 weeks:
  - close or re-scope the active implementation specs
  - re-run the highest-value proof/admin smokes before promoting the next phase
- Before each phase starts:
  - confirm baseline metrics are captured
  - confirm rollback triggers for the phase’s highest-risk change

### Weeks 1-2
- Goals:
  - install measurement and verification scaffolding
  - lock a trusted baseline
- Primary issues:
  - AM-008
  - AM-013
  - AM-015
- Work:
  - add explicit CI workflow for lint/build/tests
  - promote `verify:proof-closure` and `verify:proof-closure:proof-rc`
  - add startup diagnostics for env/cookie/origin requirements
  - define queue, bootstrap, login, proof-load, and linkage telemetry events
- Before/after measures:
  - proof closure suite cadence
  - deploy skip/no-op visibility
  - availability of queue/load failure telemetry

### Weeks 3-4
- Goals:
  - create safe refactor seams
  - reduce hidden state surprises
- Primary issues:
  - AM-001
  - AM-002
  - AM-014
- Work:
  - carve route/load shells from `src/system-admin-live-app.tsx`
  - isolate proof-playback and route-restore adapters
  - add visible restore-state banners and request-action consequence copy
- Parallelizable:
  - frontend restore UX and request UX can run beside backend telemetry finishing work
- Success metrics:
  - reduced direct edits to giant files for new work
  - restore-state behavior visible in UI
  - request-flow acceptance script remains green

### Weeks 5-6
- Goals:
  - break academic/backend hotspot boundaries
  - reduce proof/control-plane coupling
- Primary issues:
  - AM-001
  - AM-006
  - AM-004
- Work:
  - split `academic.ts` into bootstrap/faculty profile, proof routes, runtime sync, and admin-style write surfaces
  - introduce central proof access evaluators shared by route layers
  - extract checkpoint assembly and student-shell/risk-explorer composition seams from `msruas-proof-control-plane.ts`
- Success metrics:
  - smaller module ownership boundaries
  - no behavior regressions on proof, HoD, and faculty-profile acceptance flows

### Weeks 7-8
- Goals:
  - establish authoritative state boundaries
  - reduce JSON/sync fragility
- Primary issues:
  - AM-003
  - AM-012
  - AM-002
- Work:
  - narrow runtime sync contracts for at least one slice each: tasks, placements, calendar
  - define server/browser ownership matrix
  - normalize or strongly type the most operationally important snapshot fields
- Success metrics:
  - fewer whole-slice writes
  - lower bootstrap payload size for targeted screens
  - fewer ambiguous restore/fallback paths

### Weeks 9-10
- Goals:
  - improve proof trust and operability
  - isolate curriculum linkage risk
- Primary issues:
  - AM-005
  - AM-007
  - AM-011
- Work:
  - add queue-health indicators and stale-state surfacing
  - clarify probability suppression and blocked-stage explanations
  - isolate linkage health, fallback, provenance, and approval metrics
- Success metrics:
  - queue and checkpoint latency visible
  - fewer opaque proof failures
  - clearer user understanding of proof limits

### Weeks 11-12
- Goals:
  - harden security and improve usability polish
  - clean repo surface and complete migration watchouts
- Primary issues:
  - AM-009
  - AM-010
  - AM-016
- Work:
  - add keyboard/a11y regression checks on critical flows
  - remove/archive dead artifacts and clearly label retained experimental surfaces
  - add login rate limiting, secure-cookie enforcement for production, and stronger abuse monitoring
- Success metrics:
  - accessibility checks in regular verification
  - reduced repo drift surface
  - explicit security posture for production deployments

## Findings
### Parallel workstreams
- Workstream 1: observability + CI + environment diagnostics
- Workstream 2: frontend shell/state refactor
- Workstream 3: backend/proof modularization
- Workstream 4: UX/accessibility/hardening

### Dependency sequencing
- Hardest dependency chain:
  - AM-008 and AM-013 first
  - then AM-001 / AM-006 scaffolding
  - then AM-003 / AM-012 state-contract work
- Low-risk parallel stream:
  - AM-014 + AM-009 user-facing clarity improvements can progress while deep refactors are underway

## Implications
- The plan is front-loaded on measurement because otherwise the proof and state refactors will be hard to validate safely.
- Success should be judged by both engineering outcomes and user-trust outcomes, not by code movement alone.

## Recommendations
1. Review the implementation specs before starting each 2-week block and lock acceptance criteria up front.
2. Treat proof flows and state-authority changes as release-worthy increments with rollback plans.
3. Keep feature-matrix ownership current so every changed feature has a named acceptance owner.

## Confirmed facts vs inference
### Confirmed facts
- This sequencing is consistent with the verified issue dependencies in the current audit.

### Strongly supported inference
- A 90-day plan can materially reduce AirMentor’s change-failure rate if AM-008 and AM-013 are not deferred.

## Cross-links
- [16 Recommended Remediation Roadmap](./16-recommended-remediation-roadmap.md)
- [21 Feature Inventory And Traceability Matrix](./21-feature-inventory-and-traceability-matrix.md)
- [40 Risk Register And Migration Watchouts](./40-risk-register-and-migration-watchouts.md)
- [41 Current-State Reconciliation And Gap Analysis](./41-current-state-reconciliation-and-gap-analysis.md)
