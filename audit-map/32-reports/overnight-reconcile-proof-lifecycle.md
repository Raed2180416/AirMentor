# Overnight Reconcile: Proof Lifecycle

Pass: `overnight-reconcile-proof-lifecycle`
Date: 2026-04-22
Run marker: 2026-04-22 overnight-reconcile-proof-lifecycle rerun。
Scope: activation/runtime/stage-date authority/completed-inspectable vs stopped/reset semantics/next-stage pipeline。

## Findings

- F-01 activation雙寫成立：run層`activeOperationalSemester`與batch層`currentSemester`並改；07A文僅偏重前者。證：`air-mentor-api/src/lib/proof-control-plane-activation-service.ts:57`、`air-mentor-api/src/lib/proof-control-plane-activation-service.ts:61`、`docs/closeout/stage-07a-semester-activation-contract-and-seeded-data.md:62`。
- F-02 activation publish gate成立：僅`activeFlag===1`觸發publish。證：`air-mentor-api/src/lib/proof-control-plane-activation-service.ts:66`、`air-mentor-api/src/lib/proof-control-plane-activation-service.ts:67`、`docs/closeout/stage-07a-semester-activation-contract-and-seeded-data.md:9`。
- F-03 previous-semester fallback未顯式文檔化：`activeOperationalSemester ?? semesterEnd ?? null`。證：`air-mentor-api/src/lib/proof-control-plane-activation-service.ts:55`、`docs/closeout/stage-07a-semester-activation-contract-and-seeded-data.md:38`。
- F-04 restore語義=必激活：restore路徑硬置`activate:true`，故「restore後停態」不成立。證：`air-mentor-api/src/lib/proof-control-plane-runtime-service.ts:202`、`air-mentor-api/src/lib/proof-control-plane-runtime-service.ts:213`。
- F-05 runtime風險學期權威≠activation欄位：`currentSemesterNumber=max(semesterEnd, observed)`。證：`air-mentor-api/src/lib/proof-control-plane-runtime-service.ts:294`、`docs/closeout/stage-07a-semester-activation-contract-and-seeded-data.md:67`。
- F-06 reset-current-stage僅清checkpoint層：刪stage cards/sessions/queue/projections/checkpoints，不動run層`activeFlag/status`。證：`air-mentor-api/src/lib/proof-control-plane-playback-reset-service.ts:15`、`air-mentor-api/src/lib/proof-control-plane-playback-reset-service.ts:55`、`air-mentor-api/src/lib/proof-control-plane-live-run-service.ts:455`。
- F-07 seeded finalize序確定：`rebuild playback → rebuild artifacts(可跳) → recompute observed risk(可跳)`。證：`air-mentor-api/src/lib/proof-control-plane-seeded-run-service.ts:189`、`air-mentor-api/src/lib/proof-control-plane-seeded-run-service.ts:194`、`air-mentor-api/src/lib/proof-control-plane-seeded-run-service.ts:202`。
- F-08 completed-inspectable對應現況：run完成態寫`status:'completed'`，可檢視由checkpoint/tail層提供；無專用枚舉`completed-inspectable`。證：`air-mentor-api/src/lib/proof-control-plane-seeded-run-service.ts:246`、`air-mentor-api/src/lib/proof-control-plane-tail-service.ts:149`、`docs/closeout/stage-07a-semester-activation-contract-and-seeded-data.md:116`。
- F-09 stopped語義未獨立：本批檔見`running/completed`與`activeFlag`，未見`stopped`狀態值。證：`air-mentor-api/src/lib/proof-control-plane-live-run-service.ts:268`、`air-mentor-api/src/lib/proof-control-plane-live-run-service.ts:455`。
- F-10 stage/date authority與Next Stage gate成立：open queue>0 ⇒ `stageAdvanceBlocked`; 後續checkpoint `playbackAccessible=false`並標`blockedByCheckpointId`。證：`air-mentor-api/src/lib/proof-control-plane-checkpoint-service.ts:99`、`air-mentor-api/src/lib/proof-control-plane-checkpoint-service.ts:145`、`air-mentor-api/src/lib/proof-control-plane-checkpoint-service.ts:154`。
- F-11 semester boundary authority成立：rebuild context以`run.semesterStart..semesterEnd`展開checkpoint骨架；07B/07C各自列學期映射。證：`air-mentor-api/src/lib/proof-control-plane-rebuild-context-service.ts:116`、`air-mentor-api/src/lib/proof-control-plane-rebuild-context-service.ts:120`、`docs/closeout/stage-07b-semester-1-to-3-proof-walk.md:36`、`docs/closeout/stage-07c-semester-4-to-6-proof-walk.md:28`。
- F-12 live-run activate默認真值：`activate ?? true`，且啟用時先清同batch既有active。證：`air-mentor-api/src/lib/proof-control-plane-live-run-service.ts:153`、`air-mentor-api/src/lib/proof-control-plane-live-run-service.ts:219`。
- F-13 權威提示檔/凍結附錄於本樹缺席：僅見prompt索引，無指定檔。此為證據缺口，非產品語義改動。證：`audit-map/20-prompts/prompt-index.md:1`、`audit-map/20-prompts/prompt-index.md:83`。

