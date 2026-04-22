# Overnight Reconcile: Proof Lifecycle

Pass: `overnight-reconcile-proof-lifecycle`
Date: 2026-04-22
Scope: activation/runtime/stage-date authority/completed-inspectable vs stopped/reset semantics。

## Findings

- F-01 activation雙寫成立：`simulationRuns.activeOperationalSemester`與`batches.currentSemester`同時更新；07A僅明前者，後者漏記。證：`air-mentor-api/src/lib/proof-control-plane-activation-service.ts:57`、`air-mentor-api/src/lib/proof-control-plane-activation-service.ts:61`、`docs/closeout/stage-07a-semester-activation-contract-and-seeded-data.md:62`。
- F-02 publish gate成立：僅`activeFlag===1`方觸發投影刷新。證：`air-mentor-api/src/lib/proof-control-plane-activation-service.ts:66`、`air-mentor-api/src/lib/proof-control-plane-activation-service.ts:67`、`docs/closeout/stage-07a-semester-activation-contract-and-seeded-data.md:9`。
- F-03 previous fallback未文檔化：`activeOperationalSemester ?? semesterEnd ?? null`。證：`air-mentor-api/src/lib/proof-control-plane-activation-service.ts:55`。
- F-04 restore必激活：`restoreProofSimulationSnapshot`硬置`activate:true`，故無「restore後停態」。證：`air-mentor-api/src/lib/proof-control-plane-runtime-service.ts:202`、`air-mentor-api/src/lib/proof-control-plane-runtime-service.ts:213`。
- F-05 active risk錨點非activation：`currentSemesterNumber=max(semesterEnd, observed)`，不讀`activeOperationalSemester`。證：`air-mentor-api/src/lib/proof-control-plane-runtime-service.ts:294`。
- F-06 reset邊界：`resetPlaybackStageArtifacts`只刪checkpoint層artifact，不改run層`activeFlag/status`。證：`air-mentor-api/src/lib/proof-control-plane-playback-reset-service.ts:15`、`air-mentor-api/src/lib/proof-control-plane-playback-reset-service.ts:55`。
- F-07 seeded finalize序：先rebuild playback，再rebuild risk artifacts，再recompute observed risk。證：`air-mentor-api/src/lib/proof-control-plane-seeded-run-service.ts:189`、`air-mentor-api/src/lib/proof-control-plane-seeded-run-service.ts:194`、`air-mentor-api/src/lib/proof-control-plane-seeded-run-service.ts:202`。
- F-08 skip旗標存在且未入closeout：`skipArtifactRebuild`、`skipActiveRiskRecompute`可繞重算。證：`air-mentor-api/src/lib/proof-control-plane-seeded-run-service.ts:58`、`air-mentor-api/src/lib/proof-control-plane-seeded-run-service.ts:59`。
- F-09 completed-inspectable vs stopped在DB層未顯式枚舉：可見僅`activeFlag`與`status`混用，未見專屬狀態機文檔。證：`air-mentor-api/src/lib/proof-control-plane-seeded-run-service.ts:246`、`air-mentor-api/src/lib/proof-control-plane-seeded-run-service.ts:247`、`docs/closeout/stage-07a-semester-activation-contract-and-seeded-data.md:116`。
- F-10 07B/07C學期權威基於checkpoint映射，與activation排序一致。證：`docs/closeout/stage-07b-semester-1-to-3-proof-walk.md:36`、`docs/closeout/stage-07c-semester-4-to-6-proof-walk.md:28`、`air-mentor-api/src/lib/proof-control-plane-activation-service.ts:47`。
- F-11 live run `activate`為optional，默認真值由service內`input.activate ?? true`決。證：`air-mentor-api/src/lib/proof-control-plane-live-run-service.ts:38`、`air-mentor-api/src/lib/proof-control-plane-live-run-service.ts:153`。
- F-12 權威提示檔與凍結附錄於當前樹缺席；本次以既有closeout+backend+既存report為準，不改產品意圖。證：`audit-map/20-prompts/prompt-index.md:1`、`audit-map/20-prompts/prompt-index.md:83`、`audit-map/32-reports/overnight-reconcile-proof-lifecycle.md:195`。

