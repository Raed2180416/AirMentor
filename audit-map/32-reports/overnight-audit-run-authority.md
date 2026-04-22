# Overnight Audit: Run Authority / Fresh-Sem1 Core

- 依 frozen appendix，named authority prompt 缺席；今以 proxy authority 與 unified mitigation plan 映 `Phase 1/5/11`。證：`audit-map/14-reconciliation/final-decision-appendix.md:5-11`，`audit-map/32-reports/overnight-unified-mitigation-plan.md:3-5`。
- 核心準則：run authority 必可持久化、Fresh Sem1 / pre-tt1 不得預灌 sem6、`completed-inspectable` 與 stop/activate/reset 須語義單一、stage boundary 須可驗可拒。

## Findings

- RA-01 `critical` `Phase 1`：`simulation_runs` schema 未承載 `activeStageKey`、`simulatedDateIso`、`setupConfigJson`、`scenarioConfigJson`、`lifecycleState`、`runMode`、`stageBoundaryJson`；然 façade 仍讀寫其中多欄，authority source 斷裂。證：`air-mentor-api/src/db/schema.ts:475-505`，`air-mentor-api/src/lib/msruas-proof-control-plane.ts:3326-3327`，`air-mentor-api/src/lib/msruas-proof-control-plane.ts:4342-4352`。
- RA-02 `critical` `Phase 1`：seeded bootstrap 仍以 sem6 為起點；建 run 前即 `ensureSem6Offerings`，且寫 `semesterEnd: 6`、`activeOperationalSemester: 6`。Fresh Sem1 入口未成立。證：`air-mentor-api/src/lib/proof-control-plane-seeded-bootstrap-service.ts:61-65`，`air-mentor-api/src/lib/proof-control-plane-seeded-bootstrap-service.ts:81-105`。
- RA-03 `critical` `Phase 1`：seeded semester builder 固定生成 sem1..5 歷史 transcript / observed rows；Fresh Sem1 所要求「無假既往 transcript」失守。證：`air-mentor-api/src/lib/proof-control-plane-seeded-semester-service.ts:92-358`，`air-mentor-api/src/lib/proof-control-plane-seeded-semester-service.ts:322-356`，`air-mentor-api/src/lib/msruas-proof-control-plane.ts:4140-4163`。
- RA-04 `high` `Phase 1`：同一路徑又必造 sem6 operational rows、risk、intervention、elective，將「fresh-sem1 core」與 terminal-sem6 residue 綁死。證：`air-mentor-api/src/lib/proof-control-plane-seeded-semester-service.ts:367-518`，`air-mentor-api/src/lib/msruas-proof-control-plane.ts:4174-4184`。
- RA-05 `high` `Phase 1`：seeded finalizer 以假造 `observedRows` 回寫 `studentAcademicProfiles.prevCgpaScaled`，將模擬歷史滲入 live academic profile authority。證：`air-mentor-api/src/lib/proof-control-plane-seeded-run-service.ts:172-186`。
- RA-06 `critical` `Phase 1`：runtime recompute 全不看 `run.activeOperationalSemester`；其 `currentSemesterNumber = max(run.semesterEnd, observed max)`，後續 active evidence / risk 皆按該 terminal semester 落盤。semester activation 與 active risk authority 可漂移。證：`air-mentor-api/src/lib/proof-control-plane-runtime-service.ts:294-297`，`air-mentor-api/src/lib/proof-control-plane-runtime-service.ts:404-418`，`air-mentor-api/src/lib/proof-control-plane-runtime-service.ts:686-730`。
- RA-07 `high` `Phase 1`：active-run state contract 分裂。seeded/live finalizer 令 run 成 `status='completed'` 且 `activeFlag=1`；tail/batch selector 多憑 `activeFlag===1` 取 active run；但 explicit activate path 又將 target run 改成 `status='active'`。`completed-inspectable` 未被單一後端語義收束。證：`air-mentor-api/src/lib/proof-control-plane-seeded-run-service.ts:245-248`，`air-mentor-api/src/lib/proof-control-plane-live-run-service.ts:454-457`，`air-mentor-api/src/lib/proof-control-plane-tail-service.ts:401-421`，`air-mentor-api/src/lib/proof-control-plane-batch-service.ts:275-283`，`air-mentor-api/src/lib/msruas-proof-control-plane.ts:4333-4354`。
- RA-08 `high` `Phase 11`：stage-boundary monotonicity 未被驗證。activation 僅驗 semester range 與 checkpoint availability；rebuild context 只照 `stage.order` 串 `previous/next`；schema 亦無 `stageBoundaryJson` 可核。非嚴格遞增時，現碼無 fail-fast。證：`air-mentor-api/src/lib/proof-control-plane-activation-service.ts:40-53`，`air-mentor-api/src/lib/proof-control-plane-rebuild-context-service.ts:115-139`，`air-mentor-api/src/db/schema.ts:621-634`。
- RA-09 `medium` `Phase 5`：faculty tail 若無 selected active run/batch semester，直接 fallback `6`；sem6 residue 得以進入 read surface。證：`air-mentor-api/src/lib/proof-control-plane-tail-service.ts:421-428`。
- RA-10 `medium` `Phase 5`：operator lifecycle 面僅見 activate / activate-semester / archive / restore；未見 stop action、`status='stopped'`、`lifecycleState='stopped'`。故 `completed-inspectable` 與 stopped 仍未分治。證：`air-mentor-api/src/modules/admin-proof-sandbox.ts:367-483`，`air-mentor-api/src/lib/msruas-proof-control-plane.ts:4279-4299`，`air-mentor-api/src/db/schema.ts:475-505`。

