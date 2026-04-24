# ML Audit

## Layer Split
- Model层：五头先行，band后映。`RiskHeadKey`定五头；scorer算五头，再以`overallCourseRisk`过阈生`riskBand` (`air-mentor-api/src/lib/proof-risk-model.ts:16-19`, `air-mentor-api/src/lib/proof-risk-model.ts:78-83`, `air-mentor-api/src/lib/proof-risk-model.ts:2063-2075`).
- Policy层：rule/explainer与acceptance-gate，非scorer。`inferObservableDrivers`/`inferObservableRisk`读rule出explainer；`buildPolicyDiagnostics`定same-checkpoint counterfactual (`air-mentor-api/src/lib/inference-engine.ts:36-39`, `air-mentor-api/src/lib/inference-engine.ts:172-186`, `air-mentor-api/src/lib/proof-control-plane-policy-service.ts:386-406`).
- Monitoring层：独立workflow。`buildMonitoringDecision`依`riskBand`/cooldown/evidenceWindow/interventionResidual产`alert|watch|suppress` (`air-mentor-api/src/lib/monitoring-engine.ts:25-74`).
- Simulator/runtime层：掌no-action replay与authority split。`buildNoActionSnapshot`同stage造no-action；runtime记`noAction - actual`；queue分`simulation`/`live-runtime` (`air-mentor-api/src/lib/proof-control-plane-playback-service.ts:816-836`, `air-mentor-api/src/lib/proof-control-plane-runtime-service.ts:263-276`, `air-mentor-api/src/lib/proof-control-plane-runtime-service.ts:767-779`, `air-mentor-api/src/lib/proof-run-queue.ts:23-30`, `air-mentor-api/src/lib/proof-run-queue.ts:147-165`).

## Reconciled ML Claims
- 头数非四，乃五；challenger亦同五头同训 (`air-mentor-api/src/lib/proof-risk-model.ts:78-83`, `air-mentor-api/src/lib/proof-risk-model.ts:1918-1958`).
- Challenger未真成CatBoost。union仅`depth-2-tree`；`catboost_info`仅实验，未入runtime authority (`air-mentor-api/src/lib/proof-risk-model.ts:87`, `air-mentor-api/src/lib/proof-risk-model.ts:115`, `air-mentor-api/src/lib/proof-risk-model.ts:128`, `air-mentor-api/src/lib/proof-risk-model.ts:1940-1958`, `air-mentor-api/catboost_info/catboost_training.json:2-4`).
- Calibration非Beta默认。chooser容`beta`按metric选；现artifact见`isotonic`。Beta乃candidate，非truth (`air-mentor-api/src/lib/proof-risk-model.ts:85`, `air-mentor-api/src/lib/proof-risk-model.ts:107-115`, `air-mentor-api/src/lib/proof-risk-model.ts:919-1040`, `air-mentor-api/output/proof-risk-model/evaluation-report.json:9117-9123`, `air-mentor-api/output/proof-risk-model/evaluation-report.json:15450-15456`).
- Missingness半落地。schema增`cgpaMissingScaled`/`backlogMissingScaled`；然caller未传flags，默认已修乃superseded (`air-mentor-api/src/lib/proof-risk-model.ts:61-63`, `air-mentor-api/src/lib/proof-risk-model.ts:118-129`, `air-mentor-api/src/lib/proof-risk-model.ts:2203-2255`, `air-mentor-api/src/lib/proof-control-plane-playback-governance-service.ts:222-243`, `air-mentor-api/src/lib/proof-control-plane-playback-governance-service.ts:296-310`, `air-mentor-api/src/lib/proof-control-plane-runtime-service.ts:548-566`, `air-mentor-api/src/lib/proof-control-plane-runtime-service.ts:639-650`, `air-mentor-api/src/modules/academic.ts:1424-1445`).
- Latent params非first-class，仅`latentStateJson` blob (`air-mentor-api/src/db/schema.ts:534-543`).
- Intervention-response乃additive utility，非multiplicative formula (`air-mentor-api/src/lib/proof-control-plane-playback-service.ts:710-717`).

## Metric Lineage
- Retained：v7 overload headline `1.1127`仍存源码注释；overload neutral baseline = `1.0` (`air-mentor-api/src/lib/proof-risk-model.ts:118-119`, `air-mentor-api/scripts/evaluate-proof-risk-model.ts:523-550`).
- Retained：活跃artifact附加stage slice仍应保留，`overall` slice `1.0683`、`post-see` slice `1.3738` (`air-mentor-api/output/proof-risk-model/evaluation-report.json:58769-58775`, `air-mentor-api/output/proof-risk-model/evaluation-report.json:58933-58939`).
- Superseded：旧文“v8 missingness已默认落地”不成立；宜改写为“fix surface已在，caller未全接” (`air-mentor-api/src/lib/proof-risk-model.ts:61-63`, `air-mentor-api/src/lib/proof-risk-model.ts:118-129`, `air-mentor-api/src/lib/proof-control-plane-runtime-service.ts:548-566`).
- Superseded：旧文“Beta-by-head已当前生效”不成立；宜改写为“metric-driven chooser容`beta`，而活跃artifact现示`isotonic`” (`air-mentor-api/src/lib/proof-risk-model.ts:919-1040`, `air-mentor-api/output/proof-risk-model/evaluation-report.json:9117-9123`).
- Superseded：旧文“latent response参数已first-class”不成立；宜改写为“当前仅JSON blob存放latent state” (`air-mentor-api/src/db/schema.ts:534-543`).

## Preserved Surfaces
- `risk_evidence_snapshots`、`risk_model_artifacts`、governed corpus selector皆存；J.preserve所求之artifact/evidence/split骨架未失 (`air-mentor-api/src/db/schema.ts:809-819`, `air-mentor-api/src/db/schema.ts:821-839`, `air-mentor-api/src/lib/msruas-proof-control-plane.ts:2123-2172`).

## Open Contradictions
- Serious challenger若欲称CatBoost，须先扩`ChallengerModelFamily` union并接训练/评分path；现状尚否 (`air-mentor-api/src/lib/proof-risk-model.ts:87`, `air-mentor-api/src/lib/proof-risk-model.ts:115`, `air-mentor-api/src/lib/proof-risk-model.ts:128`, `air-mentor-api/src/lib/proof-risk-model.ts:1940-1958`).
- sem6 residue仍在seeded bootstrap、elective选择、offering bootstrap；与`activeOperationalSemester`并存，故J.change仅半成 (`air-mentor-api/src/lib/msruas-proof-control-plane.ts:1504-1507`, `air-mentor-api/src/lib/msruas-proof-control-plane.ts:3098-3105`, `air-mentor-api/src/lib/msruas-proof-control-plane.ts:3326-3328`, `air-mentor-api/src/lib/msruas-proof-control-plane.ts:4066-4070`, `air-mentor-api/src/lib/msruas-proof-control-plane.ts:4341-4349`).
- Queue case粒度仍偏宽：training stable-order key至`sim::student::course::stage`，governance case key仅`student::semester`；评估/排队authority尚未全对齐 (`air-mentor-api/src/lib/proof-risk-model.ts:1415`, `air-mentor-api/src/lib/proof-control-plane-playback-governance-service.ts:144-149`).
