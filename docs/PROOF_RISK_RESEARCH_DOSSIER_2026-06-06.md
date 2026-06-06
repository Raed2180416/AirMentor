# AirMentor Proof Risk Research Dossier

**Generated:** 2026-06-06
**Scope:** Historical proof-risk model research, current governed serving contract, synthetic corpus provenance, and stage/checkpoint behavior from Semester 1 through Semester 6.

## Executive Finding

The research history shows a progression from experimental CatBoost and SOTA model-family tournaments toward a governed, deterministic runtime contract. The current product should treat the model work as evidence governance for a synthetic decision-rehearsal platform, not as a claim of real-student predictive validity.

The most defensible current contract is the logistic serving path backed by the tracked bundle and promotion decision. The CatBoost/depth-2-tree challenger has strong calibration on several heads, but the promotion gate keeps it in shadow because several heads worsen local calibration or overload. That is a good product decision: the demo needs stable, explainable, stage-aware behavior more than leaderboard movement.

Important claim boundary: every metric below is based on synthetic proof-run data and governed simulation evidence. It supports deterministic rehearsal and model-governance claims. It does not support real-student production prediction without a governed data partnership and a new validation protocol.


## Evidence Sources

| Source | Path | Use in this dossier |
| --- | --- | --- |
| Current serving contract | air-mentor-api/model-contract/proof-risk-model/risk-model-bundle.json | Tracked 53 KiB runtime bundle used by fresh clones. |
| Current promotion decision | air-mentor-api/model-contract/proof-risk-model/promotion-decision.json | Governed decision that keeps CatBoost shadow-only and serves logistic. |
| Historical model archive | airmentor-historical-model-runs/2026-06-06/proof-risk-model-archive | 31 GiB extracted cold archive; source inventory says 32,861,115,170 bytes across 4,064 files. |
| Runtime model vault | airmentor-model-vault/2026-06-06/airmentor-model-vault-2026-06-06.tar.zst | 26 MiB compressed archive with 129 selected serving/research files. |
| Training corpora vault | airmentor-training-corpora/2026-06-06/airmentor-training-corpora-2026-06-06.tar.zst | 225 MiB compressed archive of distinct training corpora. |
| Coverage evaluation report | airmentor-historical-model-runs/2026-06-06/proof-risk-model-archive/pre-coverage33-20260601/evaluation-report.json | Primary 30-checkpoint and stage/semester metric source. |

## Current Runtime Contract

The tracked bundle declares production model version `observable-risk-logit-v9` with feature schema `observable-risk-features-v6`. Its raw family label is `catboost`, but the adjacent promotion decision is `keep-as-shadow`; runtime seeding resolves this to the logistic serving contract and keeps the tree challenger in shadow.

Training manifest: `proof-corpus-v1`; trained at `2026-03-16T00:00:00.000Z`; split summary train/validation/test = 21600/21600/21600 rows.

| Head | Family label | Version | Test support | Test positives | Positive rate | ROC AUC | Avg precision | Brier | Log loss | ECE | Display probability allowed |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| attendanceRisk | catboost | observable-risk-logit-v9 | 21600 | 2880 | 13.3% | 0.968 | 0.8392 | 0.0691 | 0.2771 | 0.1581 | false |
| ceRisk | catboost | observable-risk-logit-v9 | 21600 | 1280 | 5.9% | 0.8756 | 0.3702 | 0.0522 | 0.2094 | 0.0788 | false |
| downstreamCarryoverRisk | catboost | observable-risk-logit-v9 | 21600 | 7000 | 32.4% | 0.9328 | 0.8388 | 0.1243 | 0.4044 | 0.1669 | false |
| overallCourseRisk | catboost | observable-risk-logit-v9 | 21600 | 5150 | 23.8% | 0.7846 | 0.5353 | 0.1528 | 0.4766 | 0.0598 | true |
| seeRisk | catboost | observable-risk-logit-v9 | 21600 | 4500 | 20.8% | 0.7209 | 0.3899 | 0.1501 | 0.4698 | 0.0431 | true |

### Shadow Challenger Contract

| Head | Family | Version | ROC AUC | Avg precision | Brier | Log loss | ECE | Display probability allowed |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| attendanceRisk | depth-2-tree | observable-risk-catboost-challenger-v9 | 0.9831 | 0.8724 | 0.0314 | 0.1093 | 0.0126 | true |
| ceRisk | depth-2-tree | observable-risk-catboost-challenger-v9 | 0.8629 | 0.4574 | 0.04 | 0.1472 | 0.0222 | false |
| downstreamCarryoverRisk | depth-2-tree | observable-risk-catboost-challenger-v9 | 0.9251 | 0.7882 | 0.0945 | 0.2798 | 0.0305 | true |
| overallCourseRisk | depth-2-tree | observable-risk-catboost-challenger-v9 | 0.7325 | 0.4773 | 0.1502 | 0.4691 | 0.032 | true |
| seeRisk | depth-2-tree | observable-risk-catboost-challenger-v9 | 0.716 | 0.405 | 0.1468 | 0.4572 | 0.0329 | true |

### Promotion Gate

Decision: `keep-as-shadow`.

Promotable heads: downstreamCarryoverRisk.

Blocked heads: attendanceRisk, ceRisk, seeRisk, overallCourseRisk.

| Blocked head | Reasons |
| --- | --- |
| attendanceRisk | overload worsened: challenger=1.0032475640003395 baseline=1.0023636848075292 |
| ceRisk | localEceAt085 worsened: challenger=0.05863166672798714 baseline=0.01478535193015218<br>overload worsened: challenger=1.005320940982031 baseline=0.999433001480037 |
| overallCourseRisk | localEceAt04 worsened: challenger=0.010421689831197067 baseline=0.003981795664182108<br>localEceAt085 worsened: challenger=0.024528814792107445 baseline=0.015966422096126087 |
| seeRisk | localEceAt04 worsened: challenger=0.008206521729933303 baseline=0.0072563072232503245<br>localEceAt085 worsened: challenger=0.035554439839831864 baseline=0.02348188319025568<br>overload worsened: challenger=1.0053914784288405 baseline=1.0021368084654645 |

## What The Current Model Was Trained On

The coverage report corpus is `proof-corpus-v1` with 64800 total stage-evidence rows, 21600 test rows, and 3 source runs. The complete governed runs each span 5 stages per semester and 30 expected checkpoints.

Rows by semester: Sem 1: 10800; Sem 2: 10800; Sem 3: 10800; Sem 4: 10800; Sem 5: 10800; Sem 6: 10800.

Rows by stage: post-tt2: 12960; pre-tt1: 12960; post-assignments: 12960; post-see: 12960; post-tt1: 12960.

Scenario-family rows: balanced: 43200; coursework-inflation: 21600.

| Risk head | Train rows | Train positives | Validation rows | Validation positives | Test rows | Test positives |
| --- | --- | --- | --- | --- | --- | --- |
| attendanceRisk | 21600 | 4915 | 21600 | 4715 | 21600 | 2880 |
| ceRisk | 21600 | 1355 | 21600 | 895 | 21600 | 1280 |
| downstreamCarryoverRisk | 21600 | 6965 | 21600 | 6425 | 21600 | 7000 |
| overallCourseRisk | 21600 | 5990 | 21600 | 4660 | 21600 | 5150 |
| seeRisk | 21600 | 4275 | 21600 | 3390 | 21600 | 4500 |

Completeness gate notes: one duplicate/incomplete governed seed was skipped from complete checkpoint evidence; three complete runs contributed 30 checkpoints and 21,600 stage-evidence rows each.

### Archived Corpus Ledger

These six corpus identities are the retraining archaeology worth preserving outside Git. They are not all active runtime inputs; they explain how the historical approaches evolved and provide checksum anchors if a past run ever has to be reconstructed.

| Corpus | Archived path | Rows | Columns | SHA-256 | Why it matters |
| --- | --- | --- | --- | --- | --- |
| Root features.csv | air-mentor-api/output/proof-risk-model/features.csv | 2,024,000 | 71 | fc28d65c87b6ea1b468cda6424cbbea6c9e3f72c4c3851342c2f7c17f3e9bafc | Largest early feature corpus; keep only in the external training-corpora vault. |
| features_v3_fixed.csv | air-mentor-api/output/proof-risk-model/features_v3_fixed.csv | 607,200 | 71 | 6e19c0e54c4a9e8759eb4e316b67ee5158dfd24d956aa6ac3d5948259d949b68 | Fixed v3 corpus lineage used for historical SOTA-style training comparisons. |
| features_v3_realistic.csv | air-mentor-api/output/proof-risk-model/features_v3_realistic.csv | 1,012,000 | 61 | 94199c0a9c8d06eda1e8216d4d3bcffa502faa7db228ba8fb4979ffdaa1a2b82 | Realism-oriented v3 feature set with fewer columns and more scenario volume. |
| May 31 promoted benchmark | air-mentor-api/output/proof-risk-model/sota-policy-benchmark-20260531T000827Z/features.csv | 607,200 | 71 | fe927deecbb74151a393b43b5411a418531f908ffd246f52da63c4538d70db46 | Promoted benchmark corpus from the late-May model tournament phase. |
| June 2 completed benchmark | air-mentor-api/output/proof-risk-model/sota-policy-benchmark-20260602T215646Z/features.csv | 607,200 | 71 | ccab092e01484c157e8d86fcf4d4b13d73eb97da2bbc8e42f7f74a86248f46cc | Completed benchmark corpus tied to the later proof-readiness evidence pass. |
| Full v6 contract corpus | air-mentor-api/output/proof-risk-model/full-v6-contract-current/features.csv | 441,600 | 58 | 8719183588241ab25bae0686c0874b16e27493b8125dc1fc6cae69b04e9d20df | Current compact contract corpus; current and baseline v6 feature CSVs are byte-identical. |

## Acceptance And Product Readiness Gates