## Ledger

| claim_id | intent_section | current_doc (file:line) | current_code (file:line) | resolved_rule | files_to_change | validation_hook |
|---|---|---|---|---|---|---|
| LC-01 | activation contract dual-write | `docs/closeout/stage-07a-semester-activation-contract-and-seeded-data.md:62` | `air-mentor-api/src/lib/proof-control-plane-activation-service.ts:57` | activation應記雙寫run+batch；doc漏batch | `audit-map/14-reconciliation/contradiction-matrix-proof-lifecycle.md` | needs-doc-update |
| LC-02 | activation publish gate | `docs/closeout/stage-07a-semester-activation-contract-and-seeded-data.md:9` | `air-mentor-api/src/lib/proof-control-plane-activation-service.ts:66` | `activeFlag===1`才publish，與意圖同 | none | confirmed |
| LC-03 | previous semester fallback | `docs/closeout/stage-07a-semester-activation-contract-and-seeded-data.md:38` | `air-mentor-api/src/lib/proof-control-plane-activation-service.ts:55` | fallback鏈需入文檔 | `audit-map/14-reconciliation/contradiction-matrix-proof-lifecycle.md` | needs-doc-update |
| LC-04 | restore semantics | `docs/closeout/stage-07a-semester-activation-contract-and-seeded-data.md:95` | `air-mentor-api/src/lib/proof-control-plane-runtime-service.ts:213` | restore即activate，無保留停態 | `audit-map/14-reconciliation/contradiction-matrix-proof-lifecycle.md` | needs-doc-update |
| LC-05 | risk semester authority | `docs/closeout/stage-07a-semester-activation-contract-and-seeded-data.md:67` | `air-mentor-api/src/lib/proof-control-plane-runtime-service.ts:294` | risk錨點=end/observed；非activation | `audit-map/14-reconciliation/contradiction-matrix-proof-lifecycle.md` | needs-doc-update |
| LC-06 | reset-current-stage boundary | `docs/closeout/stage-07c-semester-4-to-6-proof-walk.md:64` | `air-mentor-api/src/lib/proof-control-plane-playback-reset-service.ts:51` | reset刪stage artifacts，run層存續 | `audit-map/14-reconciliation/contradiction-matrix-proof-lifecycle.md` | needs-doc-update |
| LC-07 | complete-reset snapshot anchor | `docs/closeout/stage-07a-semester-activation-contract-and-seeded-data.md:23` | `air-mentor-api/src/lib/proof-control-plane-seeded-run-service.ts:220` | seeded finalize後寫baseline snapshot可供reset鏈 | none | confirmed |
| LC-08 | seeded finalize order | `docs/closeout/stage-07a-semester-activation-contract-and-seeded-data.md:75` | `air-mentor-api/src/lib/proof-control-plane-seeded-run-service.ts:189` | rebuild順序應明示，現僅隱含 | `audit-map/14-reconciliation/contradiction-matrix-proof-lifecycle.md` | needs-doc-update |
| LC-09 | skip flags escape hatch | `docs/closeout/stage-07a-semester-activation-contract-and-seeded-data.md:82` | `air-mentor-api/src/lib/proof-control-plane-seeded-run-service.ts:58` | skip旗標需審計註記，否則可靜默跳算 | `audit-map/14-reconciliation/contradiction-matrix-proof-lifecycle.md` | needs-doc-update |
| LC-10 | semester checkpoint authority | `docs/closeout/stage-07b-semester-1-to-3-proof-walk.md:36` | `air-mentor-api/src/lib/proof-control-plane-activation-service.ts:47` | 學期可用集由checkpoint表導出 | none | confirmed |
| LC-11 | completed-inspectable vs stopped | `docs/closeout/stage-07a-semester-activation-contract-and-seeded-data.md:116` | `air-mentor-api/src/lib/proof-control-plane-seeded-run-service.ts:247` | DB層未有同名狀態枚舉；需文檔狀態機映射 | `audit-map/14-reconciliation/contradiction-matrix-proof-lifecycle.md` | needs-doc-update |
| LC-12 | live run activation default | `docs/closeout/stage-07c-semester-4-to-6-proof-walk.md:33` | `air-mentor-api/src/lib/proof-control-plane-live-run-service.ts:153` | activate默認true；需在proof walk文檔標示 | `audit-map/14-reconciliation/contradiction-matrix-proof-lifecycle.md` | needs-doc-update |

