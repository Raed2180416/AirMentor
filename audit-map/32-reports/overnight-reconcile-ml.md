# Overnight Reconcile: ML Strategy

## Findings
- Model层：五头先行，band后映。`RiskHeadKey`定五头；scorer算五头，再以`overallCourseRisk`过阈生`riskBand` (`air-mentor-api/src/lib/proof-risk-model.ts:16-19`, `air-mentor-api/src/lib/proof-risk-model.ts:78-83`, `air-mentor-api/src/lib/proof-risk-model.ts:2063-2075`).
- Policy层：rule/explainer与acceptance-gate，非scorer。`inferObservableDrivers`/`inferObservableRisk`读rule出explainer (`air-mentor-api/src/lib/inference-engine.ts:36-39`, `air-mentor-api/src/lib/inference-engine.ts:172-186`).
- Monitoring层：独立workflow。`buildMonitoringDecision`依`riskBand`/cooldown/evidenceWindow/interventionResidual产`alert|watch|suppress` (`air-mentor-api/src/lib/monitoring-engine.ts:25-74`).
- Simulator/runtime层：掌no-action replay与authority split。`buildNoActionSnapshot`同stage造no-action；runtime记`noAction - actual`；queue分`simulation`/`live-runtime` (`air-mentor-api/src/lib/proof-control-plane-playback-service.ts:816-836`, `air-mentor-api/src/lib/proof-control-plane-runtime-service.ts:263-276`, `air-mentor-api/src/lib/proof-control-plane-runtime-service.ts:767-779`, `air-mentor-api/src/lib/proof-run-queue.ts:23-30`, `air-mentor-api/src/lib/proof-run-queue.ts:147-165`).
- Challenger：未真成CatBoost。union仅`depth-2-tree`；`catboost_info`仅实验，未入runtime authority (`air-mentor-api/src/lib/proof-risk-model.ts:87`, `air-mentor-api/src/lib/proof-risk-model.ts:115`, `air-mentor-api/src/lib/proof-risk-model.ts:128`, `air-mentor-api/src/lib/proof-risk-model.ts:1940-1958`).
- Calibration：Beta非默认。chooser容`beta`按metric选；现artifact见`isotonic`。Beta乃candidate，非truth (`air-mentor-api/src/lib/proof-risk-model.ts:85`, `air-mentor-api/src/lib/proof-risk-model.ts:107-115`, `air-mentor-api/src/lib/proof-risk-model.ts:919-1040`).
- Missingness：半落地。schema增`cgpaMissingScaled`/`backlogMissingScaled`；然caller未传flags，默认已修乃superseded (`air-mentor-api/src/lib/proof-risk-model.ts:61-63`, `air-mentor-api/src/lib/proof-risk-model.ts:118-129`, `air-mentor-api/src/lib/proof-risk-model.ts:2203-2255`).
- Counterfactual：限same-checkpoint simulator comparator，非跨阶段疗效。
- Intervention-response：additive utility，非multiplicative formula。
- Latent params：非first-class，仅`latentStateJson` blob。

