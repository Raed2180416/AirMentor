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
- Challenger family remains `depth-2-tree` in the type union; prompt G.2 mandates CatBoost (see contradiction CLAIM_ML_014). Version string already advertises CatBoost (`air-mentor-api/src/lib/proof-risk-model.ts:12`) but type union (`air-mentor-api/src/lib/proof-risk-model.ts:87`) and config pins (`air-mentor-api/src/lib/proof-risk-model.ts:115`, `air-mentor-api/src/lib/proof-risk-model.ts:128`, `air-mentor-api/src/lib/proof-risk-model.ts:139`) are depth-2-tree only.

## Frozen Intervention Response Model (Section H) Coverage
- H.1 latent parameters are first-class DB columns on `student_latent_states`: `responseProfile`, `responseScore`, `consistencyScore`, `supportCompatibility` (`air-mentor-api/src/db/schema.ts:546-549`).
- H.3 base action weights: action-name catalog is split and drifting between snake_case `defaultConcernFamilyAction` (`air-mentor-api/src/lib/proof-control-plane-advance-service.ts:145-153`) and kebab-case `PolicyActionCode` stage catalogs (`air-mentor-api/src/lib/proof-control-plane-playback-service.ts:255-266`); prompt multipliers not attached.
- H.8 deterministic impact formula: current additive utility `0.35*nextCheckpoint + 0.35*stableRecovery + 0.2*semesterClose - 0.05*relapse - 0.05*capacity` (`air-mentor-api/src/lib/proof-control-plane-playback-service.ts:711-717`) replaces prompt's multiplicative `base * response * compat * stage * severity * repeat`.
- H.11 deterministic seeded deltas keyed by `stableUnit('run-<runSeed>-<studentId>-<offeringId>-<purpose>')` (`air-mentor-api/src/lib/proof-control-plane-seeded-semester-service.ts:505`, `air-mentor-api/src/lib/proof-control-plane-seeded-semester-service.ts:506`).
- H.13 workflow-vs-student-facing separation enforced: `workflowFamilies` excluded from auto-resolve (`air-mentor-api/src/lib/proof-control-plane-advance-service.ts:128`, `air-mentor-api/src/lib/proof-control-plane-advance-service.ts:129`).

## Section J Preserve / Change Coverage
Preserve items (all satisfied):
- Artifact registry `risk_model_artifacts` (`air-mentor-api/src/db/schema.ts:830-848`).
- Evidence snapshot `risk_evidence_snapshots` (`air-mentor-api/src/db/schema.ts:809-828`).
- Governed manifest + split discipline (`air-mentor-api/src/lib/proof-risk-model.ts:142-152`, `air-mentor-api/src/lib/msruas-proof-control-plane.ts:2123-2172`).
- Policy/action separation from pure risk scoring (`air-mentor-api/src/lib/proof-control-plane-playback-service.ts:544-768`).
- Queue governance layer (`air-mentor-api/src/lib/proof-queue-governance.ts:1`, `air-mentor-api/src/lib/proof-control-plane-playback-governance-service.ts:371`).
- Diagnostic head display metadata (`air-mentor-api/src/lib/proof-risk-model.ts:2004-2021`).

Change items (status):
- Sem6-centric world assumptions: partially retired (`air-mentor-api/src/lib/proof-control-plane-runtime-service.ts:382-384` uses `activeOperationalSemester`); outstanding residue (`air-mentor-api/src/lib/msruas-proof-control-plane.ts:1506`, `air-mentor-api/src/lib/msruas-proof-control-plane.ts:3076`, `air-mentor-api/src/lib/msruas-proof-control-plane.ts:4038`). Owned by `overnight-impl-phase1-run-authority`.
- Silent missingness collapse: fixed by v8 default config (`air-mentor-api/src/lib/proof-risk-model.ts:107-116`).
- Shallow intervention-response logic: outstanding until prompt H.8 multipliers land in `buildActionPolicyComparison`. Owned by `overnight-impl-phase11-final-analytics`.
- Crude fixed-penalty replay as final analytics: outstanding (`air-mentor-api/src/lib/proof-control-plane-playback-service.ts:817-838`). Owned by `overnight-impl-phase11-final-analytics`.
- Overly broad case identity: scoring-time composite is `sim::student::course::stage` (`air-mentor-api/src/lib/proof-risk-model.ts:1393`); queue case identity is `student::semester` (`air-mentor-api/src/lib/proof-control-plane-playback-governance-service.ts:144-149`). Tightening owned by `overnight-impl-phase3-case-queue`.

## Evidence Gaps
- Authoritative prompt is present in-repo (`audit-map/20-prompts/fresh-sem1-principal-architect-overnight-pass.md:387-413`); no gap on prompt availability.
- Remaining gap: fine-grained F/G/H/J/N line-level diff between prompt text and code is catalogued in `audit-map/14-reconciliation/contradiction-matrix-ml.md` + `audit-map/32-reports/overnight-reconcile-ml.md` at claim granularity (24 rows). Sub-line diffs (e.g. individual prompt H.5-H.7 multiplier values per action) are delegated to downstream impl nodes.
