# Overnight ML RCA: overallCourseRisk histograms by stage & semester

## Inputs

- 原 feature export path：`audit-map/22-evals/data/overall-course-risk-cov12-input-features.csv`
- 佐證 report path：`audit-map/22-evals/data/overall-course-risk-cov12-input-report.json`
- 重建 row export path：`audit-map/22-evals/data/overall-course-risk-cov12-reconstructed-validation.csv`
- Summary JSON path：`audit-map/22-evals/data/overall-course-risk-cov12-reconstructed-summary.json`
- Scorer 所本：prod artifact `observable-risk-logit-v8`；current bundle label `observable-risk-logit-v8`；calib `isotonic`。
- 重建法：retained export 缺 `semester_number`；各 `run_id×stage_key` 內依 calibrated `overallCourseRisk` 升序，按 `stageRollups` 與 `sourceRunCount` 所示定額切 semester（`sem1..5=1440`，`sem6=720`）。
- 範圍 caveat：retained cov12 export 僅 validation（input report 見 `totalTestRows=0`）；故此文惟 score-shape proxy，非 held-out promotion gate。

## Findings

- 重建後 artifact-grounded score mass 於任一 stage×semester 皆未越 `0.85`；max `P90` 乃 `post-see` / sem`6` 之 `0.681`。
- 各 stage 內，semester mean 皆 sem1→sem6 單調上升；最重 late-sem tail 在 `post-see` / sem`6`，mean `0.5399`。
- 同一 input report 之 `stageRollups` 卻示高風險量甚巨（如 `post-see` / sem`5` validation-proxy `2978.3333`），然 artifact-grounded rescoring 為 `0`；此偏差宜視作 provenance drift 假說，非單純 calibration noise。
- 既 row export 僅 validation 且缺 `semester_number`，此組 histogram 只宜作 deterministic proxy RCA，勿作 promotion 證據。

## Evidence

此表 input feature export：`audit-map/22-evals/data/overall-course-risk-cov12-input-features.csv`。所對照 projection 支撐：`audit-map/22-evals/data/overall-course-risk-cov12-input-report.json`。

Artifact-vs-projection high-band drift（largest negative gaps first）：

| Stage | Semester | Recon >0.85 | Report HighRisk Cnt (validation-proxy) | Gap |
| --- | --- | --- | --- | --- |
| post-see | 5 | 0 | 2978.3333 | -2978.3333 |
| post-see | 4 | 0 | 2597 | -2597 |
| post-see | 3 | 0 | 2216.6667 | -2216.6667 |
| post-assignments | 5 | 0 | 1914 | -1914 |
| post-see | 6 | 0 | 1910.6667 | -1910.6667 |
| post-tt2 | 5 | 0 | 1821 | -1821 |
| post-see | 2 | 0 | 1651.3333 | -1651.3333 |
| post-assignments | 4 | 0 | 1625 | -1625 |
| post-tt2 | 4 | 0 | 1535 | -1535 |
| post-assignments | 3 | 0 | 1348.3333 | -1348.3333 |

### pre-tt1

此表 input feature export：`audit-map/22-evals/data/overall-course-risk-cov12-input-features.csv`。重建所據：`audit-map/22-evals/data/overall-course-risk-cov12-input-report.json` 之 `stageRollups`。

| Semester | Count | Mean | P10 | P25 | P50 | P75 | P90 | >0.85 Cnt | >0.85 Share | B00-10 | B10-20 | B20-30 | B30-40 | B40-50 | B50-60 | B60-70 | B70-80 | B80-90 | B90-100 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 5760 | 0.0382 | 0.0298 | 0.0298 | 0.0431 | 0.0459 | 0.0459 | 0 | 0 | 5760 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| 2 | 5760 | 0.0507 | 0.0459 | 0.0459 | 0.0464 | 0.0526 | 0.0688 | 0 | 0 | 5662 | 98 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| 3 | 5760 | 0.1034 | 0.0526 | 0.0688 | 0.1003 | 0.1302 | 0.1815 | 0 | 0 | 2880 | 2461 | 419 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| 4 | 5760 | 0.2107 | 0.1607 | 0.1649 | 0.2142 | 0.2358 | 0.2856 | 0 | 0 | 0 | 2140 | 3529 | 91 | 0 | 0 | 0 | 0 | 0 | 0 |
| 5 | 5760 | 0.3261 | 0.2358 | 0.2856 | 0.3063 | 0.3931 | 0.4177 | 0 | 0 | 0 | 0 | 2042 | 2926 | 792 | 0 | 0 | 0 | 0 | 0 |
| 6 | 2880 | 0.4493 | 0.3931 | 0.4356 | 0.4391 | 0.466 | 0.5036 | 0 | 0 | 0 | 0 | 0 | 371 | 2205 | 274 | 30 | 0 | 0 | 0 |