## Evidence

- Proxy-authority basis：`audit-map/14-reconciliation/final-decision-appendix.md:5-11` 明示 named prompt 缺席；`audit-map/32-reports/overnight-unified-mitigation-plan.md:3-5` 明示今輪 phase 以 proxy authority 排序。
- Run-row contract drift：`air-mentor-api/src/db/schema.ts:475-505` 只存 `activeOperationalSemester/sourceType/policySnapshotJson/engineVersionsJson/metricsJson/progressJson`；`air-mentor-api/src/lib/msruas-proof-control-plane.ts:4346-4352` 卻更新 `activeStageKey/simulatedDateIso/lifecycleState`。
- Fresh-Sem1 drift 主鏈：`air-mentor-api/src/lib/proof-control-plane-seeded-bootstrap-service.ts:81-105` 先固 sem6；`air-mentor-api/src/lib/msruas-proof-control-plane.ts:4140-4184` 再無條件跑 `buildSeededHistoricalSemesterRows` 與 `buildSeededSemesterSixRows`；`air-mentor-api/src/lib/proof-control-plane-seeded-run-service.ts:172-186` 最後回寫 fake prior CGPA。
- Runtime authority drift：`air-mentor-api/src/lib/proof-control-plane-runtime-service.ts:294-297` 取 terminal semester；`air-mentor-api/src/lib/proof-control-plane-runtime-service.ts:686-730` 以該 semester 生成 active evidence/risk rows；activation service 自身只改 run/batch current semester，未重算此 authority 來源。證：`air-mentor-api/src/lib/proof-control-plane-activation-service.ts:57-72`。
- Lifecycle semantics drift：`air-mentor-api/src/lib/proof-control-plane-seeded-run-service.ts:245-248` 與 `air-mentor-api/src/lib/proof-control-plane-live-run-service.ts:454-457` 產生 `completed + activeFlag=1`；`air-mentor-api/src/lib/proof-control-plane-tail-service.ts:401-421`、`air-mentor-api/src/lib/proof-control-plane-batch-service.ts:275-283` 仍按 `activeFlag` 選 active run；然 `air-mentor-api/src/lib/msruas-proof-control-plane.ts:4333-4354` 在 explicit activate 時又把 run 轉為 `status='active'`。
- Boundary validation gap：`air-mentor-api/src/lib/proof-control-plane-rebuild-context-service.ts:120-139` 只串 checkpoint graph；`air-mentor-api/src/db/schema.ts:621-634` 亦僅存 `stageOrder/previousCheckpointId/nextCheckpointId/summaryJson`。