## Ledger

| claim_id | intent_section | current_doc (file:line) | current_code (file:line) | resolved_rule | files_to_change | validation_hook |
|---|---|---|---|---|---|---|
| LC-01 | C(10-15) activation authority | `docs/closeout/stage-07a-semester-activation-contract-and-seeded-data.md:62` | `air-mentor-api/src/lib/proof-control-plane-activation-service.ts:57` | activation語義=run+batch雙寫；doc需補batch面 | `audit-map/14-reconciliation/contradiction-matrix-proof-lifecycle.md` | needs-doc-update |
| LC-02 | C(10-15) activation publish gate | `docs/closeout/stage-07a-semester-activation-contract-and-seeded-data.md:9` | `air-mentor-api/src/lib/proof-control-plane-activation-service.ts:66` | 僅active run發布投影，規則一致 | none | confirmed |
| LC-03 | C(10-15) previous semester provenance | `docs/closeout/stage-07a-semester-activation-contract-and-seeded-data.md:38` | `air-mentor-api/src/lib/proof-control-plane-activation-service.ts:55` | previous fallback鏈須外顯於closeout | `audit-map/14-reconciliation/contradiction-matrix-proof-lifecycle.md` | needs-doc-update |
| LC-04 | D restore/reset semantics | `docs/closeout/stage-07a-semester-activation-contract-and-seeded-data.md:95` | `air-mentor-api/src/lib/proof-control-plane-runtime-service.ts:213` | restore必activate，不可解讀為stopped-restore | `audit-map/14-reconciliation/contradiction-matrix-proof-lifecycle.md` | needs-doc-update |
| LC-05 | L flow(10-11) runtime authority | `docs/closeout/stage-07a-semester-activation-contract-and-seeded-data.md:67` | `air-mentor-api/src/lib/proof-control-plane-runtime-service.ts:294` | runtime risk以end/observed為錨，不以activation欄位直驅 | `audit-map/14-reconciliation/contradiction-matrix-proof-lifecycle.md` | needs-doc-update |
| LC-06 | D reset-current-stage boundary | `docs/closeout/stage-07c-semester-4-to-6-proof-walk.md:64` | `air-mentor-api/src/lib/proof-control-plane-playback-reset-service.ts:51` | reset-current-stage僅checkpoint層資料清理 | `audit-map/14-reconciliation/contradiction-matrix-proof-lifecycle.md` | needs-doc-update |
| LC-07 | D complete-reset anchor | `docs/closeout/stage-07a-semester-activation-contract-and-seeded-data.md:23` | `air-mentor-api/src/lib/proof-control-plane-seeded-run-service.ts:220` | complete-reset依snapshot鏈可回建 | none | confirmed |
| LC-08 | C(1) seeded finalize lifecycle | `docs/closeout/stage-07a-semester-activation-contract-and-seeded-data.md:75` | `air-mentor-api/src/lib/proof-control-plane-seeded-run-service.ts:189` | finalize序固定；skip旗標屬顯式例外 | `audit-map/14-reconciliation/contradiction-matrix-proof-lifecycle.md` | needs-doc-update |
| LC-09 | B lifecycle labels | `docs/closeout/stage-07a-semester-activation-contract-and-seeded-data.md:116` | `air-mentor-api/src/lib/proof-control-plane-seeded-run-service.ts:246` | `completed-inspectable`需映射至`status/activeFlag/checkpoint`三元 | `audit-map/14-reconciliation/contradiction-matrix-proof-lifecycle.md` | needs-doc-update |
| LC-10 | L flow(1-6) next-stage gating | `docs/closeout/stage-07c-semester-4-to-6-proof-walk.md:63` | `air-mentor-api/src/lib/proof-control-plane-checkpoint-service.ts:145` | queue open → stage blocked → downstream playback gated | `audit-map/14-reconciliation/contradiction-matrix-proof-lifecycle.md` | needs-doc-update |
| LC-11 | L flow(1-6) semester boundary | `docs/closeout/stage-07b-semester-1-to-3-proof-walk.md:99` | `air-mentor-api/src/lib/proof-control-plane-rebuild-context-service.ts:116` | boundary authority來自run semester range + checkpoint mesh | none | confirmed |
| LC-12 | C(10-15) live activation default | `docs/closeout/stage-07c-semester-4-to-6-proof-walk.md:33` | `air-mentor-api/src/lib/proof-control-plane-live-run-service.ts:153` | live run activate默認true；需文檔明示 | `audit-map/14-reconciliation/contradiction-matrix-proof-lifecycle.md` | needs-doc-update |
| LC-13 | A/Q authority source availability | `audit-map/20-prompts/prompt-index.md:1` | `audit-map/20-prompts/prompt-index.md:83` | 指定權威檔缺席；先記證據缺口，待回補再二次對齊 | `audit-map/14-reconciliation/contradiction-matrix-proof-lifecycle.md` | open |

