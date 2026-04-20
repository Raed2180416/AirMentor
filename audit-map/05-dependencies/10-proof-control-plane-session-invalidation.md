# Dependency: Proof Control Plane Session Invalidation

## Context
`air-mentor-api/src/lib/msruas-proof-control-plane.ts` now directly mutates `sessions` and `roleGrants` for proof faculty lifecycle management.

## Downstream Effect
- `archiveProofSimulationRun` -> deletes scoped sessions.
- `activateProofSimulationRun` -> deletes scoped sessions.

## Risk
Must maintain strict scoping to avoid clearing live users or admins.
