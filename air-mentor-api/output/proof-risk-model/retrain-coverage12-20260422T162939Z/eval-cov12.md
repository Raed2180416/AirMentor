# Proof Risk Model Evaluation

Generated at: 2026-04-22T16:58:09.922Z

## Corpus

- Seed profile: custom
- Requested seeds: 101, 202, 303, 404, 505, 606, 707, 808, 4141, 4242, 4343, 4444
- Governed seeds evaluated: 101, 202, 303, 404, 505, 606, 707, 808, 4141, 4242, 4343, 4444
- Reused existing governed runs: 0
- Created governed runs: 12
- Skipped requested non-manifest seeds: none
- Proof runs in corpus: 12
- Total checkpoint evidence rows: 158400
- Held-out test rows: 0
- Active run used for UI parity: simulation_run_a6e55977-3024-4300-ba5c-99026a0fe2cb
- Duplicate governed runs skipped: 1
- Scenario-mismatch governed runs skipped: 0
- Non-manifest runs skipped: 0
- Stage definitions per semester: 5
- Complete requested runs: 12
- Incomplete requested runs: 1

| Seed | Run ID | Semester Span | Checkpoints (actual/expected) | Stage Evidence Rows | Complete |
| --- | --- | --- | --- | --- | --- |
| 101 | sim_mnc_2023_first6_v1 | 1-6 | 0/30 | 0 | false |
| 101 | simulation_run_ca566c32-af79-43f9-aa18-fa52a59d90ec | 1-6 | 30/30 | 39600 | true |
| 202 | simulation_run_00f57c95-2daa-43a6-b3f1-b369077babcd | 1-6 | 30/30 | 39600 | true |
| 303 | simulation_run_b2ab3377-482b-43b0-9d20-b1d9b7e02553 | 1-6 | 30/30 | 39600 | true |
| 404 | simulation_run_1f0664a4-b900-45de-b0f4-f03eef94d0cb | 1-6 | 30/30 | 39600 | true |
| 505 | simulation_run_58ff18d5-6b4f-44e2-ad14-0669d3f83c72 | 1-6 | 30/30 | 39600 | true |
| 606 | simulation_run_2bf27561-6931-4600-ae4f-0d98795f7203 | 1-6 | 30/30 | 39600 | true |
| 707 | simulation_run_ae347428-218a-4a24-b020-620a2e785f3e | 1-6 | 30/30 | 39600 | true |
| 808 | simulation_run_78b98bef-dc76-4667-a7ce-e364ea2d00e0 | 1-6 | 30/30 | 39600 | true |
| 4141 | simulation_run_1c017e4c-d6c4-43cb-b81d-530c697ec8e8 | 1-6 | 30/30 | 39600 | true |
| 4242 | simulation_run_825bf65a-ad14-4805-94c1-8fce927e9a86 | 1-6 | 30/30 | 39600 | true |
| 4343 | simulation_run_c198385f-7c5c-4162-bdca-118c90291d6f | 1-6 | 30/30 | 39600 | true |
| 4444 | simulation_run_a6e55977-3024-4300-ba5c-99026a0fe2cb | 1-6 | 30/30 | 39600 | true |

## Evaluator Config

- Git SHA: 9dff82212ca4ac0856f14f99e8af45011f956d66
- JSON path: /tmp/cov12-20260422T162939Z/cov12.json
- Markdown path: /tmp/cov12-20260422T162939Z/cov12.md
- Hybrid alpha grid: 1, 0
- Hybrid denylisted heads: downstreamCarryoverRisk, overallCourseRisk
- Hybrid minimum support: 50
- Hybrid max ROC-AUC drop: 0.01
- Hybrid max ECE increase: 0.02
- Hybrid max precision@budget drop: 0.05

| Head | Allowed Stages |
| --- | --- |
| attendanceRisk | pre-tt1, post-tt1, post-tt2, post-assignments, post-see |
| ceRisk | post-tt1, post-tt2, post-assignments |
| seeRisk | post-tt2, post-assignments, post-see |
| overallCourseRisk | current-only |
| downstreamCarryoverRisk | current-only |

## Overall Course Runtime Risk

| Scorer | Brier | Log Loss | ROC-AUC | PR-AUC | ECE | Slope | Intercept | Positive Rate | Support |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| model | 0 | 0 | 0.5 | 0 | 0 | 1 | 0 | 0 | 0 |
| heuristic | 0 | 0 | 0.5 | 0 | 0 | 1 | 0 | 0 | 0 |

