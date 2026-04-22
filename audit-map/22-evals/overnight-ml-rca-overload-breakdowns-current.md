# Overnight ML RCA: overload by stage / semester / scenario family

## Inputs

- 主 raw export：`/tmp/cov12-20260422T162939Z/features.csv`。其路径由 evaluator 日志明示；列仅含 `run_id, split, stage_key, scenario_family, labels, feat_*`，未含 `semesterNumber`。证：`air-mentor-api/output/proof-risk-model/retrain-coverage12-20260422T162939Z/eval.log:140-142`, `air-mentor-api/scripts/evaluate-proof-risk-model.ts:1456-1516`
- 同源 artifact：`/tmp/cov12-20260422T162939Z/cov12.json`。现势 corpus 为 `158400` validation rows、`0` test rows；scenario family 覆 `8` 家族，然 raw export 实际保留 `4` validation runs。证：`/tmp/cov12-20260422T162939Z/cov12.json:49-80`
- 同源 queue/cap 报表：`/tmp/cov12-20260422T162939Z/cov12.md`。其 `Queue Burden` 与 `Queue Burden Diagnostic Cross-Run Union` 提 sem×stage 之 mean-open / union-open / threshold / section-max。证：`/tmp/cov12-20260422T162939Z/cov12.md:141-209`
- 重评分口径：以 `cov12.json` 内 active `overallCourseRisk` head 之 `intercept + weights + isotonic calibration` 对 `features.csv` 逐行复算 prob，再按 evaluator 公式 `flaggedRateAtBudget / 0.20` 得 overload。证：`/tmp/cov12-20260422T162939Z/cov12.json:107649-107714`
- 家族语义旁证：`weak-foundation` 主 prerequisite weakness，`low-attendance` 主 attendance drag，`high-forgetting` 于 TT2/SEE 放大。证：`audit-map/32-reports/simulation-flow-analysis-2026-04-19.md:53-66`
- 限制：raw export 缺 `semesterNumber`。故今可严证之，仅 `semester × stage` 的 queue-open / capacity / section-max，及 `stage × scenario_family` 的 overload；full `semester × stage × family` cube 仍须新 export 列或 sidecar join file。

## Findings

- 晚阶段运营面已近满：`sem2-6` 之 `post-tt1/post-tt2/post-assignments` mean open 基本贴 `0.30` cap；`post-see` 几乎全 sem 贴 `0.35` cap。最应先盯之簇为 `post-see` 全 sem，与 `sem4-6 post-tt2`、`sem6 post-tt1/post-assignments`。
- overload 主聚两族：`weak-foundation` 与 `low-attendance`。其最坏 cell 分别为 `weak-foundation × post-tt2 = 1.3220`, `weak-foundation × post-tt1 = 1.2620`, `low-attendance × post-see = 1.2494`, `low-attendance × post-assignments = 1.1900`, `low-attendance × post-tt2 = 1.1490`。
- `pre-tt1` 呈“队列未开而分数已挤”之相：same export 上 overall `pre-tt1 overload = 1.0232`，但 sem×stage queue-open 皆 `0`；同时 `sem2-6 pre-tt1` union watch 近满 (`0.975-1.0`)。是故 pre-tt1 风险更像 score bunching / watch-only accumulation，非真实 open-case overload。
- 家族总账同指向：`weak-foundation = 1.2942` 远高于 `low-attendance = 1.1197`, `high-forgetting = 1.0891`, `balanced = 1.0504`。若后续仅做全局校准，极易由 prerequisite-dominant 切片拖坏 late-stage demo。
- 现势证据不支撑“先加阈值”叙事。多 sem-stage cell 已先被 capacity 顶满；故下一轮应先减 tied-mass / slice skew，而非再放开 queue。

## Evidence

表 A：`semester × stage` queue-opening / capacity pressure（同源输入 feature export：`/tmp/cov12-20260422T162939Z/features.csv`；queue/cap 数出自 `/tmp/cov12-20260422T162939Z/cov12.md:141-209`；`stage_overload_ratio` 由同源 export + `/tmp/cov12-20260422T162939Z/cov12.json:107649-107714` 复算）

| Semester | Stage | Mean Open | Capacity | Union Open | Section Max | Stage Overload Ratio | Pressure Index |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 6 | post-see | 0.35 | 0.35 | 0.9917 | 1.0000 | 1.0819 | 1.0819 |
| 5 | post-see | 0.35 | 0.35 | 0.9833 | 0.9833 | 1.0819 | 1.0819 |
| 4 | post-see | 0.35 | 0.35 | 1.0000 | 1.0000 | 1.0819 | 1.0819 |
| 6 | post-tt2 | 0.30 | 0.30 | 1.0000 | 1.0000 | 1.0715 | 1.0715 |
| 5 | post-tt2 | 0.30 | 0.30 | 0.9833 | 0.9833 | 1.0715 | 1.0715 |
| 4 | post-tt2 | 0.30 | 0.30 | 0.9917 | 1.0000 | 1.0715 | 1.0715 |
| 6 | post-tt1 | 0.30 | 0.30 | 1.0000 | 1.0000 | 1.0402 | 1.0402 |
| 6 | post-assignments | 0.30 | 0.30 | 0.9917 | 1.0000 | 1.0133 | 1.0133 |

