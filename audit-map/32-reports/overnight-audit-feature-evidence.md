# Overnight Audit: Feature / Evidence / Runtime Correctness

本輪唯讀稽核。named authority `audit-map/20-prompts/fresh-sem1-principal-architect-overnight-pass.md` 仍未入 tracked corpus，故本報依 proxy authority：`audit-map/14-reconciliation/final-decision-appendix.md:3-11`、`audit-map/32-reports/overnight-unified-mitigation-plan.md:15-20`、`:88-92`。  
聚焦五端：stage authority、stale checkpoint reuse、Sem1 missingness、quiz/assignment 即時可見、observed-state/runtime authority。  
契約明令 `Map every finding to Phase 2`；故下列 `target_phase` 皆記 `Phase 2`，作統一 intake lane。

## Findings

`F1` `high`：`buildObservableFeaturePayload` 以 `value > 0` 過濾 coursework / term 平均；合法 `0` 分被當缺失。零分 quiz/assignment/TT 可被直接排除出 `courseworkToTtGap` 與相關衍生特徵。碼證：`air-mentor-api/src/lib/proof-risk-model.ts:509-512`, `air-mentor-api/src/lib/proof-risk-model.ts:2300-2301`, `air-mentor-api/src/lib/proof-risk-model.ts:2333-2334`。

`F2` `high`：model schema 已明置 `cgpaMissingScaled` / `backlogMissingScaled`，然 payload builder 仍把缺失旗標預設為 `false`。caller 一旦漏傳，Sem1 unknown 立即偽裝成「非缺失」。碼證：`air-mentor-api/src/lib/proof-risk-model.ts:60-74`, `air-mentor-api/src/lib/proof-risk-model.ts:168-177`, `air-mentor-api/src/lib/proof-risk-model.ts:700-701`, `air-mentor-api/src/lib/proof-risk-model.ts:2276-2278`, `air-mentor-api/src/lib/proof-risk-model.ts:2323-2324`。

`F3` `high`：academic runtime 本身仍造零塌陷。無 profile 時 `prevCgpa` / `fallbackCgpa` 直落 `0`，無 transcript 時 `latestBacklogCount` 直落 `0`；其後此二值直接餵 risk path。碼證：`air-mentor-api/src/modules/academic.ts:1197-1217`, `air-mentor-api/src/modules/academic.ts:3082-3091`, `air-mentor-api/src/modules/academic.ts:3241-3254`, `air-mentor-api/src/modules/academic.ts:3336-3349`。

`F4` `high`：active runtime scorer 未傳 `cgpaMissing` / `backlogMissing`。即便 model 支援 explicit missingness，academic caller 仍只傳 numeric CGPA/backlog。碼證：`air-mentor-api/src/modules/academic.ts:1424-1445`, `air-mentor-api/src/modules/academic.ts:3336-3349`, `air-mentor-api/src/lib/proof-risk-model.ts:2272-2324`。

`F5` `high`：active runtime scorer 未傳 `sourceRefs`；`proof-risk-model` 之 stage one-hot 與 stage×evidence interactions 全賴 `sourceRefs.stageKey`，缺之則全歸零。當前 runtime score 不服權威 run/checkpoint stage。碼證：`air-mentor-api/src/lib/proof-risk-model.ts:210-221`, `air-mentor-api/src/lib/proof-risk-model.ts:641-711`, `air-mentor-api/src/lib/proof-risk-model.ts:2131-2138`, `air-mentor-api/src/modules/academic.ts:1446-1462`。

`F6` `medium`：stage residual 只剩 `semesterProgress = offering.stage / DEFAULT_STAGE_POLICY.stages.length` 之粗代理；此值源自 offering row，非權威 `run.activeStageKey` / selected checkpoint。碼證：`air-mentor-api/src/modules/academic.ts:2593-2614`, `air-mentor-api/src/modules/academic.ts:3346-3349`, `audit-map/32-reports/overnight-unified-mitigation-plan.md:26-27`。

