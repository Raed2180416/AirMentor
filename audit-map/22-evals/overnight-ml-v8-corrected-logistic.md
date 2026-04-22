# Overnight ML Phase 7: Corrected v8 Logistic Baseline

## Inputs

- 依 `Phase 7` 权柄：须于 `P8` 因果既明后，始以 missingness-aware contract 重训 corrected v8，并以 caller propagation 完整后之 corrected corpus 为准；若 caller 未齐，则 retrain/promote 皆止。证：`audit-map/14-reconciliation/overnight-implementation-plan.md:197-205`
- 本轮先修 evaluator 契约，未触 `src/`：control-plane import 改走 `dist`，并补 `current-v8` 动态命名、`reproducibilityManifest`、`metric sidecars`、`meta.txt`。证：`air-mentor-api/scripts/evaluate-proof-risk-model.ts:21-37`, `air-mentor-api/scripts/evaluate-proof-risk-model.ts:1006-1067`, `air-mentor-api/scripts/evaluate-proof-risk-model.ts:2341-2643`
- 训评 boot 仍倚 `createTestApp()`；其先以 `net.createServer()` 取 free port，继而起 `EmbeddedPostgres`。此 sandbox 禁 listen，故 DB-backed corrected corpus rebuild 不能于本席成。证：`air-mentor-api/tests/helpers/test-app.ts:44-89`
- 现存 `cov12` arte物不可充 corrected corpus：其文已自明 “does not claim v8 baseline is corrected”，且此 seed 组无 test-partition seed。证：`audit-map/32-reports/ml-retrain-catboost-20260422.md:111-113`, `audit-map/32-reports/ml-retrain-catboost-20260422.md:166-167`

## Training

- 已成脚本层补丁，俟 listen-capable 环境即可以同一 evaluator 落：
  - `dist` control-plane import，避 source control-plane 现行 drift。
  - `reproducibilityManifest`：`splitHash`、`featureKeyHash`、`corpusHash`、`replayHash`。
  - `metric sidecars`：overall / budget / local-calibration / overload-by-dimension / stability / queue-burden / reproducibility。
  - `meta.txt`：seed、git SHA、hash、sidecar path。
- 快验仅得部分：
  - `verify-calibration-fixes.ts` 纯逻辑 PASS，可证 calibration/local-ECE helper 未折。
  - `tests/evaluate-proof-risk-model.test.ts` 仍有既存 2 红：其断言仍假设 challenger hard-route 取胜，已不合现 chooser 行为。证：`air-mentor-api/tests/evaluate-proof-risk-model.test.ts:120-121`, `air-mentor-api/tests/evaluate-proof-risk-model.test.ts:168-169`
- 正式 corrected corpus rebuild / retrain 未成。阻因非 Phase 7 逻辑回归，乃运行域不予本地 socket；且 shell 中无 `DATABASE_URL` / `PG*` 旁路可借。证：`air-mentor-api/tests/helpers/test-app.ts:44-89`

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
- 其实现已在 evaluator 中就位。证：`air-mentor-api/scripts/evaluate-proof-risk-model.ts:2356-2427`, `air-mentor-api/scripts/evaluate-proof-risk-model.ts:2477-2551`, `air-mentor-api/scripts/evaluate-proof-risk-model.ts:2562-2643`
- 然本轮 **reproducibility gate = FAIL/BLOCKED**：
  - 无 corrected run arte物可 hash。
  - 无第二次 bytewise rerun 可比。
  - 无外部 DB path，可替代 embedded-postgres。

附 sidecar：

- blocker ledger：`audit-map/22-evals/data/overnight-ml-v8-corrected-logistic-blocker.json`
- corrected metric sidecars：未产；待 listen-capable DB 环境重跑 `coverage-24` 或更高 coverage 后，由 evaluator 自动写出。

## Closeout

- 可复用之最小后续步：
  1. 于可 listen 之机，供 `DATABASE_URL` 或开放 embedded-postgres socket。
  2. 以 `coverage-24`（含 `{train,val,test}`）重跑 evaluator。
  3. 取新 `evaluation-report.json` + `metric-sidecars/` + `meta.txt`。
  4. 再以本报告骨架补正 “Metrics / Comparison vs v7 / Promotion Decision” 三节。

- 本轮 status 仅得 `blocked`；非 `partial-complete`。因 corrected corpus 与 gate metrics 一项未成，promotion 绝不可作。