## Ledger
| claim_id | intent_section | current_doc | current_code | resolved | files_to_change | eval_artifact |
|---|---|---|---|---|---|---|
| CLAIM_ML_001 | F | 旧文混head与band。 | 五头显式；band由scorer后映 (`air-mentor-api/src/lib/proof-risk-model.ts:78-83`, `air-mentor-api/src/lib/proof-risk-model.ts:2063-2075`). | true | `audit-map/08-ml-audit/README.md`, `audit-map/32-reports/overnight-reconcile-ml.md` | - |
| CLAIM_ML_002 | F/G | 旧文称inference-engine掌banding。 | inference-engine属explainer；banding属scorer (`air-mentor-api/src/lib/inference-engine.ts:36-39`, `air-mentor-api/src/lib/inference-engine.ts:172-186`, `air-mentor-api/src/lib/proof-risk-model.ts:16-19`, `air-mentor-api/src/lib/proof-risk-model.ts:2071-2075`). | true | `audit-map/08-ml-audit/README.md`, `audit-map/32-reports/overnight-reconcile-ml.md` | - |
| CLAIM_ML_003 | F/G | 旧文称风险头仅四。 | `RiskHeadKey`定五头 (`air-mentor-api/src/lib/proof-risk-model.ts:78-83`, `air-mentor-api/src/lib/proof-risk-model.ts:1918-1958`). | true | `audit-map/08-ml-audit/README.md`, `audit-map/32-reports/overnight-reconcile-ml.md` | - |
| CLAIM_ML_004 | G | 旧文称challenger已为CatBoost。 | union仅`depth-2-tree`；CatBoost仅实验 (`air-mentor-api/src/lib/proof-risk-model.ts:87`, `air-mentor-api/src/lib/proof-risk-model.ts:115`, `air-mentor-api/src/lib/proof-risk-model.ts:128`, `air-mentor-api/src/lib/proof-risk-model.ts:1940-1958`). | false | `audit-map/08-ml-audit/README.md`, `audit-map/32-reports/overnight-reconcile-ml.md` | `air-mentor-api/catboost_info/catboost_training.json:2-4` |
| CLAIM_ML_005 | G/N | 旧文称Beta默认生效。 | chooser容`beta`；现artifact见`isotonic` (`air-mentor-api/src/lib/proof-risk-model.ts:85`, `air-mentor-api/src/lib/proof-risk-model.ts:107-115`, `air-mentor-api/src/lib/proof-risk-model.ts:919-1040`). | superseded | `audit-map/08-ml-audit/README.md`, `audit-map/32-reports/overnight-reconcile-ml.md` | `air-mentor-api/output/proof-risk-model/evaluation-report.json:9117-9123` |
| CLAIM_ML_006 | F/N | 旧文称v8 missingness已贯通。 | fix surface在；caller未传flags (`air-mentor-api/src/lib/proof-risk-model.ts:61-63`, `air-mentor-api/src/lib/proof-risk-model.ts:118-129`, `air-mentor-api/src/lib/proof-risk-model.ts:2203-2255`). | superseded | `audit-map/08-ml-audit/README.md`, `audit-map/32-reports/overnight-reconcile-ml.md` | - |
| CLAIM_ML_007 | N | 旧文视seeded与runtime同源。 | queue分流；runtime可rebuild再score (`air-mentor-api/src/lib/proof-run-queue.ts:23-30`, `air-mentor-api/src/lib/proof-run-queue.ts:147-165`, `air-mentor-api/src/lib/proof-control-plane-runtime-service.ts:263-276`). | true | `audit-map/08-ml-audit/README.md`, `audit-map/32-reports/overnight-reconcile-ml.md` | - |
| CLAIM_ML_008 | N | 旧文混monitoring入model。 | monitoring独立引擎 (`air-mentor-api/src/lib/monitoring-engine.ts:25-74`). | true | `audit-map/08-ml-audit/README.md`, `audit-map/32-reports/overnight-reconcile-ml.md` | - |
| CLAIM_ML_009 | N | 旧文称counterfactual跨阶段。 | same-checkpoint no-action replay + delta (`air-mentor-api/src/lib/proof-control-plane-playback-service.ts:816-836`, `air-mentor-api/src/lib/proof-control-plane-runtime-service.ts:767-779`). | true | `audit-map/08-ml-audit/README.md`, `audit-map/32-reports/overnight-reconcile-ml.md` | - |
| CLAIM_ML_010 | H | 旧文称intervention formula已multiplicative。 | 现仅additive utility (`air-mentor-api/src/lib/proof-control-plane-playback-service.ts:710-717`). | false | `audit-map/08-ml-audit/README.md`, `audit-map/32-reports/overnight-reconcile-ml.md` | - |
| CLAIM_ML_011 | H | 旧文称latent params为first-class。 | schema仅`latentStateJson` (`air-mentor-api/src/db/schema.ts:534-543`). | false | `audit-map/08-ml-audit/README.md`, `audit-map/32-reports/overnight-reconcile-ml.md` | - |
| CLAIM_ML_012 | J | 旧文疑preserve surfaces缺失。 | evidence/artifact tables与corpus selector俱在 (`air-mentor-api/src/db/schema.ts:809-839`, `air-mentor-api/src/lib/msruas-proof-control-plane.ts:2123-2172`). | true | `audit-map/08-ml-audit/README.md`, `audit-map/32-reports/overnight-reconcile-ml.md` | - |
| CLAIM_ML_013 | J | 旧文称sem6 residue已退尽。 | `activeOperationalSemester`入部分path；sem6 bootstrap仍在 (`air-mentor-api/src/lib/msruas-proof-control-plane.ts:3326-3328`, `air-mentor-api/src/lib/msruas-proof-control-plane.ts:4341-4349`). | false | `audit-map/32-reports/overnight-reconcile-ml.md` | - |
| CLAIM_ML_014 | J/N | 旧文将v7 overload全归model。 | overload formula = `flaggedRateAtBudget / budgetRate`；runtime另施penalty/clamp (`air-mentor-api/scripts/evaluate-proof-risk-model.ts:523-550`, `air-mentor-api/src/lib/proof-control-plane-runtime-service.ts:352-379`). | false | `audit-map/08-ml-audit/README.md`, `audit-map/32-reports/overnight-reconcile-ml.md` | `air-mentor-api/output/proof-risk-model/evaluation-report.json:58769-58775` |
| CLAIM_ML_015 | J | 旧文默认case identity够细。 | training key至course+stage；governance key仅student+semester (`air-mentor-api/src/lib/proof-risk-model.ts:1415`, `air-mentor-api/src/lib/proof-control-plane-playback-governance-service.ts:144-149`). | false | `audit-map/32-reports/overnight-reconcile-ml.md` | - |

