# Overnight Audit: Feature / Evidence / Runtime Correctness

本報唯讀稽核。權威 prompt / handoff 名稱檔於 tracked corpus 缺席，故依 `audit-map/14-reconciliation/final-decision-appendix.md:3-10` 與 `audit-map/32-reports/overnight-unified-mitigation-plan.md:15-20` 行 proxy authority。  
本輪聚焦：stage authority、stale checkpoint reuse、Sem1 missingness、quiz/assignment 即時可見性、observed-state authority。  
契約指定 `Map every finding to Phase 2`；故下列 finding 之 `target_phase` 皆記 `Phase 2`，作 intake lane 之統一歸口。

## Findings

`F1` `high`：quiz/assignment 之 stage gate 只鎖 `lock=true`，平時 save 不受 stage 限；然 runtime scorer 會無條件讀最新 assessment rows 算 `quizPct` / `assignmentPct`。故未達權威 stage 之前，草稿分數已可滲入風險。碼證：`air-mentor-api/src/modules/academic-runtime-routes.ts:1127-1141`, `air-mentor-api/src/modules/academic.ts:3268-3285`, `air-mentor-api/src/modules/academic.ts:3336-3349`。

`F2` `high`：runtime model call 未傳 `sourceRefs.stageKey`。`proof-risk-model` 之 stage one-hot 與 stage×evidence interaction 全賴 `sourceRefs.stageKey`；缺之則皆歸零，模型無從服從權威 run/checkpoint stage。碼證：`air-mentor-api/src/lib/proof-risk-model.ts:210-221`, `air-mentor-api/src/lib/proof-risk-model.ts:651-711`, `air-mentor-api/src/modules/academic.ts:1424-1462`。

`F3` `high`：Sem1 prior CGPA/backlog missingness 仍 silent zero-collapse。`computeTranscriptAnalytics` 於無 transcript 時回 `fallbackCgpa`，最新 backlog 缺值則直落 `0`；其後 runtime builder 又未傳 `cgpaMissing` / `backlogMissing`，使 `buildObservableFeaturePayload` 以預設 `false` 落模。碼證：`air-mentor-api/src/modules/academic.ts:1197-1217`, `air-mentor-api/src/modules/academic.ts:3241-3254`, `air-mentor-api/src/modules/academic.ts:3336-3349`, `air-mentor-api/src/lib/proof-risk-model.ts:168-177`, `air-mentor-api/src/lib/proof-risk-model.ts:2272-2324`。

`F4` `critical`：`latestRiskAssessmentByStudentOffering` 僅以 `studentId::offeringId` 取最新 `assessedAt`，不帶 `simulationRunId`、`assessmentScope`、`evidenceWindow`、checkpoint 維。故舊 run / 舊 checkpoint / 異 evidence window 之風險可覆當前 runtime truth。碼證：`air-mentor-api/src/db/schema.ts:870-889`, `air-mentor-api/src/modules/academic.ts:2736`, `air-mentor-api/src/modules/academic.ts:2958-2964`, `air-mentor-api/src/modules/academic.ts:3328-3335`。

`F5` `high`：assessment write path 寫入 `studentAssessmentScores` 與 lock bits 後即返回，未重算 / 失效化 `riskAssessments` 或 stage projection；bootstrap 只把新 cells 塞進 `runtime.studentPatches`，但 `studentsByOffering[*].riskProb/riskBand` 仍優先吃 stale `persistedRisk`。故「已輸入 quiz/assignment，風險應即刻可見」今未保證。碼證：`air-mentor-api/src/modules/academic-runtime-routes.ts:1193-1278`, `air-mentor-api/src/modules/academic.ts:3295-3336`, `air-mentor-api/src/modules/academic.ts:3835-3874`, `air-mentor-api/src/modules/academic.ts:3951-3958`。

`F6` `critical`：checkpoint playback 之 observed summary 取整個 run 之 `studentObservedSemesterStates`，僅以 `semesterNumber <= selected.semesterNumber` 篩；後再按 `createdAt` 取末值。此法不綁 selected checkpoint，故同學期較後 checkpoint 之 `cgpa/backlog` 可倒灌較前 checkpoint。碼證：`air-mentor-api/src/lib/proof-observed-state.ts:3-10`, `air-mentor-api/src/modules/academic.ts:2802-2818`, `air-mentor-api/src/modules/academic.ts:3408-3426`。

