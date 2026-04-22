# Overnight Impl Phase 2: Feature / Evidence / Runtime Correctness

此 pass 依 `Phase 2` 施工，主據 `audit-map/14-reconciliation/overnight-implementation-plan.md:35-60`
與 `audit-map/32-reports/overnight-audit-feature-evidence.md:44-48`。
命名 authoritative prompt 檔於 tracked corpus 未見，故僅循 frozen appendix 不改、implementation plan、feature/evidence audit 三者收斂。
本次僅作手術式修補；`src/**/*.tsx` 未動，UI/UX 流不變。

## Edits Applied

1. `P2-1` `0` 分與 missingness 分離。
   碼證：`air-mentor-api/src/lib/proof-risk-model.ts:515-519`, `air-mentor-api/src/lib/proof-risk-model.ts:2306-2340`。
   加 `averageObservedEvidence(...)`；coursework / term averages 改收一切有限數值，故 `0` 分 quiz、assignment、TT 不再被 `> 0` 誤刪。
   `courseworkToTtGap` 今真反映「零分已觀測」而非「證據缺失」。

2. `P2-2` degraded scorer 補 explicit missingness。
   碼證：`air-mentor-api/src/lib/inference-engine.ts:9-25`, `air-mentor-api/src/lib/inference-engine.ts:56-77`。
   `ObservableInferenceInput` 補 `cgpaMissing`、`backlogMissing`、`stageKey`。
   driver 推斷今於 missing flag 為真時不再把 `CGPA=0`、`backlog=0` 視作真零值風險；然 `tt1Pct=0` 仍保留為已觀測低分。

3. `P2-2` live academic scorer 改服 authority stage 與 source refs。
   碼證：`air-mentor-api/src/modules/academic.ts:1156-1197`, `air-mentor-api/src/modules/academic.ts:1444-1523`, `air-mentor-api/src/modules/academic.ts:3341-3425`。
   補 `resolveAuthoritativeStageOrder(...)` 與 `buildAcademicObservableSourceRefs(...)`。
   live score path 今傳 `cgpaMissing/backlogMissing/sourceRefs`；stage 取 `checkpoint.stageKey ?? run.activeStageKey`，不再由 evidence presence 或 `offering.stage` 粗代理奪權。

4. `P2-2` Sem1 prior history 改 null-safe。
   碼證：`air-mentor-api/src/modules/academic.ts:3341-3359`。
   無 transcript 時，`cgpaMissing/backlogMissing` 顯式置真；authoritative CGPA/backlog 與 missingness 分軌，不再把未知 prior history 靜默塌為 worst-case numeric evidence。

5. `P2-3` checkpoint observed-state 綁定 selected checkpoint 時線。
   碼證：`air-mentor-api/src/lib/proof-observed-state.ts:13-41`, `air-mentor-api/src/modules/academic.ts:2863-2907`。
   補 `readObservedNullableNumber(...)`、`readObservedStateNumber(...)`、`observedStateRowOccurredAt(...)`、`selectObservedRowsThroughCheckpoint(...)`。
   playback summary 今只吃 `<= selected checkpoint.createdAt` 之 observed rows，且 `null` 保 `null`，不再 `Number(null) -> 0`。

6. `P2-3` stale persisted risk 不再主導 live bootstrap。
   码证：`air-mentor-api/src/modules/academic.ts:3366-3425`, `air-mentor-api/src/modules/academic.ts:3450-3474`。
   prerequisite source 固定為當前 offering / authoritative observed evidence；result 用 `Ongoing`，live bootstrap 每次 fetch 依當前 evidence 重算 risk，不再重用異 window / 異 run 之 stale row 作顯示 truth。

7. `P2-3` route write semantics 與 runtime visibility 對齊。
   码证：`air-mentor-api/src/modules/academic-runtime-routes.ts:211-221`, `air-mentor-api/src/modules/academic-runtime-routes.ts:1037-1071`, `air-mentor-api/src/modules/academic-runtime-routes.ts:1130-1295`。
   新增 `upsertStudentPatchShadow(...)`。
   attendance commit 今同步落 `present` / `totalClasses` shadow；assessment commit 今同步落 `tt1LeafScores`、`tt2LeafScores`、`quizScores`、`assignmentScores`、`seeScore`。
   故新证据一经写入，下一次 bootstrap 即可见；quiz/assignment 不再待旧 persisted risk 刷新后方能反映。

## Tests Added / Updated

1. `air-mentor-api/tests/proof-risk-model.test.ts:201-302`
   补 low-confidence fallback assertion：`queuePriorityScore=0`、`rankingAllowed=false`。
   新增 zero-vs-missingness unit：验 `tt1Pct=0`、`quizPct=0` 保留，`seePct=null` 仍为缺失，`cgpaMissing/backlogMissing` 真入 payload。

2. `air-mentor-api/tests/msruas-proof-engines.test.ts:283-307`
   新增 degraded inference regression：无 prior history 时不应因 `0` 被误判为 `cgpa/backlog` driver；然 `tt1=0` 仍须触发低分证据。

3. `air-mentor-api/tests/academic-parity.test.ts:786-971`
   新增 stale persisted risk regression。
   新增 immediate quiz visibility + authoritative run stage regression。
   新增 checkpoint playback observed-state timeline binding regression。

## Validation Run

1. `npm exec vitest run tests/proof-risk-model.test.ts tests/msruas-proof-engines.test.ts`
   结果：通过。
   摘要：`Test Files  2 passed (2)`；`Tests  12 passed (12)`。

2. `npm exec vitest run tests/academic-parity.test.ts`
   结果：此 sandbox 受阻。
   阻因：embedded postgres 起监听时报 `Error: listen EPERM: operation not permitted 127.0.0.1`。
   故 integration specs 已写成、未能于本环境全跑。

3. `npm exec -- tsc -p tsconfig.json --noEmit`
   结果：本次改动外仍有既存型别漂移。
   阻因集中于 `air-mentor-api/src/lib/msruas-proof-control-plane.ts`，属 write scope 外既存问题，非本 pass 新引。

## Remaining Risk

1. integration parity suite 仍待可开本地 socket 之环境复跑；当前仅 unit lane 已证。
2. repo 尚存 write-scope 外 TypeScript 旧错，遮蔽全量 `tsc` 绿灯。
3. 本次以 live recompute + authoritative observed-state 断 stale reuse；若后续需把同等 authority 外显至更多 provenance surface，仍须下游 consumer 同步收 contract。
