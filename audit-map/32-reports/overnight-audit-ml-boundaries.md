# Overnight Audit: Model / Policy / Monitoring / Simulator Layer Separation

- 审计范围：`air-mentor-api/src/lib/proof-risk-model.ts`, `air-mentor-api/src/lib/proof-queue-governance.ts`, `air-mentor-api/src/lib/monitoring-engine.ts`, `air-mentor-api/src/lib/proof-control-plane-seeded-semester-service.ts`, `air-mentor-api/src/lib/proof-control-plane-seeded-run-service.ts`；并取 `policy/playback/runtime` 为旁证。
- 权威 caveat：named prompt 与 flow9 handoff 皆未入 tracked corpus；今据 frozen appendix、unified ledger、unified mitigation plan 立准。 `audit-map/14-reconciliation/final-decision-appendix.md:5-7`, `audit-map/14-reconciliation/overnight-unified-ledger.md:5-7`, `audit-map/32-reports/overnight-unified-mitigation-plan.md:3-5`
- 期望分层：model 仅评分/driver；policy 仅映 `risk/stage/phenotype -> action`; monitoring 仅 route/cooldown；simulator 仅供 seed/replay，runtime 须重评分并重建 queue/alert。其正例已见 playback governance 与 runtime recompute。 `air-mentor-api/src/lib/proof-control-plane-playback-governance-service.ts:222-282`, `air-mentor-api/src/lib/proof-control-plane-runtime-service.ts:240-275`, `air-mentor-api/src/lib/proof-control-plane-runtime-service.ts:548-685`

## Findings

- 总计 12 finding：critical 3，高 4，中 3，低 2。
- 主裂口在 seeded lane：simulator 先选 intervention、先写 risk/action/alert，再以 optional recompute 补救；此与 “runtime must rescore” 相违。
- 次裂口在 contract：model 仍出 `recommendedAction`，queue governance 仍吃 free-text action，monitoring API 仍暴露 `riskProb` 入参。
- analytics drift 仍入 policy layer；training drift 仍留 missingness half-wire；intervention-response delta 键亦缺 `semester/stage/case/action` 维。

## Evidence

- playback governance 所示顺序乃当前最接近目标真相之实现：先 `scoreObservableRiskWithModel`，继 `buildActionPolicyComparison`，后 `buildMonitoringDecision`，并以 same-checkpoint `buildNoActionSnapshot` 作比较。 `air-mentor-api/src/lib/proof-control-plane-playback-governance-service.ts:222-282`, `air-mentor-api/src/lib/proof-control-plane-playback-service.ts:816-836`
- runtime recompute 明确先删旧 `risk/alert/reassessment`，再载 active artifacts，后重建 evidence/risk/queue。此证 “simulator 非终局 authority”。 `air-mentor-api/src/lib/proof-control-plane-runtime-service.ts:240-275`, `air-mentor-api/src/lib/proof-control-plane-runtime-service.ts:276-277`, `air-mentor-api/src/lib/proof-control-plane-runtime-service.ts:711-780`
- monitoring 实作本体未回吐预测分数，只回 `decisionType/queueOwnerRole/reassessmentDueAt/cooldownUntil/note`；故其问题主要在 API 契约泄层，非 routing body 本身。 `air-mentor-api/src/lib/monitoring-engine.ts:11-17`, `air-mentor-api/src/lib/monitoring-engine.ts:25-74`
- seeded semester 之 intervention-response state 仅见 `runSeed + studentId + course/offering` 键，未见 `semester/stage/caseId/actionCode`；playback no-action delta 又仅按 action 固定扣分。此证 deterministic bounded-delta contract 尚未成形。 `air-mentor-api/src/lib/proof-control-plane-seeded-semester-service.ts:169-178`, `air-mentor-api/src/lib/proof-control-plane-seeded-semester-service.ts:451-458`, `air-mentor-api/src/lib/proof-control-plane-playback-service.ts:203-231`

## Recommendations

- `Phase 4`：自 model output 删 `recommendedAction`；queue contract 改吃 canonical policy action code；seeded semester 不得直接选 intervention/action；active run 一律强制 runtime rescore。参 unified plan 之 contract cleanup。 `audit-map/32-reports/overnight-unified-mitigation-plan.md:29-34`
- `Phase 3`：把 previous-band lineage 与 intervention-response delta 收束至 checkpoint-aware runtime path；delta key 至少含 `{runSeed, studentId, semester, stage, caseId, actionCode}`，simulator 仅产 evidence/base state。参 unified plan 之 stage/progression cleanup。 `audit-map/32-reports/overnight-unified-mitigation-plan.md:22-27`
- `Phase 7`：先贯通 `cgpaMissing/backlogMissing` caller，再谈 retrain/promote。未贯通前，不得把 v8 missingness claim 当已闭环。 `audit-map/32-reports/overnight-unified-mitigation-plan.md:50-55`
- `Phase 11`：acceptance gates / efficacy thresholds / model provenance 迁入 analytics + regression gate；policy service 留 action mapping 而已。 `audit-map/32-reports/overnight-unified-mitigation-plan.md:79-84`

