# Overnight Reconcile: Proof Lifecycle

## Findings
Proof lifecycle semantics misaligned in docs vs code. Setup-draft vs active-run state transition authority requires exact constraints.

## Ledger
| claim_id | intent_section | current_doc (file:line) | current_code (file:line) | resolved_rule | files_to_change | validation_hook |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| PLC-001 | B, C(1) | `docs/closeout/stage-07a-semester-activation-contract-and-seeded-data.md:12` | `air-mentor-api/src/lib/proof-control-plane-activation-service.ts:45` | Setup-draft has full date mutability; active-run derives stage/date strictly from active tail cursor. | docs/closeout/stage-07a-semester-activation-contract-and-seeded-data.md | Setup-draft tests pass |
| PLC-002 | L (flow 1) | `docs/closeout/stage-07b-semester-1-to-3-proof-walk.md:34` | `air-mentor-api/src/lib/proof-control-plane-runtime-service.ts:88` | 'completed-inspectable' state means run is immutable but queries are allowed. | docs/closeout/stage-07b-semester-1-to-3-proof-walk.md | Inspect tests on completed run pass |
| PLC-003 | L (flow 2) | `docs/closeout/stage-07b-semester-1-to-3-proof-walk.md:55` | `air-mentor-api/src/lib/proof-control-plane-tail-service.ts:102` | 'stopped' run allows resume from exactly the last known checkpoint. | docs/closeout/stage-07b-semester-1-to-3-proof-walk.md | Resume stopped run test |
| PLC-004 | L (flow 4) | `docs/closeout/stage-07c-semester-4-to-6-proof-walk.md:20` | `air-mentor-api/src/lib/proof-control-plane-seeded-run-service.ts:150` | Reset-current-stage drops uncommitted tail events but preserves stage entry boundary. | docs/closeout/stage-07c-semester-4-to-6-proof-walk.md | Stage reset test |
| PLC-005 | L (flow 5) | `docs/closeout/stage-07c-semester-4-to-6-proof-walk.md:45` | `air-mentor-api/src/lib/proof-control-plane-playback-reset-service.ts:33` | Complete-reset moves status back to setup-draft, wiping all tail events. | docs/closeout/stage-07c-semester-4-to-6-proof-walk.md | Full reset test |
| PLC-006 | C(10) | `audit-map/14-reconciliation/contradiction-matrix-proof-lifecycle.md:10` | `air-mentor-api/src/lib/proof-control-plane-advance-service.ts:60` | Next Day transition strictly bounded by semester end date. | audit-map/14-reconciliation/contradiction-matrix-proof-lifecycle.md | Next Day bounds test |
| PLC-007 | C(11) | `audit-map/14-reconciliation/contradiction-matrix-proof-lifecycle.md:15` | `air-mentor-api/src/lib/proof-control-plane-advance-service.ts:85` | Next Stage transition commits tail cursor and prepares next stage payload. | audit-map/14-reconciliation/contradiction-matrix-proof-lifecycle.md | Next Stage payload test |
| PLC-008 | D | `docs/closeout/stage-07a-semester-activation-contract-and-seeded-data.md:40` | `air-mentor-api/src/lib/proof-control-plane-seeded-semester-service.ts:20` | Semester boundaries strictly override local stage constraints. | docs/closeout/stage-07a-semester-activation-contract-and-seeded-data.md | Boundary override test |
| PLC-009 | L (flow 10) | `docs/closeout/stage-07b-semester-1-to-3-proof-walk.md:80` | `air-mentor-api/src/lib/proof-control-plane-live-run-service.ts:110` | Live runs cannot transition to seeded runs. | docs/closeout/stage-07b-semester-1-to-3-proof-walk.md | Cross-run type block test |
| PLC-010 | L (flow 11) | `docs/closeout/stage-07c-semester-4-to-6-proof-walk.md:90` | `air-mentor-api/src/lib/proof-control-plane-rebuild-context-service.ts:45` | Rebuild context strictly utilizes frozen appendix constraints. | docs/closeout/stage-07c-semester-4-to-6-proof-walk.md | Rebuild context constraint test |

## Evidence
`air-mentor-api/src/lib/proof-control-plane-*.ts`

## Mitigation Plan
- Phase 1: Re-align contradiction matrix constraints.
- Phase 5: Patch docs to align with code authority.
- Phase 7: Validate tests against new docs.

## Recommendations
Re-verify tests pass post doc-patch.
