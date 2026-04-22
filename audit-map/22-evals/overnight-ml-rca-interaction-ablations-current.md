# Overnight ML RCA: interaction-feature ablations

## Inputs

- 旨：只读 RCA；不改 model source，不动 threshold，不作 promotion 结论。
- 主 feature export：`/tmp/cov12-20260422T162939Z/features.csv`
- 行向量与 label dump：`/tmp/cov12-20260422T162939Z/dataset_dump.json`
- active weights / calibration：`/tmp/cov12-20260422T162939Z/cov12.json`
- 此 export 含 `158400` rows，split 皆 `validation`；`held-out test = 0`。故下表皆为 validation-only diagnostic，而非 promotion gate 复判。
- operational head 取 `overallCourseRisk`；`overload`、`ECE`、`local-ECE`、budget spill 口径皆循 `air-mentor-api/scripts/evaluate-proof-risk-model.ts`。
- interaction 真集合依源码凡五：`tt1tt2ExamCompoundRiskScaled`、`courseworkCompoundRiskScaled`、`stagePostTt2TtCompoundInteractionScaled`、`attendanceTrendCompoundRiskScaled`、`stagePostAssignmentsCourseworkInteractionScaled`。auth prompt所列凡四；故本报告之 `all` 依源码取“五项全灭”，未列名之 `attendanceTrendCompoundRiskScaled` 仅随总闸入列。

## Findings

1. `none` 下 `ROC-AUC 0.7769 / Brier 0.1343 / ECE 0.0001 / overload 1.0616`。然 budget 边界 `0.3792` 处有 `2764` exact ties，spill `1953`，且全盘仅 `78` unique probs。是 score bunching 甚于 calibration miss；其形更近 isotonic step-function 压扁，非局部阈值失真独作。
2. 单项 ablation 里，降 overload 最多者为 `coursework interaction only` (`1.0141`)，次为 `TT interaction only` (`1.0414`)；两项 stage-gated term 仅微动总盘：`stage × TT only = 1.0586`，`stage × coursework only = 1.0569`。故主压强在 stage-blind compound term，非 stage × term。
3. `all` 令 overload 几近平 (`1.0039`)，tie@budget 降至 `669`，spill 仅 `123`；然同时 `ROC-AUC` 降至 `0.7745`，`Brier` 升至 `0.1353`，`ECE` 恶化至 `0.0189`，`local-ECE@0.85` 恶化至 `0.0238`。故“全关 interaction”可证因，不可作 fix。
4. stage 条件裂隙甚明：baseline overload 峰在 `post-see 1.0819` 与 `post-tt2 1.0715`；最坏 ECE 却在 `pre-tt1 0.0186`。overload 峰与 calibration 峰不在同 stage，示因非“单一全局校准坏”，而是 stage-conditioned score compression / distribution shift。
5. `all` 之改善不应误归于四个指名项。补算“named-4 off，惟留 `attendanceTrendCompoundRiskScaled`”得 overload 仅降至 `1.0163`；再灭此第五项，方至 `1.0039`。故未列名第五 interaction 亦属重要共犯。
6. blanket ablation 具 stage 迁害：`all` 虽压 `post-see` overload 至 `1.0041`，却将 `post-tt1` 推高至 `1.1443`。是以 interaction 并非纯害；其于早中期仍供 separation，晚期方与 isotonic bunching 叠加成患。

## Evidence

源 feature export：`/tmp/cov12-20260422T162939Z/features.csv`  
向量 / label：`/tmp/cov12-20260422T162939Z/dataset_dump.json`  
weights / calibration：`/tmp/cov12-20260422T162939Z/cov12.json`

| Ablation | Masked Feature(s) | ROC-AUC | Brier | ECE | Overload | Threshold@Budget | Tie@Threshold | Spill | Mean abs dProb vs none |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| none | none | 0.7769 | 0.1343 | 0.0001 | 1.0616 | 0.3792 | 2764 | 1953 | 0.0000 |
| TT interaction only | `tt1tt2ExamCompoundRiskScaled` | 0.7755 | 0.1348 | 0.0098 | 1.0414 | 0.3234 | 1453 | 1313 | 0.0098 |
| coursework interaction only | `courseworkCompoundRiskScaled` | 0.7755 | 0.1347 | 0.0067 | 1.0141 | 0.3792 | 2256 | 448 | 0.0068 |
| stage × TT only | `stagePostTt2TtCompoundInteractionScaled` | 0.7768 | 0.1343 | 0.0005 | 1.0586 | 0.3792 | 2751 | 1855 | 0.0005 |
| stage × coursework only | `stagePostAssignmentsCourseworkInteractionScaled` | 0.7767 | 0.1343 | 0.0008 | 1.0569 | 0.3792 | 2720 | 1801 | 0.0008 |
| all | all 5 interaction terms | 0.7745 | 0.1353 | 0.0189 | 1.0039 | 0.3138 | 669 | 123 | 0.0189 |