`F7` `high`：course-leader proof scope access 亦用 run-wide observed rows 判權，只要任一 observed row 之 `offeringId` 屬 owned offering，即視為 scope 內；未綁 selected checkpoint / semester。故 stale observed evidence 可擴權。碼證：`air-mentor-api/src/lib/proof-observed-state.ts:3-10`, `air-mentor-api/src/modules/academic.ts:1035-1046`。

`F8` `medium`：`parseObservedStatePayload` 以 `Record<string, unknown>` 接萬形 JSON，parse fail 則回 `{}`；下游再直接讀 `offeringId`、`cgpa`、`cgpaAfterSemester`、`backlogCount`。此為 silent corruption path：髒 payload 不 fail-fast，只轉成空缺或舊值延續。碼證：`air-mentor-api/src/lib/proof-observed-state.ts:3-10`, `air-mentor-api/src/modules/academic.ts:1039-1042`, `air-mentor-api/src/modules/academic.ts:2811-2818`。

`F9` `medium`：若 model artifact 缺席或 schema 不符，`scoreObservableRiskWithModel` 退回 `inferObservableRisk`；然 fallback input 無 stage / missingness 維，且 CGPA 僅於 `>0` 時生效。故 degraded path 仍保留 Sem1 unknown→no-driver 之錯誤語義。碼證：`air-mentor-api/src/lib/proof-risk-model.ts:2093-2128`, `air-mentor-api/src/lib/inference-engine.ts:9-22`, `air-mentor-api/src/lib/inference-engine.ts:53-79`, `air-mentor-api/src/lib/inference-engine.ts:172-186`。

## Evidence

- Proxy authority：`audit-map/14-reconciliation/final-decision-appendix.md:3-10` 明示 named prompt 缺席；`audit-map/32-reports/overnight-unified-mitigation-plan.md:15-20` 提供本 pass 之 Phase 2 intake lane。
- `air-mentor-api/src/lib/proof-risk-model.ts`：stage indicators 只由 `sourceRefs.stageKey` 供入；missingness flags 有定義，caller 若不傳則落預設。見 `:210-221`, `:651-711`, `:2272-2324`。
- `air-mentor-api/src/lib/inference-engine.ts`：fallback heuristic 僅看 raw numerics，無 stage/missingness。見 `:9-22`, `:53-79`, `:172-186`。
- `air-mentor-api/src/lib/proof-observed-state.ts`：observed payload 無 schema、parse fail 回 `{}`。見 `:3-10`。
- `air-mentor-api/src/lib/proof-provenance.ts`：此檔僅標 count provenance，未見直接改寫 risk/evidence truth 之碼路；本輪無 blocking drift，僅作 coverage anchor。見 `:24-29`, `:46-78`。
- `air-mentor-api/src/modules/academic-runtime-routes.ts`：assessment save 與 lock semantics 分離，stage gate 只護 lock。見 `:1127-1141`, `:1193-1278`。
- `air-mentor-api/src/modules/academic.ts`：runtime bootstrap 同時存在三條 drift 路：stale `persistedRisk` 優先、run-wide observed reuse、runtime patch 與 risk 投影分流。見 `:2802-2818`, `:2958-2964`, `:3268-3350`, `:3408-3443`, `:3835-3958`。

## Recommendations

1. `Phase 2` 先封 `F1/F2`：runtime scorer 與 write routes 皆須吃權威 `simulationRunId + simulationStageCheckpointId + stageKey`；未達 stage 之 quiz/assignment draft 不得入 current scoring。
2. `Phase 2` 先封 `F3/F9`：academic runtime caller 必傳 `cgpaMissing` / `backlogMissing`，並補 degraded heuristic 之 unknown-vs-zero contract；Sem1 不得再以 `0/0/false/false` 偽裝。
3. `Phase 2` 先封 `F4/F5`：assessment commit 後須同步 invalidate 或 recompute 相關 `riskAssessments` / playback projections；key 至少帶 `simulationRunId + evidenceWindow`，若有 checkpoint 則再帶 checkpoint。
4. `Phase 2` 先封 `F6/F7`：checkpoint playback / scope access 不得查 run-wide latest；必以 selected checkpoint 或其明確 predecessor chain 取 evidence。
5. `Phase 2` 先封 `F8`：為 `observedStateJson` 建 schema parser，parse fail 即 hard error / audit event；禁 `{}` fallback 靜默吞錯。

## Findings Table