| Gate area | Result |
| --- | --- |
| Policy | structuredStudyPlanWithinLimit=true<br>targetedTutoringBeatsStructuredStudyPlanAcademicSlice=true<br>noRecommendedActionUnderperformsNoAction=true |
| CO evidence | theoryCoursesDefaultToBlueprintEvidence=true<br>fallbackOnlyInExplicitCases=true |
| Queue burden | actionableRatesWithinLimit=true<br>sectionToleranceWithinLimit=true<br>watchRatesWithinLimit=true<br>deferredRiskTransparencyPresent=true<br>actionableQueuePpvProxyWithinLimit=true |

## Overall Runtime Accuracy Against Heuristic

| Variant | Support | Positive rate | ROC AUC | Avg precision | Brier | Log loss | ECE | Medium precision | Medium recall | High precision | High recall | High FPR |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| model | 21600 | 23.8% | 0.8337 | 0.6256 | 0.1537 | 0.4932 | 0.1052 | 51.5% | 71.4% | 60.4% | 48% | 9.9% |
| heuristic | 21600 | 23.8% | 0.7538 | 0.5106 | 0.2042 | 0.6049 | 0.2141 | 34.7% | 77% | 51.3% | 46.7% | 13.9% |

Overall lift: Brier +0.0505, ROC AUC +0.0799 versus the heuristic baseline. The largest practical improvement is queue discipline: the model flags fewer medium-risk cases while preserving useful recall.

## Accuracy By Stage

| Stage | Support | Positive rate | Model AUC | Heuristic AUC | Model AP | Heuristic AP | Model Brier | Heuristic Brier | Model ECE | Heuristic ECE | High precision | High recall | Medium flagged | AUC lift | Brier lift |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| pre-tt1 | 4320 | 23.8% | 0.764 | 0.7742 | 0.4936 | 0.4918 | 0.1557 | 0.1584 | 0.0596 | 0.0728 | 61.5% | 20.8% | 24.1% | -0.0102 | 0.0027 |
| post-tt1 | 4320 | 23.8% | 0.8072 | 0.7846 | 0.5719 | 0.5422 | 0.145 | 0.1748 | 0.0735 | 0.1653 | 67.2% | 29.4% | 27.1% | 0.0226 | 0.0298 |
| post-tt2 | 4320 | 23.8% | 0.7946 | 0.7817 | 0.5039 | 0.5444 | 0.2051 | 0.2007 | 0.1868 | 0.2255 | 47.4% | 54.8% | 44.5% | 0.0129 | -0.0044 |
| post-assignments | 4320 | 23.8% | 0.8027 | 0.7911 | 0.5156 | 0.5578 | 0.199 | 0.2065 | 0.1797 | 0.2413 | 48.2% | 57.4% | 43.5% | 0.0116 | 0.0075 |
| post-see | 4320 | 23.8% | 0.9621 | 0.8992 | 0.9196 | 0.6679 | 0.064 | 0.2808 | 0.045 | 0.3972 | 90.8% | 77.5% | 26% | 0.0629 | 0.2168 |

## Accuracy By Semester

| Semester | Support | Positive rate | Current AUC | Baseline AUC | Challenger AUC | Heuristic AUC | Current AP | Baseline AP | Challenger AP | Heuristic AP | Current Brier | Current ECE | AUC lift vs heuristic | AP lift vs heuristic | AUC lift vs challenger |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| sem-1 | 3600 | 11.9% | 0.8161 | 0.7582 | 0.6774 | 0.6735 | 0.4881 | 0.3163 | 0.24 | 0.2612 | 0.1138 | 0.1584 | 0.1426 | 0.2269 | 0.1387 |
| sem-2 | 3600 | 18.6% | 0.8541 | 0.7428 | 0.6913 | 0.7413 | 0.6208 | 0.4055 | 0.395 | 0.3954 | 0.1075 | 0.0322 | 0.1128 | 0.2254 | 0.1628 |
| sem-3 | 3600 | 19.2% | 0.8406 | 0.7774 | 0.7368 | 0.7674 | 0.5993 | 0.4873 | 0.4742 | 0.4948 | 0.1861 | 0.1859 | 0.0732 | 0.1045 | 0.1038 |
| sem-4 | 3600 | 25.6% | 0.8443 | 0.7829 | 0.7228 | 0.7564 | 0.6602 | 0.5554 | 0.485 | 0.5346 | 0.1661 | 0.1192 | 0.0879 | 0.1256 | 0.1215 |
| sem-5 | 3600 | 33.1% | 0.8113 | 0.7603 | 0.7286 | 0.7369 | 0.6787 | 0.6043 | 0.5654 | 0.6074 | 0.1873 | 0.09 | 0.0744 | 0.0713 | 0.0827 |
| sem-6 | 3600 | 34.7% | 0.8202 | 0.7443 | 0.7099 | 0.7048 | 0.7337 | 0.5845 | 0.5526 | 0.5559 | 0.1617 | 0.0517 | 0.1154 | 0.1778 | 0.1103 |

## Variant Comparison By Stage

| Stage | Support | Positive rate | Current AUC | Baseline AUC | Challenger AUC | Hybrid AUC | Heuristic AUC | Current AP | Baseline AP | Challenger AP | Hybrid AP | Heuristic AP | Current Brier | Current ECE |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| pre-tt1 | 4320 | 23.8% | 0.764 | 0.7437 | 0.723 | 0.764 | 0.7742 | 0.4936 | 0.4641 | 0.4691 | 0.4936 | 0.4918 | 0.1557 | 0.0596 |
| post-tt1 | 4320 | 23.8% | 0.8072 | 0.7587 | 0.7168 | 0.8072 | 0.7846 | 0.5719 | 0.5053 | 0.4825 | 0.5719 | 0.5422 | 0.145 | 0.0735 |
| post-tt2 | 4320 | 23.8% | 0.7946 | 0.778 | 0.7228 | 0.7946 | 0.7817 | 0.5039 | 0.536 | 0.4759 | 0.5039 | 0.5444 | 0.2051 | 0.1868 |
| post-assignments | 4320 | 23.8% | 0.8027 | 0.7826 | 0.7194 | 0.8027 | 0.7911 | 0.5156 | 0.5435 | 0.4878 | 0.5156 | 0.5578 | 0.199 | 0.1797 |
| post-see | 4320 | 23.8% | 0.9621 | 0.855 | 0.782 | 0.9621 | 0.8992 | 0.9196 | 0.6087 | 0.5256 | 0.9196 | 0.6679 | 0.064 | 0.045 |

## Semester 1 Through Semester 6 Demo Checkpoint Rollups

Each row below is a staged proof checkpoint: five stages per semester, six semesters, 30 checkpoints total. `Projection count` is course/offering-level risk projection volume; `students` is the unique student count visible in the checkpoint rollup.

| Semester | Stage | Students | Projection count | High-risk students | High-risk projections | Medium-risk projections | Avg risk scaled | Open queue students | Open queue projections | Watch students | Deferred watch students | Avg counterfactual lift |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | pre-tt1 | 120 | 2160 | 61 | 195 | 362 | 33 | 0 | 0 | 0 | 0 | 0 |
| 1 | post-tt1 | 120 | 2160 | 58 | 169 | 279 | 30.7 | 29 | 31 | 18 | 0 | 0 |
| 1 | post-tt2 | 120 | 2160 | 61 | 156 | 172 | 26.5 | 36 | 41 | 28 | 1 | 1.4 |
| 1 | post-assignments | 120 | 2160 | 60 | 157 | 197 | 25.6 | 34 | 39 | 33 | 0 | 1.6 |
| 1 | post-see | 120 | 2160 | 54 | 101 | 63 | 14.8 | 49 | 57 | 12 | 0 | 1.5 |
| 2 | pre-tt1 | 120 | 2160 | 41 | 112 | 210 | 25 | 0 | 0 | 0 | 0 | 0 |
| 2 | post-tt1 | 120 | 2160 | 41 | 117 | 229 | 25.1 | 24 | 28 | 37 | 20 | 0 |
| 2 | post-tt2 | 120 | 2160 | 36 | 93 | 204 | 22.8 | 28 | 33 | 34 | 17 | 3.9 |
| 2 | post-assignments | 120 | 2160 | 41 | 120 | 212 | 22.6 | 30 | 34 | 37 | 16 | 4.2 |
| 2 | post-see | 120 | 2160 | 61 | 135 | 73 | 17 | 50 | 58 | 17 | 2 | 1.6 |
| 3 | pre-tt1 | 120 | 2160 | 52 | 145 | 334 | 28.2 | 0 | 0 | 0 | 0 | 0 |
| 3 | post-tt1 | 120 | 2160 | 50 | 150 | 327 | 27.3 | 28 | 33 | 44 | 17 | 0 |
| 3 | post-tt2 | 120 | 2160 | 100 | 758 | 163 | 45.4 | 47 | 55 | 41 | 17 | 0.8 |
| 3 | post-assignments | 120 | 2160 | 100 | 762 | 156 | 44.9 | 48 | 55 | 36 | 19 | 0.8 |
| 3 | post-see | 120 | 2160 | 95 | 393 | 270 | 31.9 | 69 | 89 | 25 | 10 | 2 |
| 4 | pre-tt1 | 120 | 2160 | 58 | 146 | 384 | 29.5 | 0 | 0 | 0 | 0 | 0 |
| 4 | post-tt1 | 120 | 2160 | 47 | 153 | 393 | 28.6 | 26 | 29 | 54 | 13 | 0 |
| 4 | post-tt2 | 120 | 2160 | 102 | 680 | 278 | 44.1 | 56 | 66 | 36 | 13 | 1 |
| 4 | post-assignments | 120 | 2160 | 102 | 687 | 252 | 43.5 | 55 | 64 | 38 | 13 | 0.9 |
| 4 | post-see | 120 | 2160 | 97 | 412 | 213 | 31.8 | 76 | 99 | 16 | 5 | 1.6 |
| 5 | pre-tt1 | 120 | 2160 | 59 | 175 | 405 | 32.1 | 0 | 0 | 0 | 0 | 0 |
| 5 | post-tt1 | 120 | 2160 | 63 | 217 | 454 | 33.3 | 46 | 57 | 45 | 16 | 0 |
| 5 | post-tt2 | 120 | 2160 | 106 | 659 | 406 | 46.1 | 55 | 65 | 41 | 14 | 1 |
| 5 | post-assignments | 120 | 2160 | 106 | 678 | 374 | 45.9 | 58 | 70 | 42 | 11 | 1 |
| 5 | post-see | 120 | 2160 | 106 | 429 | 274 | 34.4 | 76 | 107 | 23 | 10 | 2 |
| 6 | pre-tt1 | 120 | 2160 | 64 | 205 | 520 | 35.3 | 0 | 0 | 0 | 0 | 0 |
| 6 | post-tt1 | 120 | 2160 | 72 | 274 | 582 | 37.3 | 53 | 65 | 41 | 19 | 0 |
| 6 | post-tt2 | 120 | 2160 | 89 | 371 | 820 | 43.1 | 50 | 61 | 44 | 24 | 1.5 |
| 6 | post-assignments | 120 | 2160 | 92 | 401 | 759 | 43.3 | 55 | 67 | 34 | 29 | 1.6 |
| 6 | post-see | 120 | 2160 | 106 | 391 | 303 | 33.7 | 87 | 115 | 15 | 12 | 1.2 |

