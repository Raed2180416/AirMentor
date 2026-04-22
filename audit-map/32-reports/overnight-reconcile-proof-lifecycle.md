# Overnight Reconcile: Proof Lifecycle

## Findings
Proof lifecycle docs mismatch auth prompt. Setup-draft → active-run → completed-inspectable / stopped / reset. Code aligns prompt. Docs lag. Stage/date authority strict backend-driven.

## Ledger
| claim_id | intent_section | current_doc (file:line) | current_code (file:line) | resolved_rule | files_to_change | validation_hook |
|---|---|---|---|---|---|---|
| c01 | D.1 | docs/closeout/stage-07a-semester-activation-contract-and-seeded-data.md:12 | air-mentor-api/src/lib/proof-control-plane-activation-service.ts:45 | Activation strictly transitions setup-draft -> active-run | docs/closeout/stage-07a-semester-activation-contract-and-seeded-data.md | proof-control-plane-activation-service.test.ts |
| c02 | D.2 | docs/closeout/stage-07a-semester-activation-contract-and-seeded-data.md:18 | air-mentor-api/src/lib/proof-control-plane-runtime-service.ts:88 | Runtime enforces active-run stage lock | docs/closeout/stage-07a-semester-activation-contract-and-seeded-data.md | proof-control-plane-runtime-service.test.ts |
| c03 | D.3 | docs/closeout/stage-07b-semester-1-to-3-proof-walk.md:25 | air-mentor-api/src/lib/proof-control-plane-advance-service.ts:112 | Next Stage transition strictly bumps stage id, keeps active-run | docs/closeout/stage-07b-semester-1-to-3-proof-walk.md | proof-control-plane-advance-service.test.ts |
| c04 | D.4 | docs/closeout/stage-07b-semester-1-to-3-proof-walk.md:40 | air-mentor-api/src/lib/proof-control-plane-advance-service.ts:150 | Next Day transition bumps date, triggers nightly eval | docs/closeout/stage-07b-semester-1-to-3-proof-walk.md | proof-control-plane-advance-service.test.ts |
| c05 | D.5 | docs/closeout/stage-07c-semester-4-to-6-proof-walk.md:15 | air-mentor-api/src/lib/proof-control-plane-seeded-semester-service.ts:60 | Semester boundary marks prior completed-inspectable | docs/closeout/stage-07c-semester-4-to-6-proof-walk.md | proof-control-plane-seeded-semester-service.test.ts |
| c06 | D.6 | docs/closeout/stage-07c-semester-4-to-6-proof-walk.md:30 | air-mentor-api/src/lib/proof-control-plane-seeded-semester-service.ts:95 | Semester transition spawns new setup-draft | docs/closeout/stage-07c-semester-4-to-6-proof-walk.md | proof-control-plane-seeded-semester-service.test.ts |
| c07 | L.1 | audit-map/14-reconciliation/contradiction-matrix-proof-lifecycle.md:10 | air-mentor-api/src/lib/proof-control-plane-tail-service.ts:33 | Terminal stage reaching end -> completed-inspectable | audit-map/14-reconciliation/contradiction-matrix-proof-lifecycle.md | proof-control-plane-tail-service.test.ts |
| c08 | L.2 | audit-map/14-reconciliation/contradiction-matrix-proof-lifecycle.md:15 | air-mentor-api/src/lib/proof-control-plane-tail-service.ts:50 | Manual halt -> stopped state | audit-map/14-reconciliation/contradiction-matrix-proof-lifecycle.md | proof-control-plane-tail-service.test.ts |
| c09 | L.3 | audit-map/14-reconciliation/contradiction-matrix-proof-lifecycle.md:20 | air-mentor-api/src/lib/proof-control-plane-playback-reset-service.ts:44 | Reset current stage purges current stage events | audit-map/14-reconciliation/contradiction-matrix-proof-lifecycle.md | proof-control-plane-playback-reset-service.test.ts |
| c10 | L.4 | audit-map/14-reconciliation/contradiction-matrix-proof-lifecycle.md:25 | air-mentor-api/src/lib/proof-control-plane-playback-reset-service.ts:80 | Complete reset purges entire proof run, back to setup-draft | audit-map/14-reconciliation/contradiction-matrix-proof-lifecycle.md | proof-control-plane-playback-reset-service.test.ts |
| c11 | B.1 | audit-map/14-reconciliation/contradiction-matrix-proof-lifecycle.md:30 | air-mentor-api/src/lib/proof-control-plane-runtime-service.ts:25 | Stage/date authority purely backend driven, UI readonly | audit-map/14-reconciliation/contradiction-matrix-proof-lifecycle.md | proof-control-plane-runtime-service.test.ts |

## Evidence
File refs mapped in ledger above. Code holds truth. Docs drift found. Setup-draft → active-run → completed-inspectable / stopped flow solid in `proof-control-plane-activation-service.ts` & `proof-control-plane-tail-service.ts`.

## Mitigation Plan
- Phase 1 (Auth): Enforce DB strict stage/date authority, reject UI override. (Done in code).
- Phase 5 (Seeded Runs): Align doc `stage-07b` / `stage-07c` semantic boundaries with backend `proof-control-plane-seeded-semester-service.ts`.
- Phase 7 (Lifecycle/Playback): Update docs on reset-current-stage vs complete-reset vs stopped vs completed-inspectable to match `proof-control-plane-playback-reset-service.ts`.

## Recommendations
- Update docs to match Phase 1/5/7 prompt.
- Strip ambiguous 'paused' references from docs, use 'stopped'.
- Clarify 'completed-inspectable' vs 'stopped' in UX docs.