| ID | severity | target_phase | file:line | expected | current code truth |
| --- | --- | --- | --- | --- | --- |
| F1 | high | Phase 2 | `air-mentor-api/src/modules/academic-runtime-routes.ts:1127-1141`; `air-mentor-api/src/modules/academic.ts:3268-3285`; `air-mentor-api/src/modules/academic.ts:3336-3349` | quiz/assignment 只於權威 stage 後入 risk | save 時可先寫，runtime 立刻讀 rows 算 risk |
| F2 | high | Phase 2 | `air-mentor-api/src/lib/proof-risk-model.ts:210-221`; `air-mentor-api/src/lib/proof-risk-model.ts:651-711`; `air-mentor-api/src/modules/academic.ts:1424-1462` | stage derivation 服 authoritative run/checkpoint stage | active runtime call 未傳 `stageKey`，stage one-hot 與 interaction 皆歸零 |
| F3 | high | Phase 2 | `air-mentor-api/src/modules/academic.ts:1197-1217`; `air-mentor-api/src/modules/academic.ts:3241-3254`; `air-mentor-api/src/lib/proof-risk-model.ts:2272-2324` | Sem1 unknown ≠ zero，missingness 顯式入模 | CGPA/backlog 缺值塌為 `0` 與 `false` |
| F4 | critical | Phase 2 | `air-mentor-api/src/db/schema.ts:870-889`; `air-mentor-api/src/modules/academic.ts:2736`; `air-mentor-api/src/modules/academic.ts:2958-2964`; `air-mentor-api/src/modules/academic.ts:3328-3335` | persisted risk key 應含 run/checkpoint/evidence window | map 僅以 `studentId::offeringId` 取最新行 |
| F5 | high | Phase 2 | `air-mentor-api/src/modules/academic-runtime-routes.ts:1193-1278`; `air-mentor-api/src/modules/academic.ts:3295-3336`; `air-mentor-api/src/modules/academic.ts:3951-3958` | 已輸入 evidence 即時反映 risk | route 寫 cells 後未重算 risk，bootstrap 仍優先 stale persisted risk |
| F6 | critical | Phase 2 | `air-mentor-api/src/lib/proof-observed-state.ts:3-10`; `air-mentor-api/src/modules/academic.ts:2802-2818`; `air-mentor-api/src/modules/academic.ts:3408-3426` | playback observed state 應綁 selected checkpoint | 查 run 全量，再以 semester/createdAt 取末值 |
| F7 | high | Phase 2 | `air-mentor-api/src/lib/proof-observed-state.ts:3-10`; `air-mentor-api/src/modules/academic.ts:1035-1046` | proof access 應綁 selected checkpoint/scope | 任一 run-wide observed row 命中 owned offering 即授權 |
| F8 | medium | Phase 2 | `air-mentor-api/src/lib/proof-observed-state.ts:3-10`; `air-mentor-api/src/modules/academic.ts:2811-2818` | observed payload 應 schema-validated | parse fail 回 `{}`，下游靜默吞錯 |
| F9 | medium | Phase 2 | `air-mentor-api/src/lib/proof-risk-model.ts:2093-2128`; `air-mentor-api/src/lib/inference-engine.ts:53-79`; `air-mentor-api/src/lib/inference-engine.ts:172-186` | degraded path 仍守 stage/missingness authority | fallback heuristic 無 stage/missingness，unknown 可被誤當 no-risk |

## Severity Distribution

- `critical`: 2 (`F4`, `F6`)
- `high`: 5 (`F1`, `F2`, `F3`, `F5`, `F7`)
- `medium`: 2 (`F8`, `F9`)
- `low`: 0

## Target-Phase Mapping

| finding | target_phase | mapping note |
| --- | --- | --- |
| F1 | Phase 2 | stage-gated evidence write 為 control-plane/runtime contract intake |
| F2 | Phase 2 | authoritative stage propagation 屬 Phase-2 parity gate |
| F3 | Phase 2 | missingness drift 雖於 unified plan 後段再拆，然本 pass 契約仍先回 Phase 2 intake |
| F4 | Phase 2 | persisted-risk key correctness 屬 runtime control-plane truth |
| F5 | Phase 2 | route write semantics ↔ runtime projection parity 屬 Phase-2 control-plane contract |
| F6 | Phase 2 | checkpoint playback evidence authority 屬 Phase-2 proof parity |
| F7 | Phase 2 | proof scope gating 之 authority drift 先入 Phase 2 |
| F8 | Phase 2 | observed-state parser contract 為 Phase-2 producer/consumer hygiene |
| F9 | Phase 2 | degraded scorer parity 先作 Phase-2 intake，後續可再分派 ML lane |