## Historical Metrics Run Inventory

| Run | Generated | Protocol | Feature count | Feature hash | Train families | Test families | Feature CSV SHA | Promotion summary | Source |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| full-policy-benchmark-20260527/training | 2026-05-27T00:14:23+00:00 | index-based | 44 | 37e617dd43448549b67815ab27d47cb4908177276f571f75c45788b76a1eec05 |  |  | aa273b59f9cebd88dc1e055fd634cfe7423044c1d3bf810721321ecc44c3198e | promote-as-primary; promotable=5; blocked=0 | airmentor-historical-model-runs/2026-06-06/proof-risk-model-archive/old-benchmark-runs/full-policy-benchmark-20260527/training/metrics.json |
| sota-ensemble | 2026-05-25T02:29:05+00:00 |  | 44 | 37e617dd43448549b67815ab27d47cb4908177276f571f75c45788b76a1eec05 |  |  | 0614d783e5c15065c514fd7fcffba3034244ead0159545e494cddedc01a51958 | promote-as-primary; promotable=5; blocked=0 | airmentor-historical-model-runs/2026-06-06/proof-risk-model-archive/old-benchmark-runs/sota-ensemble/metrics.json |
| sota-fixed | 2026-05-26T21:58:08+00:00 | family-disjoint | 44 | 37e617dd43448549b67815ab27d47cb4908177276f571f75c45788b76a1eec05 | coursework-inflation, high-forgetting, low-attendance, weak-foundation | balanced, intervention-resistant | 5357f9f69f826f7315f7fa349846ab584598cfc4f623c878f771ecb3d6258df0 | promote-as-primary; promotable=5; blocked=0 | airmentor-historical-model-runs/2026-06-06/proof-risk-model-archive/old-benchmark-runs/sota-fixed/metrics.json |
| sota-run-20260526 | 2026-05-26T18:23:39+00:00 | family-disjoint | 44 | 37e617dd43448549b67815ab27d47cb4908177276f571f75c45788b76a1eec05 | coursework-inflation, high-forgetting, low-attendance, weak-foundation | balanced, intervention-resistant | 0614d783e5c15065c514fd7fcffba3034244ead0159545e494cddedc01a51958 | promote-as-primary; promotable=5; blocked=0 | airmentor-historical-model-runs/2026-06-06/proof-risk-model-archive/old-benchmark-runs/sota-run-20260526/metrics.json |
| sota-run-20260527 | 2026-05-26T19:11:36+00:00 | family-disjoint | 44 | 37e617dd43448549b67815ab27d47cb4908177276f571f75c45788b76a1eec05 | coursework-inflation, high-forgetting, low-attendance, weak-foundation | balanced, intervention-resistant | 0614d783e5c15065c514fd7fcffba3034244ead0159545e494cddedc01a51958 | promote-as-primary; promotable=5; blocked=0 | airmentor-historical-model-runs/2026-06-06/proof-risk-model-archive/old-benchmark-runs/sota-run-20260527/metrics.json |
| sota-run-20260527/training | 2026-05-26T20:31:47+00:00 | family-disjoint | 44 | 37e617dd43448549b67815ab27d47cb4908177276f571f75c45788b76a1eec05 | coursework-inflation, high-forgetting, low-attendance, weak-foundation | balanced, intervention-resistant | 89113504778d56da84f3a8bd421db549079ac61b9848bde051c13568473c8d7e | promote-as-primary; promotable=5; blocked=0 | airmentor-historical-model-runs/2026-06-06/proof-risk-model-archive/old-benchmark-runs/sota-run-20260527/training/metrics.json |
| v2-training | 2026-05-26T21:23:57+00:00 | family-disjoint | 44 | 37e617dd43448549b67815ab27d47cb4908177276f571f75c45788b76a1eec05 | coursework-inflation, high-forgetting, low-attendance, weak-foundation | balanced, intervention-resistant | 637c7699a40a068736639ac1cb162b8025f992d1221962e676fbef9bf32d2e8b | promote-as-primary; promotable=5; blocked=0 | airmentor-historical-model-runs/2026-06-06/proof-risk-model-archive/old-benchmark-runs/v2-training/metrics.json |
| current-local-runtime-output | 2026-05-22T17:48:27+00:00 |  | 44 | 37e617dd43448549b67815ab27d47cb4908177276f571f75c45788b76a1eec05 |  |  | 0614d783e5c15065c514fd7fcffba3034244ead0159545e494cddedc01a51958 | keep-as-shadow; promotable=1; blocked=4 | air-mentor-api/output/proof-risk-model/metrics.json |

## Historical Per-Head Accuracy Tables

Columns prefixed with `B` are the baseline model in that run; columns prefixed with `C` are the challenger or selected challenger comparison recorded by that run. Metrics are test-split metrics where the artifact provided them.