`F7` `critical`：runtime 取 `risk_assessments` 全表，再以 `studentId::offeringId` 選最新 `assessedAt`；`simulationRunId`、`assessmentScope`、`evidenceWindow` 皆未入 key。舊 run / 舊 window / 異 scope 風險可覆當前 truth。碼證：`air-mentor-api/src/db/schema.ts:870-886`, `air-mentor-api/src/modules/academic.ts:2736`, `air-mentor-api/src/modules/academic.ts:2958-2964`, `air-mentor-api/src/modules/academic.ts:3328-3335`。

`F8` `high`：assessment commit route 只寫 `studentAssessmentScores` 與 lock bits，未 invalidate / recompute `riskAssessments`。academic bootstrap 雖把新 cells 回灌 `studentPatches`，但風險仍優先吃 stale `persistedRisk`。故 quiz/assignment 已輸入，risk 未必即見。碼證：`air-mentor-api/src/modules/academic-runtime-routes.ts:1193-1278`, `air-mentor-api/src/modules/academic.ts:3295-3336`, `air-mentor-api/src/modules/academic.ts:3835-3874`, `air-mentor-api/src/modules/academic.ts:3949-3958`。

`F9` `critical`：checkpoint playback 之 observed summary 查整個 run 之 `studentObservedSemesterStates`，僅以 `semesterNumber <= selected.semesterNumber` 篩，再按 `createdAt` 取末值。此法不綁 selected checkpoint，故同學期較後 observed row 可倒灌較前 checkpoint。碼證：`air-mentor-api/src/lib/proof-observed-state.ts:5-10`, `air-mentor-api/src/modules/academic.ts:2802-2818`, `air-mentor-api/src/modules/academic.ts:3408-3426`。

`F10` `high`：playback observed summary 又有 null→0 塌陷。`Number(payload.backlogCount)` 與 `Number(payload.cgpa ?? payload.cgpaAfterSemester)` 直接 coercion；若 JSON 內為 `null`，即可能寫成 `0` 並覆舊值。碼證：`air-mentor-api/src/modules/academic.ts:2811-2818`。

`F11` `medium`：`proof-provenance.ts` 之 provenance 只攜 `simulationRunId` / `simulationStageCheckpointId` / `activeOperationalSemester`；未攜 `stageKey`、`stageOrder`、`evidenceWindow`、`assessedAt` 或 snapshot ids。故 downstream surface 難自證「此風險確服權威 stage / evidence」。碼證：`air-mentor-api/src/lib/proof-provenance.ts:24-30`, `air-mentor-api/src/lib/proof-provenance.ts:32-44`, `air-mentor-api/src/lib/proof-provenance.ts:46-78`。

`F12` `medium`：degraded scorer path 退回 `inferObservableRisk`，其 input type 無 stage / missingness 維，CGPA driver 又僅於 `> 0` 觸發。故 artifact 缺席時，unknown-vs-zero 與 stage authority 仍失真。碼證：`air-mentor-api/src/lib/inference-engine.ts:9-22`, `air-mentor-api/src/lib/inference-engine.ts:53-79`, `air-mentor-api/src/lib/inference-engine.ts:172-186`, `air-mentor-api/src/lib/proof-risk-model.ts:2093-2128`。

## Evidence