## Findings Table

| ID | File | Expected Boundary | Current Code Truth | Evidence | Severity | target_phase |
| --- | --- | --- | --- | --- | --- | --- |
| F1 | `air-mentor-api/src/lib/proof-risk-model.ts` | model 仅出 `riskProb/riskBand/headProbabilities/drivers`；action 应由 policy 映射 | `ModelBackedRiskOutput` 继承 `ObservableInferenceOutput`，其公开 contract 已含 `recommendedAction`；`scoreObservableRiskWithModel` 又按 `riskBand` 直写处置文案 | `air-mentor-api/src/lib/proof-risk-model.ts:390-404`, `air-mentor-api/src/lib/proof-risk-model.ts:2140-2167`, `air-mentor-api/src/lib/inference-engine.ts:25-30` | high | Phase 4 |
| F2 | `air-mentor-api/src/lib/monitoring-engine.ts` | monitoring API 应只吃 routing state，不暴露预测分数字段 | `MonitoringDecisionInput` 含 `riskProb`，而 `buildMonitoringDecision` 全程未用；契约泄露 model surface 至 monitoring lane | `air-mentor-api/src/lib/monitoring-engine.ts:1-9`, `air-mentor-api/src/lib/monitoring-engine.ts:25-74` | low | Phase 4 |
| F3 | `air-mentor-api/src/lib/proof-queue-governance.ts` | queue governance 应只消费 canonical policy action code，不应把 model free-text 视作同类 authority | candidate/decision 皆持 `recommendedAction: string | null`，eligibility 仅查 truthiness；runtime 又以 `policyComparison.recommendedAction ?? inference.recommendedAction` 回填，故 model 文案可入治理链 | `air-mentor-api/src/lib/proof-queue-governance.ts:19-42`, `air-mentor-api/src/lib/proof-queue-governance.ts:139-145`, `air-mentor-api/src/lib/proof-control-plane-runtime-service.ts:617-621`, `air-mentor-api/src/lib/proof-control-plane-runtime-service.ts:756-779` | high | Phase 4 |
| F4 | `air-mentor-api/src/lib/proof-control-plane-seeded-semester-service.ts` | simulator 仅供 seed/replay；intervention type 应由 policy/action layer 决 | historical branch 直以 fail/prereq risk 选 `interventionType`；semester-6 branch 亦直选 `recoveryInterventionType`，并先算 `temporalLift/residual` | `air-mentor-api/src/lib/proof-control-plane-seeded-semester-service.ts:169-178`, `air-mentor-api/src/lib/proof-control-plane-seeded-semester-service.ts:444-458` | critical | Phase 4 |
| F5 | `air-mentor-api/src/lib/proof-control-plane-seeded-semester-service.ts` | seeded lane 不应先落 simulation-authored authoritative risk/action/alert；runtime 须后置重建 | semester-6 seed 直接写 `riskAssessments`，`recommendedAction: inference.recommendedAction`，`sourceType: 'simulation'`，并同步写 `alertDecisions/reassessmentEvents` | `air-mentor-api/src/lib/proof-control-plane-seeded-semester-service.ts:484-505`, `air-mentor-api/src/lib/proof-control-plane-seeded-semester-service.ts:588-635` | critical | Phase 4 |
| F6 | `air-mentor-api/src/lib/proof-control-plane-seeded-semester-service.ts` | monitoring 之 `previousRiskBand` 应来自 prior runtime assessment / checkpoint lineage | seed path 以 `stableUnit(...-prev) > 0.55 ? 'Medium' : null` 伪造 prior band，属 RNG-based lineage，不属真实前态 | `air-mentor-api/src/lib/proof-control-plane-seeded-semester-service.ts:474-482` | medium | Phase 3 |
| F7 | `air-mentor-api/src/lib/proof-control-plane-seeded-run-service.ts` | active seeded run 一经完成，即须 hard-gate runtime rescore | input 明设 `skipActiveRiskRecompute?: boolean`；finalize 时仅 `if (!input.skipActiveRiskRecompute)` 才调 `recomputeObservedOnlyRisk` | `air-mentor-api/src/lib/proof-control-plane-seeded-run-service.ts:47-59`, `air-mentor-api/src/lib/proof-control-plane-seeded-run-service.ts:202-209` | critical | Phase 4 |
| F8 | `air-mentor-api/src/lib/proof-control-plane-playback-service.ts` | intervention-response / no-action delta 应依 `{runSeed, studentId, semester, stage, caseId, actionCode}` deterministic 且 bounded | `counterfactualAdjustment` 仅按 `actionTaken` 回固定 penalty/buff；`buildNoActionSnapshot` 亦仅据 action 调整 evidence，未见 run/student/stage/case identity 入 key | `air-mentor-api/src/lib/proof-control-plane-playback-service.ts:203-231`, `air-mentor-api/src/lib/proof-control-plane-playback-service.ts:816-836` | high | Phase 3 |
| F9 | `air-mentor-api/src/lib/proof-control-plane-policy-service.ts` | policy layer 应止于 risk/stage/phenotype -> action；acceptance/calibration 阈值属 analytics | service 内直接算 `acceptanceGates`、`efficacySupportThreshold`、`targetedTutoringVsStructuredStudyPlanAcademicSlice` 等诊断门槛，analytics drift 入 policy 命名层 | `air-mentor-api/src/lib/proof-control-plane-policy-service.ts:386-417` | medium | Phase 11 |
| F10 | `air-mentor-api/src/lib/proof-risk-model.ts` | feature contract 若宣称 missingness-aware，runtime/playback caller 须显式传 flag | payload builder 虽有 `cgpaMissing/backlogMissing` 且默认 `false`；runtime builder 未传二 flag，致 omission 被静默折叠为 “not missing” | `air-mentor-api/src/lib/proof-risk-model.ts:2272-2335`, `air-mentor-api/src/lib/proof-control-plane-runtime-service.ts:548-566` | medium | Phase 7 |
| F11 | `air-mentor-api/src/lib/proof-control-plane-seeded-run-service.ts` | 若 seeded lane 与 runtime lane 并存，snapshot 应同时钉住 policy 与 model artifact identity，供 Phase 11 比对 | baseline snapshot 仅记 `policySnapshot/seed/sectionCount/studentCount/facultyCount`；runtime 之后再动态 `loadActiveProofRiskArtifacts`，seed snapshot 无 model provenance | `air-mentor-api/src/lib/proof-control-plane-seeded-run-service.ts:212-219`, `air-mentor-api/src/lib/proof-control-plane-runtime-service.ts:263-277` | low | Phase 11 |
| F12 | `air-mentor-api/src/lib/proof-control-plane-seeded-semester-service.ts` | intervention-response delta 应为 `{runSeed, studentId, semester, stage, caseId, actionCode}` 上之 bounded deterministic fn | historical/semester-6 branches 仅以 `run-student-course/offering` 键抽 acceptance/completion，`responseResidual` 仅由 `temporalLift - threshold` 得，另以 `...-prev` RNG 伪造前态；同一 student/offering 于不同 stage/action 无独立 identity | `air-mentor-api/src/lib/proof-control-plane-seeded-semester-service.ts:169-178`, `air-mentor-api/src/lib/proof-control-plane-seeded-semester-service.ts:451-458`, `air-mentor-api/src/lib/proof-control-plane-seeded-semester-service.ts:474-482` | high | Phase 3 |

