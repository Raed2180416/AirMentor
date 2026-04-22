# Overnight Reconcile: Proof Lifecycle

## Findings
Proof lifecycle semantics diverge across docs. `final-decision-appendix.md` states reset semantics must clear temporal state but retain topological. Activation/runtime separation not always honored in docs.

## Ledger
| claim_id | intent_section | current_doc | current_code | resolved_rule | files_to_change | validation_hook |
|---|---|---|---|---|---|---|
| LIFECYCLE-1 | B | docs/closeout/stage-07a-semester-activation-contract-and-seeded-data.md:45 | src/lib/proof-control-plane-activation-service.ts:12 | Activation separated from runtime config | docs/closeout/stage-07a-semester-activation-contract-and-seeded-data.md | verify-activation-split |
| LIFECYCLE-2 | C(1) | docs/closeout/stage-07a-semester-activation-contract-and-seeded-data.md:88 | src/lib/proof-control-plane-runtime-service.ts:34 | Stage/date authority rests strictly with DB, never client | docs/closeout/stage-07a-semester-activation-contract-and-seeded-data.md | verify-db-auth |
| LIFECYCLE-3 | C(10) | docs/closeout/stage-07b-semester-1-to-3-proof-walk.md:112 | src/lib/proof-control-plane-tail-service.ts:22 | Completed runs are inspectable-only, never mutable | docs/closeout/stage-07b-semester-1-to-3-proof-walk.md | verify-inspect-only |
| LIFECYCLE-4 | C(11) | docs/closeout/stage-07b-semester-1-to-3-proof-walk.md:145 | src/lib/proof-control-plane-seeded-run-service.ts:55 | Stopped runs emit distinct terminal event | docs/closeout/stage-07b-semester-1-to-3-proof-walk.md | verify-stop-event |
| LIFECYCLE-5 | C(12) | docs/closeout/stage-07c-semester-4-to-6-proof-walk.md:89 | src/lib/proof-control-plane-seeded-semester-service.ts:18 | Reset current stage retains topology, drops active claims | docs/closeout/stage-07c-semester-4-to-6-proof-walk.md | verify-stage-reset |
| LIFECYCLE-6 | C(13) | docs/closeout/stage-07c-semester-4-to-6-proof-walk.md:120 | src/lib/proof-control-plane-live-run-service.ts:44 | Complete reset cascades via cascade delete on core relations | docs/closeout/stage-07c-semester-4-to-6-proof-walk.md | verify-complete-reset |
| LIFECYCLE-7 | C(14) | docs/closeout/stage-07a-semester-activation-contract-and-seeded-data.md:133 | src/lib/proof-control-plane-rebuild-context-service.ts:77 | Next Day transitions advance virtual clock exactly 24h | docs/closeout/stage-07a-semester-activation-contract-and-seeded-data.md | verify-next-day |
| LIFECYCLE-8 | C(15) | docs/closeout/stage-07b-semester-1-to-3-proof-walk.md:200 | src/lib/proof-control-plane-playback-reset-service.ts:31 | Next Stage transitions trigger invariant checks before step | docs/closeout/stage-07b-semester-1-to-3-proof-walk.md | verify-next-stage |
| LIFECYCLE-9 | D | docs/closeout/stage-07c-semester-4-to-6-proof-walk.md:180 | src/lib/proof-control-plane-advance-service.ts:88 | Semester boundaries enforce strict isolation of memory space | docs/closeout/stage-07c-semester-4-to-6-proof-walk.md | verify-semester-boundary |
| LIFECYCLE-10 | L(1) | audit-map/14-reconciliation/contradiction-matrix-proof-lifecycle.md:40 | src/lib/proof-control-plane-runtime-service.ts:90 | Runtime stage authority strictly delegates to core sequencer | audit-map/14-reconciliation/contradiction-matrix-proof-lifecycle.md | verify-sequencer-delegation |

## Evidence
- `src/lib/proof-control-plane-activation-service.ts:12` - split mechanism.
- `docs/closeout/stage-07a-semester-activation-contract-and-seeded-data.md:45` - legacy merged terminology.
- `audit-map/14-reconciliation/contradiction-matrix-proof-lifecycle.md:40` - highlights drift.

## Mitigation Plan
- Phase 1: Update terminology in `stage-07a` to reflect strict split (setup-draft vs active-run).
- Phase 5: Align `stage-07b` & `stage-07c` reset semantics to frozen appendix (topology retained).
- Phase 7: Rectify contradiction matrix with final runtime vs activation boundaries.

## Recommendations
- Enforce `setup-draft` and `active-run` strict disjoint states in all docs.
- Treat `completed-inspectable` as immutable append-only view.
- Clarify `reset-current-stage` does NOT destroy role assignments, only stage events.

