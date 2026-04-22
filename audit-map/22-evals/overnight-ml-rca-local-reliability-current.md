# Overnight ML RCA: local reliability at 0.4 and 0.85

## Inputs

- authority caveat：命名 prompt `audit-map/20-prompts/fresh-sem1-principal-architect-overnight-pass.md` 于 tracked corpus 缺；今循 frozen appendix、implementation plan、ML boundaries、现存 eval artifact 行事；不改 threshold，不促 model。  
- current scoring artifact：`air-mentor-api/output/proof-risk-model/evaluation-report.json`；其 active threshold 仍 `medium=0.4`、`high=0.85`。  
- retained input feature export path：`/home/raed/projects/air-mentor-ui/air-mentor-api/output/proof-risk-model/features.csv`。此 CSV 含 `split,stage_key,label_overall,feat_0..feat_38`；今只取 `split=test`，以对齐 retained report `support=21600`。  
- derived summary：`audit-map/22-evals/data/overnight-ml-rca-local-reliability-current-summary.json`。其以 current-v6 active artifact 之 `overallCourseRisk` 权重与 `isotonic` 校准，重分 retained feature CSV；校验得 `Brier=0.1216` 与 report 全同，`global ECE=0.0191` 对 report `0.0195`，误差 `0.0004`，足供 local-window RCA。  
- stage-id caveat：retained CSV 之 `stage_key` 为 numeric id；今据 feat one-hot `feat_26..30` 反解：`0=post-tt2`、`1=post-assignments`、`2=pre-tt1`、`3=post-see`、`4=post-tt1`。  

## Findings

- `0.4` window 乃今轮主症。overall `support=3255`，`mean_pred=0.4016`，`observed_fail=0.4565`，`local ECE=0.0550`；较 retained global `ECE=0.0195` 高约 `2.8x`，示 medium gate 近阈显著低估。  
- 最坏 stage 为 `post-see`。其 `0.4` window `support=788`，`mean_pred=0.3961`，`observed_fail=0.4734`，`local ECE=0.0772`；亦为 retained stage-global ECE 最坏者 `0.0368`。  
- `post-tt1` 与 `post-assignments` 于 `0.4` window 较轻，然仍失配：`0.0440`、`0.0435`；无一 stage 近 `0.4` window 低于 `0.04`。  
- `0.85` window 支撑极薄。overall 仅 `10` row 落 `0.80..0.90`；`pre-tt1` 为 `0`，`post-tt2` 为 `1`，`post-assignments` 为 `2`，`post-tt1` 为 `3`，`post-see` 为 `4`。此窗足供示警，不足供稳健校准结论。  
- 高阈真越线集中后段：`>0.85` 计数仅见 `post-tt2=3`、`post-assignments=3`、`post-see=5`；`pre-tt1/post-tt1` 皆 `0`。是故高风险边界问题偏晚段稀薄尾部，非早段普遍溢出。  
- 今轮无 threshold-change 依据。若据 `0.85` 小样本躁动而动阈，噪声大于信号；可执行结论仅在 `0.4` 邻域之系统性低估。  

## Evidence

表 A。input feature export：`/home/raed/projects/air-mentor-ui/air-mentor-api/output/proof-risk-model/features.csv`。scoring artifact：`air-mentor-api/output/proof-risk-model/evaluation-report.json`。derived rows：`audit-map/22-evals/data/overnight-ml-rca-local-reliability-current-summary.json`。

| Threshold | Support (±0.05) | Mean Pred | Observed Fail | Local ECE | Read |
| --- | --- | --- | --- | --- | --- |
| `0.4` | 3255 | 0.4016 | 0.4565 | 0.0550 | medium gate 近阈低估 |
| `0.85` | 10 | 0.8133 | 0.8000 | 0.0133 | window 过薄，不宜作独立调阈证 |

表 B。input feature export：`/home/raed/projects/air-mentor-ui/air-mentor-api/output/proof-risk-model/features.csv`。derived rows：`audit-map/22-evals/data/overnight-ml-rca-local-reliability-current-summary.json`。retained stage-global ECE：`air-mentor-api/output/proof-risk-model/evaluation-report.json`。