- Overall-course runtime Brier lift: 0
- Overall-course runtime AUC lift: 0

## Head Metrics

| Head | Model Brier | Heuristic Brier | Brier Lift | Model Log Loss | Heuristic Log Loss | Model ROC-AUC | Heuristic ROC-AUC | AUC Lift | Model PR-AUC | Heuristic PR-AUC | Model ECE | Heuristic ECE |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| attendanceRisk | 0 | 0 | 0 | 0 | 0 | 0.5 | 0.5 | 0 | 0 | 0 | 0 | 0 |
| ceRisk | 0 | 0 | 0 | 0 | 0 | 0.5 | 0.5 | 0 | 0 | 0 | 0 | 0 |
| seeRisk | 0 | 0 | 0 | 0 | 0 | 0.5 | 0.5 | 0 | 0 | 0 | 0 | 0 |
| overallCourseRisk | 0 | 0 | 0 | 0 | 0 | 0.5 | 0.5 | 0 | 0 | 0 | 0 | 0 |
| downstreamCarryoverRisk | 0 | 0 | 0 | 0 | 0 | 0.5 | 0.5 | 0 | 0 | 0 | 0 | 0 |

## Variant Comparison

| Variant | Brier | Log Loss | ROC-AUC | PR-AUC | ECE | Budget Rate | Flagged@Budget | Precision@Budget | Recall@Budget | Overload Ratio |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| current-v6 | 0 | 0 | 0.5 | 0 | 0 | 0.2 | 0 | 0 | 0 | 0 |
| baseline-v5-like | 0 | 0 | 0.5 | 0 | 0 | 0.2 | 0 | 0 | 0 | 0 |
| hybrid-router | 0 | 0 | 0.5 | 0 | 0 | 0.2 | 0 | 0 | 0 | 0 |
| challenger | 0 | 0 | 0.5 | 0 | 0 | 0.2 | 0 | 0 | 0 | 0 |
| heuristic | 0 | 0 | 0.5 | 0 | 0 | 0.2 | 0 | 0 | 0 | 0 |

| Head | Fallback Alpha | Stage Routes |
| --- | --- | --- |
| attendanceRisk | 1 | post-assignments:1, pre-tt1:1, post-tt2:1, post-tt1:1, post-see:1 |
| ceRisk | 1 | post-assignments:1, pre-tt1:1, post-tt2:1, post-tt1:1, post-see:1 |
| seeRisk | 1 | post-assignments:1, pre-tt1:1, post-tt2:1, post-tt1:1, post-see:1 |
| overallCourseRisk | 1 | post-assignments:1, pre-tt1:1, post-tt2:1, post-tt1:1, post-see:1 |
| downstreamCarryoverRisk | 1 | post-assignments:1, pre-tt1:1, post-tt2:1, post-tt1:1, post-see:1 |

| Head | Baseline ROC-AUC | Current ROC-AUC | Hybrid ROC-AUC | Challenger ROC-AUC | Current-Baseline Brier Lift | Current-Hybrid Brier Lift | Hybrid-Challenger Brier Lift |
| --- | --- | --- | --- | --- | --- | --- | --- |
| attendanceRisk | 0.5 | 0.5 | 0.5 | 0.5 | 0 | 0 | 0 |
| ceRisk | 0.5 | 0.5 | 0.5 | 0.5 | 0 | 0 | 0 |
| seeRisk | 0.5 | 0.5 | 0.5 | 0.5 | 0 | 0 | 0 |
| overallCourseRisk | 0.5 | 0.5 | 0.5 | 0.5 | 0 | 0 | 0 |
| downstreamCarryoverRisk | 0.5 | 0.5 | 0.5 | 0.5 | 0 | 0 | 0 |

## Action Rollups

| Action | Cases | Immediate Benefit (scaled points) | Next-Checkpoint Lift (Lower is Better) | Recovery Rate |
| --- | --- | --- | --- | --- |
| targeted-tutoring | 5487 | 9.4 | -1.9 | 0.2817 |
| pre-see-rescue | 5310 | 8.3 | 0.2 | 0.3746 |
| attendance-recovery-follow-up | 1767 | 2.2 | 2 | 0.3161 |
| prerequisite-bridge | 1616 | 11.1 | -2.5 | 0.1826 |

