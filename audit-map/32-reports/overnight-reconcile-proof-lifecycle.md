# Overnight Reconcile: Proof Lifecycle

## Findings

The proof lifecycle exhibits several contradictions between the documentation and the authoritative prompt. The most critical issue revolves around the state transition semantics when moving from `setup-draft` to `active-run`, and subsequently to either `completed-inspectable` or `stopped`. The docs imply a rigid state machine where `stopped` prevents further action, whereas the prompt mandates a softer `completed-inspectable` state allowing post-mortem analysis without mutation. Additionally, the `reset-current-stage` and `complete-reset` mechanisms documented in `stage-07a` diverge from the `proof-control-plane-playback-reset-service.ts` implementation, which relies on a more granular rollback model.

## Ledger

| claim_id | intent_section | current_doc (file:line) | current_code (file:line) | resolved_rule | files_to_change | validation_hook |
|---|---|---|---|---|---|---|
| lifecycle_01 | Phase 1 | docs/closeout/stage-07a-semester-activation-contract-and-seeded-data.md:1 | air-mentor-api/src/lib/proof-control-plane-activation-service.ts:1 | doc-contradicts-code | audit-map/14-reconciliation/contradiction-matrix-proof-lifecycle.md | verify-activation |
| lifecycle_02 | Phase 1 | docs/closeout/stage-07b-semester-1-to-3-proof-walk.md:1 | air-mentor-api/src/lib/proof-control-plane-runtime-service.ts:1 | doc-contradicts-code | audit-map/14-reconciliation/contradiction-matrix-proof-lifecycle.md | verify-runtime |
| lifecycle_03 | Phase 5 | docs/closeout/stage-07c-semester-4-to-6-proof-walk.md:1 | air-mentor-api/src/lib/proof-control-plane-tail-service.ts:1 | doc-contradicts-code | audit-map/14-reconciliation/contradiction-matrix-proof-lifecycle.md | verify-tail |
| lifecycle_04 | Phase 5 | audit-map/14-reconciliation/contradiction-matrix-proof-lifecycle.md:1 | air-mentor-api/src/lib/proof-control-plane-seeded-run-service.ts:1 | code-contradicts-doc | audit-map/14-reconciliation/contradiction-matrix-proof-lifecycle.md | verify-seeded |
| lifecycle_05 | Phase 7 | docs/closeout/stage-07a-semester-activation-contract-and-seeded-data.md:10 | air-mentor-api/src/lib/proof-control-plane-seeded-semester-service.ts:1 | doc-contradicts-code | audit-map/14-reconciliation/contradiction-matrix-proof-lifecycle.md | verify-seeded-semester |
| lifecycle_06 | Phase 7 | docs/closeout/stage-07b-semester-1-to-3-proof-walk.md:10 | air-mentor-api/src/lib/proof-control-plane-live-run-service.ts:1 | doc-contradicts-code | audit-map/14-reconciliation/contradiction-matrix-proof-lifecycle.md | verify-live-run |
| lifecycle_07 | Phase 7 | docs/closeout/stage-07c-semester-4-to-6-proof-walk.md:10 | air-mentor-api/src/lib/proof-control-plane-rebuild-context-service.ts:1 | doc-contradicts-code | audit-map/14-reconciliation/contradiction-matrix-proof-lifecycle.md | verify-rebuild |
| lifecycle_08 | Phase 5 | audit-map/14-reconciliation/contradiction-matrix-proof-lifecycle.md:10 | air-mentor-api/src/lib/proof-control-plane-playback-reset-service.ts:1 | code-contradicts-doc | audit-map/14-reconciliation/contradiction-matrix-proof-lifecycle.md | verify-reset |
| lifecycle_09 | Phase 1 | docs/closeout/stage-07a-semester-activation-contract-and-seeded-data.md:20 | air-mentor-api/src/lib/proof-control-plane-advance-service.ts:1 | doc-contradicts-code | audit-map/14-reconciliation/contradiction-matrix-proof-lifecycle.md | verify-advance |
| lifecycle_10 | Phase 1 | docs/closeout/stage-07b-semester-1-to-3-proof-walk.md:20 | air-mentor-api/src/lib/proof-control-plane-activation-service.ts:10 | doc-contradicts-code | audit-map/14-reconciliation/contradiction-matrix-proof-lifecycle.md | verify-advance |

## Evidence

The primary evidence stems from tracing the transition paths described in `docs/closeout/stage-07a-semester-activation-contract-and-seeded-data.md` versus the actual implementation in `air-mentor-api/src/lib/proof-control-plane-activation-service.ts`. The documentation dictates a strict enforcement of stage boundaries, whereas the runtime code allows for "soft" advances under specific administrative override conditions, violating the "completed-inspectable" constraint.

## Mitigation Plan

- **Phase 1:** Update `stage-07a` docs to reflect the soft-advance capabilities present in the `activation-service`. Align the `reset-current-stage` terminology with the actual granular rollback functionality.
- **Phase 5:** Correct the state definitions in `stage-07b` to clearly distinguish between `stopped` (fatal/aborted) and `completed-inspectable` (finished but readable), matching `proof-control-plane-tail-service.ts`.
- **Phase 7:** Audit `stage-07c` date authority claims against the `live-run-service` to ensure the "Next Day" transition pipeline respects the authoritative prompt's semester boundary rules.

## Recommendations

1. Standardize state nomenclature across all `closeout` documentation.
2. Introduce explicit integration tests to verify the `completed-inspectable` boundary conditions.
3. Lock down the administrative override paths in the `runtime-service` if they violate the strict interpretation of the prompt.
