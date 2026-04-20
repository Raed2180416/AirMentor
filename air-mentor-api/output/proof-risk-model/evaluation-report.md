# Proof Risk Model Evaluation

Generated at: 2026-04-20T02:51:40.283Z

## Corpus

- Seed profile: smoke-3
- Requested seeds: 101, 4141, 5353
- Governed seeds evaluated: 101, 4141, 5353
- Reused existing governed runs: 0
- Created governed runs: 3
- Skipped requested non-manifest seeds: none
- Proof runs in corpus: 3
- Total checkpoint evidence rows: 64800
- Held-out test rows: 21600
- Active run used for UI parity: simulation_run_91b4bcb3-ba31-47d9-9c3e-bcae941e52a6
- Duplicate governed runs skipped: 1
- Scenario-mismatch governed runs skipped: 0
- Non-manifest runs skipped: 0
- Stage definitions per semester: 5
- Complete requested runs: 3
- Incomplete requested runs: 1

| Seed | Run ID | Semester Span | Checkpoints (actual/expected) | Stage Evidence Rows | Complete |
| --- | --- | --- | --- | --- | --- |
| 101 | sim_mnc_2023_first6_v1 | 1-6 | 0/30 | 0 | false |
| 101 | simulation_run_3b58df01-2198-476c-a81e-502b86b8bdde | 1-6 | 30/30 | 21600 | true |
| 4141 | simulation_run_a935586f-21a4-4510-9733-18b03cc3b346 | 1-6 | 30/30 | 21600 | true |
| 5353 | simulation_run_91b4bcb3-ba31-47d9-9c3e-bcae941e52a6 | 1-6 | 30/30 | 21600 | true |

## Overall Course Runtime Risk

| Scorer | Brier | Log Loss | ROC-AUC | PR-AUC | ECE | Slope | Intercept | Positive Rate | Support |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| model | 0.1216 | 0.3848 | 0.8049 | 0.4629 | 0.0195 | 0.9457 | 0.046 | 0.1843 | 21600 |
| heuristic | 0.2156 | 0.6403 | 0.7611 | 0.4342 | 0.2732 | 0.7141 | -0.8402 | 0.1843 | 21600 |

- Overall-course runtime Brier lift: 0.094
- Overall-course runtime AUC lift: 0.0438

## Head Metrics

| Head | Model Brier | Heuristic Brier | Brier Lift | Model Log Loss | Heuristic Log Loss | Model ROC-AUC | Heuristic ROC-AUC | AUC Lift | Model PR-AUC | Heuristic PR-AUC | Model ECE | Heuristic ECE |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| attendanceRisk | 0.0262 | 0.252 | 0.2258 | 0.0991 | 0.7508 | 0.9555 | 0.8051 | 0.1504 | 0.651 | 0.1365 | 0.0358 | 0.4165 |
| ceRisk | 0.0256 | 0.2542 | 0.2286 | 0.1009 | 0.7539 | 0.8866 | 0.8433 | 0.0433 | 0.2236 | 0.1532 | 0.005 | 0.4278 |
| seeRisk | 0.1357 | 0.2264 | 0.0907 | 0.427 | 0.6721 | 0.7562 | 0.7207 | 0.0355 | 0.3958 | 0.3763 | 0.0302 | 0.2646 |
| overallCourseRisk | 0.1216 | 0.2156 | 0.094 | 0.3848 | 0.6403 | 0.8049 | 0.7611 | 0.0438 | 0.4629 | 0.4342 | 0.0195 | 0.2732 |
| downstreamCarryoverRisk | 0.1007 | 0.2618 | 0.1611 | 0.2994 | 0.7639 | 0.9236 | 0.6015 | 0.3221 | 0.7945 | 0.3433 | 0.0306 | 0.1855 |

## Variant Comparison

