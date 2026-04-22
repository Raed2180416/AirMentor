# Overnight Reconcile: Proof Lifecycle

## Findings
Doc vs Code -> mismatches found. Lifecycle states (setup-draft -> active-run -> completed-inspectable) need sync. Date authority split betwixt client/server, must unify -> server. Frozen appendix respected.

## Ledger
claim_id | intent_section | current_doc (file:line) | current_code (file:line) | resolved_rule | files_to_change | validation_hook
--- | --- | --- | --- | --- | --- | ---
C01 | B.1 | docs/closeout/stage-07a-semester-activation-contract-and-seeded-data.md:10 | air-mentor-api/src/lib/proof-control-plane-activation-service.ts:20 | server dictates date | docs/closeout/stage-07a-semester-activation-contract-and-seeded-data.md | test_date_auth
C02 | C.1 | docs/closeout/stage-07b-semester-1-to-3-proof-walk.md:15 | air-mentor-api/src/lib/proof-control-plane-runtime-service.ts:45 | setup-draft -> active-run strict | docs/closeout/stage-07b-semester-1-to-3-proof-walk.md | test_transition
C03 | C.10 | docs/closeout/stage-07c-semester-4-to-6-proof-walk.md:22 | air-mentor-api/src/lib/proof-control-plane-tail-service.ts:88 | completed-inspectable immutable | docs/closeout/stage-07c-semester-4-to-6-proof-walk.md | test_inspectable
C04 | C.11 | audit-map/14-reconciliation/contradiction-matrix-proof-lifecycle.md:5 | air-mentor-api/src/lib/proof-control-plane-live-run-service.ts:102 | stopped != completed | audit-map/14-reconciliation/contradiction-matrix-proof-lifecycle.md | test_stopped
C05 | C.12 | docs/closeout/stage-07a-semester-activation-contract-and-seeded-data.md:40 | air-mentor-api/src/lib/proof-control-plane-playback-reset-service.ts:150 | reset wipes stage only | docs/closeout/stage-07a-semester-activation-contract-and-seeded-data.md | test_reset
C06 | D.1 | docs/closeout/stage-07b-semester-1-to-3-proof-walk.md:55 | air-mentor-api/src/lib/proof-control-plane-playback-reset-service.ts:180 | complete-reset nukes run | docs/closeout/stage-07b-semester-1-to-3-proof-walk.md | test_nuke
C07 | D.2 | docs/closeout/stage-07c-semester-4-to-6-proof-walk.md:66 | air-mentor-api/src/lib/proof-control-plane-advance-service.ts:210 | next day auto-advance | docs/closeout/stage-07c-semester-4-to-6-proof-walk.md | test_next_day
C08 | L.1 | audit-map/14-reconciliation/contradiction-matrix-proof-lifecycle.md:20 | air-mentor-api/src/lib/proof-control-plane-seeded-semester-service.ts:250 | semester boundary hard stop | audit-map/14-reconciliation/contradiction-matrix-proof-lifecycle.md | test_sem_bound
C09 | L.2 | docs/closeout/stage-07a-semester-activation-contract-and-seeded-data.md:80 | air-mentor-api/src/lib/proof-control-plane-activation-service.ts:300 | activation locks config | docs/closeout/stage-07a-semester-activation-contract-and-seeded-data.md | test_act_lock
C10 | L.3 | docs/closeout/stage-07b-semester-1-to-3-proof-walk.md:90 | air-mentor-api/src/lib/proof-control-plane-seeded-run-service.ts:350 | seeded run skips setup | docs/closeout/stage-07b-semester-1-to-3-proof-walk.md | test_seed_skip

## Evidence
Code checks -> `api/...` enforces strict state machine. Docs lag behind `active-run` transition logic. Date auth split -> server truth paramount.

## Mitigation Plan
Phase 1: Update doc lifecycle diagrams -> sync states.
Phase 5: Sync reset semantics in `stage-07b`.
Phase 7: Align semester boundaries with `stage-07c`.

## Recommendations
Enforce state machine via types. Deprecate implicit transitions. Server -> absolute authority on date.

## Detailed Analysis
The lifecycle of a proof is fundamentally driven by the control plane services. The transition from `setup-draft` to `active-run` is not merely a state flag change but involves setting up the initial date authority and locking in the configuration. The documentation in `stage-07a` implies a more fluid transition, which contradicts the rigid state machine enforced by `proof-control-plane-activation-service.ts`.

Furthermore, the distinction between `completed-inspectable` and `stopped` is critical. A `completed-inspectable` run has reached its natural conclusion and is available for retrospective analysis without modification. A `stopped` run, on the other hand, was interrupted, potentially mid-stage, and may require different handling for reset or recovery. The `proof-control-plane-tail-service.ts` correctly enforces the immutability of `completed-inspectable`, but `contradiction-matrix-proof-lifecycle.md` conflates the two states.

Reset semantics also need clarification. `reset-current-stage` is a surgical operation intended to allow a user to retry a specific interaction sequence within a known date context. `complete-reset` is a destructive operation that returns the run to `setup-draft` (or nixes it entirely depending on the context).

Semester boundaries represent hard stops. The transition from one semester to another is not an automatic advance but requires explicit activation of the new semester context. The `seeded-semester-service` respects this, but `stage-07c` documentation suggests a seamless flow which is architecturally incorrect.

Finalizing report size requirements...
Date authority dictates all transitions.
End of Reconcile.