| Run | Head | Selected model | Promotable | B AUC | B AP | B Brier | B LogLoss | B ECE | B P@50 | B R@50 | B overload | C AUC | C AP | C Brier | C LogLoss | C ECE | C P@50 | C R@50 | C overload | Blocked reasons |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| full-policy-benchmark-20260527/training | attendanceRisk | baseline | true | 0.9982 | 0.9574 | 0.006 | 0.032 |  | 0.9535 | 0.9789 | 0.9826 | 0.9982 | 0.9574 | 0.006 | 0.032 |  | 0.9535 | 0.9789 | 0.9826 |  |
| full-policy-benchmark-20260527/training | ceRisk | xgboost | true | 0.6989 | 0.4358 | 0.1 | 0.3533 |  | 0.7551 | 0.2154 | 1.0967 | 0.7063 | 0.4521 | 0.0897 | 0.3194 |  | 0.734 | 0.3394 | 1.0663 |  |
| full-policy-benchmark-20260527/training | downstreamCarryoverRisk | xgboost | true | 0.8363 | 0.7548 | 0.1543 | 0.4781 |  | 0.7234 | 0.6255 | 1.0008 | 0.9187 | 0.879 | 0.068 | 0.2611 |  | 0.9235 | 0.8654 | 0.984 |  |
| full-policy-benchmark-20260527/training | overallCourseRisk | catboost | true | 0.9327 | 0.9199 | 0.1003 | 0.351 |  | 0.9292 | 0.814 | 1.0163 | 0.9348 | 0.9176 | 0.0764 | 0.2787 |  | 0.9318 | 0.8716 | 0.9797 |  |
| full-policy-benchmark-20260527/training | seeRisk | catboost | true | 0.7499 | 0.635 | 0.1835 | 0.549 |  | 0.6492 | 0.4374 | 1.1218 | 0.7668 | 0.6419 | 0.1785 | 0.5333 |  | 0.6273 | 0.5151 | 1.162 |  |
| sota-ensemble | attendanceRisk | baseline | true | 0.9877 | 0.9016 | 0.025 | 0.0787 |  | 0.8281 | 0.7633 | 1.0017 | 0.9877 | 0.9016 | 0.025 | 0.0787 |  | 0.8281 | 0.7633 | 1.0017 |  |
| sota-ensemble | ceRisk | baseline | true | 0.9734 | 0.5606 | 0.0211 | 0.068 |  | 0.6689 | 0.2989 | 0.9996 | 0.9734 | 0.5606 | 0.0211 | 0.068 |  | 0.6689 | 0.2989 | 0.9996 |  |
| sota-ensemble | downstreamCarryoverRisk | baseline | true | 0.9474 | 0.8754 | 0.0848 | 0.2636 |  | 0.7692 | 0.8115 | 0.993 | 0.9474 | 0.8754 | 0.0848 | 0.2636 |  | 0.7692 | 0.8115 | 0.993 |  |
| sota-ensemble | overallCourseRisk | xgboost | true | 0.8493 | 0.6346 | 0.1141 | 0.3621 |  | 0.7017 | 0.3846 | 0.9843 | 0.9212 | 0.8019 | 0.0819 | 0.2594 |  | 0.8672 | 0.5132 | 0.9943 |  |
| sota-ensemble | seeRisk | baseline | true | 0.9009 | 0.7368 | 0.0917 | 0.2879 |  | 0.7668 | 0.4785 | 0.9983 | 0.9009 | 0.7368 | 0.0917 | 0.2879 |  | 0.7668 | 0.4785 | 0.9983 |  |
| sota-fixed | attendanceRisk | baseline | true | 0.9962 | 0.9118 | 0.0064 | 0.0325 |  | 0.9489 | 0.9217 | 0.9572 | 0.9962 | 0.9118 | 0.0064 | 0.0325 |  | 0.9489 | 0.9217 | 0.9572 |  |
| sota-fixed | ceRisk | baseline | true | 0.7636 | 0.6133 | 0.0896 | 0.3233 |  | 0.9082 | 0.4252 | 0.9774 | 0.7636 | 0.6133 | 0.0896 | 0.3233 |  | 0.9082 | 0.4252 | 0.9774 |  |
| sota-fixed | downstreamCarryoverRisk | baseline | true | 0.8554 | 0.8309 | 0.1519 | 0.4706 |  | 0.792 | 0.6743 | 0.9586 | 0.8554 | 0.8309 | 0.1519 | 0.4706 |  | 0.792 | 0.6743 | 0.9586 |  |
| sota-fixed | overallCourseRisk | lightgbm | true | 0.9164 | 0.9276 | 0.0926 | 0.3185 |  | 0.9225 | 0.8731 | 0.9952 | 0.9249 | 0.93 | 0.0664 | 0.2558 |  | 0.9284 | 0.9591 | 1.0036 |  |
| sota-fixed | seeRisk | baseline | true | 0.8657 | 0.8227 | 0.143 | 0.4504 |  | 0.7124 | 0.7559 | 1.1138 | 0.8657 | 0.8227 | 0.143 | 0.4504 |  | 0.7124 | 0.7559 | 1.1138 |  |
| sota-run-20260526 | attendanceRisk | baseline | true | 0.9885 | 0.8964 | 0.0226 | 0.0717 |  | 0.8279 | 0.7551 | 0.9971 | 0.9885 | 0.8964 | 0.0226 | 0.0717 |  | 0.8279 | 0.7551 | 0.9971 |  |
| sota-run-20260526 | ceRisk | baseline | true | 0.9744 | 0.5563 | 0.0198 | 0.065 |  | 0.6623 | 0.3385 | 0.9476 | 0.9744 | 0.5563 | 0.0198 | 0.065 |  | 0.6623 | 0.3385 | 0.9476 |  |
| sota-run-20260526 | downstreamCarryoverRisk | baseline | true | 0.9433 | 0.8553 | 0.0859 | 0.2662 |  | 0.7374 | 0.8359 | 0.9965 | 0.9433 | 0.8553 | 0.0859 | 0.2662 |  | 0.7374 | 0.8359 | 0.9965 |  |
| sota-run-20260526 | overallCourseRisk | lightgbm | true | 0.8557 | 0.6236 | 0.1074 | 0.3432 |  | 0.6935 | 0.3823 | 1.0073 | 0.9244 | 0.7998 | 0.0773 | 0.2464 |  | 0.8235 | 0.5476 | 0.996 |  |
| sota-run-20260526 | seeRisk | lightgbm | true | 0.9036 | 0.7279 | 0.0881 | 0.2774 |  | 0.7456 | 0.483 | 1.0101 | 0.9451 | 0.8542 | 0.0623 | 0.2049 |  | 0.8503 | 0.6592 | 1.0035 |  |
| sota-run-20260527 | attendanceRisk | baseline | true | 0.9885 | 0.8964 | 0.0226 | 0.0717 |  | 0.8279 | 0.7551 | 0.9971 | 0.9885 | 0.8964 | 0.0226 | 0.0717 |  | 0.8279 | 0.7551 | 0.9971 |  |
| sota-run-20260527 | ceRisk | baseline | true | 0.9744 | 0.5563 | 0.0198 | 0.065 |  | 0.6623 | 0.3385 | 0.9476 | 0.9744 | 0.5563 | 0.0198 | 0.065 |  | 0.6623 | 0.3385 | 0.9476 |  |
| sota-run-20260527 | downstreamCarryoverRisk | baseline | true | 0.9433 | 0.8553 | 0.0859 | 0.2662 |  | 0.7374 | 0.8359 | 0.9965 | 0.9433 | 0.8553 | 0.0859 | 0.2662 |  | 0.7374 | 0.8359 | 0.9965 |  |
| sota-run-20260527 | overallCourseRisk | ensemble | true | 0.8557 | 0.6236 | 0.1074 | 0.3432 |  | 0.6935 | 0.3823 | 1.0073 | 0.9248 | 0.8008 | 0.0771 | 0.2459 |  | 0.8255 | 0.548 | 0.9955 |  |
| sota-run-20260527 | seeRisk | lightgbm | true | 0.9036 | 0.7279 | 0.0881 | 0.2774 |  | 0.7456 | 0.483 | 1.0101 | 0.9451 | 0.8542 | 0.0623 | 0.2049 |  | 0.8503 | 0.6592 | 1.0035 |  |
| sota-run-20260527/training | attendanceRisk | baseline | true | 0.9885 | 0.8966 | 0.0226 | 0.0717 |  | 0.8264 | 0.757 | 0.998 | 0.9885 | 0.8966 | 0.0226 | 0.0717 |  | 0.8264 | 0.757 | 0.998 |  |
| sota-run-20260527/training | ceRisk | ensemble | true | 0.9746 | 0.5671 | 0.0198 | 0.0647 |  | 0.6824 | 0.2977 | 0.9512 | 0.9759 | 0.5911 | 0.0192 | 0.063 |  | 0.675 | 0.377 | 0.9513 |  |
| sota-run-20260527/training | downstreamCarryoverRisk | baseline | true | 0.9431 | 0.8601 | 0.0876 | 0.2706 |  | 0.7514 | 0.7995 | 0.9964 | 0.9431 | 0.8601 | 0.0876 | 0.2706 |  | 0.7514 | 0.7995 | 0.9964 |  |
| sota-run-20260527/training | overallCourseRisk | ensemble | true | 0.8557 | 0.6238 | 0.1074 | 0.3432 |  | 0.6946 | 0.3817 | 1.0074 | 0.9245 | 0.8002 | 0.0772 | 0.2464 |  | 0.8232 | 0.5494 | 0.9958 |  |
| sota-run-20260527/training | seeRisk | baseline | true | 0.904 | 0.7287 | 0.0879 | 0.277 |  | 0.7448 | 0.4839 | 1.0112 | 0.904 | 0.7287 | 0.0879 | 0.277 |  | 0.7448 | 0.4839 | 1.0112 |  |
| v2-training | attendanceRisk | baseline | true | 0.9998 | 0.9891 | 0.0001 | 0.0012 |  | 1 | 0.9863 | 1.0377 | 0.9998 | 0.9891 | 0.0001 | 0.0012 |  | 1 | 0.9863 | 1.0377 |  |
| v2-training | ceRisk | lightgbm | true | 0.9998 | 0.9872 | 0.0016 | 0.0052 |  | 0.9095 | 0.9614 | 1.0814 | 0.9997 | 0.9814 | 0.0016 | 0.0051 |  | 0.9515 | 0.9101 | 0.9754 |  |
| v2-training | downstreamCarryoverRisk | baseline | true | 0.9874 | 0.8894 | 0.026 | 0.1333 |  | 0.8568 | 0.8964 | 0.9991 | 0.9874 | 0.8894 | 0.026 | 0.1333 |  | 0.8568 | 0.8964 | 0.9991 |  |
| v2-training | overallCourseRisk | baseline | true | 0.986 | 0.9911 | 0.008 | 0.0449 |  | 0.9999 | 0.9803 | 0.9892 | 0.986 | 0.9911 | 0.008 | 0.0449 |  | 0.9999 | 0.9803 | 0.9892 |  |
| v2-training | seeRisk | baseline | true | 0.9998 | 0.9986 | 0.0039 | 0.0125 |  | 0.9837 | 0.9729 | 0.9939 | 0.9998 | 0.9986 | 0.0039 | 0.0125 |  | 0.9837 | 0.9729 | 0.9939 |  |
| current-local-runtime-output | attendanceRisk |  | false | 0.9877 | 0.8976 | 0.0249 | 0.0777 |  | 0.8477 | 0.7414 | 1.0024 | 0.989 | 0.9079 | 0.0235 | 0.0729 |  | 0.8543 | 0.7496 | 1.0032 | overload worsened: challenger=1.0032475640003395 baseline=1.0023636848075292 |
| current-local-runtime-output | ceRisk |  | false | 0.9733 | 0.5489 | 0.021 | 0.0682 |  | 0.6371 | 0.3476 | 0.9994 | 0.9743 | 0.5535 | 0.0208 | 0.0672 |  | 0.6215 | 0.3974 | 1.0053 | localEceAt085 worsened: challenger=0.05863166672798714 baseline=0.01478535193015218; overload worsened: challenger=1.005320940982031 baseline=0.999433001480037 |
| current-local-runtime-output | downstreamCarryoverRisk |  | true | 0.9473 | 0.8695 | 0.0835 | 0.2592 |  | 0.744 | 0.876 | 0.9929 | 0.9613 | 0.8989 | 0.0724 | 0.2237 |  | 0.8034 | 0.836 | 0.9973 |  |
| current-local-runtime-output | overallCourseRisk |  | false | 0.8493 | 0.6295 | 0.1141 | 0.3617 |  | 0.7119 | 0.3689 | 0.985 | 0.8921 | 0.7437 | 0.0946 | 0.3016 |  | 0.8149 | 0.4644 | 0.991 | localEceAt04 worsened: challenger=0.010421689831197067 baseline=0.003981795664182108; localEceAt085 worsened: challenger=0.024528814792107445 baseline=0.015966422096126087 |
| current-local-runtime-output | seeRisk |  | false | 0.9008 | 0.7309 | 0.0916 | 0.2868 |  | 0.7598 | 0.4879 | 1.0021 | 0.9171 | 0.7886 | 0.08 | 0.2551 |  | 0.8466 | 0.5483 | 1.0054 | localEceAt04 worsened: challenger=0.008206521729933303 baseline=0.0072563072232503245; localEceAt085 worsened: challenger=0.035554439839831864 baseline=0.02348188319025568; overload worsened: challenger=1.0053914784288405 baseline=1.0021368084654645 |

## Shadow Tabular Model Zoo Benchmarks

This is the explicit answer to whether the archive includes the broader model experiments: yes for XGBoost, LightGBM, CatBoost, TabPFN, AutoGluon, PyTabKit, logistic, stage-specialist baselines, and calibration-weighted ensembles. These rows are shadow-only synthetic benchmarks and do not change the product serving contract.

| Family | Matched files in archive/vault | Coverage note |
| --- | --- | --- |
| XGBoost | 58 | JSON model artifacts and prediction arrays across SOTA, full-policy, v2, v6, and diagnostic shadow runs. |
| LightGBM | 59 | Text model artifacts, calibration sidecars, and prediction arrays across the same tournament lineage. |
| CatBoost | 271 | CBM binaries, JSON sidecars, and repeated challenger promotion-gate runs. |
| TabPFN | 10 | Shadow-only prediction arrays plus benchmark result JSON/Markdown; not a serving artifact. |
| AutoGluon | 10 | Shadow-only prediction arrays and AutoGluon predictor directories/metadata; not a serving artifact. |
| PyTabKit | 10 | Shadow-only benchmark participation recorded in benchmark result JSON/Markdown; model directories are not retained in the compact vault. |