- Proxy authority 仍屬 gap：`audit-map/14-reconciliation/final-decision-appendix.md:5-11` 明示 named prompt 缺席；`audit-map/32-reports/overnight-unified-mitigation-plan.md:15-20` 將 Phase 2 定為 proof activation / contract intake，`:88-92` 明記 P2-P5 先收 proof truth 與 contract。
- `air-mentor-api/src/lib/proof-risk-model.ts` 現碼同時揭示兩件事：一、feature schema 已有 missingness 之明文契約；二、runtime caller 若不給 `sourceRefs` / missing flags，stage 與 unknown-vs-zero 皆失真。關鍵段：`:60-74`, `:168-177`, `:641-711`, `:2272-2334`。
- `air-mentor-api/src/modules/academic.ts` 為 drift 主聚點：Sem1 fallback zero、persisted risk reuse、playback observed reuse、checkpoint overlay merge，皆在單一路徑匯流。關鍵段：`:1197-1217`, `:1424-1462`, `:2802-2818`, `:2958-2964`, `:3295-3349`, `:3408-3426`。
- `air-mentor-api/src/modules/academic-runtime-routes.ts` 寫 evidence 後即返回，未見 risk recompute / projection refresh；關鍵段 `:1193-1278`。
- `air-mentor-api/src/lib/proof-observed-state.ts` 與 `air-mentor-api/src/lib/proof-provenance.ts` 皆偏薄：前者只 parse JSON，後者只記 count provenance；兩者皆不足以單獨證 runtime risk authority。見 `air-mentor-api/src/lib/proof-observed-state.ts:5-10`, `air-mentor-api/src/lib/proof-provenance.ts:24-78`。
- `air-mentor-api/src/lib/inference-engine.ts` fallback heuristic 不含 stage / missingness contract；artifact 不可用時仍會放大 unknown-vs-zero drift。見 `:9-22`, `:53-79`, `:172-186`。

## Recommendations

1. `Phase 2` 先封 missingness contract：刪除 zero fallback，caller 必傳 `cgpaMissing` / `backlogMissing`，並為 observed-state/null transcript 建 hard distinction。
2. `Phase 2` 先封 stage authority：runtime score 必帶 authoritative `stageKey` / checkpoint refs；禁以 `offering.stage` 粗代理代替。
3. `Phase 2` 先封 stale reuse：`riskAssessments` key 至少帶 `simulationRunId + assessmentScope + evidenceWindow`；checkpoint playback query 必綁 selected checkpoint 或 predecessor chain。
4. `Phase 2` 先封 immediate visibility：assessment commit 後同步 invalidate / recompute risk rows 與相關 playback/runtime projections。
5. `Phase 2` 補 provenance/guardrail：provenance 增 `stageKey` / `assessedAt` / evidence identity；degraded inference path 亦須保 missingness/stage semantics。

## Findings Table