## Policy Diagnostics

| Phenotype | Support | Avg Lift | Avg Regret | Beats No Action | Teacher Efficacy Allowed |
| --- | --- | --- | --- | --- | --- |
| late-semester-acute | 76354 | 1.05 | 0 | true | true |
| persistent-nonresponse | 6809 | 13.66 | 0 | true | true |
| prerequisite-dominant | 100995 | 7.96 | 0 | true | true |
| academic-weakness | 53505 | 13.11 | 0 | true | true |
| attendance-dominant | 20396 | 4.76 | 0 | true | true |
| diffuse-amber | 44215 | 8.92 | 0 | true | true |

- Policy acceptance gates: {"structuredStudyPlanWithinLimit":true,"targetedTutoringBeatsStructuredStudyPlanAcademicSlice":true,"noRecommendedActionUnderperformsNoAction":true}

## CO Evidence Diagnostics

| Metric | Value |
| --- | --- |
| totalRows | 158400 |
| fallbackCount | 72000 |
| theoryFallbackCount | 52800 |
| labFallbackCount | 19200 |

- CO evidence acceptance gates: {"theoryCoursesDefaultToBlueprintEvidence":false,"fallbackOnlyInExplicitCases":false}

## Queue Burden

| Semester | Stage | Runs | Mean Open | Median Open | P95 Open | Max Open | Mean Watch | P95 Watch | P95 Section Max | Mean PPV | Min PPV | Threshold |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | pre-tt1 | 12 | 0 | 0 | 0 | 0 | 0.0118 | 0.05 | 0 | 0 | 0.55 | 0.3 |
| 1 | post-tt1 | 12 | 0.2229 | 0.225 | 0.2667 | 0.2667 | 0.0354 | 0.1833 | 0.3 | 0.4727 | 0.4454 | 0.3 |
| 1 | post-tt2 | 12 | 0.2736 | 0.2833 | 0.3 | 0.3 | 0.0924 | 0.2667 | 0.3 | 0.6065 | 0.5682 | 0.3 |
| 1 | post-assignments | 12 | 0.2764 | 0.2917 | 0.3 | 0.3 | 0.1021 | 0.275 | 0.3 | 0.6145 | 0.5803 | 0.3 |
| 1 | post-see | 12 | 0.3479 | 0.35 | 0.35 | 0.35 | 0.1278 | 0.4417 | 0.35 | 0.7368 | 0.7105 | 0.35 |
| 2 | pre-tt1 | 12 | 0 | 0 | 0 | 0 | 0.4563 | 0.6083 | 0 | 0 | 0.55 | 0.3 |
| 2 | post-tt1 | 12 | 0.3 | 0.3 | 0.3 | 0.3 | 0.1819 | 0.6167 | 0.3 | 0.7326 | 0.6683 | 0.3 |
| 2 | post-tt2 | 12 | 0.3 | 0.3 | 0.3 | 0.3 | 0.1694 | 0.625 | 0.3 | 0.8342 | 0.8053 | 0.3 |
| 2 | post-assignments | 12 | 0.3 | 0.3 | 0.3 | 0.3 | 0.1681 | 0.625 | 0.3 | 0.8362 | 0.8092 | 0.3 |
| 2 | post-see | 12 | 0.35 | 0.35 | 0.35 | 0.35 | 0.1208 | 0.5417 | 0.35 | 0.9027 | 0.8857 | 0.35 |
| 3 | pre-tt1 | 12 | 0 | 0 | 0 | 0 | 0.5882 | 0.7583 | 0 | 0 | 0.55 | 0.3 |
| 3 | post-tt1 | 12 | 0.3 | 0.3 | 0.3 | 0.3 | 0.1854 | 0.6417 | 0.3 | 0.7754 | 0.7294 | 0.3 |
| 3 | post-tt2 | 12 | 0.3 | 0.3 | 0.3 | 0.3 | 0.2069 | 0.6417 | 0.3 | 0.8658 | 0.8458 | 0.3 |
| 3 | post-assignments | 12 | 0.3 | 0.3 | 0.3 | 0.3 | 0.2167 | 0.6417 | 0.3 | 0.8651 | 0.8442 | 0.3 |
| 3 | post-see | 12 | 0.35 | 0.35 | 0.35 | 0.35 | 0.1417 | 0.5417 | 0.35 | 0.9179 | 0.9002 | 0.35 |
| 4 | pre-tt1 | 12 | 0 | 0 | 0 | 0 | 0.675 | 0.8167 | 0 | 0 | 0.55 | 0.3 |
| 4 | post-tt1 | 12 | 0.3 | 0.3 | 0.3 | 0.3 | 0.1826 | 0.6083 | 0.3 | 0.7965 | 0.7375 | 0.3 |
| 4 | post-tt2 | 12 | 0.3 | 0.3 | 0.3 | 0.3 | 0.1813 | 0.6333 | 0.3 | 0.8844 | 0.8636 | 0.3 |
| 4 | post-assignments | 12 | 0.3 | 0.3 | 0.3 | 0.3 | 0.1813 | 0.6333 | 0.3 | 0.8864 | 0.865 | 0.3 |
| 4 | post-see | 12 | 0.35 | 0.35 | 0.35 | 0.35 | 0.1333 | 0.5417 | 0.35 | 0.9213 | 0.8964 | 0.35 |
| 5 | pre-tt1 | 12 | 0 | 0 | 0 | 0 | 0.7285 | 0.8583 | 0 | 0 | 0.55 | 0.3 |
| 5 | post-tt1 | 12 | 0.3 | 0.3 | 0.3 | 0.3 | 0.1687 | 0.65 | 0.3 | 0.8216 | 0.7697 | 0.3 |
| 5 | post-tt2 | 12 | 0.3 | 0.3 | 0.3 | 0.3 | 0.1861 | 0.6667 | 0.3 | 0.8994 | 0.8847 | 0.3 |
| 5 | post-assignments | 12 | 0.3 | 0.3 | 0.3 | 0.3 | 0.1833 | 0.6667 | 0.3 | 0.9009 | 0.8797 | 0.3 |
| 5 | post-see | 12 | 0.35 | 0.35 | 0.35 | 0.35 | 0.1257 | 0.5333 | 0.35 | 0.9248 | 0.9117 | 0.35 |
| 6 | pre-tt1 | 12 | 0 | 0 | 0 | 0 | 0.7792 | 0.8917 | 0 | 0 | 0.55 | 0.3 |
| 6 | post-tt1 | 12 | 0.3 | 0.3 | 0.3 | 0.3 | 0.1639 | 0.65 | 0.3 | 0.8385 | 0.8128 | 0.3 |
| 6 | post-tt2 | 12 | 0.3 | 0.3 | 0.3 | 0.3 | 0.1667 | 0.6833 | 0.3 | 0.8919 | 0.8728 | 0.3 |
| 6 | post-assignments | 12 | 0.3 | 0.3 | 0.3 | 0.3 | 0.1847 | 0.6917 | 0.3 | 0.8915 | 0.8767 | 0.3 |
| 6 | post-see | 12 | 0.35 | 0.35 | 0.35 | 0.35 | 0.1299 | 0.4917 | 0.35 | 0.9091 | 0.8974 | 0.35 |