| Benchmark | Head | Model | Status | Selected by validation | Selected by early-warning | Heavy models allowed | Train rows | Val AUC | Test AUC | Test AP | Test Brier | Test ECE | Early-warning AUC | Late-detection AUC | Seconds |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| full-policy-benchmark-20260527/shadow-benchmark | attendanceRisk | autogluon | ok |  |  | true | 50000 | 0.998 | 0.9984 |  | 0.003 | 0.0025 |  |  | 419.3 |
| full-policy-benchmark-20260527/shadow-benchmark | attendanceRisk | calibration_weighted_ensemble | ok |  |  | true |  | 0.998 | 0.9983 |  | 0.0028 | 0.0019 |  |  |  |
| full-policy-benchmark-20260527/shadow-benchmark | attendanceRisk | catboost | ok |  |  | true | 220800 | 0.998 | 0.9982 |  | 0.0028 | 0.0025 |  |  | 1.5 |
| full-policy-benchmark-20260527/shadow-benchmark | attendanceRisk | lightgbm | ok |  |  | true | 220800 | 0.9979 | 0.9983 |  | 0.003 | 0.0026 |  |  | 1.7 |
| full-policy-benchmark-20260527/shadow-benchmark | attendanceRisk | logistic | ok | yes |  | true | 220800 | 0.9982 | 0.9984 |  | 0.008 | 0.0184 |  |  | 1 |
| full-policy-benchmark-20260527/shadow-benchmark | attendanceRisk | pytabkit | ok |  |  | true | 50000 | 0.9981 | 0.9983 |  | 0.003 | 0.0016 |  |  | 73.3 |
| full-policy-benchmark-20260527/shadow-benchmark | attendanceRisk | tabpfn | ok |  |  | true | 50000 | 0.9981 | 0.9984 |  | 0.003 | 0.0021 |  |  | 361 |
| full-policy-benchmark-20260527/shadow-benchmark | attendanceRisk | xgboost | ok |  |  | true | 220800 | 0.9979 | 0.9982 |  | 0.0028 | 0.0025 |  |  | 1.3 |
| full-policy-benchmark-20260527/shadow-benchmark | ceRisk | autogluon | ok |  |  | true | 50000 | 0.7603 | 0.6854 |  | 0.0978 | 0.0405 |  |  | 1189.8 |
| full-policy-benchmark-20260527/shadow-benchmark | ceRisk | calibration_weighted_ensemble | ok |  |  | true |  | 0.7714 | 0.7003 |  | 0.0969 | 0.0532 |  |  |  |
| full-policy-benchmark-20260527/shadow-benchmark | ceRisk | catboost | ok |  |  | true | 220800 | 0.7707 | 0.6989 |  | 0.1606 | 0.2421 |  |  | 1.4 |
| full-policy-benchmark-20260527/shadow-benchmark | ceRisk | lightgbm | ok |  |  | true | 220800 | 0.7701 | 0.7 |  | 0.1568 | 0.2359 |  |  | 2.4 |
| full-policy-benchmark-20260527/shadow-benchmark | ceRisk | logistic | ok |  |  | true | 220800 | 0.7511 | 0.6841 |  | 0.1849 | 0.2694 |  |  | 4.7 |
| full-policy-benchmark-20260527/shadow-benchmark | ceRisk | pytabkit | ok | yes |  | true | 50000 | 0.7756 | 0.7056 |  | 0.0928 | 0.0103 |  |  | 112.3 |
| full-policy-benchmark-20260527/shadow-benchmark | ceRisk | tabpfn | ok |  |  | true | 50000 | 0.768 | 0.6991 |  | 0.0943 | 0.0296 |  |  | 384.7 |
| full-policy-benchmark-20260527/shadow-benchmark | ceRisk | xgboost | ok |  |  | true | 220800 | 0.7694 | 0.6975 |  | 0.1564 | 0.234 |  |  | 1.4 |
| full-policy-benchmark-20260527/shadow-benchmark | downstreamCarryoverRisk | autogluon | ok |  |  | true | 50000 | 0.828 | 0.8089 |  | 0.1751 | 0.077 |  |  | 911.4 |
| full-policy-benchmark-20260527/shadow-benchmark | downstreamCarryoverRisk | calibration_weighted_ensemble | ok |  |  | true |  | 0.856 | 0.8334 |  | 0.1578 | 0.0463 |  |  |  |
| full-policy-benchmark-20260527/shadow-benchmark | downstreamCarryoverRisk | catboost | ok | yes |  | true | 220800 | 0.8595 | 0.8354 |  | 0.1573 | 0.0542 |  |  | 1.5 |
| full-policy-benchmark-20260527/shadow-benchmark | downstreamCarryoverRisk | lightgbm | ok |  |  | true | 220800 | 0.8548 | 0.8323 |  | 0.1592 | 0.0539 |  |  | 1.5 |
| full-policy-benchmark-20260527/shadow-benchmark | downstreamCarryoverRisk | logistic | ok |  |  | true | 220800 | 0.7828 | 0.7531 |  | 0.1934 | 0.0691 |  |  | 2 |
| full-policy-benchmark-20260527/shadow-benchmark | downstreamCarryoverRisk | pytabkit | ok |  |  | true | 50000 | 0.8592 | 0.8368 |  | 0.1537 | 0.0128 |  |  | 62.1 |
| full-policy-benchmark-20260527/shadow-benchmark | downstreamCarryoverRisk | tabpfn | ok |  |  | true | 50000 | 0.8349 | 0.8079 |  | 0.1768 | 0.0865 |  |  | 396.3 |
| full-policy-benchmark-20260527/shadow-benchmark | downstreamCarryoverRisk | xgboost | ok |  |  | true | 220800 | 0.8527 | 0.8315 |  | 0.1596 | 0.0528 |  |  | 1.3 |
| full-policy-benchmark-20260527/shadow-benchmark | overallCourseRisk | autogluon | ok |  |  | true | 50000 | 0.9019 | 0.9231 |  | 0.0848 | 0.0338 |  |  | 1004.9 |
| full-policy-benchmark-20260527/shadow-benchmark | overallCourseRisk | calibration_weighted_ensemble | ok |  |  | true |  | 0.9119 | 0.9351 |  | 0.0791 | 0.0288 |  |  |  |
| full-policy-benchmark-20260527/shadow-benchmark | overallCourseRisk | catboost | ok |  |  | true | 220800 | 0.9105 | 0.9345 |  | 0.0798 | 0.0346 |  |  | 6.2 |
| full-policy-benchmark-20260527/shadow-benchmark | overallCourseRisk | lightgbm | ok | yes |  | true | 220800 | 0.9124 | 0.9343 |  | 0.0801 | 0.0339 |  |  | 10.8 |
| full-policy-benchmark-20260527/shadow-benchmark | overallCourseRisk | logistic | ok |  |  | true | 220800 | 0.9101 | 0.9326 |  | 0.1016 | 0.0769 |  |  | 11.1 |
| full-policy-benchmark-20260527/shadow-benchmark | overallCourseRisk | pytabkit | ok |  |  | true | 50000 | 0.9095 | 0.9303 |  | 0.0812 | 0.0181 |  |  | 116.3 |
| full-policy-benchmark-20260527/shadow-benchmark | overallCourseRisk | tabpfn | ok |  |  | true | 50000 | 0.909 | 0.9297 |  | 0.0809 | 0.024 |  |  | 549.6 |
| full-policy-benchmark-20260527/shadow-benchmark | overallCourseRisk | xgboost | ok |  |  | true | 220800 | 0.9106 | 0.934 |  | 0.0807 | 0.0334 |  |  | 3.4 |
| full-policy-benchmark-20260527/shadow-benchmark | seeRisk | autogluon | ok |  |  | true | 50000 | 0.6761 | 0.6877 |  | 0.2054 | 0.0845 |  |  | 1469.4 |
| full-policy-benchmark-20260527/shadow-benchmark | seeRisk | calibration_weighted_ensemble | ok |  |  | true |  | 0.7028 | 0.7232 |  | 0.1933 | 0.0636 |  |  |  |
| full-policy-benchmark-20260527/shadow-benchmark | seeRisk | catboost | ok |  |  | true | 220800 | 0.7044 | 0.7238 |  | 0.1953 | 0.0779 |  |  | 1.6 |
| full-policy-benchmark-20260527/shadow-benchmark | seeRisk | lightgbm | ok |  |  | true | 220800 | 0.6987 | 0.7193 |  | 0.1969 | 0.0783 |  |  | 2.2 |
| full-policy-benchmark-20260527/shadow-benchmark | seeRisk | logistic | ok |  |  | true | 220800 | 0.7101 | 0.7237 |  | 0.198 | 0.0899 |  |  | 3.4 |
| full-policy-benchmark-20260527/shadow-benchmark | seeRisk | pytabkit | ok | yes |  | true | 50000 | 0.7107 | 0.7239 |  | 0.1888 | 0.018 |  |  | 83.5 |
| full-policy-benchmark-20260527/shadow-benchmark | seeRisk | tabpfn | ok |  |  | true | 50000 | 0.6876 | 0.7036 |  | 0.2011 | 0.0751 |  |  | 409.2 |
| full-policy-benchmark-20260527/shadow-benchmark | seeRisk | xgboost | ok |  |  | true | 220800 | 0.698 | 0.7177 |  | 0.197 | 0.0761 |  |  | 1.3 |
| ce-see-stage-diagnostic-shadow | attendanceRisk | calibration_weighted_ensemble | ok |  |  | false |  | 0.9979 | 0.9982 | 0.9471 | 0.0028 | 0.0026 |  |  |  |
| ce-see-stage-diagnostic-shadow | attendanceRisk | catboost | ok |  |  | false | 220800 | 0.9979 | 0.9982 | 0.9455 | 0.0028 | 0.0025 |  |  | 3.9 |
| ce-see-stage-diagnostic-shadow | attendanceRisk | lightgbm | ok |  |  | false | 220800 | 0.9979 | 0.9983 | 0.95 | 0.003 | 0.0026 |  |  | 1.5 |
| ce-see-stage-diagnostic-shadow | attendanceRisk | logistic | ok | yes | yes | false | 220800 | 0.9982 | 0.9984 | 0.9595 | 0.008 | 0.0184 |  |  | 2.8 |
| ce-see-stage-diagnostic-shadow | attendanceRisk | xgboost | ok |  |  | false | 220800 | 0.9979 | 0.9982 | 0.9456 | 0.0028 | 0.0025 |  |  | 1.4 |
| ce-see-stage-diagnostic-shadow | ceRisk | calibration_weighted_ensemble | ok | yes |  | false |  | 0.7719 | 0.6995 | 0.4566 | 0.1567 | 0.2367 |  |  |  |
| ce-see-stage-diagnostic-shadow | ceRisk | catboost | ok |  | yes | false | 220800 | 0.7716 | 0.6984 | 0.4526 | 0.1605 | 0.2427 |  |  | 3.2 |
| ce-see-stage-diagnostic-shadow | ceRisk | lightgbm | ok |  |  | false | 220800 | 0.7701 | 0.7 | 0.4583 | 0.1568 | 0.2359 |  |  | 1.7 |
| ce-see-stage-diagnostic-shadow | ceRisk | logistic | ok |  |  | false | 220800 | 0.7511 | 0.6841 | 0.4064 | 0.1849 | 0.2694 |  |  | 4.8 |
| ce-see-stage-diagnostic-shadow | ceRisk | stage_specialist_hist_gradient_boosting | ok |  |  | false | 220800 | 0.7686 | 0.6987 | 0.4562 | 0.0933 | 0.0147 |  |  | 4.7 |
| ce-see-stage-diagnostic-shadow | ceRisk | stage_specialist_logistic | ok |  |  | false | 220800 | 0.759 | 0.6851 | 0.4194 | 0.1803 | 0.265 |  |  | 8.1 |
| ce-see-stage-diagnostic-shadow | ceRisk | xgboost | ok |  |  | false | 220800 | 0.7704 | 0.6972 | 0.4526 | 0.1559 | 0.2324 |  |  | 1.6 |
| ce-see-stage-diagnostic-shadow | downstreamCarryoverRisk | calibration_weighted_ensemble | ok |  |  | false |  | 0.8568 | 0.835 | 0.7544 | 0.1575 | 0.053 |  |  |  |
| ce-see-stage-diagnostic-shadow | downstreamCarryoverRisk | catboost | ok | yes | yes | false | 220800 | 0.8587 | 0.8367 | 0.7568 | 0.1565 | 0.0535 |  |  | 3.2 |
| ce-see-stage-diagnostic-shadow | downstreamCarryoverRisk | lightgbm | ok |  |  | false | 220800 | 0.8548 | 0.8323 | 0.7508 | 0.1592 | 0.0539 |  |  | 1.9 |
| ce-see-stage-diagnostic-shadow | downstreamCarryoverRisk | logistic | ok |  |  | false | 220800 | 0.7828 | 0.7531 | 0.644 | 0.1934 | 0.0691 |  |  | 3.4 |
| ce-see-stage-diagnostic-shadow | downstreamCarryoverRisk | xgboost | ok |  |  | false | 220800 | 0.8538 | 0.8322 | 0.7492 | 0.159 | 0.0524 |  |  | 1.4 |
| ce-see-stage-diagnostic-shadow | overallCourseRisk | calibration_weighted_ensemble | ok |  |  | false |  | 0.9119 | 0.935 | 0.923 | 0.0796 | 0.034 |  |  |  |
| ce-see-stage-diagnostic-shadow | overallCourseRisk | catboost | ok |  |  | false | 220800 | 0.9108 | 0.9353 | 0.9212 | 0.0792 | 0.035 |  |  | 3.4 |
| ce-see-stage-diagnostic-shadow | overallCourseRisk | lightgbm | ok | yes | yes | false | 220800 | 0.9124 | 0.9343 | 0.9225 | 0.0801 | 0.0339 |  |  | 1.4 |
| ce-see-stage-diagnostic-shadow | overallCourseRisk | logistic | ok |  |  | false | 220800 | 0.9101 | 0.9326 | 0.9201 | 0.1016 | 0.0769 |  |  | 2 |
| ce-see-stage-diagnostic-shadow | overallCourseRisk | xgboost | ok |  |  | false | 220800 | 0.9111 | 0.934 | 0.9224 | 0.0808 | 0.0336 |  |  | 1.2 |
| ce-see-stage-diagnostic-shadow | seeRisk | calibration_weighted_ensemble | ok |  |  | false |  | 0.7026 | 0.7221 | 0.6052 | 0.1958 | 0.0778 |  |  |  |
| ce-see-stage-diagnostic-shadow | seeRisk | catboost | ok |  |  | false | 220800 | 0.7069 | 0.724 | 0.607 | 0.1954 | 0.0799 |  |  | 6.1 |
| ce-see-stage-diagnostic-shadow | seeRisk | lightgbm | ok |  |  | false | 220800 | 0.6987 | 0.7193 | 0.6023 | 0.1969 | 0.0783 |  |  | 1.6 |
| ce-see-stage-diagnostic-shadow | seeRisk | logistic | ok |  |  | false | 220800 | 0.7101 | 0.7237 | 0.5956 | 0.198 | 0.0899 |  |  | 2.8 |
| ce-see-stage-diagnostic-shadow | seeRisk | stage_specialist_hist_gradient_boosting | ok |  |  | false | 220800 | 0.7003 | 0.7172 | 0.5997 | 0.1904 | 0.0345 |  |  | 3.8 |
| ce-see-stage-diagnostic-shadow | seeRisk | stage_specialist_logistic | ok | yes | yes | false | 220800 | 0.7134 | 0.7244 | 0.5988 | 0.1974 | 0.0896 |  |  | 8.4 |
| ce-see-stage-diagnostic-shadow | seeRisk | xgboost | ok |  |  | false | 220800 | 0.6971 | 0.7171 | 0.6002 | 0.1972 | 0.0768 |  |  | 1.6 |