## Recommendations

- `Phase 1`：先補 `simulation_runs` authority cols，並將 active semester / active stage / simulated date / lifecycle / config / boundary 皆收斂到單一 persisted contract。若 schema 不補，後續審計與 façade 僅能繼續漂。
- `Phase 1`：切斷 sem6-first seeded path。Fresh Sem1 需獨立 bootstrap：`semesterStart=1`、`activeOperationalSemester=1`、`pre-tt1`、無 historical transcript、無 sem6 offering/risk/intervention side effects；並禁止 seeded finalizer 回寫 live profile。
- `Phase 1`：令 runtime recompute 服從 `run.activeOperationalSemester`；active evidence/risk queue source 不得再取 `semesterEnd`。
- `Phase 5`：統一 lifecycle surface 與語義。若保留 `completed-inspectable` 為行為語，後端仍須有明確 stop/archive/active contract，且 selector 規則一致，不得一處看 `activeFlag`、一處看 `status='active'`。
- `Phase 5`：移除 tail-service `?? 6` fallback，改 explicit unavailable / no-active-run state。
- `Phase 11`：補 focused proof guards：Sem1 no-transcript seed test、activation monotonic-boundary reject test、activeFlag/status parity test、runtime recompute respects activeOperationalSemester test。

## Findings Table

