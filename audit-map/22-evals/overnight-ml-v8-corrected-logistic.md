# Overnight ML Phase 7: Corrected v8 Logistic Baseline

## Inputs

- 依 `Phase 7` 权柄：须于 `P8` 因果既明后，始以 missingness-aware contract 重训 corrected v8，并以 caller propagation 完整后之 corrected corpus 为准；若 caller 未齐，则 retrain/promote 皆止。证：`audit-map/14-reconciliation/overnight-implementation-plan.md:197-205`
- 本轮先修 evaluator 契约，未触 `src/`：control-plane import 改走 `dist`，并补 `current-v8` 动态命名、`reproducibilityManifest`、`metric sidecars`、`meta.txt`，今又补 `AIRMENTOR_EVAL_DATABASE_URL` 外部 DB fallback，俾后续可脱 `createTestApp()` 之 local listen 依赖。证：`air-mentor-api/scripts/evaluate-proof-risk-model.ts:9-13`, `air-mentor-api/scripts/evaluate-proof-risk-model.ts:24-40`, `air-mentor-api/scripts/evaluate-proof-risk-model.ts:1003-1041`, `air-mentor-api/scripts/evaluate-proof-risk-model.ts:2391-2665`
- 今席已实测三路皆阻：
  - TCP listen probe 回 `Error: listen EPERM: operation not permitted 127.0.0.1`
  - embedded-postgres 改 Unix-domain socket，仍回 `FATAL: could not create any Unix-domain sockets`
  - `/tmp/.s.PGSQL.*` 既存 socket 抽样连接皆回 `connect EPERM`
  证：`audit-map/22-evals/data/overnight-ml-v8-corrected-logistic-probes.json:1-112`
- 现存 `cov12` arte物不可充 corrected corpus：其文已自明 “does not claim v8 baseline is corrected”，且此 seed 组无 test-partition seed。证：`audit-map/32-reports/ml-retrain-catboost-20260422.md:111-113`, `audit-map/32-reports/ml-retrain-catboost-20260422.md:166-167`
- 盘上亦无 post-Phase-2 corrected arte物可援。Phase 2 完于 `2026-04-22T20:59:42Z`；可见最新 retrain dir `retrain-coverage12-20260422T162939Z` 时戳仅 `2026-04-22T17:07:22.657205474Z`，先于 Phase 2；最新 `dataset_dump.json` 亦仅 `2026-04-22T17:46:22.618074764Z`，`metric-sidecars/*` 全盘未见。证：`audit-map/22-evals/data/overnight-ml-v8-corrected-logistic-probes.json:1-112`
- 主仓 `output/proof-risk-model/evaluation-report.json` 虽于 `2026-04-23T01:52:16.7992224350` 落盘，然 payload 自陈 `generatedAt=2026-04-20T02:51:40.283Z`、`seedProfile=smoke-3`、且无 `reproducibilityManifest`；乃旧 smoke arte物之拷映，非 corrected v8 证。证：`audit-map/22-evals/data/overnight-ml-v8-corrected-logistic-probes.json:1-112`, `/home/raed/projects/air-mentor-ui/air-mentor-api/output/proof-risk-model/evaluation-report.json:1-30`

## Training

- 已成脚本层补丁，俟 listen-capable 环境即可以同一 evaluator 落：
  - `dist` control-plane import，避 source control-plane 现行 drift。
  - `AIRMENTOR_EVAL_DATABASE_URL`：若供 fresh external Postgres，可不经 embedded socket bootstrap。
  - `reproducibilityManifest`：`splitHash`、`featureKeyHash`、`corpusHash`、`replayHash`。
  - `metric sidecars`：overall / budget / local-calibration / overload-by-dimension / stability / queue-burden / reproducibility。
  - `meta.txt`：seed、git SHA、hash、sidecar path。