| Variant | Brier | Log Loss | ROC-AUC | PR-AUC | ECE | Budget Rate | Flagged@Budget | Precision@Budget | Recall@Budget | Overload Ratio |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| current-v6 | 0.1216 | 0.3848 | 0.8049 | 0.4629 | 0.0195 | 0.2 | 0.2002 | 0.4765 | 0.5178 | 1.0012 |
| baseline-v5-like | 0.1222 | 0.388 | 0.8005 | 0.4603 | 0.02 | 0.2 | 0.2066 | 0.47 | 0.5269 | 1.0329 |
| hybrid-router | 0.1216 | 0.3848 | 0.8058 | 0.4624 | 0.0195 | 0.2 | 0.2002 | 0.4765 | 0.5178 | 1.0012 |
| challenger | 0.1175 | 0.3847 | 0.7658 | 0.4863 | 0.0161 | 0.2 | 0.2886 | 0.4184 | 0.6553 | 1.4431 |
| heuristic | 0.2156 | 0.6403 | 0.7611 | 0.4342 | 0.2732 | 0.2 | 0.2058 | 0.4179 | 0.4668 | 1.0292 |

| Head | Fallback Alpha | Stage Routes |
| --- | --- | --- |
| attendanceRisk | 1 | post-assignments:1, pre-tt1:1, post-tt1:1, post-tt2:1, post-see:1 |
| ceRisk | 1 | post-assignments:1, pre-tt1:1, post-tt1:1, post-tt2:1, post-see:1 |
| seeRisk | 1 | post-assignments:0, pre-tt1:1, post-tt1:1, post-tt2:0, post-see:1 |
| overallCourseRisk | 1 | post-assignments:1, pre-tt1:1, post-tt1:1, post-tt2:1, post-see:1 |
| downstreamCarryoverRisk | 1 | post-assignments:1, pre-tt1:1, post-tt1:1, post-tt2:1, post-see:1 |

| Head | Baseline ROC-AUC | Current ROC-AUC | Hybrid ROC-AUC | Challenger ROC-AUC | Current-Baseline Brier Lift | Current-Hybrid Brier Lift | Hybrid-Challenger Brier Lift |
| --- | --- | --- | --- | --- | --- | --- | --- |
| attendanceRisk | 0.9524 | 0.9555 | 0.9564 | 0.9556 | 0.0007 | 0 | -0.0044 |
| ceRisk | 0.8796 | 0.8866 | 0.8882 | 0.6474 | 0.0003 | 0 | 0.0018 |
| seeRisk | 0.7505 | 0.7562 | 0.768 | 0.7438 | 0.0007 | -0.0036 | 0.0015 |
| overallCourseRisk | 0.8005 | 0.8049 | 0.8058 | 0.7658 | 0.0006 | 0 | -0.0041 |
| downstreamCarryoverRisk | 0.9234 | 0.9236 | 0.9241 | 0.9138 | 0.0003 | 0 | 0.0007 |

## Action Rollups

| Action | Cases | Immediate Benefit (scaled points) | Next-Checkpoint Lift (Lower is Better) | Recovery Rate |
| --- | --- | --- | --- | --- |
| targeted-tutoring | 894 | 8.7 | -9.6 | 0.0492 |
| pre-see-rescue | 823 | 8.1 | -5.9 | 0.1317 |
| prerequisite-bridge | 810 | 9.8 | -5.4 | 0.0666 |
| attendance-recovery-follow-up | 348 | 3.5 | -7.1 | 0.104 |

## Policy Diagnostics

| Phenotype | Support | Avg Lift | Avg Regret | Beats No Action | Teacher Efficacy Allowed |
| --- | --- | --- | --- | --- | --- |
| late-semester-acute | 7671 | 1.12 | 0 | true | true |
| persistent-nonresponse | 1820 | 7.38 | 0 | true | true |
| prerequisite-dominant | 9873 | 6.01 | 0 | true | true |
| academic-weakness | 5107 | 10.55 | 0 | true | true |
| attendance-dominant | 1654 | 4.42 | 0 | true | true |
| diffuse-amber | 3726 | 9.61 | 0 | true | true |

