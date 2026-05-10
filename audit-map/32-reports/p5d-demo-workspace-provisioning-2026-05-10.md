# AirMentor P5-D Demo Workspace Provisioning — 2026-05-10

## Intent

College evaluator can create a local demo workspace with seeded MSRUAS academic/proof data and a demo-bound active proof run while global proof state remains untouched.

## Implementation

- Added `POST /api/admin/demo-workspaces/:demoWorkspaceId/provision`.
- Provisioning clones seeded MSRUAS academic root rows into deterministic demo-prefixed IDs.
- Demo-visible students, enrollments, offerings, mentor assignments, and offering ownerships are tagged with `demoWorkspaceId`.
- Provisioning clones seeded proof-source artifacts for the demo run, including observed states, risk evidence, risk assessments, teacher allocations, question/CO/topic state, interventions, transcript rows, and elective rows.
- Provisioning rebuilds demo-bound playback checkpoints/projections from the cloned proof-source artifacts using the existing playback rebuild engine.
- Provisioning creates a demo-bound active simulation run without deactivating or replacing the global active proof run.
- Provisioning is idempotent for an already provisioned workspace.
- Reset deletes demo-bound sessions, cloned academic rows, cloned proof artifacts, generated playback artifacts, demo-bound runs, and physical demo schema while leaving global rows intact.

## Verification

- `npx --no-install vitest run tests/demo-isolation.test.ts --reporter=dot --testTimeout=300000` — PASS: 17 tests / 1 file in 104.17s.
- `npx --no-install vitest run tests/demo-isolation.test.ts tests/proof-control-plane-seeded-bootstrap-service.test.ts tests/proof-control-plane-playback-reset-service.test.ts --reporter=dot --testTimeout=300000` — PASS: 22 tests / 3 files in 104.65s.
- `npx --no-install tsc -p tsconfig.json --noEmit --pretty false` — PASS: exit 0.

## Claim Boundary

P5-D proves local seeded demo workspace provisioning/reset under current `demoWorkspaceId` guards for demo academic rows, cloned seeded proof-source artifacts, generated playback checkpoints/projections, demo sessions, and demo-bound active proof runs. It does not claim broad physical schema routing for every table, multi-program templates, browser E2E completion for this new route, production deployment readiness, real-data validation, or production ML validity.