## Severity Distribution

| severity | count | finding_ids |
| --- | --- | --- |
| critical | 3 | `F4`, `F5`, `F7` |
| high | 4 | `F1`, `F3`, `F8`, `F12` |
| medium | 3 | `F6`, `F9`, `F10` |
| low | 2 | `F2`, `F11` |

## Target-Phase Mapping

| target_phase | finding_ids | why / plan anchor |
| --- | --- | --- |
| Phase 3 | `F6`, `F8`, `F12` | 皆涉 checkpoint/state lineage、stage-aware counterfactual semantics、以及 deterministic intervention-response identity；应归 stage/date/progression cleanup。 `audit-map/32-reports/overnight-unified-mitigation-plan.md:22-27` |
| Phase 4 | `F1`, `F2`, `F3`, `F4`, `F5`, `F7` | 皆属 producer/consumer 契约裂口：model/policy/monitoring/simulator authority 混线。 `audit-map/32-reports/overnight-unified-mitigation-plan.md:29-34` |
| Phase 7 | `F10` | 乃 training-serving feature contract 未闭合；需 missingness caller propagation。 `audit-map/32-reports/overnight-unified-mitigation-plan.md:50-55` |
| Phase 11 | `F9`, `F11` | acceptance analytics 与 provenance/freeze 本属 final analytics / regression gate。 `audit-map/32-reports/overnight-unified-mitigation-plan.md:79-84` |