- Policy acceptance gates: {"structuredStudyPlanWithinLimit":true,"targetedTutoringBeatsStructuredStudyPlanAcademicSlice":true,"noRecommendedActionUnderperformsNoAction":true}

## CO Evidence Diagnostics

| Metric | Value |
| --- | --- |
| totalRows | 64800 |
| fallbackCount | 0 |
| theoryFallbackCount | 0 |
| labFallbackCount | 0 |

- CO evidence acceptance gates: {"theoryCoursesDefaultToBlueprintEvidence":true,"fallbackOnlyInExplicitCases":true}

## Queue Burden

| Semester | Stage | Runs | Mean Open | Median Open | P95 Open | Max Open | Mean Watch | P95 Watch | P95 Section Max | Mean PPV | Min PPV | Threshold |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | pre-tt1 | 3 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.55 | 0.3 |
| 1 | post-tt1 | 3 | 0.1389 | 0.2 | 0.2167 | 0.2167 | 0.0194 | 0.0333 | 0.3 | 0.4691 | 0.455 | 0.3 |
| 1 | post-tt2 | 3 | 0.1806 | 0.2417 | 0.3 | 0.3 | 0.1194 | 0.2 | 0.3 | 0.5742 | 0.5717 | 0.3 |
| 1 | post-assignments | 3 | 0.1806 | 0.2417 | 0.3 | 0.3 | 0.1333 | 0.2417 | 0.3 | 0.5939 | 0.5867 | 0.3 |
| 1 | post-see | 3 | 0.2333 | 0.35 | 0.35 | 0.35 | 0.2444 | 0.4417 | 0.35 | 0.8418 | 0.8357 | 0.35 |
| 2 | pre-tt1 | 3 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.55 | 0.3 |
| 2 | post-tt1 | 3 | 0.2194 | 0.3 | 0.3 | 0.3 | 0.3389 | 0.6167 | 0.3 | 0.6125 | 0.4143 | 0.3 |
| 2 | post-tt2 | 3 | 0.2056 | 0.3 | 0.3 | 0.3 | 0.3444 | 0.625 | 0.3 | 0.6934 | 0.54 | 0.3 |
| 2 | post-assignments | 3 | 0.2056 | 0.3 | 0.3 | 0.3 | 0.3444 | 0.625 | 0.3 | 0.6972 | 0.54 | 0.3 |
| 2 | post-see | 3 | 0.2389 | 0.35 | 0.35 | 0.35 | 0.2972 | 0.5167 | 0.35 | 0.757 | 0.54 | 0.35 |
| 3 | pre-tt1 | 3 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.55 | 0.3 |
| 3 | post-tt1 | 3 | 0.2667 | 0.3 | 0.3 | 0.3 | 0.3472 | 0.625 | 0.3 | 0.6581 | 0.4708 | 0.3 |
| 3 | post-tt2 | 3 | 0.25 | 0.3 | 0.3 | 0.3 | 0.3667 | 0.6417 | 0.3 | 0.7426 | 0.5711 | 0.3 |
| 3 | post-assignments | 3 | 0.2472 | 0.3 | 0.3 | 0.3 | 0.3694 | 0.6417 | 0.3 | 0.7406 | 0.5612 | 0.3 |
| 3 | post-see | 3 | 0.2778 | 0.35 | 0.35 | 0.35 | 0.2861 | 0.5167 | 0.35 | 0.7757 | 0.5694 | 0.35 |
| 4 | pre-tt1 | 3 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.55 | 0.3 |
| 4 | post-tt1 | 3 | 0.2806 | 0.3 | 0.3 | 0.3 | 0.3639 | 0.6 | 0.3 | 0.6722 | 0.4855 | 0.3 |
| 4 | post-tt2 | 3 | 0.2667 | 0.3 | 0.3 | 0.3 | 0.3778 | 0.6417 | 0.3 | 0.7538 | 0.5813 | 0.3 |
| 4 | post-assignments | 3 | 0.2639 | 0.3 | 0.3 | 0.3 | 0.3806 | 0.6417 | 0.3 | 0.7588 | 0.5948 | 0.3 |
| 4 | post-see | 3 | 0.2861 | 0.35 | 0.35 | 0.35 | 0.2833 | 0.5 | 0.35 | 0.7928 | 0.6042 | 0.35 |
| 5 | pre-tt1 | 3 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.55 | 0.3 |
| 5 | post-tt1 | 3 | 0.2861 | 0.3 | 0.3 | 0.3 | 0.3944 | 0.65 | 0.3 | 0.7217 | 0.5365 | 0.3 |
| 5 | post-tt2 | 3 | 0.2694 | 0.3 | 0.3 | 0.3 | 0.4222 | 0.6667 | 0.3 | 0.7815 | 0.5992 | 0.3 |
| 5 | post-assignments | 3 | 0.2694 | 0.3 | 0.3 | 0.3 | 0.4111 | 0.6667 | 0.3 | 0.7834 | 0.5944 | 0.3 |
| 5 | post-see | 3 | 0.3111 | 0.35 | 0.35 | 0.35 | 0.2833 | 0.4583 | 0.35 | 0.798 | 0.6071 | 0.35 |
| 6 | pre-tt1 | 3 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.55 | 0.3 |
| 6 | post-tt1 | 3 | 0.275 | 0.3 | 0.3 | 0.3 | 0.4278 | 0.65 | 0.3 | 0.7386 | 0.5574 | 0.3 |
| 6 | post-tt2 | 3 | 0.2806 | 0.3 | 0.3 | 0.3 | 0.4278 | 0.6833 | 0.3 | 0.799 | 0.6207 | 0.3 |
| 6 | post-assignments | 3 | 0.2889 | 0.3 | 0.3 | 0.3 | 0.4278 | 0.6917 | 0.3 | 0.7999 | 0.6144 | 0.3 |
| 6 | post-see | 3 | 0.3028 | 0.35 | 0.35 | 0.35 | 0.3028 | 0.475 | 0.35 | 0.8174 | 0.6204 | 0.35 |