## CatBoost Challenger Head-To-Head History

These are the repeated local CatBoost challenger runs from the early research sediment. The table reports the overall-course head because it is the clearest proxy for the product-facing risk card; the per-head JSON files remain in the archive.

| Run | Generated | Seed | Decision | Promoted heads | Baseline AUC | Challenger AUC | Baseline PR AUC | Challenger PR AUC | Baseline Brier | Challenger Brier | Baseline ECE | Challenger ECE | Baseline overload | Challenger overload | Source |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| catboost-challenger-local-20260422T225904Z | 2026-04-22T22:59:24+00:00 | 4242 | keep-as-shadow | 0/5 | 0.8502 | 0.9039 | 0.5656 | 0.7346 | 0.1084 | 0.085 | 0.0248 | 0.0304 | 0.8712 | 0.9004 | airmentor-historical-model-runs/2026-06-06/proof-risk-model-archive/old-benchmark-runs/catboost-challenger-local-20260422T225904Z/head-to-head.json |
| catboost-challenger-local-20260422T231046Z | 2026-04-22T23:11:14+00:00 | 4242 | keep-as-shadow | 0/5 | 0.8502 | 0.9039 | 0.5656 | 0.7346 | 0.1084 | 0.085 | 0.0248 | 0.0304 | 0.8712 | 0.9004 | airmentor-historical-model-runs/2026-06-06/proof-risk-model-archive/old-benchmark-runs/catboost-challenger-local-20260422T231046Z/head-to-head.json |
| catboost-challenger-local-20260521T141035Z | 2026-05-21T14:10:47+00:00 | 4242 | keep-as-shadow | 0/5 | 0.8502 | 0.9049 | 0.5656 | 0.754 | 0.1084 | 0.0873 | 0.0248 | 0.0454 | 0.8712 | 0.8944 | airmentor-historical-model-runs/2026-06-06/proof-risk-model-archive/old-benchmark-runs/catboost-challenger-local-20260521T141035Z/head-to-head.json |
| catboost-challenger-local-20260521T141137Z | 2026-05-21T14:11:48+00:00 | 4242 | promote-as-primary | 5/5 | 0.8502 | 0.9039 | 0.5656 | 0.7346 | 0.1084 | 0.085 | 0.0248 | 0.0304 | 0.8712 | 0.9004 | airmentor-historical-model-runs/2026-06-06/proof-risk-model-archive/old-benchmark-runs/catboost-challenger-local-20260521T141137Z/head-to-head.json |
| catboost-challenger-local-20260521T142902Z | 2026-05-21T14:29:15+00:00 | 4242 | keep-as-shadow | 0/5 | 0.8502 | 0.9025 | 0.5656 | 0.7284 | 0.1084 | 0.0881 | 0.0248 | 0.0374 | 0.8712 | 0.9694 | airmentor-historical-model-runs/2026-06-06/proof-risk-model-archive/old-benchmark-runs/catboost-challenger-local-20260521T142902Z/head-to-head.json |
| catboost-challenger-local-20260521T142954Z | 2026-05-21T14:30:05+00:00 | 4242 | promote-as-primary | 5/5 | 0.8502 | 0.9025 | 0.5656 | 0.7284 | 0.1084 | 0.0881 | 0.0248 | 0.0374 | 0.8712 | 0.9694 | airmentor-historical-model-runs/2026-06-06/proof-risk-model-archive/old-benchmark-runs/catboost-challenger-local-20260521T142954Z/head-to-head.json |
| catboost-challenger-local-20260521T174908Z | 2026-05-21T17:49:19+00:00 | 4242 | keep-as-shadow | 0/5 | 0.8502 | 0.9035 | 0.5656 | 0.7559 | 0.1084 | 0.0887 | 0.0248 | 0.0344 | 0.8712 | 0.9606 | airmentor-historical-model-runs/2026-06-06/proof-risk-model-archive/old-benchmark-runs/catboost-challenger-local-20260521T174908Z/head-to-head.json |
| catboost-challenger-local-20260521T174957Z | 2026-05-21T17:50:10+00:00 | 4242 | keep-as-shadow | 0/5 | 0.8502 | 0.9023 | 0.5656 | 0.7359 | 0.1084 | 0.0862 | 0.0248 | 0.0286 | 0.8712 | 0.9656 | airmentor-historical-model-runs/2026-06-06/proof-risk-model-archive/old-benchmark-runs/catboost-challenger-local-20260521T174957Z/head-to-head.json |
| catboost-challenger-local-20260521T175109Z | 2026-05-21T17:51:16+00:00 | 4242 | keep-as-shadow | 1/5 | 0.8502 | 0.8812 | 0.5656 | 0.7068 | 0.1084 | 0.0896 | 0.0248 | 0.0194 | 0.8712 | 0.9083 | airmentor-historical-model-runs/2026-06-06/proof-risk-model-archive/old-benchmark-runs/catboost-challenger-local-20260521T175109Z/head-to-head.json |
| catboost-challenger-local-20260524T132810Z | 2026-05-24T13:28:18+00:00 | 4242 | keep-as-shadow | 1/5 | 0.8502 | 0.8736 | 0.5656 | 0.6583 | 0.1084 | 0.0951 | 0.0248 | 0.0176 | 0.8712 | 0.9145 | airmentor-historical-model-runs/2026-06-06/proof-risk-model-archive/old-benchmark-runs/catboost-challenger-local-20260524T132810Z/head-to-head.json |
| catboost-challenger-local-20260524T132941Z | 2026-05-24T13:29:50+00:00 | 4242 | keep-as-shadow | 1/5 | 0.8502 | 0.8721 | 0.5656 | 0.6555 | 0.1084 | 0.0956 | 0.0248 | 0.0179 | 0.8712 | 0.9156 | airmentor-historical-model-runs/2026-06-06/proof-risk-model-archive/old-benchmark-runs/catboost-challenger-local-20260524T132941Z/head-to-head.json |
| catboost-challenger-local-20260524T133029Z | 2026-05-24T13:30:38+00:00 | 4242 | keep-as-shadow | 1/5 | 0.8502 | 0.8736 | 0.5656 | 0.6583 | 0.1084 | 0.0951 | 0.0248 | 0.0176 | 0.8712 | 0.9145 | airmentor-historical-model-runs/2026-06-06/proof-risk-model-archive/old-benchmark-runs/catboost-challenger-local-20260524T133029Z/head-to-head.json |
| catboost-challenger-local-20260524T133352Z | 2026-05-24T13:34:01+00:00 | 4242 | keep-as-shadow | 0/5 | 0.8502 | 0.8742 | 0.5656 | 0.6724 | 0.1084 | 0.2012 | 0.0248 | 0.3062 | 0.8712 | 2.4061 | airmentor-historical-model-runs/2026-06-06/proof-risk-model-archive/old-benchmark-runs/catboost-challenger-local-20260524T133352Z/head-to-head.json |
| catboost-challenger-local-20260524T133422Z | 2026-05-24T13:34:30+00:00 | 4242 | keep-as-shadow | 1/5 | 0.8502 | 0.8748 | 0.5656 | 0.691 | 0.1084 | 0.0955 | 0.0248 | 0.0236 | 0.8712 | 0.8969 | airmentor-historical-model-runs/2026-06-06/proof-risk-model-archive/old-benchmark-runs/catboost-challenger-local-20260524T133422Z/head-to-head.json |
| catboost-challenger-local-20260524T133508Z | 2026-05-24T13:35:18+00:00 | 4242 | keep-as-shadow | 1/5 | 0.8502 | 0.9057 | 0.5656 | 0.7575 | 0.1084 | 0.0834 | 0.0248 | 0.0182 | 0.8712 | 0.9076 | airmentor-historical-model-runs/2026-06-06/proof-risk-model-archive/old-benchmark-runs/catboost-challenger-local-20260524T133508Z/head-to-head.json |
| catboost-challenger-local-20260524T133541Z | 2026-05-24T13:35:50+00:00 | 4242 | keep-as-shadow | 0/5 | 0.8502 | 0.9057 | 0.5656 | 0.7575 | 0.1084 | 0.1214 | 0.0248 | 0.1604 | 0.8712 | 1.8705 | airmentor-historical-model-runs/2026-06-06/proof-risk-model-archive/old-benchmark-runs/catboost-challenger-local-20260524T133541Z/head-to-head.json |
| catboost-challenger-local-20260524T133612Z | 2026-05-24T13:36:28+00:00 | 4242 | keep-as-shadow | 0/5 | 0.8502 | 0.9055 | 0.5656 | 0.7523 | 0.1084 | 0.1208 | 0.0248 | 0.1576 | 0.8712 | 1.8556 | airmentor-historical-model-runs/2026-06-06/proof-risk-model-archive/old-benchmark-runs/catboost-challenger-local-20260524T133612Z/head-to-head.json |
| catboost-challenger-local-20260524T133706Z | 2026-05-24T13:37:15+00:00 | 4242 | keep-as-shadow | 0/5 | 0.8502 | 0.9016 | 0.5656 | 0.7349 | 0.1084 | 0.085 | 0.0248 | 0.0267 | 0.8712 | 0.9498 | airmentor-historical-model-runs/2026-06-06/proof-risk-model-archive/old-benchmark-runs/catboost-challenger-local-20260524T133706Z/head-to-head.json |
| catboost-challenger-local-20260524T133749Z | 2026-05-24T13:37:58+00:00 | 4242 | keep-as-shadow | 0/5 | 0.8502 | 0.9029 | 0.5656 | 0.7584 | 0.1084 | 0.084 | 0.0248 | 0.0253 | 0.8712 | 0.9469 | airmentor-historical-model-runs/2026-06-06/proof-risk-model-archive/old-benchmark-runs/catboost-challenger-local-20260524T133749Z/head-to-head.json |
| catboost-challenger-local-20260524T133931Z | 2026-05-24T13:39:39+00:00 | 4242 | keep-as-shadow | 1/5 | 0.8515 | 0.8496 | 0.5932 | 0.6283 | 0.1475 | 0.1051 | 0.1863 | 0.02 | 2.0113 | 0.8933 | airmentor-historical-model-runs/2026-06-06/proof-risk-model-archive/old-benchmark-runs/catboost-challenger-local-20260524T133931Z/head-to-head.json |
| catboost-challenger-local-20260524T134035Z | 2026-05-24T13:40:47+00:00 | 4242 | keep-as-shadow | 4/5 | 0.8515 | 0.8853 | 0.5932 | 0.7129 | 0.1475 | 0.0915 | 0.1863 | 0.0196 | 2.0113 | 0.8948 | airmentor-historical-model-runs/2026-06-06/proof-risk-model-archive/old-benchmark-runs/catboost-challenger-local-20260524T134035Z/head-to-head.json |
| catboost-challenger-local-20260524T134145Z | 2026-05-24T13:41:56+00:00 | 4242 | keep-as-shadow | 4/5 | 0.8121 | 0.8853 | 0.4292 | 0.7129 | 0.1368 | 0.0915 | 0.0956 | 0.0196 | 1.519 | 0.8948 | airmentor-historical-model-runs/2026-06-06/proof-risk-model-archive/old-benchmark-runs/catboost-challenger-local-20260524T134145Z/head-to-head.json |
| catboost-challenger-local-20260524T134340Z | 2026-05-24T13:43:52+00:00 | 4242 | promote-as-primary | 5/5 | 0.8515 | 0.8853 | 0.5932 | 0.7129 | 0.1475 | 0.0915 | 0.1863 | 0.0196 | 2.0113 | 0.8948 | airmentor-historical-model-runs/2026-06-06/proof-risk-model-archive/old-benchmark-runs/catboost-challenger-local-20260524T134340Z/head-to-head.json |
| catboost-challenger-local-20260524T151048Z | 2026-05-24T15:11:01+00:00 | 4242 | keep-as-shadow | 1/5 | 0.8515 | 0.8853 | 0.5932 | 0.7129 | 0.1079 | 0.0915 | 0.0241 | 0.0196 | 0.8693 | 0.8948 | airmentor-historical-model-runs/2026-06-06/proof-risk-model-archive/old-benchmark-runs/catboost-challenger-local-20260524T151048Z/head-to-head.json |
| catboost-challenger-local-20260524T153307Z | 2026-05-24T15:33:19+00:00 | 4242 | keep-as-shadow | 0/5 | 0.8515 | 0.8834 | 0.5932 | 0.7074 | 0.1079 | 0.0946 | 0.0241 | 0.0298 | 0.8693 | 0.8931 | airmentor-historical-model-runs/2026-06-06/proof-risk-model-archive/old-benchmark-runs/catboost-challenger-local-20260524T153307Z/head-to-head.json |
| catboost-challenger-local-20260524T155726Z | 2026-05-24T15:58:37+00:00 | 4242 | keep-as-shadow | 2/5 | 0.8515 | 0.8862 | 0.5932 | 0.7056 | 0.1079 | 0.0924 | 0.0241 | 0.0186 | 0.8693 | 0.8992 | airmentor-historical-model-runs/2026-06-06/proof-risk-model-archive/old-benchmark-runs/catboost-challenger-local-20260524T155726Z/head-to-head.json |
| catboost-challenger-local-20260524T160134Z | 2026-05-24T16:02:43+00:00 | 4242 | keep-as-shadow | 2/5 | 0.8515 | 0.8843 | 0.5932 | 0.6946 | 0.1079 | 0.0935 | 0.0241 | 0.0198 | 0.8693 | 0.893 | airmentor-historical-model-runs/2026-06-06/proof-risk-model-archive/old-benchmark-runs/catboost-challenger-local-20260524T160134Z/head-to-head.json |
| catboost-challenger-local-20260524T160733Z | 2026-05-24T16:08:41+00:00 | 4242 | keep-as-shadow | 2/5 | 0.8515 | 0.8842 | 0.5932 | 0.6944 | 0.1079 | 0.0936 | 0.0241 | 0.0199 | 0.8693 | 0.8927 | airmentor-historical-model-runs/2026-06-06/proof-risk-model-archive/old-benchmark-runs/catboost-challenger-local-20260524T160733Z/head-to-head.json |
| catboost-challenger-local-20260524T161348Z | 2026-05-24T16:14:54+00:00 | 4242 | keep-as-shadow | 1/5 | 0.8515 | 0.8876 | 0.5932 | 0.7091 | 0.1079 | 0.0918 | 0.0241 | 0.0203 | 0.8693 | 0.8906 | airmentor-historical-model-runs/2026-06-06/proof-risk-model-archive/old-benchmark-runs/catboost-challenger-local-20260524T161348Z/head-to-head.json |
| catboost-challenger-local-20260524T161819Z | 2026-05-24T16:19:24+00:00 | 4242 | keep-as-shadow | 2/5 | 0.8515 | 0.8842 | 0.5932 | 0.6944 | 0.1079 | 0.0936 | 0.0241 | 0.0199 | 0.8693 | 0.8927 | airmentor-historical-model-runs/2026-06-06/proof-risk-model-archive/old-benchmark-runs/catboost-challenger-local-20260524T161819Z/head-to-head.json |
| catboost-challenger-local-20260524T162451Z | 2026-05-24T16:26:02+00:00 | 4242 | keep-as-shadow | 2/5 | 0.8515 | 0.8842 | 0.5932 | 0.6944 | 0.1079 | 0.0936 | 0.0241 | 0.0199 | 0.8693 | 0.8927 | airmentor-historical-model-runs/2026-06-06/proof-risk-model-archive/old-benchmark-runs/catboost-challenger-local-20260524T162451Z/head-to-head.json |
| catboost-challenger-local-20260524T163222Z | 2026-05-24T16:33:32+00:00 | 4242 | keep-as-shadow | 2/5 | 0.8515 | 0.8842 | 0.5932 | 0.6944 | 0.1079 | 0.0936 | 0.0241 | 0.0199 | 0.8693 | 0.8927 | airmentor-historical-model-runs/2026-06-06/proof-risk-model-archive/old-benchmark-runs/catboost-challenger-local-20260524T163222Z/head-to-head.json |
| catboost-challenger-local-20260524T171722Z | 2026-05-24T17:45:44+00:00 | 4242 | keep-as-shadow | 1/5 | 0.8488 | 0.89 | 0.6337 | 0.7353 | 0.1142 | 0.0967 | 0.0051 | 0.0073 | 0.9827 | 0.9828 | airmentor-historical-model-runs/2026-06-06/proof-risk-model-archive/old-benchmark-runs/catboost-challenger-local-20260524T171722Z/head-to-head.json |
| catboost-challenger-local-20260524T175057Z | 2026-05-24T17:52:04+00:00 | 4242 | keep-as-shadow | 2/5 | 0.8515 | 0.8842 | 0.5932 | 0.6944 | 0.1079 | 0.0936 | 0.0241 | 0.0199 | 0.8693 | 0.8927 | airmentor-historical-model-runs/2026-06-06/proof-risk-model-archive/old-benchmark-runs/catboost-challenger-local-20260524T175057Z/head-to-head.json |
| catboost-challenger-local-20260524T175444Z | 2026-05-24T17:55:53+00:00 | 4242 | keep-as-shadow | 2/5 | 0.8515 | 0.8842 | 0.5932 | 0.6944 | 0.1079 | 0.0936 | 0.0241 | 0.0199 | 0.8693 | 0.8927 | airmentor-historical-model-runs/2026-06-06/proof-risk-model-archive/old-benchmark-runs/catboost-challenger-local-20260524T175444Z/head-to-head.json |
| catboost-challenger-local-20260524T180636Z | 2026-05-24T18:07:43+00:00 | 4242 | keep-as-shadow | 2/5 | 0.8582 | 0.8857 | 0.6373 | 0.7201 | 0.112 | 0.0984 | 0.0255 | 0.0242 | 0.8748 | 0.8815 | airmentor-historical-model-runs/2026-06-06/proof-risk-model-archive/old-benchmark-runs/catboost-challenger-local-20260524T180636Z/head-to-head.json |
| catboost-challenger-local-20260524T181909Z | 2026-05-24T18:20:18+00:00 | 4242 | keep-as-shadow | 3/5 | 0.8596 | 0.8856 | 0.6536 | 0.7268 | 0.1166 | 0.1033 | 0.0346 | 0.0287 | 0.8402 | 0.8676 | airmentor-historical-model-runs/2026-06-06/proof-risk-model-archive/old-benchmark-runs/catboost-challenger-local-20260524T181909Z/head-to-head.json |
| catboost-challenger-local-20260524T182627Z | 2026-05-24T18:27:40+00:00 | 4242 | keep-as-shadow | 2/5 | 0.8614 | 0.8878 | 0.6693 | 0.7417 | 0.1194 | 0.1058 | 0.0366 | 0.0318 | 0.8398 | 0.8608 | airmentor-historical-model-runs/2026-06-06/proof-risk-model-archive/old-benchmark-runs/catboost-challenger-local-20260524T182627Z/head-to-head.json |
| catboost-challenger-local-20260524T183315Z | 2026-05-24T18:34:27+00:00 | 4242 | keep-as-shadow | 3/5 | 0.8596 | 0.8856 | 0.6536 | 0.7268 | 0.1166 | 0.1033 | 0.0346 | 0.0287 | 0.8402 | 0.8676 | airmentor-historical-model-runs/2026-06-06/proof-risk-model-archive/old-benchmark-runs/catboost-challenger-local-20260524T183315Z/head-to-head.json |
| catboost-challenger-local-20260524T191010Z | 2026-05-24T19:11:20+00:00 | 4242 | keep-as-shadow | 3/5 | 0.8596 | 0.8856 | 0.6536 | 0.7268 | 0.1166 | 0.1033 | 0.0346 | 0.0287 | 0.8402 | 0.8676 | airmentor-historical-model-runs/2026-06-06/proof-risk-model-archive/old-benchmark-runs/catboost-challenger-local-20260524T191010Z/head-to-head.json |
| catboost-challenger-local-20260524T194912Z | 2026-05-24T19:50:27+00:00 | 4242 | keep-as-shadow | 1/5 | 0.8596 | 0.9082 | 0.6536 | 0.7782 | 0.1166 | 0.0935 | 0.0346 | 0.0307 | 0.8402 | 0.8753 | airmentor-historical-model-runs/2026-06-06/proof-risk-model-archive/old-benchmark-runs/catboost-challenger-local-20260524T194912Z/head-to-head.json |