- 快验仅得部分：
  - runbook 直令 `tsx scripts/verify-calibration-fixes.ts` 今亦阻于 `listen EPERM ... /tmp/tsx-1002/3.pipe`；是故 sandbox 内连 fast smoke 都不可循既有 `tsx` 入口。证：`audit-map/22-evals/data/overnight-ml-v8-corrected-logistic-probes.json:1-97`
  - 改以 `node --experimental-strip-types scripts/verify-calibration-fixes.ts`，功能项 `isotonic-equivalence`、`isotonic-monotonic`、`local-ece-catches-local-miscal` 皆过；然性能闸 `isotonic-scaling-not-quadratic` 仍红，`150k/2k ratio=244.4x`，故 smoke 非全绿。证：`audit-map/22-evals/data/overnight-ml-v8-corrected-logistic-probes.json:1-97`
  - `tests/evaluate-proof-risk-model.test.ts` 仍有既存 2 红：其断言仍假设 challenger hard-route 取胜，已不合现 chooser 行为。证：`air-mentor-api/tests/evaluate-proof-risk-model.test.ts:120-121`, `air-mentor-api/tests/evaluate-proof-risk-model.test.ts:168-169`
- 正式 corrected corpus rebuild / retrain 未成。阻因非 Phase 7 逻辑回归，乃运行域既禁本地 socket，亦无 `AIRMENTOR_EVAL_DATABASE_URL` / `DATABASE_URL` / `PG*` 旁路可借。证：`audit-map/22-evals/data/overnight-ml-v8-corrected-logistic-probes.json:1-97`
- 另验 sandbox listener/host socket：`ss -ltn` 为空；`/tmp` 下虽留 `37` 个 host PG lock/socket，AF_UNIX 连接仍一律 `Operation not permitted`。是故即便宿主残留 Postgres 存在，sandbox 亦不可借。证：`audit-map/22-evals/data/overnight-ml-v8-corrected-logistic-probes.json:1-97`

## Metrics

本节只录 **admissible corrected metrics = 未得**，并列 **inadmissible prior artefact** 以防误引。

| Metric | Corrected v8 (required) | State |
| --- | --- | --- |
| ROC-AUC | `N/A` | blocked |
| PR-AUC | `N/A` | blocked |
| Brier | `N/A` | blocked |
| Global ECE | `N/A` | blocked |
| local-ECE @ 0.4 | `N/A` | blocked |
| local-ECE @ 0.85 | `N/A` | blocked |
| overload ratio | `N/A` | blocked |
| precision@budget | `N/A` | blocked |
| recall@budget | `N/A` | blocked |
| stage stability | `N/A` | blocked |
| semester stability | `N/A` | blocked |
| scenario-family stability | `N/A` | blocked |

拒引 arte物：`air-mentor-api/output/proof-risk-model/retrain-coverage12-20260422T162939Z/eval-cov12.json`

| Rejected Metric | Value | 何以不可用 |
| --- | ---: | --- |
| productionModelVersion | `observable-risk-logit-v8` | 版号虽 v8，然非 post-Phase-2 corrected corpus |
| ROC-AUC | `0.5000` | held-out `support=0`，degenerate |
| Brier | `0.0000` | held-out `support=0`，degenerate |
| PR-AUC | `0.0000` | held-out `support=0`，degenerate |
| Global ECE | `0.0000` | held-out `support=0`，degenerate |
| overload ratio | `0.0000` | held-out `support=0`，degenerate |

证：`air-mentor-api/output/proof-risk-model/retrain-coverage12-20260422T162939Z/eval-cov12.json:238960-238977`, `air-mentor-api/output/proof-risk-model/retrain-coverage12-20260422T162939Z/eval-cov12.json:240078-240105`

## Comparison vs v7

可直比者，仅 v7 frozen reference；corrected v8 列从缺，不可伪补。

| Metric | v7 cov-24 reference | corrected v8 this pass |
| --- | ---: | --- |
| ROC-AUC | `0.7894` | `N/A (blocked)` |
| Brier | `0.1359` | `N/A (blocked)` |
| Global ECE | `0.0067` | `N/A (blocked)` |
| overload ratio | `1.1127` | `N/A (blocked)` |
| baseline v5-like overload | `1.0100` | `N/A (blocked)` |
| heuristic overload | `1.0049` | `N/A (blocked)` |