| ID | severity | target_phase | file:line | expected | current code truth |
| --- | --- | --- | --- | --- | --- |
| F1 | high | Phase 2 | `air-mentor-api/src/lib/proof-risk-model.ts:509-512`; `air-mentor-api/src/lib/proof-risk-model.ts:2300-2301` | `0` 分應為有效 evidence，不得當缺失 | `value > 0` 過濾使零分退出 coursework / term averages |
| F2 | high | Phase 2 | `air-mentor-api/src/lib/proof-risk-model.ts:60-74`; `air-mentor-api/src/lib/proof-risk-model.ts:2276-2278`; `air-mentor-api/src/lib/proof-risk-model.ts:2323-2324` | missingness flags 顯式必填 | builder 以 `false` 補空 |
| F3 | high | Phase 2 | `air-mentor-api/src/modules/academic.ts:1197-1217`; `air-mentor-api/src/modules/academic.ts:3082-3091`; `air-mentor-api/src/modules/academic.ts:3241-3254` | Sem1 unknown prior CGPA/backlog 應保 null/missing | runtime 以 `0` 作 fallback |
| F4 | high | Phase 2 | `air-mentor-api/src/modules/academic.ts:1424-1445`; `air-mentor-api/src/modules/academic.ts:3336-3349`; `air-mentor-api/src/lib/proof-risk-model.ts:2272-2324` | academic caller 應把 missing flags 餵模 | caller 僅傳 numeric CGPA/backlog |
| F5 | high | Phase 2 | `air-mentor-api/src/lib/proof-risk-model.ts:210-221`; `air-mentor-api/src/lib/proof-risk-model.ts:641-711`; `air-mentor-api/src/modules/academic.ts:1446-1462` | stage features 應服 authoritative stageKey | active runtime call 未傳 `sourceRefs`，stage one-hot / interaction 皆歸零 |
| F6 | medium | Phase 2 | `air-mentor-api/src/modules/academic.ts:2593-2614`; `air-mentor-api/src/modules/academic.ts:3346-3349` | stage progress 應取 run/checkpoint authority | 只取 `offering.stage / DEFAULT_STAGE_POLICY.stages.length` |
| F7 | critical | Phase 2 | `air-mentor-api/src/db/schema.ts:870-886`; `air-mentor-api/src/modules/academic.ts:2736`; `air-mentor-api/src/modules/academic.ts:2958-2964`; `air-mentor-api/src/modules/academic.ts:3328-3335` | persisted risk key 應含 run/scope/window | map 僅以 `studentId::offeringId` 取最新 |
| F8 | high | Phase 2 | `air-mentor-api/src/modules/academic-runtime-routes.ts:1193-1278`; `air-mentor-api/src/modules/academic.ts:3295-3336`; `air-mentor-api/src/modules/academic.ts:3949-3958` | entered evidence 應即時更新 risk | route 寫 evidence，risk 仍優先 stale persisted row |
| F9 | critical | Phase 2 | `air-mentor-api/src/lib/proof-observed-state.ts:5-10`; `air-mentor-api/src/modules/academic.ts:2802-2818`; `air-mentor-api/src/modules/academic.ts:3408-3426` | checkpoint playback evidence 應綁 selected checkpoint | 現查 run-wide observed rows，再取 semester/createdAt 末值 |
| F10 | high | Phase 2 | `air-mentor-api/src/modules/academic.ts:2811-2818` | observed `null` 應保 missing | `Number(...)` coercion 可令 `null -> 0` |
| F11 | medium | Phase 2 | `air-mentor-api/src/lib/proof-provenance.ts:24-30`; `air-mentor-api/src/lib/proof-provenance.ts:46-78` | provenance 應足證 stage/evidence authority | 僅記 run/checkpoint/semester 級資訊 |
| F12 | medium | Phase 2 | `air-mentor-api/src/lib/inference-engine.ts:9-22`; `air-mentor-api/src/lib/inference-engine.ts:53-79`; `air-mentor-api/src/lib/proof-risk-model.ts:2093-2128` | degraded path 亦應守 stage/missingness | fallback heuristic 無 stage/missingness 維 |

## Severity Distribution

- `critical`: 2 (`F7`, `F9`)
- `high`: 7 (`F1`, `F2`, `F3`, `F4`, `F5`, `F8`, `F10`)
- `medium`: 3 (`F6`, `F11`, `F12`)
- `low`: 0

## Target-Phase Mapping

| finding | target_phase | mapping note |
| --- | --- | --- |
| F1 | Phase 2 | evidence normalization contract drift，先入 Phase 2 intake |
| F2 | Phase 2 | missingness contract drift，先入 Phase 2 intake |
| F3 | Phase 2 | Sem1 prior authority drift，先入 Phase 2 intake |
| F4 | Phase 2 | caller-to-model contract drift，先入 Phase 2 intake |
| F5 | Phase 2 | stage authority propagation drift，先入 Phase 2 intake |
| F6 | Phase 2 | stage proxy drift，先入 Phase 2 intake |
| F7 | Phase 2 | stale persisted-risk reuse，屬 runtime correctness 核心 |
| F8 | Phase 2 | route write semantics ↔ runtime risk parity drift |
| F9 | Phase 2 | checkpoint evidence authority drift，屬 playback correctness 核心 |
| F10 | Phase 2 | observed-state null handling drift，先入 Phase 2 intake |
| F11 | Phase 2 | provenance insufficiency，先入 Phase 2 intake |
| F12 | Phase 2 | degraded scorer parity drift，先入 Phase 2 intake |