- Queue burden acceptance gates: {"actionableRatesWithinLimit":true,"sectionToleranceWithinLimit":true,"watchRatesWithinLimit":false,"actionableQueuePpvProxyWithinLimit":true}

### Queue Burden Diagnostic Cross-Run Union

| Semester | Stage | Unique Students | Open Queue Students | Watch Students | Open Rate | Watch Rate | PPV Proxy | Threshold | Section Max Rate |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | pre-tt1 | 120 | 0 | 15 | 0 | 0.125 | 0 | 0.3 | 0 |
| 1 | post-tt1 | 120 | 104 | 9 | 0.8667 | 0.075 | 0.5261 | 0.3 | 0.9667 |
| 1 | post-tt2 | 120 | 117 | 3 | 0.975 | 0.025 | 0.6788 | 0.3 | 1 |
| 1 | post-assignments | 120 | 116 | 4 | 0.9667 | 0.0333 | 0.69 | 0.3 | 0.9833 |
| 1 | post-see | 120 | 119 | 1 | 0.9917 | 0.0083 | 0.8071 | 0.35 | 1 |
| 2 | pre-tt1 | 120 | 0 | 117 | 0 | 0.975 | 0 | 0.3 | 0 |
| 2 | post-tt1 | 120 | 117 | 3 | 0.975 | 0.025 | 0.8272 | 0.3 | 0.9833 |
| 2 | post-tt2 | 120 | 116 | 4 | 0.9667 | 0.0333 | 0.8841 | 0.3 | 0.9667 |
| 2 | post-assignments | 120 | 116 | 4 | 0.9667 | 0.0333 | 0.8875 | 0.3 | 0.9667 |
| 2 | post-see | 120 | 119 | 1 | 0.9917 | 0.0083 | 0.935 | 0.35 | 1 |
| 3 | pre-tt1 | 120 | 0 | 120 | 0 | 1 | 0 | 0.3 | 0 |
| 3 | post-tt1 | 120 | 117 | 3 | 0.975 | 0.025 | 0.8653 | 0.3 | 0.9833 |
| 3 | post-tt2 | 120 | 119 | 1 | 0.9917 | 0.0083 | 0.9087 | 0.3 | 1 |
| 3 | post-assignments | 120 | 118 | 2 | 0.9833 | 0.0167 | 0.9128 | 0.3 | 0.9833 |
| 3 | post-see | 120 | 119 | 1 | 0.9917 | 0.0083 | 0.9452 | 0.35 | 1 |
| 4 | pre-tt1 | 120 | 0 | 120 | 0 | 1 | 0 | 0.3 | 0 |
| 4 | post-tt1 | 120 | 116 | 4 | 0.9667 | 0.0333 | 0.8822 | 0.3 | 0.9833 |
| 4 | post-tt2 | 120 | 119 | 1 | 0.9917 | 0.0083 | 0.9243 | 0.3 | 1 |
| 4 | post-assignments | 120 | 119 | 1 | 0.9917 | 0.0083 | 0.9263 | 0.3 | 1 |
| 4 | post-see | 120 | 120 | 0 | 1 | 0 | 0.9468 | 0.35 | 1 |
| 5 | pre-tt1 | 120 | 0 | 120 | 0 | 1 | 0 | 0.3 | 0 |
| 5 | post-tt1 | 120 | 119 | 1 | 0.9917 | 0.0083 | 0.8888 | 0.3 | 1 |
| 5 | post-tt2 | 120 | 118 | 2 | 0.9833 | 0.0167 | 0.9323 | 0.3 | 0.9833 |
| 5 | post-assignments | 120 | 118 | 2 | 0.9833 | 0.0167 | 0.9332 | 0.3 | 0.9833 |
| 5 | post-see | 120 | 118 | 2 | 0.9833 | 0.0167 | 0.9465 | 0.35 | 0.9833 |
| 6 | pre-tt1 | 120 | 0 | 120 | 0 | 1 | 0 | 0.3 | 0 |
| 6 | post-tt1 | 120 | 120 | 0 | 1 | 0 | 0.9012 | 0.3 | 1 |
| 6 | post-tt2 | 120 | 120 | 0 | 1 | 0 | 0.9311 | 0.3 | 1 |
| 6 | post-assignments | 120 | 119 | 1 | 0.9917 | 0.0083 | 0.9344 | 0.3 | 1 |
| 6 | post-see | 120 | 119 | 1 | 0.9917 | 0.0083 | 0.9466 | 0.35 | 1 |