### post-tt1

此表 input feature export：`audit-map/22-evals/data/overall-course-risk-cov12-input-features.csv`。重建所據：`audit-map/22-evals/data/overall-course-risk-cov12-input-report.json` 之 `stageRollups`。

| Semester | Count | Mean | P10 | P25 | P50 | P75 | P90 | >0.85 Cnt | >0.85 Share | B00-10 | B10-20 | B20-30 | B30-40 | B40-50 | B50-60 | B60-70 | B70-80 | B80-90 | B90-100 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 5760 | 0.0143 | 0.0046 | 0.0047 | 0.0149 | 0.0246 | 0.0246 | 0 | 0 | 5760 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| 2 | 5760 | 0.036 | 0.0246 | 0.0287 | 0.0298 | 0.0298 | 0.0693 | 0 | 0 | 5718 | 42 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| 3 | 5760 | 0.0955 | 0.0431 | 0.0526 | 0.0891 | 0.1057 | 0.1731 | 0 | 0 | 3192 | 2348 | 220 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| 4 | 5760 | 0.2011 | 0.1057 | 0.1649 | 0.2142 | 0.2358 | 0.2681 | 0 | 0 | 139 | 2479 | 3017 | 125 | 0 | 0 | 0 | 0 | 0 | 0 |
| 5 | 5760 | 0.3301 | 0.2358 | 0.2856 | 0.3063 | 0.3931 | 0.4177 | 0 | 0 | 0 | 0 | 2067 | 2934 | 759 | 0 | 0 | 0 | 0 | 0 |
| 6 | 2880 | 0.4648 | 0.3931 | 0.4391 | 0.4487 | 0.4854 | 0.5611 | 0 | 0 | 0 | 0 | 0 | 385 | 1909 | 414 | 172 | 0 | 0 | 0 |

### post-tt2

此表 input feature export：`audit-map/22-evals/data/overall-course-risk-cov12-input-features.csv`。重建所據：`audit-map/22-evals/data/overall-course-risk-cov12-input-report.json` 之 `stageRollups`。

| Semester | Count | Mean | P10 | P25 | P50 | P75 | P90 | >0.85 Cnt | >0.85 Share | B00-10 | B10-20 | B20-30 | B30-40 | B40-50 | B50-60 | B60-70 | B70-80 | B80-90 | B90-100 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 5760 | 0.0056 | 0.0001 | 0.0015 | 0.0046 | 0.0047 | 0.0149 | 0 | 0 | 5760 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| 2 | 5760 | 0.0312 | 0.0149 | 0.0246 | 0.0298 | 0.0388 | 0.0464 | 0 | 0 | 5715 | 45 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| 3 | 5760 | 0.098 | 0.0431 | 0.0464 | 0.0891 | 0.129 | 0.1815 | 0 | 0 | 3062 | 2400 | 298 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| 4 | 5760 | 0.2066 | 0.1184 | 0.1729 | 0.2142 | 0.2358 | 0.2856 | 0 | 0 | 73 | 2278 | 3204 | 205 | 0 | 0 | 0 | 0 | 0 | 0 |
| 5 | 5760 | 0.3393 | 0.2358 | 0.2856 | 0.3234 | 0.3931 | 0.429 | 0 | 0 | 0 | 0 | 1882 | 2943 | 935 | 0 | 0 | 0 | 0 | 0 |
| 6 | 2880 | 0.4862 | 0.4091 | 0.4391 | 0.4576 | 0.5036 | 0.6085 | 0 | 0 | 0 | 0 | 0 | 279 | 1717 | 514 | 359 | 0 | 11 | 0 |

### post-assignments

此表 input feature export：`audit-map/22-evals/data/overall-course-risk-cov12-input-features.csv`。重建所據：`audit-map/22-evals/data/overall-course-risk-cov12-input-report.json` 之 `stageRollups`。