## Evidence

- E-01 `air-mentor-api/src/lib/proof-control-plane-activation-service.ts:32`
- E-02 `air-mentor-api/src/lib/proof-control-plane-activation-service.ts:55`
- E-03 `air-mentor-api/src/lib/proof-control-plane-activation-service.ts:61`
- E-04 `air-mentor-api/src/lib/proof-control-plane-activation-service.ts:66`
- E-05 `air-mentor-api/src/lib/proof-control-plane-activation-service.ts:74`
- E-06 `air-mentor-api/src/lib/proof-control-plane-runtime-service.ts:187`
- E-07 `air-mentor-api/src/lib/proof-control-plane-runtime-service.ts:213`
- E-08 `air-mentor-api/src/lib/proof-control-plane-runtime-service.ts:294`
- E-09 `air-mentor-api/src/lib/proof-control-plane-playback-reset-service.ts:15`
- E-10 `air-mentor-api/src/lib/proof-control-plane-seeded-run-service.ts:58`
- E-11 `air-mentor-api/src/lib/proof-control-plane-seeded-run-service.ts:189`
- E-12 `air-mentor-api/src/lib/proof-control-plane-seeded-run-service.ts:220`
- E-13 `air-mentor-api/src/lib/proof-control-plane-seeded-run-service.ts:246`
- E-14 `air-mentor-api/src/lib/proof-control-plane-live-run-service.ts:38`
- E-15 `air-mentor-api/src/lib/proof-control-plane-live-run-service.ts:153`
- E-16 `docs/closeout/stage-07a-semester-activation-contract-and-seeded-data.md:9`
- E-17 `docs/closeout/stage-07a-semester-activation-contract-and-seeded-data.md:62`
- E-18 `docs/closeout/stage-07b-semester-1-to-3-proof-walk.md:36`
- E-19 `docs/closeout/stage-07c-semester-4-to-6-proof-walk.md:28`
- E-20 `audit-map/20-prompts/prompt-index.md:1`

## Mitigation Plan

### Phase 1

- P1-1：先補文檔矛盾矩陣（不改產品碼），將LC-01/03/04/05/06/08/09/11/12標`needs-doc-update`，供後續closeout擁有者處理。
- P1-2：在矩陣中明列「reset-current-stage只清checkpoint層」「restore必activate」「risk錨點=end/observed」。
- P1-3：凍結附錄不可改，僅引用並旁註缺席風險；若檔回補，再次對齊。

### Phase 5

- P5-1：將proof-lifecycle專矩陣納入`audit-map/14-reconciliation`主流程，與既有`contradiction-matrix.md`互鏈。
- P5-2：補`validation_hook`對應：`confirmed`/`needs-doc-update`雙軌，避免將文檔缺口誤判為程式缺陷。
- P5-3：對「completed-inspectable vs stopped」建立暫行映射：`activeFlag/status`現況映射，待owner定最終語義。

### Phase 7

- P7-1：回歸鉤子：抽查LC-02/10/07（純一致項）不需代碼變更。
- P7-2：風險鉤子：抽查LC-05（risk錨點）與LC-04（restore激活）是否仍舊；若漂移則升級為行為矛盾。
- P7-3：交付鉤子：本報ledger>=10（現12），且每列doc/code皆`file:line`。

## Recommendations

- R-01：先以文檔修復為主，不動backend/frontend源，保持當前產品意圖。
- R-02：由closeout owner在07A/07B/07C增「生命周期狀態機」短節：`setup-draft -> active-run -> completed-inspectable/stopped -> reset-current-stage -> complete-reset`對應欄位。
- R-03：將`skipArtifactRebuild/skipActiveRiskRecompute`列為受控開關，要求審計事件模板。
- R-04：將risk錨點差異（activation vs semesterEnd/observed）標示於對外說明，防跨面誤解。
- R-05：待權威提示/附錄檔回補後，再跑一次proof-lifecycle reconciliation做最終封口。
