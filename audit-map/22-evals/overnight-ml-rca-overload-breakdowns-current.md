# Overnight ML RCA: overload by stage / semester / scenario family

## Inputs

- 依 frozen appendix 行事。authority prompt path 于 tracked corpus 缺失，故今轮只据现存 artifact 与代码口径，不改阈值、不改模型源。证：`audit-map/14-reconciliation/final-decision-appendix.md:5-11`
- 工作树现行 `air-mentor-api/output/proof-risk-model/evaluation-report.md` 之 `current-v6` overload 仅 `1.0012`，非本题所指 `1.1127` corpus。故 RCA 改取 retained coverage-24 v7 artifact：`/home/raed/projects/air-mentor-ui/air-mentor-api/output/proof-risk-model-runs/airmentor-proof-risk-coverage-24-v7-20260420T184234Z/airmentor-proof-risk-coverage-24-v7-20260420T184234Z.{md,json}`，并辅以 guarded-router 对照 artifact。证：`air-mentor-api/output/proof-risk-model/evaluation-report.md:51-57`, `/home/raed/projects/air-mentor-ui/air-mentor-api/output/proof-risk-model-runs/airmentor-proof-risk-coverage-24-v7-20260420T184234Z/airmentor-proof-risk-coverage-24-v7-20260420T184234Z.md:54-56`, `/home/raed/projects/air-mentor-ui/air-mentor-api/output/proof-risk-model-runs/20260420T110826Z-coverage-24-guarded-router/evaluation-report.md:54-56`
- retained feature export path 为 `/home/raed/projects/air-mentor-ui/air-mentor-api/output/proof-risk-model-runs/airmentor-proof-risk-coverage-24-v7-20260420T184234Z/dataset_dump.json`。其 row schema 仅见 `features,labelMask,split,stageId`；无 `semesterNumber`、无 `scenarioFamily`。是故今可严证者，为 stage overload、semester-stage queue burden、family support balance；不可自 retained export 直还原 exact `stage × semester × scenario family` overload cube。证：`/home/raed/projects/air-mentor-ui/air-mentor-api/output/proof-risk-model-runs/airmentor-proof-risk-coverage-24-v7-20260420T184234Z/dataset_dump.json:1`
- v7 corpus 本体：24 governed runs、518400 rows、8 scenario families；各 family 各 3 runs、64800 rows，support 全平。证：`/home/raed/projects/air-mentor-ui/air-mentor-api/output/proof-risk-model-runs/airmentor-proof-risk-coverage-24-v7-20260420T184234Z/airmentor-proof-risk-coverage-24-v7-20260420T184234Z.md:7-22`, `/home/raed/projects/air-mentor-ui/air-mentor-api/output/proof-risk-model-runs/airmentor-proof-risk-coverage-24-v7-20260420T184234Z/airmentor-proof-risk-coverage-24-v7-20260420T184234Z.json:101-135`
- family roster 由 manifest 固定轮转：`balanced`, `weak-foundation`, `low-attendance`, `high-forgetting`, `coursework-inflation`, `exam-fragility`, `carryover-heavy`, `intervention-resistant`。代码注释亦直记“Fixes v7 overload=1.1127”。证：`air-mentor-api/src/lib/proof-risk-model.ts:76-85`, `air-mentor-api/src/lib/proof-risk-model.ts:132-143`, `air-mentor-api/src/lib/proof-risk-model.ts:156-163`
- overload 口径 = `flaggedRateAtBudget / budgetRate`；queue burden 口径依 stage 聚合后取 mean/p95/open/watch/threshold。queue cap：常规 `0.30`，`post-see` 为 `0.35`，watch gate `0.45`。证：`air-mentor-api/scripts/evaluate-proof-risk-model.ts:447-505`, `air-mentor-api/scripts/evaluate-proof-risk-model.ts:645-680`, `air-mentor-api/src/lib/proof-queue-governance.ts:1-7`, `air-mentor-api/src/lib/proof-queue-governance.ts:82-95`

## Findings

