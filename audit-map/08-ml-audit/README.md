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

## Metric Notes
- Active overload formula is `flaggedRateAtBudget / budgetRate` (`air-mentor-api/scripts/evaluate-proof-risk-model.ts:499`, `air-mentor-api/scripts/evaluate-proof-risk-model.ts:523`).
- Canonical v7 headline Overload is **1.1127**, cited in the authoritative prompt metrics table (`audit-map/20-prompts/fresh-sem1-principal-architect-overnight-pass.md:398`) and corroborated by the in-code fix comment at `air-mentor-api/src/lib/proof-risk-model.ts:119` ("Fixes v7 overload=1.1127 by restoring missingness signal suppressed by 0.5 imputation").
- Artifact slices show stage-decomposition supporting the headline: 1.0683 overall-slice and 1.3738 post-see-slice (`air-mentor-api/output/proof-risk-model/evaluation-report.json:58775`, `air-mentor-api/output/proof-risk-model/evaluation-report.json:58939`). The prompt's 1.1127 is the global coverage-24 metric; 1.0683 / 1.3738 are supplementary stage slices, not replacements.

## v8 Fix Surface
- `CORRECTED_V8_PROOF_RISK_TRAINING_CONFIG` is an exported training config that targets v7 overload by adding missingness indicator features (`air-mentor-api/src/lib/proof-risk-model.ts:118`, `air-mentor-api/src/lib/proof-risk-model.ts:120-129`).
- v8 feature vector gains binary `cgpaMissingScaled` and `backlogMissingScaled` (`air-mentor-api/src/lib/proof-risk-model.ts:62-63`), restoring the signal suppressed by 0.5 sentinel imputation.
- Challenger family remains `depth-2-tree` under v8 and is explicitly not promotable at current overload (prompt L400, L407).

## Evidence Gaps
- Authoritative prompt is present in-repo (`audit-map/20-prompts/fresh-sem1-principal-architect-overnight-pass.md:387-413`); no gap on prompt availability.
- Remaining gap: fine-grained F/G/H/J/N line-level diff between prompt text and code is not yet catalogued row-by-row; current reconciliation uses claim-level mapping only.