## Evidence
- Model truth：五头、阈值、artifact结构在`proof-risk-model.ts` (`air-mentor-api/src/lib/proof-risk-model.ts:16-19`, `air-mentor-api/src/lib/proof-risk-model.ts:78-83`, `air-mentor-api/src/lib/proof-risk-model.ts:1918-1958`, `air-mentor-api/src/lib/proof-risk-model.ts:2063-2075`).
- Policy truth：explainer与acceptance-gate在`inference-engine.ts`与`proof-control-plane-policy-service.ts` (`air-mentor-api/src/lib/inference-engine.ts:36-39`, `air-mentor-api/src/lib/inference-engine.ts:172-186`, `air-mentor-api/src/lib/proof-control-plane-policy-service.ts:386-406`).
- Monitoring truth：`buildMonitoringDecision`独立消费风险与cooldown (`air-mentor-api/src/lib/monitoring-engine.ts:25-74`).
- Simulator/runtime truth：no-action snapshot、runtime delta、queue authority split在playback/runtime/queue (`air-mentor-api/src/lib/proof-control-plane-playback-service.ts:816-836`, `air-mentor-api/src/lib/proof-control-plane-runtime-service.ts:263-276`, `air-mentor-api/src/lib/proof-control-plane-runtime-service.ts:767-779`, `air-mentor-api/src/lib/proof-run-queue.ts:23-30`, `air-mentor-api/src/lib/proof-run-queue.ts:147-165`).
- Artifact truth：CatBoost实验在`catboost_info`；active artifact留isotonic与overload slices (`air-mentor-api/catboost_info/catboost_training.json:2-4`, `air-mentor-api/output/proof-risk-model/evaluation-report.json:9117-9123`, `air-mentor-api/output/proof-risk-model/evaluation-report.json:15450-15456`, `air-mentor-api/output/proof-risk-model/evaluation-report.json:58769-58775`, `air-mentor-api/output/proof-risk-model/evaluation-report.json:58933-58939`).
- Preserve truth：evidence/artifact tables与corpus selector在schema/control-plane (`air-mentor-api/src/db/schema.ts:809-839`, `air-mentor-api/src/lib/msruas-proof-control-plane.ts:2123-2172`).

## v7 Overload Diagnosis
`overloadRatio = flaggedRateAtBudget / budgetRate`。baseline `1.0`表预算中性；v7 headline `1.1127`超预算 (`air-mentor-api/scripts/evaluate-proof-risk-model.ts:523-550`, `air-mentor-api/src/lib/proof-risk-model.ts:118-119`).

候因：
1. Missingness suppression：0.5 imputation掩missingness signal，致model误判missing为average，推高risk。v8增flags然caller未传 (`air-mentor-api/src/lib/proof-risk-model.ts:61-63`, `air-mentor-api/src/lib/proof-risk-model.ts:118-129`, `air-mentor-api/src/lib/proof-control-plane-runtime-service.ts:548-566`).
2. Score bunching：scores聚于阈值(0.4/0.85)附近，微变即越阈致overload。
3. Interaction effects：interaction features (如`stagePostTt2TtCompoundInteractionScaled`)于后段放大risk，致stage skew (`air-mentor-api/output/proof-risk-model/evaluation-report.json:58769-58775`, `air-mentor-api/output/proof-risk-model/evaluation-report.json:58933-58939`).
4. Capacity clamp：runtime施penalty/clamp，混入overload叙事 (`air-mentor-api/src/lib/proof-control-plane-runtime-service.ts:352-379`).

结论：v7 overload乃missingness未贯通 + score bunching + interaction skew + capacity clamp复合症候。

## Mitigation Plan
- Missingness：caller须传`cgpaMissing`/`backlogMissing`等flags至`buildObservableFeaturePayload`。
- Calibration：强推Beta-by-head以善local calibration，解score bunching。
- Thresholds：勿盲调阈值。先析score histograms与local reliability。
- Overload：拆双账本：`model_overload_ratio`与`capacity_clamp_ratio`。

## Recommendations
- 训v8前必先修world semantics、stage/date truth与missingness caller。
- CatBoost challenger须比decision-aware metrics (ranking, proper scoring, local calibration, overload)，非仅AUC。
- 施multiplicative intervention-response formula。
- Final analytics必用simulator-based no-intervention path。
- ML claim无`src`/artifact行号即拒。