- retained coverage-24 v7 artifact 之全局 overload 为 `1.1127`。证：`/home/raed/projects/air-mentor-ui/air-mentor-api/output/proof-risk-model-runs/airmentor-proof-risk-coverage-24-v7-20260420T184234Z/airmentor-proof-risk-coverage-24-v7-20260420T184234Z.md:92-100`
- stage 维度最重者非 `post-see`，而是 `post-assignments 1.0913`，继而 `pre-tt1 1.0667`、`post-tt1 1.0664`、`post-tt2 1.0625`，`post-see 1.0318` 反较低。此示 overload 主因偏向 mid/late decision edge 之 budget spill，而非 final-stage 独占。证：`/home/raed/projects/air-mentor-ui/air-mentor-api/output/proof-risk-model-runs/airmentor-proof-risk-coverage-24-v7-20260420T184234Z/airmentor-proof-risk-coverage-24-v7-20260420T184234Z.json:266269-266296`, `/home/raed/projects/air-mentor-ui/air-mentor-api/output/proof-risk-model-runs/airmentor-proof-risk-coverage-24-v7-20260420T184234Z/airmentor-proof-risk-coverage-24-v7-20260420T184234Z.json:266393-266420`, `/home/raed/projects/air-mentor-ui/air-mentor-api/output/proof-risk-model-runs/airmentor-proof-risk-coverage-24-v7-20260420T184234Z/airmentor-proof-risk-coverage-24-v7-20260420T184234Z.json:266206-266235`, `/home/raed/projects/air-mentor-ui/air-mentor-api/output/proof-risk-model-runs/airmentor-proof-risk-coverage-24-v7-20260420T184234Z/airmentor-proof-risk-coverage-24-v7-20260420T184234Z.json:266331-266358`, `/home/raed/projects/air-mentor-ui/air-mentor-api/output/proof-risk-model-runs/airmentor-proof-risk-coverage-24-v7-20260420T184234Z/airmentor-proof-risk-coverage-24-v7-20260420T184234Z.json:266455-266482`
- semester-stage 容量压强最热者为全体 `post-see` cells：`sem1..6` mean open `0.3354..0.3455` 对 cap `0.35`，即约 `95.8%..98.7%` 满载；其次为高 semester 之 `post-tt1/post-tt2/post-assignments`，皆贴 `0.30` cap。watch gate 全局失败，示队列虽未越 cap，旁路 watch 仍偏高。证：`/home/raed/projects/air-mentor-ui/air-mentor-api/output/proof-risk-model-runs/airmentor-proof-risk-coverage-24-v7-20260420T184234Z/airmentor-proof-risk-coverage-24-v7-20260420T184234Z.md:151-186`
- family support 完全均衡，故全局 `1.1127` 非由某 single family 之样本量偏置所拖；然 retained export 无 family-aware overload slice，故“最坏 scenario family”今轮仅可提 support-level 结论，不可伪造 exact overload 排名。证：`/home/raed/projects/air-mentor-ui/air-mentor-api/output/proof-risk-model-runs/airmentor-proof-risk-coverage-24-v7-20260420T184234Z/airmentor-proof-risk-coverage-24-v7-20260420T184234Z.json:101-135`, `/home/raed/projects/air-mentor-ui/air-mentor-api/output/proof-risk-model-runs/airmentor-proof-risk-coverage-24-v7-20260420T184234Z/dataset_dump.json:1`
- guarded-router 将全局 overload 压至 `1.0042`，然残余 spill 改聚于 `post-see 1.0923` 与 `pre-tt1 1.0755`；即总体解压，局部迁移。后续若再做 calibration/threshold，不宜只看总量。证：`/home/raed/projects/air-mentor-ui/air-mentor-api/output/proof-risk-model-runs/20260420T110826Z-coverage-24-guarded-router/evaluation-report.md:92-100`, `/home/raed/projects/air-mentor-ui/air-mentor-api/output/proof-risk-model-runs/20260420T110826Z-coverage-24-guarded-router/evaluation-report.json:250420-250447`, `/home/raed/projects/air-mentor-ui/air-mentor-api/output/proof-risk-model-runs/20260420T110826Z-coverage-24-guarded-router/evaluation-report.json:250482-250509`

## Evidence

表 A。输入 feature export：`/home/raed/projects/air-mentor-ui/air-mentor-api/output/proof-risk-model-runs/airmentor-proof-risk-coverage-24-v7-20260420T184234Z/dataset_dump.json`

