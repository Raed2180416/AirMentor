# Agent Memory: Proof Lifecycle Reconcile

## Context
- named auth prompt / appendix / flow9 handoff 未出現於現行 prompt/docs inventories；然既有 ML report 仍稱該 prompt 在 repo，故本 worktree 之 direct B/C/D/L reconcile 受阻，僅可先以 closeout + code 對齊 (`audit-map/20-prompts/prompt-index.md:16-82`, `audit-map/01-inventory/docs-index.md:15-55`, `audit-map/32-reports/overnight-reconcile-ml.md:13`, `audit-map/32-reports/overnight-reconcile-ml.md:39`)。
- lifecycle 真軸非 `setup-draft -> active-run`。bootstrap insert `running`; seeded/live materialization 收斂為 `completed`; activate 將目標 run 置 `active`; archive 則為 `archived`; backend 無 `stopped` run status (`air-mentor-api/src/lib/proof-control-plane-seeded-bootstrap-service.ts:124-130`, `air-mentor-api/src/lib/proof-control-plane-seeded-run-service.ts:245-248`, `air-mentor-api/src/lib/proof-control-plane-live-run-service.ts:265-271`, `air-mentor-api/src/lib/msruas-proof-control-plane.ts:4257-4278`, `air-mentor-api/src/lib/msruas-proof-control-plane.ts:4311-4332`, `air-mentor-api/src/lib/proof-control-plane-batch-service.ts:257-270`)。

## Actions
- refreshed `audit-map/32-reports/overnight-reconcile-proof-lifecycle.md`：增補 dual activation gate、semester authority ladder、first-blocked playback gate、reset 二軌、completed-inspectable 定義。
- expanded `audit-map/14-reconciliation/contradiction-matrix-proof-lifecycle.md`：逐 claim 落 doc/code anchors、status、resolution、validation hook。

## Next Steps
- 待 auth prompt / appendix / flow9 handoff 補回後，逐列解除 `needs-auth-source`，重驗 B/C/D/L mapping。
- 若 closeout docs 再用 `stopped` 或 `setup-draft`，視為 stale wording，應改 `archived` / `inactive completed run` / `running` / `queued`。
