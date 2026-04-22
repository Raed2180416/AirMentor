# ML Audit

## Layer Boundaries (Authoritative)
- This audit enforces a strict split across four layers: model, policy, monitoring, simulator/runtime.
- Model scoring computes five head probabilities and an operational band from configured thresholds (`air-mentor-api/src/lib/proof-risk-model.ts:68`, `air-mentor-api/src/lib/proof-risk-model.ts:1955`, `air-mentor-api/src/lib/proof-risk-model.ts:1964`).
- Policy diagnostics define counterfactual semantics and acceptance gates, not model fitting logic (`air-mentor-api/src/lib/proof-control-plane-policy-service.ts:386`, `air-mentor-api/src/lib/proof-control-plane-policy-service.ts:405`).
- Monitoring consumes `riskBand` and applies cooldown/reassessment workflow decisions (`air-mentor-api/src/lib/monitoring-engine.ts:25`, `air-mentor-api/src/lib/monitoring-engine.ts:39`, `air-mentor-api/src/lib/monitoring-engine.ts:53`).
- Simulator/runtime owns no-action replay, lift computation, and queue budgeting constraints (`air-mentor-api/src/lib/proof-control-plane-playback-service.ts:816`, `air-mentor-api/src/lib/proof-control-plane-runtime-service.ts:771`, `air-mentor-api/src/lib/proof-control-plane-runtime-service.ts:377`).

## Model Layer
- Risk heads are explicitly typed as `attendanceRisk`, `ceRisk`, `seeRisk`, `overallCourseRisk`, and `downstreamCarryoverRisk` (`air-mentor-api/src/lib/proof-risk-model.ts:68`, `air-mentor-api/src/lib/proof-risk-model.ts:73`).
- Production and challenger are both trained for all five heads in the same training pass (`air-mentor-api/src/lib/proof-risk-model.ts:1819`, `air-mentor-api/src/lib/proof-risk-model.ts:1841`, `air-mentor-api/src/lib/proof-risk-model.ts:1857`).
- Challenger scoring is explicit and separate from production scoring (`air-mentor-api/src/lib/proof-risk-model.ts:2004`, `air-mentor-api/src/lib/proof-risk-model.ts:2021`).
- Calibration method candidates include identity/sigmoid/beta/isotonic/venn-abers; selection is metric-driven on validation/test summaries (`air-mentor-api/src/lib/proof-risk-model.ts:75`, `air-mentor-api/src/lib/proof-risk-model.ts:856`, `air-mentor-api/src/lib/proof-risk-model.ts:971`).
- Default training config includes `beta` as part of allowed calibration methods (`air-mentor-api/src/lib/proof-risk-model.ts:96`, `air-mentor-api/src/lib/proof-risk-model.ts:102`).

## Policy Layer
- Driver inference uses policy-configured thresholds and impacts to generate explainers and a rule-based observable risk path (`air-mentor-api/src/lib/inference-engine.ts:36`, `air-mentor-api/src/lib/inference-engine.ts:39`, `air-mentor-api/src/lib/inference-engine.ts:172`).
- Policy diagnostics include acceptance gates and same-checkpoint counterfactual notes (`air-mentor-api/src/lib/proof-control-plane-policy-service.ts:386`, `air-mentor-api/src/lib/proof-control-plane-policy-service.ts:405`).
- Counterfactual efficacy language is constrained by replay support thresholds (`air-mentor-api/src/lib/proof-control-plane-policy-service.ts:405`, `air-mentor-api/src/lib/proof-control-plane-policy-service.ts:406`).

## Monitoring Layer
- `buildMonitoringDecision` is a dedicated post-scoring workflow step and returns `alert`/`watch`/`suppress` actions (`air-mentor-api/src/lib/monitoring-engine.ts:25`, `air-mentor-api/src/lib/monitoring-engine.ts:31`, `air-mentor-api/src/lib/monitoring-engine.ts:60`).
- High/Medium/Low branch behavior is implemented independently from model head training artifacts (`air-mentor-api/src/lib/monitoring-engine.ts:39`, `air-mentor-api/src/lib/monitoring-engine.ts:53`, `air-mentor-api/src/lib/monitoring-engine.ts:68`).

## Simulator and Runtime Layer
- No-action snapshots are generated only for defined stages and are built from the same evidence checkpoint (`air-mentor-api/src/lib/proof-control-plane-playback-service.ts:816`, `air-mentor-api/src/lib/proof-control-plane-playback-service.ts:821`).
- Action-specific counterfactual penalties/buffs are encoded in playback adjustment logic (`air-mentor-api/src/lib/proof-control-plane-playback-service.ts:209`, `air-mentor-api/src/lib/proof-control-plane-playback-service.ts:227`).
- Runtime records `counterfactualLiftScaled = noAction - actual` per queued case (`air-mentor-api/src/lib/proof-control-plane-runtime-service.ts:769`, `air-mentor-api/src/lib/proof-control-plane-runtime-service.ts:771`).
- Seeded queue metadata sets `sourceType` as `simulation` or `live-runtime`; runtime can rebuild artifacts before active scoring (`air-mentor-api/src/lib/proof-run-queue.ts:29`, `air-mentor-api/src/lib/proof-run-queue.ts:65`, `air-mentor-api/src/lib/proof-control-plane-runtime-service.ts:263`).
- Capacity budget is adjusted by overload penalty when weekly contact hours exceed threshold (`air-mentor-api/src/lib/proof-control-plane-runtime-service.ts:355`, `air-mentor-api/src/lib/proof-control-plane-runtime-service.ts:357`, `air-mentor-api/src/lib/proof-control-plane-runtime-service.ts:377`).

## Metric Notes (with Superseded Claims)
- Active overload formula is `flaggedRateAtBudget / budgetRate` (`air-mentor-api/scripts/evaluate-proof-risk-model.ts:499`, `air-mentor-api/scripts/evaluate-proof-risk-model.ts:500`).
- Artifact sample confirms overload above budget in current evaluation output: 1.0683 overall slice and 1.3738 post-see slice (`air-mentor-api/output/proof-risk-model/evaluation-report.json:58775`, `air-mentor-api/output/proof-risk-model/evaluation-report.json:58939`).
- Superseded doc claim retained for traceability: `1.1127` appears in prior docs but is not directly observed in current checked artifact lines (`audit-map/32-reports/overnight-reconcile-ml.md`, superseded by artifact-cited values above).

## Evidence Gaps
- Authoritative prompt file is missing from repo: `audit-map/20-prompts/fresh-sem1-principal-architect-overnight-pass.md` (verified by repository search).
- Until restored, intent mapping for F/G/H/J/N is reconstructed from the contradiction matrix and executable evidence, not direct prompt text.