释：

- v7 reference 仍示 overload `1.1127`，故即便 corrected v8 未得，promotion 亦不可借旧数通关。
- `cov12` 旧 run 不足作 “better than v7” 之证；其 held-out 支撑为零，且 build 时点先于 Phase 2 完成。

证：`audit-map/08-ml-audit/07-v7-overload-root-cause-analysis-2026-04-22.md:8-17`, `audit-map/32-reports/ml-retrain-catboost-20260422.md:111-113`, `audit-map/32-reports/ml-retrain-catboost-20260422.md:166-167`

## Promotion Decision

- 结论：**Do not promote**。
- 理由一：hard gate `overload <= 1.00` 未于 corrected corpus 复验。
- 理由二：`ROC-AUC >= 0.78`、`ECE <= 0.010`、local calibration、stage/semester/family stability 皆未得 admissible corrected 数。
- 理由三：reproducibility proof 仅脚本能力已补，未有 bytewise rerun 成果。
- 理由四：Phase 7 plan 明言 caller propagation 未齐则 retrain/promote 皆止；而本席无 DB-backed 环境，无法完成该验证链。
- 理由五：盘上可见 retrain arte物皆早于 `2026-04-22T20:59:42Z` 之 Phase 2 完成时点，援引即违 “corrected corpus only”。

故本轮只可交付：script hardening + blocker ledger；不可宣称 corrected v8 baseline 已训成，亦不可切 serving。

## Reproducibility Manifest

- 未来同脚本可落之 manifest 字段：
  - `selectedRuns`
  - `featureKeys`
  - `splitHash`
  - `featureKeyHash`
  - `corpusHash`
  - `replayHash`
  - `metric sidecar paths`
  - `meta.txt`
- 其实现已在 evaluator 中就位；若后续供 external DB，亦可同路产出。证：`air-mentor-api/scripts/evaluate-proof-risk-model.ts:1003-1041`, `air-mentor-api/scripts/evaluate-proof-risk-model.ts:2406-2477`, `air-mentor-api/scripts/evaluate-proof-risk-model.ts:2480-2665`
- 然本轮 **reproducibility gate = FAIL/BLOCKED**：
  - 无 corrected run arte物可 hash。
  - 无第二次 bytewise rerun 可比。
  - 无外部 DB path，可替代 embedded-postgres；新加 fallback 亦因 env 缺失而未能启用。
  - 主仓现存 `evaluation-report.json` 自身亦无 `reproducibilityManifest`，故连 stale smoke run 亦不足作 replay witness。证：`audit-map/22-evals/data/overnight-ml-v8-corrected-logistic-probes.json:1-97`, `/home/raed/projects/air-mentor-ui/air-mentor-api/output/proof-risk-model/evaluation-report.json:1-30`

附 sidecar：

- blocker ledger：`audit-map/22-evals/data/overnight-ml-v8-corrected-logistic-blocker.json`
- probe ledger：`audit-map/22-evals/data/overnight-ml-v8-corrected-logistic-probes.json`
- corrected metric sidecars：未产；待 listen-capable DB 环境重跑 `coverage-24` 或更高 coverage 后，由 evaluator 自动写出。

## Closeout

- 可复用之最小后续步：
  1. 于可 listen 之机，供 fresh `AIRMENTOR_EVAL_DATABASE_URL` / `DATABASE_URL`，或开放 embedded-postgres socket。
  2. 以 `coverage-24`（含 `{train,val,test}`）重跑 evaluator。
  3. 取新 `evaluation-report.json` + `metric-sidecars/` + `meta.txt`。
  4. 再以本报告骨架补正 “Metrics / Comparison vs v7 / Promotion Decision” 三节。

- 本轮 status 仅得 `blocked`；非 `partial-complete`。因 corrected corpus 与 gate metrics 一项未成，promotion 绝不可作。