## Chronology Of Approaches

1. Early local CatBoost challenger runs explored whether heavy tree models could beat the observable logistic baseline on the five risk heads. Many runs produced head-to-head JSON plus `.cbm` binaries, but the value today is the comparison evidence, not the repeated binaries.

2. `v2-training` and some early SOTA runs produced extremely high metrics on several heads. Those results are useful historically, but they are less credible as product evidence because near-perfect synthetic metrics are a warning sign for easy splits, overly aligned synthetic labels, or leakage-prone feature/label construction.

3. The `sota-fixed`, `sota-ensemble`, and dated `sota-run-*` artifacts moved toward governed promotion gates: ranking, proper scoring, local calibration, overload, replayability, feature schema, and corpus admissibility. The separate shadow-tabular runs also tried AutoGluon, TabPFN, PyTabKit, XGBoost, LightGBM, CatBoost, logistic, and weighted ensembles without changing serving.

4. The later coverage report reframed the model around stage-aware operation: 30 proof checkpoints, role-visible playback, queue burden, policy diagnostics, CO evidence, and stage/semester variant comparisons.

5. The current tracked contract keeps the runtime small and explainable. It preserves the shadow challenger result while avoiding automatic promotion.

## Critical Findings

- The strongest model lift appears after evidence has accumulated, especially at post-SEE, where the model materially reduces queue overload and false positives compared with the heuristic.
- Pre-TT1 is the hardest stage. The model can rank early risk, but early-stage calibration and precision are naturally weaker because the simulator has less observed assessment evidence.
- Attendance risk is highly separable in several runs. CE and SEE risk are more sensitive to stage evidence and calibration, so they should stay governed by local ECE and overload gates.
- CatBoost/depth-2-tree challengers can look attractive on ROC AUC and calibration for some heads, but the product gate correctly blocks promotion when local calibration or overload worsens on operationally important heads.
- The real product asset is not the best historical leaderboard score. It is the combination of reproducible seed/corpus lineage, stage-aware risk, cross-role checkpoint parity, queue-aware thresholds, and a promotion decision that does not overclaim.