| Stage | Support@0.4 | Mean Pred | Observed Fail | Local ECE@0.4 | Retained Global ECE |
| --- | --- | --- | --- | --- | --- |
| `pre-tt1` | 602 | 0.4060 | 0.4585 | 0.0524 | 0.0313 |
| `post-tt1` | 646 | 0.4018 | 0.4458 | 0.0440 | 0.0204 |
| `post-tt2` | 611 | 0.4032 | 0.4550 | 0.0518 | 0.0269 |
| `post-assignments` | 608 | 0.4022 | 0.4457 | 0.0435 | 0.0269 |
| `post-see` | 788 | 0.3961 | 0.4734 | 0.0772 | 0.0368 |

表 C。input feature export：`/home/raed/projects/air-mentor-ui/air-mentor-api/output/proof-risk-model/features.csv`。derived rows：`audit-map/22-evals/data/overnight-ml-rca-local-reliability-current-summary.json`。

| Stage | Support@0.85 | Mean Pred | Observed Fail | Local ECE@0.85 | `>0.85` Count |
| --- | --- | --- | --- | --- | --- |
| `pre-tt1` | 0 | 0.0000 | 0.0000 | 0.0000 | 0 |
| `post-tt1` | 3 | 0.8222 | 1.0000 | 0.1778 | 0 |
| `post-tt2` | 1 | 0.8000 | 1.0000 | 0.2000 | 3 |
| `post-assignments` | 2 | 0.8167 | 1.0000 | 0.1833 | 3 |
| `post-see` | 4 | 0.8083 | 0.5000 | 0.3083 | 5 |

表 D。input feature export：`/home/raed/projects/air-mentor-ui/air-mentor-api/output/proof-risk-model/features.csv`。derived rows：`audit-map/22-evals/data/overnight-ml-rca-local-reliability-current-summary.json`。

| Check | Value |
| --- | --- |
| test rows scored | 21600 |
| reconstructed Brier | 0.1216 |
| retained report Brier | 0.1216 |
| reconstructed global ECE | 0.0191 |
| retained report global ECE | 0.0195 |
| inference | retained feature CSV + current-v6 artifact 足够复现 overall score shape；故 local-window RCA 可采 |

证摘：

- `0.4` window 之失配非单一 stage 偶发；五 stage 皆 `observed_fail > mean_pred`。  
- `post-see` 既有最高 local ECE@`0.4`，亦有最多 `>0.85` 真越线量。  
- `0.85` window 内 `mean_pred` 普遍仅 `0.80..0.82`，示 near-high gate 样本多贴阈下缘；boundary density 本身即稀。  

## Next-Steps Hypotheses

- `stage-conditioned compression`：单一全局 `isotonic` 可能把 late-stage 尾部压扁；故 `post-see` 于 `0.4` 邻域最显低估。  
- `tail sparsity`：高阈附近样本太少，且多已跃至 `0.9999` 极端值，致 `0.80..0.90` window 留样过薄；今之 `0.85` RCA 更像 retention/score-shape 问题，未足成阈值动作依据。  
- `export-retention gap`：current-v6 report 于 tracked corpus 无 paired feature export；今得 retained smoke-3 CSV，虽可借 Brier/ECE 近复 overall shape，然仍应把 exact paired export 视为后续 RCA 必补件。  
- `late-stage evidence mix`：`post-see` 之 fail-rate 与 score mass 同升，或示 exam-fragility / carryover-like evidence 于 late-stage 经同一 calibrator 合桶，致 local underprediction。  

## Recommendations

- 勿改 `0.4/0.85` threshold。今可执行结论仅为：medium gate 邻域，尤 `post-see`，存在系统性低估。  
- 下一轮离线 eval 应与 report 同留 exact feature export，且把 per-stage `support/mean_pred/mean_actual/local_ece` 直写入 retained JSON/MD；免再靠 side reconstruction。  
- 若准下轮深掘，先做 `post-see` vs earlier stages 之 stage-conditioned calibration / bin retention，对照 `0.4` window；未补此证前，不宜讨论 promote 或 threshold motion。  
- 将本报与 `audit-map/22-evals/data/overnight-ml-rca-local-reliability-current-summary.json` 一并留档；`0.85` 结论须标 support-limited，供后续 agent 复核。  