## Evidence

- E-01 `air-mentor-api/src/lib/proof-control-plane-activation-service.ts:55`
- E-02 `air-mentor-api/src/lib/proof-control-plane-activation-service.ts:57`
- E-03 `air-mentor-api/src/lib/proof-control-plane-activation-service.ts:61`
- E-04 `air-mentor-api/src/lib/proof-control-plane-activation-service.ts:66`
- E-05 `air-mentor-api/src/lib/proof-control-plane-runtime-service.ts:202`
- E-06 `air-mentor-api/src/lib/proof-control-plane-runtime-service.ts:213`
- E-07 `air-mentor-api/src/lib/proof-control-plane-runtime-service.ts:294`
- E-08 `air-mentor-api/src/lib/proof-control-plane-playback-reset-service.ts:15`
- E-09 `air-mentor-api/src/lib/proof-control-plane-playback-reset-service.ts:55`
- E-10 `air-mentor-api/src/lib/proof-control-plane-seeded-run-service.ts:58`
- E-11 `air-mentor-api/src/lib/proof-control-plane-seeded-run-service.ts:59`
- E-12 `air-mentor-api/src/lib/proof-control-plane-seeded-run-service.ts:189`
- E-13 `air-mentor-api/src/lib/proof-control-plane-seeded-run-service.ts:194`
- E-14 `air-mentor-api/src/lib/proof-control-plane-seeded-run-service.ts:202`
- E-15 `air-mentor-api/src/lib/proof-control-plane-seeded-run-service.ts:220`
- E-16 `air-mentor-api/src/lib/proof-control-plane-seeded-run-service.ts:246`
- E-17 `air-mentor-api/src/lib/proof-control-plane-live-run-service.ts:153`
- E-18 `air-mentor-api/src/lib/proof-control-plane-live-run-service.ts:219`
- E-19 `air-mentor-api/src/lib/proof-control-plane-live-run-service.ts:455`
- E-20 `air-mentor-api/src/lib/proof-control-plane-checkpoint-service.ts:99`
- E-21 `air-mentor-api/src/lib/proof-control-plane-checkpoint-service.ts:145`
- E-22 `air-mentor-api/src/lib/proof-control-plane-checkpoint-service.ts:154`
- E-23 `air-mentor-api/src/lib/proof-control-plane-rebuild-context-service.ts:116`
- E-24 `air-mentor-api/src/lib/proof-control-plane-rebuild-context-service.ts:120`
- E-25 `air-mentor-api/src/lib/proof-control-plane-tail-service.ts:149`
- E-26 `docs/closeout/stage-07a-semester-activation-contract-and-seeded-data.md:9`
- E-27 `docs/closeout/stage-07a-semester-activation-contract-and-seeded-data.md:62`
- E-28 `docs/closeout/stage-07a-semester-activation-contract-and-seeded-data.md:67`
- E-29 `docs/closeout/stage-07b-semester-1-to-3-proof-walk.md:36`
- E-30 `docs/closeout/stage-07c-semester-4-to-6-proof-walk.md:28`
- E-31 `audit-map/20-prompts/prompt-index.md:1`
- E-32 `audit-map/20-prompts/prompt-index.md:83`

## Mitigation Plan

### Phase 1

- P1-1 先固化對帳口徑：LC-01/03/04/05/06/08/09/10/12標`needs-doc-update`，僅改reconciliation檔，不碰產品碼。
- P1-2 補語義明文：`restore=activate`、`reset-current-stage=checkpoint-only`、`runtime semester authority=max(end,observed)`。
- P1-3 權威檔缺席先記`open`，待回補後重跑本pass，不觸動frozen appendix。

### Phase 5

- P5-1 將本ledger映射回`contradiction-matrix-proof-lifecycle`，確保claim級追蹤一對一。
- P5-2 對`completed-inspectable vs stopped`建立暫行映射表（`status/activeFlag/playbackAccessible`），避免跨文檔詞義漂移。
- P5-3 對skip旗標建立審計檢核鉤：若`skipArtifactRebuild`或`skipActiveRiskRecompute`為真，必有audit註記。

### Phase 7

- P7-1 回歸鉤子A：抽檢activation雙寫與publish gate（LC-01/02）。
- P7-2 回歸鉤子B：抽檢next-stage gate與semester boundary（LC-10/11）。
- P7-3 交付鉤子：ledger >= 10列（現13），且每列doc/code皆`file:line`。

## Recommendations

- R-01 由closeout owner於07A/07B/07C補生命周期狀態機短節：`setup-draft → active-run → completed-inspectable/stopped → reset-current-stage → complete-reset`，並給欄位映射。
- R-02 將Next Day/Next Stage關卡語義（queue阻塞→playback gate）納入07C敘述，避免前端誤推可播放範圍。
- R-03 對runtime semester authority另立一句硬規則，明示其與activation欄位可短暫分離。
- R-04 權威提示檔與appendix回補後，執行二次reconcile，僅允許文檔對齊，不改產品行為。
