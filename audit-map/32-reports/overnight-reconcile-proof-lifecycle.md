# Overnight Reconcile: Proof Lifecycle

## Findings
- F1: 權威 prompt / frozen appendix / flow9 handoff 於本 worktree 缺檔；本輪改採「現存 closeout + lifecycle code + reconciliation/memory」取證，結論標 `needs-auth-source`，待補源後二次核對。
- F2: activation-semester 權威在 backend，且受 run 範圍 + checkpoint 可用 semester 雙重閘控；doc 偏重流程敘述，未明寫雙閘控細節。
- F3: active semester 權威優先序為 `run.activeOperationalSemester` → `batch.currentSemester`，且 checkpoint 視圖強制以 checkpoint semester 為準；doc 對「stage/date authority」語義不足。
- F4: 「completed-inspectable vs stopped」於 code 無 `stopped` status；可見狀態軸為 active/completed/ready/draft/archived，故 `stopped` 屬語義漂移詞。
- F5: reset 有二軌：`resetPlaybackStageArtifacts` 僅刪 stage-scope artifacts；`restoreProofSimulationSnapshot` 走新 run + activate，近似 complete-reset。

## Ledger
| claim_id | intent_section | current_doc (file:line) | current_code (file:line) | resolved_rule | files_to_change | validation_hook |
|---|---|---|---|---|---|---|
| PL-01 | B | docs/closeout/stage-07a-semester-activation-contract-and-seeded-data.md:38 | air-mentor-api/src/lib/proof-control-plane-activation-service.ts:40 | activation semester 必在 run range，否則 reject。 | docs/closeout/stage-07a-semester-activation-contract-and-seeded-data.md | activate-semester-range-guard |
| PL-02 | B | docs/closeout/stage-07a-semester-activation-contract-and-seeded-data.md:38 | air-mentor-api/src/lib/proof-control-plane-activation-service.ts:51 | activation semester 尚需存在於 checkpoint semester 集；雙重閘控。 | docs/closeout/stage-07a-semester-activation-contract-and-seeded-data.md | activate-semester-available-checkpoint |
| PL-03 | C.1 | docs/closeout/stage-07a-semester-activation-contract-and-seeded-data.md:67 | air-mentor-api/src/lib/proof-control-plane-activation-service.ts:66 | publishOperationalProjection 僅 run.activeFlag=1 觸發。 | docs/closeout/stage-07a-semester-activation-contract-and-seeded-data.md | projection-publish-active-only |
| PL-04 | C.10 | docs/closeout/stage-07b-semester-1-to-3-proof-walk.md:43 | air-mentor-api/src/lib/proof-control-plane-tail-service.ts:421 | active semester authority: `run.activeOperationalSemester` 優先於 `batch.currentSemester`。 | docs/closeout/stage-07b-semester-1-to-3-proof-walk.md | authority-run-over-batch |
| PL-05 | C.11 | docs/closeout/stage-07c-semester-4-to-6-proof-walk.md:34 | air-mentor-api/src/lib/proof-control-plane-tail-service.ts:437 | 若 run/batch semester 漂移，tail 強制切 checkpoint 視圖回正。 | docs/closeout/stage-07c-semester-4-to-6-proof-walk.md | checkpoint-fallback-on-drift |
| PL-06 | C.12 | docs/closeout/stage-07c-semester-4-to-6-proof-walk.md:63 | air-mentor-api/src/lib/proof-control-plane-checkpoint-service.ts:99 | next-stage gate: open queue > 0 → stageAdvanceBlocked=true。 | docs/closeout/stage-07c-semester-4-to-6-proof-walk.md | queue-blocks-progression |
| PL-07 | C.13 | docs/closeout/stage-07c-semester-4-to-6-proof-walk.md:34 | air-mentor-api/src/lib/proof-control-plane-checkpoint-service.ts:145 | next-day/next-stage playback gate: first blocked checkpoint 之後皆 inaccessible。 | docs/closeout/stage-07c-semester-4-to-6-proof-walk.md | playback-gate-first-blocked |
| PL-08 | C.14 | docs/closeout/stage-07c-semester-4-to-6-proof-walk.md:65 | air-mentor-api/src/lib/proof-control-plane-playback-reset-service.ts:15 | reset-current-stage 僅清 stage artifacts，不改 run 主體。 | docs/closeout/stage-07c-semester-4-to-6-proof-walk.md, audit-map/14-reconciliation/contradiction-matrix-proof-lifecycle.md | reset-stage-scope-only |
| PL-09 | C.15 | docs/closeout/stage-07a-semester-activation-contract-and-seeded-data.md:93 | air-mentor-api/src/lib/proof-control-plane-runtime-service.ts:202 | complete-reset 語義以 restore snapshot→start new run(activate=true) 實現。 | docs/closeout/stage-07a-semester-activation-contract-and-seeded-data.md, audit-map/14-reconciliation/contradiction-matrix-proof-lifecycle.md | restore-spawns-new-active-run |
| PL-10 | D | docs/closeout/stage-07b-semester-1-to-3-proof-walk.md:43 | air-mentor-api/src/lib/msruas-proof-control-plane.ts:2081 | code 狀態集合含 active/completed/ready/draft/archived；無 stopped。 | docs/closeout/stage-07b-semester-1-to-3-proof-walk.md, audit-map/14-reconciliation/contradiction-matrix-proof-lifecycle.md | no-stopped-status-enum |
| PL-11 | L(1-6) | docs/closeout/stage-07c-semester-4-to-6-proof-walk.md:40 | air-mentor-api/src/lib/proof-control-plane-rebuild-context-service.ts:120 | checkpoint pipeline 固定 semester×stage 全展開，前後指標鏈接。 | docs/closeout/stage-07c-semester-4-to-6-proof-walk.md | checkpoint-chain-integrity |
| PL-12 | L(10-11) | docs/closeout/stage-07c-semester-4-to-6-proof-walk.md:40 | air-mentor-api/src/lib/proof-control-plane-tail-service.ts:1863 | checkpoint-bound surface 之 semester/date authority = selected checkpoint semester。 | docs/closeout/stage-07c-semester-4-to-6-proof-walk.md | checkpoint-semester-authority |