| Slice | v7 Overload | Guarded-Router Overload | 义 |
| --- | --- | --- | --- |
| overall | 1.1127 | 1.0042 | 全局解压 `-0.1085` |
| post-assignments | 1.0913 | 1.0240 | 主 spill 明降，仍高于 1 |
| pre-tt1 | 1.0667 | 1.0755 | 反上移，示早期 residual spill |
| post-tt1 | 1.0664 | 1.0013 | 近乎压平 |
| post-tt2 | 1.0625 | 1.0048 | 近乎压平 |
| post-see | 1.0318 | 1.0923 | spill 迁往 final stage |

证：v7 overall `/home/raed/projects/air-mentor-ui/air-mentor-api/output/proof-risk-model-runs/airmentor-proof-risk-coverage-24-v7-20260420T184234Z/airmentor-proof-risk-coverage-24-v7-20260420T184234Z.md:92-100`, v7 stage `/home/raed/projects/air-mentor-ui/air-mentor-api/output/proof-risk-model-runs/airmentor-proof-risk-coverage-24-v7-20260420T184234Z/airmentor-proof-risk-coverage-24-v7-20260420T184234Z.json:266206-266235`, `/home/raed/projects/air-mentor-ui/air-mentor-api/output/proof-risk-model-runs/airmentor-proof-risk-coverage-24-v7-20260420T184234Z/airmentor-proof-risk-coverage-24-v7-20260420T184234Z.json:266269-266358`, `/home/raed/projects/air-mentor-ui/air-mentor-api/output/proof-risk-model-runs/airmentor-proof-risk-coverage-24-v7-20260420T184234Z/airmentor-proof-risk-coverage-24-v7-20260420T184234Z.json:266393-266420`, `/home/raed/projects/air-mentor-ui/air-mentor-api/output/proof-risk-model-runs/airmentor-proof-risk-coverage-24-v7-20260420T184234Z/airmentor-proof-risk-coverage-24-v7-20260420T184234Z.json:266455-266482`; guarded overall `/home/raed/projects/air-mentor-ui/air-mentor-api/output/proof-risk-model-runs/20260420T110826Z-coverage-24-guarded-router/evaluation-report.md:92-100`, guarded stage `/home/raed/projects/air-mentor-ui/air-mentor-api/output/proof-risk-model-runs/20260420T110826Z-coverage-24-guarded-router/evaluation-report.json:250233-250262`, `/home/raed/projects/air-mentor-ui/air-mentor-api/output/proof-risk-model-runs/20260420T110826Z-coverage-24-guarded-router/evaluation-report.json:250296-250385`, `/home/raed/projects/air-mentor-ui/air-mentor-api/output/proof-risk-model-runs/20260420T110826Z-coverage-24-guarded-router/evaluation-report.json:250420-250447`, `/home/raed/projects/air-mentor-ui/air-mentor-api/output/proof-risk-model-runs/20260420T110826Z-coverage-24-guarded-router/evaluation-report.json:250482-250509`

表 B。输入 feature export：`/home/raed/projects/air-mentor-ui/air-mentor-api/output/proof-risk-model-runs/airmentor-proof-risk-coverage-24-v7-20260420T184234Z/dataset_dump.json`

| Semester | Stage | Mean Open | Threshold | Cap Use | Mean Watch | P95 Watch |
| --- | --- | --- | --- | --- | --- | --- |
| 6 | post-see | 0.3455 | 0.35 | 98.7% | 0.0674 | 0.35 |
| 4 | post-see | 0.3451 | 0.35 | 98.6% | 0.0573 | 0.30 |
| 5 | post-see | 0.3448 | 0.35 | 98.5% | 0.0625 | 0.3583 |
| 3 | post-see | 0.3431 | 0.35 | 98.0% | 0.0656 | 0.35 |
| 2 | post-see | 0.3382 | 0.35 | 96.6% | 0.0573 | 0.30 |
| 1 | post-see | 0.3354 | 0.35 | 95.8% | 0.0563 | 0.3167 |
| 6 | post-tt1 | 0.2990 | 0.30 | 99.7% | 0.0833 | 0.4333 |
| 6 | post-tt2 | 0.2976 | 0.30 | 99.2% | 0.0889 | 0.4833 |
| 6 | post-assignments | 0.2976 | 0.30 | 99.2% | 0.0931 | 0.4917 |