## Carryover Head

| Metric | Value |
| --- | --- |
| Brier lift | 0 |
| AUC lift | 0 |
| Calibration method | isotonic |
| Display probability allowed | false |
| Support warning | Held-out support is below the probability display threshold. |

## Stage Rollups

| Semester | Stage | Projection Rows | Unique Students | High Risk Rows | High Risk Students | Medium Risk Rows | Avg Risk | Avg Lift | Open Queue Rows | Open Queue Students | Watch Students |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | pre-tt1 | 17280 | 120 | 0 | 0 | 40 | 9.3 | 0 | 0 | 0 | 15 |
| 1 | post-tt1 | 17280 | 120 | 3 | 3 | 1374 | 17.6 | 0 | 958 | 104 | 9 |
| 1 | post-tt2 | 17280 | 120 | 139 | 60 | 2808 | 22.3 | 1.5 | 1154 | 117 | 3 |
| 1 | post-assignments | 17280 | 120 | 185 | 69 | 3048 | 22.9 | 1.6 | 1197 | 116 | 4 |
| 1 | post-see | 17280 | 120 | 687 | 103 | 6069 | 31.7 | 4.6 | 2501 | 119 | 1 |
| 2 | pre-tt1 | 17280 | 120 | 36 | 13 | 6990 | 31.7 | 0 | 0 | 0 | 117 |
| 2 | post-tt1 | 17280 | 120 | 1163 | 96 | 9893 | 40.7 | 0 | 3699 | 117 | 3 |
| 2 | post-tt2 | 17280 | 120 | 2488 | 119 | 8672 | 45.6 | 8.4 | 2206 | 116 | 4 |
| 2 | post-assignments | 17280 | 120 | 2673 | 119 | 8591 | 46.1 | 8.3 | 2169 | 116 | 4 |
| 2 | post-see | 17280 | 120 | 4954 | 120 | 8431 | 54.8 | 10.1 | 2998 | 119 | 1 |
| 3 | pre-tt1 | 17280 | 120 | 70 | 21 | 9600 | 35.6 | 0 | 0 | 0 | 120 |
| 3 | post-tt1 | 17280 | 120 | 1812 | 115 | 10557 | 45.2 | 0 | 4368 | 117 | 3 |
| 3 | post-tt2 | 17280 | 120 | 3817 | 120 | 8668 | 51.1 | 8.8 | 2562 | 119 | 1 |
| 3 | post-assignments | 17280 | 120 | 4045 | 120 | 8515 | 51.7 | 8.6 | 2533 | 118 | 2 |
| 3 | post-see | 17280 | 120 | 6650 | 120 | 7525 | 60.1 | 9.4 | 2943 | 119 | 1 |
| 4 | pre-tt1 | 17280 | 120 | 54 | 18 | 11204 | 38.2 | 0 | 0 | 0 | 120 |
| 4 | post-tt1 | 17280 | 120 | 2307 | 117 | 10895 | 48.4 | 0 | 4685 | 116 | 4 |
| 4 | post-tt2 | 17280 | 120 | 4605 | 120 | 8659 | 54.4 | 9.1 | 2967 | 119 | 1 |
| 4 | post-assignments | 17280 | 120 | 4875 | 120 | 8456 | 55 | 8.8 | 2884 | 119 | 1 |
| 4 | post-see | 17280 | 120 | 7791 | 120 | 6772 | 63.6 | 8.7 | 2944 | 120 | 0 |
| 5 | pre-tt1 | 17280 | 120 | 90 | 27 | 12242 | 39.9 | 0 | 0 | 0 | 120 |
| 5 | post-tt1 | 17280 | 120 | 2759 | 120 | 11293 | 51 | 0 | 4970 | 119 | 1 |
| 5 | post-tt2 | 17280 | 120 | 5463 | 120 | 8654 | 57.7 | 9.3 | 2975 | 118 | 2 |
| 5 | post-assignments | 17280 | 120 | 5742 | 120 | 8403 | 58.3 | 9 | 2855 | 118 | 2 |
| 5 | post-see | 17280 | 120 | 8935 | 120 | 6230 | 67.4 | 8.1 | 2769 | 118 | 2 |
| 6 | pre-tt1 | 8640 | 120 | 50 | 36 | 6601 | 41.5 | 0 | 0 | 0 | 120 |
| 6 | post-tt1 | 8640 | 120 | 2233 | 120 | 5272 | 56.4 | 0 | 2527 | 120 | 0 |
| 6 | post-tt2 | 8640 | 120 | 3721 | 120 | 3840 | 64.2 | 8.7 | 1390 | 120 | 0 |
| 6 | post-assignments | 8640 | 120 | 3852 | 120 | 3723 | 64.7 | 8.5 | 1373 | 119 | 1 |
| 6 | post-see | 8640 | 120 | 5732 | 120 | 2318 | 75.9 | 5.7 | 1278 | 119 | 1 |

## Phase 8 Overload Diagnostics

### Per-Stage Overload (overallCourseRisk — current variant)

| Stage | Support | Budget Rate | Flagged@Budget | Overload Ratio | ECE | Calibration Slope |
| --- | --- | --- | --- | --- | --- | --- |

### Local Reliability at Decision Thresholds (overallCourseRisk — current)

| Threshold | Support (±0.05) | Mean Predicted | Mean Actual | Calibration Error |
| --- | --- | --- | --- | --- |
| 0.4 | 0 | 0 | 0 | 0 |
| 0.85 | 0 | 0 | 0 | 0 |

### Score Histogram (overallCourseRisk — current, 10 bins)

| Bin Low | Bin High | Count | Positive Rate | Mean Predicted |
| --- | --- | --- | --- | --- |

