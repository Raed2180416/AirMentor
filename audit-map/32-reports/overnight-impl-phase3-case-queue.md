# Overnight Impl Phase 3: Primary Case / Queue / Workflow

- 期：依 `audit-map/14-reconciliation/overnight-implementation-plan.md:84-106` 之 Phase 3，收 primary case / workflow task / active-run / queue lineage 四脈。
- 法：僅改 owner lib 與測；`src/**/*.tsx`、frozen appendix、scope 外 runtime producer/consumer 未觸。
- 權柄 caveat：named authority prompt 缺席仍如前；本報仍依 unified plan / ledger / case-queue audit 與現碼落地。

## Implementation Plan

1. `air-mentor-api/src/lib/proof-queue-governance.ts`
   - 補 `concernContextKey`、`concernFamily`、`caseId` canonical contract。
   - 內部按 concern context 分組；外留 legacy alias，免 scope 外 caller 立斷。
   - primary-case lifecycle 與 workflow-task action 明拆；`dismissed/handled`、`reopenedFromCaseId`、count helper 同源。
2. `air-mentor-api/src/lib/monitoring-engine.ts`
   - manual teacher concern 視作 intervention。
   - owner rule 固為 `High→Mentor`、`Medium/Low→Course Leader`；HoD 僅 oversight。
   - ownership drift 直接輸出 `workflowTaskAction='reassign'`。
3. `air-mentor-api/src/lib/proof-active-run.ts`
   - selector 若見 lifecycle signal，唯選 active row；非 active row 不得憑 recency 奪權。
4. `air-mentor-api/src/lib/proof-run-queue.ts`
   - enqueue 默姿改 `activate=false`。
   - retry 改生新 attempt row，保 lineage。
   - worker 加 execution-start fence；lease 失主前止重放。
5. `air-mentor-api/tests/**`
   - 補 collision / reopen / watch-count / ownership-rewire / active-run / queue lineage 測。

## Edits Applied

- `air-mentor-api/src/lib/proof-queue-governance.ts:18-85`
  - 新增 `ProofQueueConcernFamily`、canonical status、workflow action、`concernContextKey` / `caseId` / `reopenedFromCaseId` / `ownershipChanged` / `manualInterventionCount`。
- `air-mentor-api/src/lib/proof-queue-governance.ts:141-202`
  - 新增 fallback concern family、context-key builder、case-id builder、`proofQueueCountsTowardCapacity`、prior-state resolver。
- `air-mentor-api/src/lib/proof-queue-governance.ts:282-357`
  - `createCaseDecision` 今同時計 legacy status 與 canonical status；`resolved -> dismissed`、closed→new deterioration 則 `canonicalStatus='reopened'` 且生新 `caseId`。
- `air-mentor-api/src/lib/proof-queue-governance.ts:360-518`
  - queue governance 今按 concern context 分組、排序、入 cap；watch/close path 皆產 canonical decision。
- `air-mentor-api/src/lib/proof-queue-governance.ts:531-560`
  - 回傳新增 `decisionsByConcernContextKey` 與 `decisionContextKeysByLegacyCaseKey`；legacy `decisions` 仍保 best-effort alias。
- `air-mentor-api/src/lib/monitoring-engine.ts:1-29`
  - input/output contract 補 `manualConcernCreated`、`manualInterventionCount`、`currentOwnerRole`、`workflowTaskAction`、`ownershipChanged`、HoD oversight metadata。
- `air-mentor-api/src/lib/monitoring-engine.ts:37-128`
  - decision builder 今以 manual concern 疊加 intervention count；owner 轉移即 `reassign`；HoD 不再作 task owner。
- `air-mentor-api/src/lib/proof-active-run.ts:1-37`
  - 新增 `isActiveProofRunCandidate`；若 row 自帶 `activeFlag/status/lifecycleState`，selector 僅食 active 候選。
- `air-mentor-api/src/lib/proof-run-queue.ts:57-62`
  - 新增 `ProofRunLeaseLostError`，供 worker fence path 使用。
- `air-mentor-api/src/lib/proof-run-queue.ts:138-217`
  - enqueue default activate 改 false；queued progress 保 `requestedActivate=false`，除非 caller 明示 opt-in。