证：`/home/raed/projects/air-mentor-ui/air-mentor-api/output/proof-risk-model-runs/airmentor-proof-risk-coverage-24-v7-20260420T184234Z/airmentor-proof-risk-coverage-24-v7-20260420T184234Z.md:151-186`, `air-mentor-api/src/lib/proof-queue-governance.ts:1-7`, `air-mentor-api/src/lib/proof-queue-governance.ts:82-95`

表 C。输入 feature export：`/home/raed/projects/air-mentor-ui/air-mentor-api/output/proof-risk-model-runs/airmentor-proof-risk-coverage-24-v7-20260420T184234Z/dataset_dump.json`

| Scenario Family | Runs | Rows | 义 |
| --- | --- | --- | --- |
| balanced | 3 | 64800 | support 平 |
| weak-foundation | 3 | 64800 | support 平 |
| low-attendance | 3 | 64800 | support 平 |
| high-forgetting | 3 | 64800 | support 平 |
| coursework-inflation | 3 | 64800 | support 平 |
| exam-fragility | 3 | 64800 | support 平 |
| carryover-heavy | 3 | 64800 | support 平 |
| intervention-resistant | 3 | 64800 | support 平 |

证：`/home/raed/projects/air-mentor-ui/air-mentor-api/output/proof-risk-model-runs/airmentor-proof-risk-coverage-24-v7-20260420T184234Z/airmentor-proof-risk-coverage-24-v7-20260420T184234Z.json:101-135`, `air-mentor-api/src/lib/proof-risk-model.ts:76-85`, `air-mentor-api/src/lib/proof-risk-model.ts:156-163`

表 D。输入 feature export：`/home/raed/projects/air-mentor-ui/air-mentor-api/output/proof-risk-model-runs/airmentor-proof-risk-coverage-24-v7-20260420T184234Z/dataset_dump.json`

| Retained Export | Present Keys | Missing Keys | RCA Impact |
| --- | --- | --- | --- |
| `dataset_dump.json` row | `features,labelMask,split,stageId` | `semesterNumber,scenarioFamily` | exact `stage × semester × family` overload cell 不可复原 |

证：`/home/raed/projects/air-mentor-ui/air-mentor-api/output/proof-risk-model-runs/airmentor-proof-risk-coverage-24-v7-20260420T184234Z/dataset_dump.json:1`

## Next-Steps Hypotheses

- `H1`: 主过载更像 stage-budget pinch，非 family volume skew。support 既平，而 `post-assignments/pre-tt1/post-tt1/post-tt2` 同列 `>1.06`，宜先查 budget edge 附近之 score bunching。
- `H2`: late-sem `post-see` cells 几尽满载，然 stage overload 仅 `1.0318`。此示运营 cap 热点与 overload 热点并非同一层；未来若只盯 overload，易漏真实 queue pain。
- `H3`: guarded-router 证“总量降，局部移”。若后续 calibration 只做 global fix，恐把 spill 由 `post-assignments` 推去 `post-see/pre-tt1`，仍伤一线容量。
- `H4`: family RCA 之真缺口在 retention。无 `semesterNumber` 与 `scenarioFamily` 同行保留，则任何 exact family-overload 排名皆不足证。

## Recommendations

- 今轮维持 read-only。勿改 threshold，勿改 model source。
- 若后续重开 calibration/threshold work，先瞄 `post-assignments`、`pre-tt1`、late-sem `post-see` 三簇；彼等分别代表 overload 主因、early-stage spill、capacity 主痛点。
- evaluator retention 须补可复算 slice 之 export：至少保留 `semesterNumber`、`scenarioFamily`，最好另留 row-level `stage_key` CSV/Parquet，而非仅 minified `dataset_dump.json`。
- retained JSON 宜新增 `overallCourseVariantSummaryBySemester` 与 `overallCourseVariantSummaryByScenarioFamily`；否则每次 RCA 皆须绕报表旁证，不能直读 exact slice。
- 下轮诊断 gate 不宜仅看 `overloadRatio`。须并看 `mean_open / threshold` 与 `watchRatesWithinLimit`，方能分清“模型 spill”与“运营已满”。
