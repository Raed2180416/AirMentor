# Agent Memory: Proof Lifecycle Reconcile

## Context
- named auth prompt / appendix / flow9 handoff 未進現行 prompt/docs indexes；然 ML reconcile 仍稱 auth prompt 可直審，故本 worktree 只能先以 closeout docs + code reconcile，phase map 借 `final-authoritative-plan.md` 與 ATM `07A/07B/07C` (`audit-map/20-prompts/prompt-index.md:16-82`, `audit-map/01-inventory/docs-index.md:15-55`, `audit-map/32-reports/overnight-reconcile-ml.md:13`, `audit-map/32-reports/overnight-reconcile-ml.md:39`, `docs/closeout/final-authoritative-plan.md:323-371`, `docs/closeout/assertion-traceability-matrix.md:31-33`)。
- semester authority ladder: operational surfaces `run.activeOperationalSemester -> batch.currentSemester`; checkpoint-bound surfaces `checkpoint.semesterNumber -> run.activeOperationalSemester -> batch.currentSemester`; drift 時 tail reroute 至 checkpoint view (`air-mentor-api/src/lib/proof-control-plane-tail-service.ts:346-357`, `air-mentor-api/src/lib/proof-control-plane-tail-service.ts:421-441`, `air-mentor-api/src/lib/proof-control-plane-tail-service.ts:1306-1328`, `air-mentor-api/src/lib/proof-control-plane-tail-service.ts:1860-1868`)。
- stage/date authority: active runtime projection obey `run.activeStageKey`; checkpoint dates obey fixed `semesterDayOffset` + `run.createdAt`; blocked progression reason 由 checkpoint summary/payload 下放，不由 UI 自推 (`air-mentor-api/src/lib/msruas-proof-control-plane.ts:3304-3321`, `air-mentor-api/src/lib/msruas-proof-control-plane.ts:3452-3563`, `air-mentor-api/src/lib/stage-policy.ts:86-149`, `air-mentor-api/src/lib/proof-control-plane-playback-service.ts:70-72`, `air-mentor-api/src/lib/proof-control-plane-checkpoint-service.ts:141-160`, `air-mentor-api/src/lib/proof-control-plane-tail-service.ts:1624-1643`)。
- lifecycle 真軸非 `setup-draft -> active-run`。bootstrap insert `running`; seeded/live materialization 收斂為 `completed`; activate 置目標 run 為 `active`; archive 為 `archived`; backend 無 `stopped` run status (`air-mentor-api/src/lib/proof-control-plane-seeded-bootstrap-service.ts:121-130`, `air-mentor-api/src/lib/proof-control-plane-seeded-run-service.ts:245-248`, `air-mentor-api/src/lib/proof-control-plane-live-run-service.ts:262-270`, `air-mentor-api/src/lib/msruas-proof-control-plane.ts:4257-4278`, `air-mentor-api/src/lib/msruas-proof-control-plane.ts:4311-4332`, `air-mentor-api/src/lib/proof-control-plane-batch-service.ts:257-270`)。

## Actions
- refreshed `audit-map/32-reports/overnight-reconcile-proof-lifecycle.md`：補 stage/date authority、queue/task/admin-confirmed gate、dual reset semantics、out-of-scope doc targets。
- refreshed `audit-map/14-reconciliation/contradiction-matrix-proof-lifecycle.md`：擴成 16 claims，逐列 doc/code anchors、status、resolution、validation hook。

## Next Steps
- 若 named auth prompt / appendix / flow9 handoff 回庫，重跑 direct section B/C/D/L reconcile，解除 fallback-only 標記。
- 若 closeout docs 再用 `stopped`、`setup-draft`，或將 dates/stages 視為 UI 推斷值，視為 stale wording，應改碼證詞彙。