| Semester | Count | Mean | P10 | P25 | P50 | P75 | P90 | >0.85 Cnt | >0.85 Share | B00-10 | B10-20 | B20-30 | B30-40 | B40-50 | B50-60 | B60-70 | B70-80 | B80-90 | B90-100 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 5760 | 0.006 | 0.0001 | 0.0015 | 0.0046 | 0.0047 | 0.0149 | 0 | 0 | 5760 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| 2 | 5760 | 0.033 | 0.0149 | 0.0246 | 0.0298 | 0.0431 | 0.0464 | 0 | 0 | 5641 | 119 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| 3 | 5760 | 0.1042 | 0.0431 | 0.0526 | 0.1003 | 0.1607 | 0.1815 | 0 | 0 | 2833 | 2569 | 358 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| 4 | 5760 | 0.2131 | 0.1607 | 0.1815 | 0.2218 | 0.2358 | 0.2856 | 0 | 0 | 0 | 2056 | 3440 | 264 | 0 | 0 | 0 | 0 | 0 | 0 |
| 5 | 5760 | 0.3473 | 0.2358 | 0.2856 | 0.3792 | 0.3931 | 0.4356 | 0 | 0 | 0 | 0 | 1641 | 3022 | 1097 | 0 | 0 | 0 | 0 | 0 |
| 6 | 2880 | 0.5031 | 0.4177 | 0.4391 | 0.466 | 0.568 | 0.6121 | 0 | 0 | 0 | 0 | 0 | 233 | 1525 | 594 | 494 | 0 | 34 | 0 |

### post-see

此表 input feature export：`audit-map/22-evals/data/overall-course-risk-cov12-input-features.csv`。重建所據：`audit-map/22-evals/data/overall-course-risk-cov12-input-report.json` 之 `stageRollups`。

| Semester | Count | Mean | P10 | P25 | P50 | P75 | P90 | >0.85 Cnt | >0.85 Share | B00-10 | B10-20 | B20-30 | B30-40 | B40-50 | B50-60 | B60-70 | B70-80 | B80-90 | B90-100 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 5760 | 0.007 | 0.0001 | 0.0015 | 0.0046 | 0.0107 | 0.0246 | 0 | 0 | 5760 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| 2 | 5760 | 0.0438 | 0.0149 | 0.0246 | 0.0298 | 0.0464 | 0.0943 | 0 | 0 | 5219 | 541 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| 3 | 5760 | 0.1335 | 0.0526 | 0.0943 | 0.129 | 0.1815 | 0.2142 | 0 | 0 | 1456 | 3539 | 765 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| 4 | 5760 | 0.2336 | 0.1731 | 0.2142 | 0.2218 | 0.2681 | 0.3063 | 0 | 0 | 0 | 1415 | 3670 | 675 | 0 | 0 | 0 | 0 | 0 | 0 |
| 5 | 5760 | 0.3684 | 0.2681 | 0.3063 | 0.3931 | 0.4177 | 0.4391 | 0 | 0 | 0 | 0 | 1229 | 2898 | 1633 | 0 | 0 | 0 | 0 | 0 |
| 6 | 2880 | 0.5399 | 0.4391 | 0.4576 | 0.5036 | 0.6085 | 0.681 | 0 | 0 | 0 | 0 | 0 | 107 | 1149 | 709 | 818 | 0 | 97 | 0 |

## Next-Steps Hypotheses

- `artifact/projection mismatch`：`simulationStageStudentProjections.riskProbScaled` 與 `artifact.activeModelFromEndpoint.production` 多半不同 scorer / calibration vintage。
- `feature-export contract gap`：evaluator export 當增 `semester_number`，並宜直出 `overall_course_risk_prob`；今次缺失，遂須重建，forensic certainty 因而弱。
- `high-band drift source`：若 active artifact 為真，則 `stageRollups` 所見 `High` band 膨脹，多半來自 stale persisted risk、projection-time fallback、或 export 後轉換，非 raw feature score 本身。

## Recommendations

- Threshold 仍凍結；先補 evaluator row-level export 欄位（`semester_number`、direct score、`scorer version`），後議任何 model 決斷。
- 至 t47/t48，當以具真 row-level semester tag 之 corpus 重跑，逐 cell 比對 artifact-grounded `>0.85` count 與 projection-layer `highRiskProjectionCount`。
- 此報告宜存作 provenance evidence；重建表勿視為 promotion-grade metric。

## Appendix: Reconstruction Validation

- Raw export 內 validation run 數：`4`
- 重建 validation row 數：`158400`
- Max mean cell：`post-see` / sem`6` = `0.5399`
- Max `P90` cell：`post-see` / sem`6` = `0.681`
- 最大 report-vs-artifact high-band gap：`post-see` / sem`5` gap `-2978.3333`
