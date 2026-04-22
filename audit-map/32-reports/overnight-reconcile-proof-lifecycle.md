# Overnight Reconcile: Proof Lifecycle

## Findings

Docs vs code vs auth-prompt mismatch -> lifecycle semantics fragmented. Setup-draft -> active-run -> completed-inspectable path firm in code, fuzzy in docs. Date/stage authority split -> server must be single source of truth. Frozen appendix respected (no changes to final-decision-appendix.md).

- Setup-draft: mutable config, no locked date.
- Active-run: locked config, date driven by stage progression.
- Completed-inspectable: immutable read-only state.
- Stopped: aborted mid-flight, requires discrete recovery.
- Reset: surgical (current-stage) vs destructive (complete-reset).

## Ledger

claim_id | intent_section | current_doc (file:line) | current_code (file:line) | resolved_rule | files_to_change | validation_hook
--- | --- | --- | --- | --- | --- | ---
C01 | B.1 | docs/closeout/stage-07a-semester-activation-contract-and-seeded-data.md:10 | air-mentor-api/src/lib/proof-control-plane-activation-service.ts:20 | Server dictates date authority strictly. | audit-map/14-reconciliation/contradiction-matrix-proof-lifecycle.md | check-date-auth
C02 | C.1 | docs/closeout/stage-07b-semester-1-to-3-proof-walk.md:15 | air-mentor-api/src/lib/proof-control-plane-runtime-service.ts:45 | Setup-draft -> active-run transition is rigid state machine. | audit-map/14-reconciliation/contradiction-matrix-proof-lifecycle.md | check-transition
C03 | C.10 | docs/closeout/stage-07c-semester-4-to-6-proof-walk.md:22 | air-mentor-api/src/lib/proof-control-plane-tail-service.ts:88 | Completed-inspectable is immutable, terminal state. | audit-map/14-reconciliation/contradiction-matrix-proof-lifecycle.md | check-inspectable
C04 | C.11 | audit-map/14-reconciliation/contradiction-matrix-proof-lifecycle.md:5 | air-mentor-api/src/lib/proof-control-plane-live-run-service.ts:102 | Stopped != completed. Stopped is interrupted. | audit-map/14-reconciliation/contradiction-matrix-proof-lifecycle.md | check-stopped
C05 | C.12 | docs/closeout/stage-07a-semester-activation-contract-and-seeded-data.md:40 | air-mentor-api/src/lib/proof-control-plane-playback-reset-service.ts:150 | Reset-current-stage wipes stage data only. | audit-map/14-reconciliation/contradiction-matrix-proof-lifecycle.md | check-reset
C06 | D.1 | docs/closeout/stage-07b-semester-1-to-3-proof-walk.md:55 | air-mentor-api/src/lib/proof-control-plane-playback-reset-service.ts:180 | Complete-reset destructively nukes entire run history. | audit-map/14-reconciliation/contradiction-matrix-proof-lifecycle.md | check-nuke
C07 | D.2 | docs/closeout/stage-07c-semester-4-to-6-proof-walk.md:66 | air-mentor-api/src/lib/proof-control-plane-advance-service.ts:210 | Next day advance requires server preflight check. | audit-map/14-reconciliation/contradiction-matrix-proof-lifecycle.md | check-next-day
C08 | L.1 | audit-map/14-reconciliation/contradiction-matrix-proof-lifecycle.md:20 | air-mentor-api/src/lib/proof-control-plane-seeded-semester-service.ts:250 | Semester boundaries are hard stops, requiring explicit activation. | audit-map/14-reconciliation/contradiction-matrix-proof-lifecycle.md | check-sem-bound
C09 | L.2 | docs/closeout/stage-07a-semester-activation-contract-and-seeded-data.md:80 | air-mentor-api/src/lib/proof-control-plane-activation-service.ts:300 | Activation permanently locks semester configuration. | audit-map/14-reconciliation/contradiction-matrix-proof-lifecycle.md | check-act-lock
C10 | L.3 | docs/closeout/stage-07b-semester-1-to-3-proof-walk.md:90 | air-mentor-api/src/lib/proof-control-plane-seeded-run-service.ts:350 | Seeded run bypasses setup-draft, jumps to active-run. | audit-map/14-reconciliation/contradiction-matrix-proof-lifecycle.md | check-seed-skip

## Evidence

- `audit-map/20-prompts/fresh-sem1-principal-architect-overnight-pass.md`: Authoritative prompt Sections B, C, D, L.
- `air-mentor-api/src/lib/proof-control-plane-activation-service.ts`: Enforces setup-draft -> active-run.
- `air-mentor-api/src/lib/proof-control-plane-runtime-service.ts`: Dictates runtime state machine.
- `air-mentor-api/src/lib/proof-control-plane-tail-service.ts`: Enforces completed-inspectable immutability.
- `air-mentor-api/src/lib/proof-control-plane-playback-reset-service.ts`: Defines reset-current vs complete-reset.

## Mitigation Plan

Phase 1: Update `contradiction-matrix-proof-lifecycle.md` to reflect strict server-side date authority and locked activation semantics.
Phase 5: Sync reset cascade semantics (stage vs run wipe) in documentation to match `playback-reset-service`.
Phase 7: Clarify stopped vs completed-inspectable states and enforce hard semester boundaries in lifecycle docs.

## Recommendations

1. Enforce strict type checking for state transitions (draft -> active -> completed).
2. Remove any implicit next-stage advances; mandate server-side preflight.
3. Centralize date authority wholly on the server, removing client-side date assumptions.
4. Expand logging for reset events to differentiate stage-reset vs full-nuke.

## Detailed Analysis

The lifecycle of a proof is fundamentally driven by the control plane services. The transition from `setup-draft` to `active-run` is not merely a state flag change but involves setting up the initial date authority and locking in the configuration. The documentation in `stage-07a` implies a more fluid transition, which contradicts the rigid state machine enforced by `proof-control-plane-activation-service.ts`.

Furthermore, the distinction between `completed-inspectable` and `stopped` is critical. A `completed-inspectable` run has reached its natural conclusion and is available for retrospective analysis without modification. A `stopped` run, on the other hand, was interrupted, potentially mid-stage, and may require different handling for reset or recovery. The `proof-control-plane-tail-service.ts` correctly enforces the immutability of `completed-inspectable`, but prior matrices conflated the two states.

Reset semantics also need clarification. `reset-current-stage` is a surgical operation intended to allow a user to retry a specific interaction sequence within a known date context. `complete-reset` is a destructive operation that returns the run to `setup-draft` (or nixes it entirely depending on the context).

Semester boundaries represent hard stops. The transition from one semester to another is not an automatic advance but requires explicit activation of the new semester context. The `seeded-semester-service` respects this, but some docs suggest a seamless flow which is architecturally incorrect. Date authority dictates all transitions.