- `air-mentor-api/src/lib/proof-run-queue.ts:220-297`
  - retry 不再覆寫舊 row；今插入新 `simulationRunId`，`parentSimulationRunId=retryOf`，並記 `attemptNumber`。
- `air-mentor-api/src/lib/proof-run-queue.ts:300-365`
  - claim SQL 今拒 reclaim 已 `executionStarted=true` 之 running row；mark-start 另寫 execution fence。
- `air-mentor-api/src/lib/proof-run-queue.ts:421-520`
  - execute path 先驗 lease 仍屬己，再啟 run；失主則 skip，不再 fail 與重放同一 run。
- `air-mentor-api/tests/proof-queue-governance.test.ts:8-266`
  - 補 canonical fixture、`concernContextKey` collision、reopen-new-case、watch count separation 斷言。
- `air-mentor-api/tests/msruas-proof-engines.test.ts:243-310`
  - 補 monitoring workflow action、manual concern intervention、ownership rewire 斷言。
- `air-mentor-api/tests/proof-active-run.test.ts:1-53`
  - 補 active selector 之 recency-vs-active truth 測。
- `air-mentor-api/tests/proof-run-queue.test.ts:11-227`
  - 補 `activate=false` 默姿、retry lineage、新 SQL fence 與 worker stop path 調整。

## Tests Added / Updated

- `air-mentor-api/tests/proof-queue-governance.test.ts`
  - `keeps colliding legacy case keys split by concernContextKey`
  - `opens a new case episode when deterioration returns after dismissal`
  - `keeps workflow watch items visible without counting them as blocking primary capacity`
- `air-mentor-api/tests/msruas-proof-engines.test.ts`
  - `treats manual teacher concerns as interventions and rewires workflow ownership immediately`
  - 既有 monitoring assertions 今補 `workflowTaskAction`
- `air-mentor-api/tests/proof-active-run.test.ts`
  - active-only selection
  - no-active-row => `null`
- `air-mentor-api/tests/proof-run-queue.test.ts`
  - queued rerun default non-activating
  - retry creates fresh attempt row
  - worker claim SQL 含 execution-start fence

## Validation Run

- 已過：
  - `npm exec vitest run tests/proof-queue-governance.test.ts tests/msruas-proof-engines.test.ts tests/proof-active-run.test.ts tests/proof-run-queue.test.ts`
  - 結果：`4` files / `18` tests 皆過。
- 未全過：
  - `npm exec -- tsc -p tsconfig.json --noEmit`
  - 阻於既存 scope 外 `air-mentor-api/src/lib/msruas-proof-control-plane.ts`
  - 錯串：
    - `Module '"./msruas-proof-sandbox.js"' has no exported member 'PROOF_SEMESTER_SIM_START_DATES'.`
    - `Property 'offeringBySemesterCourseTitleSection' does not exist on type 'PreparedSeededProofRunBootstrap'.`
    - `Object literal may only specify known properties, but 'offeringBySemesterCourseTitleSection' does not exist in type 'BuildSeededScaffoldingInput'.`
    - `Object literal may only specify known properties, and 'ensureProofOfferings' does not exist in type 'ProofControlPlaneSeededBootstrapServiceDeps'.`

## Remaining Risk

- `proof-queue-governance.ts` 今已給 `decisionsByConcernContextKey` canonical map；然 scope 外 playback/runtime consumer 仍主讀 legacy `decisions` alias。若欲全線 `concernContextKey everywhere`，後續須同步 producer/consumer cutover。
- reopen/new-case semantics 今在 governance contract 與測已固；若下游持久層欲把舊案閉、新案開寫入 DB，仍需 scope 外 queue-case writer 同步。
- monitoring ownership rewire 已成 signal；實際 task row rewrite 之 consumer 若仍忽略 `workflowTaskAction`，則只得 best-effort。
- queue execution fence 取「已開執行者不自動 reclaim」之保守策；若 worker 於 mark-start 後硬死，後續需 manual retry 新 attempt row，而非舊 row 自動重放。