- Queue burden acceptance gates: {"actionableRatesWithinLimit":true,"sectionToleranceWithinLimit":true,"watchRatesWithinLimit":false,"actionableQueuePpvProxyWithinLimit":true}

### Queue Burden Diagnostic Cross-Run Union

| Semester | Stage | Unique Students | Open Queue Students | Watch Students | Open Rate | Watch Rate | PPV Proxy | Threshold | Section Max Rate |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | pre-tt1 | 120 | 0 | 0 | 0 | 0 | 0 | 0.3 | 0 |
| 1 | post-tt1 | 120 | 42 | 7 | 0.35 | 0.0583 | 0.4824 | 0.3 | 0.5 |
| 1 | post-tt2 | 120 | 55 | 32 | 0.4583 | 0.2667 | 0.5824 | 0.3 | 0.4833 |
| 1 | post-assignments | 120 | 55 | 34 | 0.4583 | 0.2833 | 0.5987 | 0.3 | 0.4833 |
| 1 | post-see | 120 | 68 | 46 | 0.5667 | 0.3833 | 0.8518 | 0.35 | 0.5833 |
| 2 | pre-tt1 | 120 | 0 | 0 | 0 | 0 | 0 | 0.3 | 0 |
| 2 | post-tt1 | 120 | 64 | 55 | 0.5333 | 0.4583 | 0.7064 | 0.3 | 0.5833 |
| 2 | post-tt2 | 120 | 64 | 55 | 0.5333 | 0.4583 | 0.7764 | 0.3 | 0.5667 |
| 2 | post-assignments | 120 | 64 | 55 | 0.5333 | 0.4583 | 0.7837 | 0.3 | 0.55 |
| 2 | post-see | 120 | 69 | 50 | 0.575 | 0.4167 | 0.8716 | 0.35 | 0.5833 |
| 3 | pre-tt1 | 120 | 0 | 0 | 0 | 0 | 0 | 0.3 | 0 |
| 3 | post-tt1 | 120 | 71 | 49 | 0.5917 | 0.4083 | 0.7049 | 0.3 | 0.6333 |
| 3 | post-tt2 | 120 | 75 | 44 | 0.625 | 0.3667 | 0.7895 | 0.3 | 0.6667 |
| 3 | post-assignments | 120 | 75 | 44 | 0.625 | 0.3667 | 0.7889 | 0.3 | 0.6667 |
| 3 | post-see | 120 | 76 | 41 | 0.6333 | 0.3417 | 0.8522 | 0.35 | 0.6667 |
| 4 | pre-tt1 | 120 | 0 | 0 | 0 | 0 | 0 | 0.3 | 0 |
| 4 | post-tt1 | 120 | 72 | 47 | 0.6 | 0.3917 | 0.7208 | 0.3 | 0.6167 |
| 4 | post-tt2 | 120 | 74 | 46 | 0.6167 | 0.3833 | 0.8031 | 0.3 | 0.7167 |
| 4 | post-assignments | 120 | 72 | 48 | 0.6 | 0.4 | 0.8125 | 0.3 | 0.7 |
| 4 | post-see | 120 | 77 | 43 | 0.6417 | 0.3583 | 0.863 | 0.35 | 0.6833 |
| 5 | pre-tt1 | 120 | 0 | 0 | 0 | 0 | 0 | 0.3 | 0 |
| 5 | post-tt1 | 120 | 73 | 45 | 0.6083 | 0.375 | 0.7671 | 0.3 | 0.6333 |
| 5 | post-tt2 | 120 | 68 | 52 | 0.5667 | 0.4333 | 0.8441 | 0.3 | 0.6167 |
| 5 | post-assignments | 120 | 72 | 48 | 0.6 | 0.4 | 0.8381 | 0.3 | 0.6667 |
| 5 | post-see | 120 | 84 | 32 | 0.7 | 0.2667 | 0.8479 | 0.35 | 0.75 |
| 6 | pre-tt1 | 120 | 0 | 0 | 0 | 0 | 0 | 0.3 | 0 |
| 6 | post-tt1 | 120 | 75 | 45 | 0.625 | 0.375 | 0.7867 | 0.3 | 0.6833 |
| 6 | post-tt2 | 120 | 79 | 41 | 0.6583 | 0.3417 | 0.8365 | 0.3 | 0.6833 |
| 6 | post-assignments | 120 | 81 | 39 | 0.675 | 0.325 | 0.8335 | 0.3 | 0.7 |
| 6 | post-see | 120 | 83 | 37 | 0.6917 | 0.3083 | 0.8849 | 0.35 | 0.7 |