| id | file | sev | target_phase | expected_truth | current_truth | cites |
| --- | --- | --- | --- | --- | --- | --- |
| RA-01 | `air-mentor-api/src/db/schema.ts` | critical | Phase 1 | run row 應持久化 active stage/date/lifecycle/config/boundary authority | schema 未載其欄；consumer 仍讀寫之 | `air-mentor-api/src/db/schema.ts:475-505`; `air-mentor-api/src/lib/msruas-proof-control-plane.ts:4342-4352` |
| RA-02 | `air-mentor-api/src/lib/proof-control-plane-seeded-bootstrap-service.ts` | critical | Phase 1 | Fresh Sem1 應自 sem1 pre-tt1 起，不預灌 sem6 | bootstrap 先 `ensureSem6Offerings`，且 `activeOperationalSemester=6` | `air-mentor-api/src/lib/proof-control-plane-seeded-bootstrap-service.ts:61-65`; `air-mentor-api/src/lib/proof-control-plane-seeded-bootstrap-service.ts:81-105` |
| RA-03 | `air-mentor-api/src/lib/proof-control-plane-seeded-semester-service.ts` | critical | Phase 1 | Fresh Sem1 不得造假既往 transcript | loop `semesterNumber=1..5`，寫 transcript/observed/transition 歷史 | `air-mentor-api/src/lib/proof-control-plane-seeded-semester-service.ts:92-358`; `air-mentor-api/src/lib/msruas-proof-control-plane.ts:4140-4163` |
| RA-04 | `air-mentor-api/src/lib/proof-control-plane-seeded-semester-service.ts` | high | Phase 1 | Fresh Sem1 不應同時 materialize sem6 live state | `buildSeededSemesterSixRows` 直接造 sem6 risk/intervention/elective path | `air-mentor-api/src/lib/proof-control-plane-seeded-semester-service.ts:367-518`; `air-mentor-api/src/lib/msruas-proof-control-plane.ts:4174-4184` |
| RA-05 | `air-mentor-api/src/lib/proof-control-plane-seeded-run-service.ts` | high | Phase 1 | 模擬史不得回寫 live profile authority | finalizer 以 fake observed rows 回寫 `prevCgpaScaled` | `air-mentor-api/src/lib/proof-control-plane-seeded-run-service.ts:172-186` |
| RA-06 | `air-mentor-api/src/lib/proof-control-plane-runtime-service.ts` | critical | Phase 1 | active risk/evidence 應服 `activeOperationalSemester` | recompute 固取 terminal semester，並按之寫 active rows | `air-mentor-api/src/lib/proof-control-plane-runtime-service.ts:294-297`; `air-mentor-api/src/lib/proof-control-plane-runtime-service.ts:686-730` |
| RA-07 | `air-mentor-api/src/lib/proof-control-plane-live-run-service.ts` | high | Phase 1 | active run selector 應守單一 lifecycle truth | producer 產 `completed+activeFlag=1`；consumer 有者看 `activeFlag`、activate path 又寫 `status='active'` | `air-mentor-api/src/lib/proof-control-plane-live-run-service.ts:454-457`; `air-mentor-api/src/lib/proof-control-plane-seeded-run-service.ts:245-248`; `air-mentor-api/src/lib/proof-control-plane-tail-service.ts:401-421`; `air-mentor-api/src/lib/proof-control-plane-batch-service.ts:275-283`; `air-mentor-api/src/lib/msruas-proof-control-plane.ts:4333-4354` |
| RA-08 | `air-mentor-api/src/lib/proof-control-plane-activation-service.ts` | high | Phase 11 | stage boundary 應嚴格遞增，違者 activation fail | activation 只驗 semester range + availability；boundary metadata/guard 皆缺 | `air-mentor-api/src/lib/proof-control-plane-activation-service.ts:40-53`; `air-mentor-api/src/lib/proof-control-plane-rebuild-context-service.ts:115-139`; `air-mentor-api/src/db/schema.ts:621-634` |
| RA-09 | `air-mentor-api/src/lib/proof-control-plane-tail-service.ts` | medium | Phase 5 | 無 active run 時應明示 unavailable，不得默認 sem6 | read surface fallback 直接 `?? 6` | `air-mentor-api/src/lib/proof-control-plane-tail-service.ts:421-428` |
| RA-10 | `air-mentor-api/src/modules/admin-proof-sandbox.ts` | medium | Phase 5 | `completed-inspectable` 與 stopped 應各有明義/動作 | surface 僅 activate / archive / restore；未見 stop state/action | `air-mentor-api/src/modules/admin-proof-sandbox.ts:367-483`; `air-mentor-api/src/lib/msruas-proof-control-plane.ts:4279-4299` |

## Severity Distribution

| severity | count | ids |
| --- | --- | --- |
| critical | 4 | `RA-01`, `RA-02`, `RA-03`, `RA-06` |
| high | 4 | `RA-04`, `RA-05`, `RA-07`, `RA-08` |
| medium | 2 | `RA-09`, `RA-10` |
| low | 0 | `none` |

## Target-Phase Mapping

| target_phase | finding_ids | mapping_basis |
| --- | --- | --- |
| Phase 1 | `RA-01`, `RA-02`, `RA-03`, `RA-04`, `RA-05`, `RA-06`, `RA-07` | run authority/source-of-truth drift；對應 unified plan 先鎖 authority / contract。證：`audit-map/32-reports/overnight-unified-mitigation-plan.md:3-13` |
| Phase 5 | `RA-09`, `RA-10` | operator/playback surface semantics drift；需先收 surface truth，再談 UX/action contract。證：`audit-map/32-reports/overnight-unified-mitigation-plan.md:36-40`，`audit-map/32-reports/overnight-unified-mitigation-plan.md:88-90` |
| Phase 11 | `RA-08` | fail-fast / regression proof 缺位；需入 focused guard pack。證：`audit-map/32-reports/overnight-unified-mitigation-plan.md:79-84` |