注：`Pressure Index = (mean_open / capacity) × stage_overload_ratio`；`union_open` 仅作“跨 run 触达面”旁证，不是单次运营压强。

表 B：`stage × scenario_family` overload（输入 feature export：`/tmp/cov12-20260422T162939Z/features.csv`；重评分 artifact：`/tmp/cov12-20260422T162939Z/cov12.json:107649-107714`）

| Stage | Scenario Family | Support | Positive Rate | Flagged@Budget | Precision@Budget | Overload Ratio |
| --- | --- | --- | --- | --- | --- | --- |
| post-tt2 | weak-foundation | 7920 | 0.2775 | 0.2644 | 0.5124 | 1.3220 |
| post-tt1 | weak-foundation | 7920 | 0.2775 | 0.2524 | 0.5038 | 1.2620 |
| post-see | low-attendance | 7920 | 0.2098 | 0.2499 | 0.4689 | 1.2494 |
| post-assignments | low-attendance | 7920 | 0.2098 | 0.2380 | 0.4578 | 1.1900 |
| post-tt2 | low-attendance | 7920 | 0.2098 | 0.2298 | 0.4610 | 1.1490 |
| post-assignments | high-forgetting | 7920 | 0.1711 | 0.2210 | 0.3971 | 1.1048 |
| pre-tt1 | low-attendance | 7920 | 0.2098 | 0.2202 | 0.4524 | 1.1010 |
| pre-tt1 | balanced | 7920 | 0.1412 | 0.2201 | 0.3437 | 1.1004 |

表 C：family 总账（输入 feature export：`/tmp/cov12-20260422T162939Z/features.csv`；重评分 artifact：`/tmp/cov12-20260422T162939Z/cov12.json:107649-107714`）

| Scenario Family | Support | Positive Rate | Flagged@Budget | Precision@Budget | Overload Ratio |
| --- | --- | --- | --- | --- | --- |
| weak-foundation | 39600 | 0.2775 | 0.2588 | 0.5101 | 1.2942 |
| low-attendance | 39600 | 0.2098 | 0.2239 | 0.4578 | 1.1197 |
| high-forgetting | 39600 | 0.1711 | 0.2178 | 0.3920 | 1.0891 |
| balanced | 39600 | 0.1412 | 0.2101 | 0.3573 | 1.0504 |

表 D：stage 总账（输入 feature export：`/tmp/cov12-20260422T162939Z/features.csv`；重评分 artifact：`/tmp/cov12-20260422T162939Z/cov12.json:107649-107714`）

| Stage | Support | Flagged@Budget | Precision@Budget | Overload Ratio |
| --- | --- | --- | --- | --- |
| post-see | 31680 | 0.2164 | 0.4740 | 1.0819 |
| post-tt2 | 31680 | 0.2143 | 0.4551 | 1.0715 |
| post-tt1 | 31680 | 0.2080 | 0.4483 | 1.0402 |
| pre-tt1 | 31680 | 0.2046 | 0.4362 | 1.0232 |
| post-assignments | 31680 | 0.2027 | 0.4623 | 1.0133 |

## Next-Steps Hypotheses

- `H1`: `weak-foundation × post-tt1/post-tt2` 乃 first fix slice。其 prerequisite chain 特征与 family prior 同向，易在 budget 边界形成 tied mass。先看此 slice 之 score histogram / local reliability，优先于全局 retune。
- `H2`: `low-attendance × post-see/post-assignments` 为次主因。晚阶段 capacity 已贴顶，而该族 overload 仍高，示意 attendance drag 于 late-stage 被 SEE/assignment 信号放大。若仅调全局阈，恐只把 saturated cell 更早推满。
- `H3`: `pre-tt1` 应拆“watch saturation”与“open saturation”。今证 queue-open 为 `0`，但 overload 仍 `>1`。后续校准若能降 `pre-tt1` overload 而不增 open-rate，方算真消 tie-bunching。
- `H4`: t48 真正缺口非公式，乃 export 粒度。无 `semesterNumber` 入 raw export，则 family overload 与 sem queue 只能分表，不能还原 full cube；下一轮应先补数据面。

## Recommendations

- 今轮不调任何 threshold；下轮 calibration / threshold work 先锁 `weak-foundation × post-tt2`, `weak-foundation × post-tt1`, `low-attendance × post-see`, `low-attendance × post-assignments`, 以及 `pre-tt1` watch-only slice。
- evaluator feature export 须补 `semesterNumber`，最好并补 `openQueueFlag`, `watchFlag`, `sectionCode`。若不补，`stage × semester × family` 仍只能分裂成两张旁证表。
- 之后 gate 不宜只看 `overloadRatio`。应并看 `mean_open/capacity` 与 `union_open/capacity`；否则会把“模型 tie 问题”与“运营已满问题”混成一账。
- `post-see` 与 `post-tt2` 宜先做 slice-local calibration 复盘；二者已是 same-export 上最高 stage overload，且 late-sem queue 几近满载。
- `pre-tt1` 宜做单独 histogram / local-reliability pass；此处若继续沿用全局结论，易把 watch-only rows 误判成真实 queue overload。