## Carryover Head

| Metric | Value |
| --- | --- |
| Brier lift | 0.1611 |
| AUC lift | 0.3221 |
| Calibration method | isotonic |
| Display probability allowed | true |
| Support warning | NA |

## Stage Rollups

| Semester | Stage | Projection Rows | Unique Students | High Risk Rows | High Risk Students | Medium Risk Rows | Avg Risk | Avg Lift | Open Queue Rows | Open Queue Students | Watch Students |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | pre-tt1 | 2160 | 120 | 0 | 0 | 0 | 7.8 | 0 | 0 | 0 | 0 |
| 1 | post-tt1 | 2160 | 120 | 0 | 0 | 95 | 14.2 | 0 | 85 | 42 | 7 |
| 1 | post-tt2 | 2160 | 120 | 16 | 14 | 206 | 16.3 | 0.7 | 95 | 55 | 32 |
| 1 | post-assignments | 2160 | 120 | 22 | 19 | 222 | 16.6 | 0.7 | 100 | 55 | 34 |
| 1 | post-see | 2160 | 120 | 396 | 91 | 621 | 37.1 | 5.1 | 230 | 68 | 46 |
| 2 | pre-tt1 | 2160 | 120 | 0 | 0 | 464 | 22.1 | 0 | 0 | 0 | 0 |
| 2 | post-tt1 | 2160 | 120 | 98 | 42 | 751 | 29.4 | 0 | 321 | 64 | 55 |
| 2 | post-tt2 | 2160 | 120 | 201 | 69 | 656 | 31.9 | 4.5 | 182 | 64 | 55 |
| 2 | post-assignments | 2160 | 120 | 216 | 72 | 654 | 32.1 | 4.5 | 178 | 64 | 55 |
| 2 | post-see | 2160 | 120 | 529 | 100 | 587 | 42.3 | 4.9 | 216 | 69 | 50 |
| 3 | pre-tt1 | 2160 | 120 | 2 | 2 | 741 | 26.3 | 0 | 0 | 0 | 0 |
| 3 | post-tt1 | 2160 | 120 | 147 | 51 | 865 | 34 | 0 | 420 | 71 | 49 |
| 3 | post-tt2 | 2160 | 120 | 277 | 83 | 759 | 36.6 | 5.2 | 245 | 75 | 44 |
| 3 | post-assignments | 2160 | 120 | 287 | 84 | 755 | 36.9 | 5.1 | 239 | 75 | 44 |
| 3 | post-see | 2160 | 120 | 575 | 102 | 682 | 45.8 | 5.3 | 259 | 76 | 41 |
| 4 | pre-tt1 | 2160 | 120 | 2 | 2 | 928 | 29.5 | 0 | 0 | 0 | 0 |
| 4 | post-tt1 | 2160 | 120 | 192 | 66 | 959 | 37.5 | 0 | 464 | 72 | 47 |
| 4 | post-tt2 | 2160 | 120 | 353 | 93 | 797 | 40.4 | 5.4 | 274 | 74 | 46 |
| 4 | post-assignments | 2160 | 120 | 376 | 93 | 778 | 40.9 | 5.3 | 272 | 72 | 48 |
| 4 | post-see | 2160 | 120 | 676 | 103 | 664 | 49.7 | 4.8 | 267 | 77 | 43 |
| 5 | pre-tt1 | 2160 | 120 | 5 | 5 | 1011 | 31.8 | 0 | 0 | 0 | 0 |
| 5 | post-tt1 | 2160 | 120 | 264 | 81 | 1023 | 41.2 | 0 | 517 | 73 | 45 |
| 5 | post-tt2 | 2160 | 120 | 428 | 104 | 849 | 44.3 | 5.9 | 281 | 68 | 52 |
| 5 | post-assignments | 2160 | 120 | 452 | 105 | 825 | 44.7 | 5.7 | 283 | 72 | 48 |
| 5 | post-see | 2160 | 120 | 802 | 113 | 663 | 54.7 | 4.7 | 256 | 84 | 32 |
| 6 | pre-tt1 | 2160 | 120 | 5 | 4 | 1191 | 34.9 | 0 | 0 | 0 | 0 |
| 6 | post-tt1 | 2160 | 120 | 305 | 82 | 1098 | 44.5 | 0 | 537 | 75 | 45 |
| 6 | post-tt2 | 2160 | 120 | 582 | 114 | 834 | 49.9 | 5.6 | 300 | 79 | 41 |
| 6 | post-assignments | 2160 | 120 | 601 | 114 | 820 | 50.3 | 5.5 | 302 | 81 | 39 |
| 6 | post-see | 2160 | 120 | 882 | 115 | 662 | 57.9 | 4.1 | 234 | 83 | 37 |