## Evidence
- closeout 目標與範圍：07A 公開 activation contract、activeOperationalSemester 可見 (`docs/closeout/stage-07a-semester-activation-contract-and-seeded-data.md:38`, `docs/closeout/stage-07a-semester-activation-contract-and-seeded-data.md:93`)。
- closeout 早/晚 semester walk 要求跨 surface 一致可檢視 (`docs/closeout/stage-07b-semester-1-to-3-proof-walk.md:43`, `docs/closeout/stage-07c-semester-4-to-6-proof-walk.md:34`)。
- activation 雙閘控與 audit emit：range + availableSemesters + semester-activated (`air-mentor-api/src/lib/proof-control-plane-activation-service.ts:40`, `air-mentor-api/src/lib/proof-control-plane-activation-service.ts:51`, `air-mentor-api/src/lib/proof-control-plane-activation-service.ts:77`)。
- stage gate 規則：open queue 阻斷 progression，並產 blocked reason (`air-mentor-api/src/lib/proof-control-plane-checkpoint-service.ts:99`, `air-mentor-api/src/lib/proof-control-plane-checkpoint-service.ts:155`)。
- stage/date authority：run/batch 漂移時 tail 轉 checkpoint 視圖；checkpoint semester 覆寫 provenance semester (`air-mentor-api/src/lib/proof-control-plane-tail-service.ts:437`, `air-mentor-api/src/lib/proof-control-plane-tail-service.ts:1863`)。
- reset 二軌：stage-only delete 與 snapshot-restore 新 run (`air-mentor-api/src/lib/proof-control-plane-playback-reset-service.ts:15`, `air-mentor-api/src/lib/proof-control-plane-runtime-service.ts:202`)。
- 狀態詞對齊：governedRunStatusRank 無 stopped，僅 active/completed/ready/draft/archived (`air-mentor-api/src/lib/msruas-proof-control-plane.ts:2081`)。
- 本輪先前記憶亦指出 lifecycle 對齊焦點為 completed-inspectable/stopped 與 reset semantics (`audit-map/24-agent-memory/overnight-reconcile-proof-lifecycle.md:4`, `audit-map/24-agent-memory/overnight-reconcile-proof-lifecycle.md:10`)。

## Mitigation Plan
- Phase 1（語義定盤）
  - 補寫 doc 明確語義：`stopped` 非 backend status，改以 `archived`/`completed` 描述；checkpoint gate 與雙閘控明文化。
  - `needs-auth-source`: 權威 prompt 與 frozen appendix 缺檔，待補檔後逐列 re-verify intent section B/C/D/L。
- Phase 5（runtime 對齊）
  - 以 code-truth 回填 07A/07B/07C：stage/date authority、run-vs-batch drift fallback、queue-blocked progression。
  - 驗證鉤子綁定：`activate-semester-range-guard`、`queue-blocks-progression`、`checkpoint-semester-authority`。
- Phase 7（reconciliation 固化）
  - 更新 contradiction matrix，每 claim 落 `doc_anchor + code_anchor + resolved_rule`；凡含 stopped 詞彙標 `needs-doc-update`。
  - 形成二次稽核清單：待權威 prompt/appendix 回補後，逐行消除 `needs-auth-source` 標記。

## Recommendations
- R1: 先完成 docs 語義修補，再做下一輪 live proof；否則同詞異義持續擴散。
- R2: 將 `completed-inspectable` 定義為「completed + playbackAccessible scope」而非新 status 名稱。
- R3: 於 closeout 直接嵌入 reset 二軌圖：`reset-current-stage`(stage artifacts only) vs `complete-reset`(restore→new active run)。
- R4: 權威 prompt/appendix 一旦回補，立刻執行 `needs-auth-source` 專項 reconcile，避免長期漂移。