补证：若仅灭 auth prompt所指名四项，而保 `attendanceTrendCompoundRiskScaled`，则 `ROC-AUC 0.7748 / Brier 0.1352 / ECE 0.0170 / overload 1.0163 / tie@budget 656 / spill 516`。是知 `attendanceTrendCompoundRiskScaled` 对 `all` 之余量改善约再去 `0.0124` overload。

源 feature export：`/tmp/cov12-20260422T162939Z/features.csv`  
向量 / label：`/tmp/cov12-20260422T162939Z/dataset_dump.json`  
weights / calibration：`/tmp/cov12-20260422T162939Z/cov12.json`

| Ablation | Local-ECE@0.4 | Support@0.4 | Local-ECE@0.85 | Support@0.85 |
| --- | ---: | ---: | ---: | ---: |
| none | 0.0000 | 22181 | 0.0029 | 278 |
| TT interaction only | 0.0043 | 21239 | 0.0122 | 196 |
| coursework interaction only | 0.0023 | 21496 | 0.0007 | 242 |
| stage × TT only | 0.0001 | 22140 | 0.0041 | 276 |
| stage × coursework only | 0.0006 | 22112 | 0.0074 | 271 |
| all | 0.0080 | 20535 | 0.0238 | 154 |

读法：baseline `none` 之 local-ECE 近零，尤 `0.85` 窗仅 `0.0029`，而 overload 仍 `1.0616`。故“local miscalibration 单因论”不立；主因仍为 tied mass 过厚。

源 feature export：`/tmp/cov12-20260422T162939Z/features.csv`  
向量 / label：`/tmp/cov12-20260422T162939Z/dataset_dump.json`  
weights / calibration：`/tmp/cov12-20260422T162939Z/cov12.json`

| Stage | Baseline ECE | Baseline Overload | Threshold@Budget | Tie@Threshold | Spill | all-off Overload |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| pre-tt1 | 0.0186 | 1.0232 | 0.3138 | 160 | 147 | 1.0398 |
| post-tt1 | 0.0024 | 1.0402 | 0.3792 | 596 | 255 | 1.1443 |
| post-tt2 | 0.0057 | 1.0715 | 0.3792 | 492 | 453 | 1.0161 |
| post-assignments | 0.0081 | 1.0133 | 0.3801 | 105 | 84 | 1.0147 |
| post-see | 0.0090 | 1.0819 | 0.3931 | 1766 | 519 | 1.0041 |

补读：

- `stage × TT only` 仅真动 `post-tt2`，其 overload delta `-0.0155`；余 stage 近零。
- `stage × coursework only` 仅真动 `post-assignments`，其 overload delta `-0.0095`；余 stage 近零。
- `TT interaction only` 与 `coursework interaction only` 虽于全局各降 overload，然二者皆把 `pre-tt1` overload 推高至 `1.0892` / `1.0994`；说明其修晚期 bunching 之时，亦在前期损分层。

## Next-Steps Hypotheses

1. 首因当为 `isotonic` calibration 之 step-mass；interaction 乃放大器。若保 feature 不变，仅改 `beta` / `sigmoid` calibrator，budget 边界 ties 当大幅缩。
2. 若须先碰 feature，优先查 `courseworkCompoundRiskScaled`、`tt1tt2ExamCompoundRiskScaled`、`attendanceTrendCompoundRiskScaled`；两项 stage-gated term 非主因，不宜先砍。
3. `post-see` 与 `post-tt2` 应另看 late-stage calibration / rebin；其 overload 峰远高于 `pre-tt1`，而 `pre-tt1` 之痛点更像 calibration drift 非 overload drift。
4. `post-tt1` 不宜 blanket 去 interaction；`all-off` 于此 stage 反致 `1.1443` overload，示该 stage 仍赖 interaction 维持排序张力。
5. 下轮宜正式补算单项 `attendanceTrendCompoundRiskScaled` ablation；今轮 ad hoc 旁证已示其不可忽。

## Recommendations

- 本轮不改 threshold，不改源码，不作 promotion / demotion 结论。
- 待可重跑 DB-backed eval 时，以同口径复现于 `coverage-24` 乃至 `manifest-64` held-out export；优先验证“isotonic bunching 为首因”是否仍立。
- 若只准一项离线实验，先做“same logits, alternate calibrator”而非“all interactions off”；后者虽压 overload，却同步伤 `ROC-AUC`、`Brier`、`ECE`。
- 若只准一项 feature 实验，先做 targeted shrink / cap 于 `courseworkCompoundRiskScaled` 与 `tt1tt2ExamCompoundRiskScaled`，并单补 `attendanceTrendCompoundRiskScaled`；勿先删 stage × 项。
- 若需 stage 化处置，先收 `post-see` / `post-tt2` 之 late-stage tie cluster；`pre-tt1` 则另以 calibration drift 视之。