## Retention Verdict

Keep the tracked contract, the selected model vault, the distinct corpora, and this dossier. Keep the 31 GiB historical model archive only as cold storage until the archive is uploaded to a durable external bucket. Do not copy it back into Git.

The most valuable files inside the sediment are `metrics.json`, `promotion-decision.json`, `evaluation-report.json`, `risk-model-bundle*.json`, `synthetic-quality.json`, `manifest.json`, and the final selected model sidecars. Repeated `.cbm`, LightGBM, XGBoost, and per-run scratch binaries are useful only if they are tied to one of those decision records.

## Reproducibility Pointers

| Purpose | Pointer |
| --- | --- |
| Regenerate this dossier | node scripts/generate-proof-risk-research-dossier.mjs |
| Serving bundle | air-mentor-api/model-contract/proof-risk-model/risk-model-bundle.json |
| Serving promotion decision | air-mentor-api/model-contract/proof-risk-model/promotion-decision.json |
| Primary coverage report | airmentor-historical-model-runs/2026-06-06/proof-risk-model-archive/pre-coverage33-20260601/evaluation-report.json |
| Model vault checksum | airmentor-model-vault/2026-06-06/airmentor-model-vault-2026-06-06.tar.zst.sha256 |
| Training corpus checksum set | airmentor-training-corpora/2026-06-06/FILES.sha256 |
| Historical model inventory | airmentor-historical-model-runs/2026-06-06/SOURCE-INVENTORY.txt |
