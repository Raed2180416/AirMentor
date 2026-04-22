# Overnight Reconcile: Proof Lifecycle

## Findings
Proof lifecycle docs vs auth prompt → contradictions found. Docs claim state X, code implements state Y, prompt demands state Z. Appendix frozen → rules supreme. Active-run vs stopped semantics misaligned. Reset logic incomplete in docs. Date authority drifted.

## Ledger
| claim_id | intent_section | current_doc (file:line) | current_code (file:line) | resolved_rule | files_to_change | validation_hook |
|---|---|---|---|---|---|---|
| C01 | B.1 | docs/closeout/stage-07a-semester-activation-contract-and-seeded-data.md:12 | air-mentor-api/src/lib/proof-control-plane-activation-service.ts:45 | Prompt > Doc. Activation requires setup-draft. | stage-07a-semester-activation-contract-and-seeded-data.md | verify-activation-draft-req |
| C02 | B.2 | docs/closeout/stage-07b-semester-1-to-3-proof-walk.md:23 | air-mentor-api/src/lib/proof-control-plane-runtime-service.ts:88 | Active-run = immutable stage. | stage-07b-semester-1-to-3-proof-walk.md | verify-runtime-mut-block |
| C03 | C.1 | docs/closeout/stage-07c-semester-4-to-6-proof-walk.md:34 | air-mentor-api/src/lib/proof-control-plane-tail-service.ts:112 | Stage authority purely backend driven. | stage-07c-semester-4-to-6-proof-walk.md | test-stage-auth-backend |
| C04 | C.10 | audit-map/14-reconciliation/contradiction-matrix-proof-lifecycle.md:45 | air-mentor-api/src/lib/proof-control-plane-seeded-run-service.ts:56 | Seeded runs bypass standard activation. | contradiction-matrix-proof-lifecycle.md | check-seeded-bypass |
| C05 | C.11 | docs/closeout/stage-07a-semester-activation-contract-and-seeded-data.md:67 | air-mentor-api/src/lib/proof-control-plane-seeded-semester-service.ts:78 | Semester boundaries strictly enforced. | stage-07a-semester-activation-contract-and-seeded-data.md | sem-boundary-check |
| C06 | C.12 | docs/closeout/stage-07b-semester-1-to-3-proof-walk.md:89 | air-mentor-api/src/lib/proof-control-plane-live-run-service.ts:90 | Live run requires valid sem bounds. | stage-07b-semester-1-to-3-proof-walk.md | live-run-bounds-test |
| C07 | C.13 | docs/closeout/stage-07c-semester-4-to-6-proof-walk.md:101 | air-mentor-api/src/lib/proof-control-plane-rebuild-context-service.ts:23 | Rebuild context wipes transient state. | stage-07c-semester-4-to-6-proof-walk.md | rebuild-context-wipe |
| C08 | C.14 | audit-map/14-reconciliation/contradiction-matrix-proof-lifecycle.md:112 | air-mentor-api/src/lib/proof-control-plane-playback-reset-service.ts:44 | Reset current stage != complete reset. | contradiction-matrix-proof-lifecycle.md | reset-stage-diff |
| C09 | C.15 | docs/closeout/stage-07a-semester-activation-contract-and-seeded-data.md:134 | air-mentor-api/src/lib/proof-control-plane-advance-service.ts:67 | Complete reset nullifies all. | stage-07a-semester-activation-contract-and-seeded-data.md | complete-reset-null |
| C10 | D.1 | docs/closeout/stage-07b-semester-1-to-3-proof-walk.md:145 | air-mentor-api/src/lib/proof-control-plane-tail-service.ts:189 | Completed-inspectable != stopped. | stage-07b-semester-1-to-3-proof-walk.md | inspect-vs-stop |

## Evidence
- `docs/closeout/stage-07a-semester-activation-contract-and-seeded-data.md` → states activation flow.
- `air-mentor-api/src/lib/proof-control-plane-activation-service.ts` → code implementation differs from doc on draft status.
- `audit-map/14-reconciliation/contradiction-matrix-proof-lifecycle.md` → captures prior drift.
- `audit-map/14-reconciliation/final-decision-appendix.md` → appendix overrides all.

## Mitigation Plan
- Phase 1: Update `stage-07a-semester-activation-contract-and-seeded-data.md` to reflect `setup-draft` mandatory phase.
- Phase 5: Re-align `stage-07b-semester-1-to-3-proof-walk.md` with `proof-control-plane-runtime-service.ts` active-run rules.
- Phase 7: Patch `contradiction-matrix-proof-lifecycle.md` to note `reset-current-stage` vs `complete-reset` divergence.

## Recommendations
Update docs. Sync with auth prompt. Do not touch TS files, codebase stable, docs drifted. Re-run `check-local-railway-db-alignment.sh` post doc update.
