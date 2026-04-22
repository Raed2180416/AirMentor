# Overnight Impl Phase 1: Run Authority / Fresh-Sem1 Core

- 纪日：`2026-04-23`。
- 依循：`Phase 1` 主收 `P1-1`、`P1-3`、`P1-4`；并借 `P11-2/P11-3` 之 snapshot/boundary gate 收尾。
- 冻结 appendix 未动。
- `src/**/*.tsx` 未触。
- 本轮仅改 write-scope 内 backend / tests / report。
- 关键意图仍守：run authority 入库、runtime 服 active semester、tail 去 sem6 fallback、completed-inspectable 有单一语义。
- Fresh-Sem1 全链未竟；主阻在 out-of-scope bootstrap / control-plane 邻接 typedrift，详后。

## Edits Applied

- `P1-1` `air-mentor-api/src/db/schema.ts:475-510`：为 `simulation_runs` 增 `activeStageKey`、`simulatedDateIso`、`setupConfigJson`、`scenarioConfigJson`、`lifecycleState`、`runMode`、`stageBoundaryJson`。
- `P1-1` `air-mentor-api/src/db/migrations/0020_proof_run_authority.sql:1-57`：以 nullable/dual-write 迁移补列，并对既有 run 回填 lifecycle/runMode/stage defaults。
- `P11-3` `air-mentor-api/src/lib/proof-control-plane-rebuild-context-service.ts:74-135`：增 `buildProofRunStageBoundarySnapshot`，汇 semester→entry/exit stage、strict monotonic flag，供 activation/snapshot 共用。
- `P1-1` `air-mentor-api/src/lib/proof-control-plane-activation-service.ts:33-115`：activation 今双写 `activeStageKey`、`simulatedDateIso`、`lifecycleState`、`stageBoundaryJson`。
- `P11-3` 同文件 `:59-70`：activation 今先验 boundary monotonic；若 lifecycle 为 `stopped`，即拒 activation。
- `P1-1` 同文件 `:93-104`：audit payload 今含 `previousLifecycleState`、`lifecycleState`、`activeStageKey`。
- `P1-3` `air-mentor-api/src/lib/proof-control-plane-runtime-service.ts:188-222`：抽 `resolveRuntimeCurrentSemesterNumber` 与 `buildLatestHistoricalPayloadByStudent`。
- `P1-3` 同文件 `:330-331`：runtime recompute 今先服 `run.activeOperationalSemester`；不再被 terminal semester 强拖。
- `P1-3` `air-mentor-api/src/lib/proof-control-plane-seeded-run-service.ts:173-299`：删 fake observed→`studentAcademicProfiles.prevCgpaScaled` 回写。
- `P11-2` 同文件 `:195-245`：seeded baseline snapshot 今附 `runAuthority`、`setupConfig`、`scenarioConfig`。
- `P1-4` 同文件 `:264-299`：seeded finalize 今写 `completed-inspectable` lifecycle、`runMode='seeded-proof'`、`activeStageKey`、`stageBoundaryJson`。
- `P1-4` `air-mentor-api/src/lib/proof-control-plane-live-run-service.ts:221-287`：live run create/deactivate path 今双写 `lifecycleState`、`runMode`、`setupConfigJson`、`scenarioConfigJson`、`simulatedDateIso`。
- `P11-2` 同文件 `:452-505`：live baseline snapshot 今附 authority sidecar；finalize 同步写 run authority fields。
- `P1-4` `air-mentor-api/src/lib/proof-control-plane-tail-service.ts:121-133`：增 helper，明 `stopped/archived` 非 inspectable。
- `P1-4` 同文件 `:429-458`：tail 只取 inspectable active rows；若无 current semester authority，则 explicit unavailable。
- `P1-4` 同文件 `:603-646`：elective/count provenance 今服 resolved semester；旧 `?? 6` fallback 已去。
- `Phase 1` 补充 `air-mentor-api/src/lib/proof-control-plane-seeded-semester-service.ts:25-44`：historical builder type 吃既存 call-site extra prop，免局部 contract 再裂。

## Tests Added / Updated

- `air-mentor-api/tests/proof-control-plane-activation-service.test.ts:1-253`：扩 existing unit pack。
- 同文件：验 semester activate 后 authority fields 与 audit payload 俱齐。
- 同文件：验 fresh-sem activate 必落 `pre-tt1` entry stage，且写 lifecycle/stageBoundary。
- 同文件：验 `stopped -> active` 非法。
- `air-mentor-api/tests/proof-control-plane-runtime-service.test.ts:1-41`：新增 runtime authority pack。
- 同文件：验 recompute semester 取 `activeOperationalSemester`，不取 sem6 residue。
- 同文件：验 semester1 前无 prior CGPA/backlog baseline。
- `air-mentor-api/tests/proof-control-plane-tail-service.test.ts:1-18`：新增 tail helper pack。
- 同文件：验 no-active authority 时回 `null`，不默降 sem6。
- 同文件：验 `completed-inspectable` 可读、`stopped` 不可读。
- `air-mentor-api/tests/proof-control-plane-seeded-run-service.test.ts:1-161`：新增 seeded finalize pack。
- 同文件：验 finalize 不再需 live-profile writeback 才能过；并写 `completed-inspectable` authority snapshot。

## Validation Run

- 已跑：`npm --prefix air-mentor-api test -- tests/proof-control-plane-activation-service.test.ts tests/proof-control-plane-runtime-service.test.ts tests/proof-control-plane-tail-service.test.ts tests/proof-control-plane-seeded-run-service.test.ts`。
- 结果：`4` files 皆过，`10` tests 皆过。
- 已试：`npm --prefix air-mentor-api run build`。
- build 未过，然现存阻点皆在 out-of-scope 邻接 typedrift：
- `air-mentor-api/src/lib/msruas-proof-control-plane.ts:205` 缺 `PROOF_SEMESTER_SIM_START_DATES` export。
- `air-mentor-api/src/lib/msruas-proof-control-plane.ts:4060` 之 `PreparedSeededProofRunBootstrap.offeringBySemesterCourseTitleSection` 型别未补。
- `air-mentor-api/src/lib/msruas-proof-control-plane.ts:4108` 之 `BuildSeededScaffoldingInput` 未纳既存 prop。
- `air-mentor-api/src/lib/msruas-proof-control-plane.ts:4524` 之 `ProofControlPlaneSeededBootstrapServiceDeps.ensureProofOfferings` 未纳。
- 本轮新增/所改 touched packs 未见 fail。

## Remaining Risk

- 最大余险：`P1-2` 主体仍卡 `air-mentor-api/src/lib/proof-control-plane-seeded-bootstrap-service.ts` 与 `air-mentor-api/src/lib/msruas-proof-control-plane.ts`；二者皆不在 write scope。
- 故 `ensureSem6Offerings` 与 full Fresh-Sem1 seed lane 仍未整链翻转。
- 现况已收者：runtime/tail 不再把 sem6 当隐式 authority；lifecycle/run snapshot 已可审。
- 现况未收者：seed generation 本体仍可产 sem6-first residue；若要真做到 “no fake prior transcript/history”，须下轮开 `P1-2` 主文件 scope。
- migration 已备，然未跑 full integration suite；若 downstream 依赖老 flat run contract，需观察 dual-write reader 行为。
- live-run 亦仅收 authority sidecar；其阶段语义仍多依 observed evidence，而非单一 run-wide stage。
- 建议后续：先解 out-of-scope typedrift，再开 bootstrap/control-plane 真正 Fresh-Sem1 lane，后补 integration pass 覆 seeded path。
