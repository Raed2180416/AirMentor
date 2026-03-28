# AirMentor Implementation Spec AM-012

## Problem statement
AirMentor stores many operationally important runtime and proof concepts as JSON snapshots, which weakens relational clarity, makes debugging harder, and blurs which representation is authoritative.

## Exact code locations
- Schema authority:
  - `air-mentor-api/src/db/schema.ts`
  - `academicRuntimeState`
  - `simulationRuns`
  - `studentAgentCards`
  - `studentObservedSemesterStates`
  - `riskEvidenceSnapshots`
  - `simulationResetSnapshots`
- JSON helpers:
  - `air-mentor-api/src/lib/json.ts`
- Snapshot-heavy read/write paths:
  - `air-mentor-api/src/modules/academic.ts`
  - `air-mentor-api/src/lib/msruas-proof-control-plane.ts`
  - `src/repositories.ts`

## Root cause
Snapshot persistence made it faster to ship proof replay, runtime sync, and bounded shell payloads, but those snapshots kept expanding into quasi-authoritative state instead of remaining derived artifacts.

## Full dependency graph
- academic workspace runtime sync -> `academic_runtime_state` JSON blobs
- proof execution and playback -> `simulation_runs` and checkpoint-related payloads
- student shell and risk explorer -> card/evidence snapshot tables
- UI hydration -> `src/repositories.ts` and API payloads -> JSON parse / stringify helpers

## Affected user journeys
- task, placement, and calendar runtime editing
- proof dashboard and checkpoint playback
- student shell card generation
- risk explorer evidence display
- replay and reset workflows

## Risk if left unfixed
- cross-surface drift remains harder to detect
- ad hoc DB inspection and repair stay expensive
- relational constraints cannot protect the most important payload fields
- future migrations become riskier because too much behavior hangs off opaque blobs

## Target future architecture or behavior
- immutable snapshots remain for replay and audit where they add value
- authoritative operational facts move into typed relational columns or narrowly scoped typed stores
- the system can query queue, risk, and runtime state without decoding large JSON payloads first

## Concrete refactor or fix plan
1. Rank snapshot families by operational value and migration pain.
2. Start with the highest-leverage families:
   - `academic_runtime_state`
   - queue- and checkpoint-readiness data needed for proof freshness
   - student shell/risk-explorer summary facts that drive operator views
3. Introduce relational columns or companion tables for the most-used facts.
4. Dual-write relational facts and legacy JSON snapshots during migration.
5. Convert read paths to prefer normalized facts and fall back to snapshots only where replay fidelity is required.

## Sequencing plan
- Do after AM-001 and AM-003 create cleaner boundaries.
- Coordinate with AM-011 so queue-health facts are normalized in the same migration family.
- Keep proof payload refactors from AM-006 aligned with the new normalized sources.

## Migration strategy
- Migrate one snapshot family at a time.
- Backfill from existing JSON records before switching reads.
- Keep immutable snapshot storage for replay and audit even after operational facts are normalized.

## Testing plan
- Migration tests that compare normalized facts against existing JSON source rows.
- Route tests proving payload parity before and after normalization.
- Backfill validation queries for nulls, count mismatches, and stale dual-write drift.

## Rollout plan
- Stage 1: introduce relational facts and backfill.
- Stage 2: dual-write and shadow-read.
- Stage 3: switch authoritative reads.
- Stage 4: trim legacy snapshot dependence where safe.

## Fallback / rollback plan
- Maintain snapshot writes during early migration phases.
- If normalized reads drift, revert to snapshot-backed reads while preserving backfilled columns for later retry.

## Acceptance criteria
- At least one major runtime slice and one major proof slice stop depending on JSON blobs as their sole authoritative state.
- Operators can query the most important status facts without decoding opaque payloads.
- Backfill and dual-write validation shows no material drift.
- Replay and audit behavior remain intact.

## Open questions
- Which snapshot family yields the best leverage first: runtime-state sync or proof card/evidence caches?
- Does the team prefer typed JSON columns plus validation for some domains instead of full normalization?

## Complexity and change risk
- Complexity: XL
- Risk of change: High
- Prerequisite issues: AM-001, AM-003
- Downstream issues unblocked: AM-002, AM-006, AM-011
