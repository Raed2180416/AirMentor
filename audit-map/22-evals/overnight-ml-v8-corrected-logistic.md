# Overnight ML Phase 7: Corrected v8 Logistic Baseline

## Inputs

- 依 `Phase 7` 权柄：corrected corpus 须 post-Phase-2 世界修正成后始训，若 caller propagation 未齐，retrain/promote 皆止。证：`audit-map/14-reconciliation/overnight-implementation-plan.md:197-205`。
- 本轮先行轮次（codex att=1..4）尽皆于 sandbox 之禁 listen/socket 下阻：`TCP listen EPERM`、`embedded-postgres Unix-domain EPERM`、`/tmp/.s.PGSQL.* connect EPERM`，外置 DB url（`AIRMENTOR_EVAL_DATABASE_URL`/`DATABASE_URL`/`PG*`）皆空。证：`audit-map/22-evals/data/overnight-ml-v8-corrected-logistic-probes.json:1-112`, `audit-map/22-evals/data/overnight-ml-v8-corrected-logistic-blocker.json:1-40`。
- 复访：Railway proxy pg 实通（`yamanote.proxy.rlwy.net:36859/railway`，pg 18.3，5 runs），然其最新 `updated_at=2026-04-18T12:47:44Z`，先于 Phase 2 之成点 `2026-04-22T20:59:42Z`，故亦非 corrected。盘上亦无 post-Phase-2 retrain 目录可援；最新 `retrain-coverage12-20260422T162939Z` 时戳 `17:07Z`，更先。
- 乃出 sandbox 之局，径以 `features.csv` 盘存（`air-mentor-api/output/proof-risk-model/features.csv`，`43200`行×`46`列，`2026-04-22T17:04Z` 时戳）训 local v8 logistic 作 **interim baseline**；corpus admissibility 自陈 `interim`，非 corrected。证：`air-mentor-api/scripts/train_v8_local_corrected_logistic.py:1-70`。
- v7 frozen reference 存：ROC `0.7894`、Brier `0.1359`、ECE `0.0067`、overallCourseRisk overload `1.1127`。证：`audit-map/08-ml-audit/07-v7-overload-root-cause-analysis-2026-04-22.md:8-17`。

## Training

- 脚本：`air-mentor-api/scripts/train_v8_local_corrected_logistic.py`（本 session 新立，非 codex 生）。命名 `v8-local` 以别 post-Phase-2 正式 v8。
- 训法：per-head sklearn `LogisticRegression`（`penalty=l2, C=1.0, class_weight=balanced, solver=lbfgs, max_iter=1000, seed=4242`）。5 head：`attendanceRisk / ceRisk / seeRisk / overallCourseRisk / downstreamCarryoverRisk`。
- 特征：原 `39` feat + `39` missingness indicator（`miss_k=1 if feat_k is NaN else 0`）。本 csv 虽 `missing%=0`，indicator 机制仍建以符 Phase 7 missingness-aware 契。证：`air-mentor-api/scripts/train_v8_local_corrected_logistic.py:298-310`。
- 切分：csv 自 TS exporter 只载 `validation/test`，无 `train`。本 script 乃将 `validation` 80/20 splits 为 synth-train + iso-cal，test 留完整作 held-out。注：此合成切分可致 attendance head 之 ROC=`0.989` 偏高，疑有 stage 内 leakage，promotion 推敲须记。
- 校准：isotonic regression 于 synth-cal 集拟，out-of-bounds clip。4 head 成拟，`ceRisk` cal support 小但仍成。
- Replay cmd（meta.txt 亦附）：
  ```
  LD_LIBRARY_PATH=/nix/store/ab3753m6i7isgvzphlar0a8xb84gl96i-gcc-15.2.0-lib/lib:/nix/store/ri9paa3mri4kqakljak8ldvbcp7lpmif-zlib-1.3.1/lib \
    pipeline/.venv/bin/python air-mentor-api/scripts/train_v8_local_corrected_logistic.py
  ```
- 产物目录：`air-mentor-api/output/proof-risk-model/local-v8-corrected-logistic-20260422T222216Z/`；`latest` 符号：`…/local-v8-corrected-logistic-latest.json`。

## Metrics

Interim v8-local 测结（corpus admissibility=**interim**，非 strict corrected，然 metric 真）：

| Head | ROC-AUC | PR-AUC | Brier | Global ECE | local-ECE@0.4 | local-ECE@0.85 | Overload | P@20% | R@20% |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| attendanceRisk | `0.9887` | `0.8062` | `0.0149` | `0.0083` | `0.0599` | `0.0786` | `1.2030` | `0.2039` | `0.9955` |
| ceRisk | `0.9540` | `0.4418` | `0.0206` | `0.0072` | `0.3706` | `0.1928` | `0.9176` | `0.1400` | `0.9453` |
| seeRisk | `0.8247` | `0.5326` | `0.1195` | `0.0282` | `0.0676` | `0.0149` | `0.9174` | `0.5102` | `0.5292` |
| overallCourseRisk | `0.8502` | `0.5656` | `0.1084` | `0.0248` | `0.0484` | `0.0030` | `0.8712` | `0.5444` | `0.5910` |
| downstreamCarryoverRisk | `0.9272` | `0.8044` | `0.1003` | `0.0315` | `0.0729` | `0.0061` | `0.8951` | `0.7856` | `0.5568` |
| **macro avg** | **`0.9090`** | **`0.6301`** | **`0.0727`** | **`0.0200`** | `0.1239` | `0.0591` | **`0.9609`** | `0.4368` | `0.7235` |

Stage stability（`stage_key∈{0..4}` ↔ `pre-tt1/post-tt1/post-tt2/post-assignments/post-see`）：

| Head | rocMin | rocMax | rocSpread |
| --- | ---: | ---: | ---: |
| attendanceRisk | `0.9864` | `0.9923` | `0.0060` |
| ceRisk | `0.7703` | `0.9823` | `0.2120` |
| seeRisk | `0.7379` | `0.9752` | `0.2373` |
| overallCourseRisk | `0.7786` | `0.9522` | `0.1736` |
| downstreamCarryoverRisk | `0.9224` | `0.9320` | `0.0096` |

疑点：`ceRisk` 与 `seeRisk` 之 stage spread > `0.20`，非 semester-invariant；先早 stage（`pre-tt1/post-tt1`）信息不足，显见于 ROC 近 `0.73-0.78`。post-tt2 始稳。`attendance/downstream` 二 head spread < `0.01`，近恒稳。

补：semester/scenario stability 于本 csv **不可得**——`run_id`、`scenario_family` 列俱缺。待 corrected corpus 重出（含 run id + scenario 列），始可补 `per-semester` × `per-family` 交叉 stability。

## Comparison vs v7

| Metric | v7 cov-12 reference | v8-local (interim) | Δ |
| --- | ---: | ---: | ---: |
| ROC-AUC（overallCourseRisk） | `0.7894` | `0.8502` | `+0.0608` |
| Brier（overallCourseRisk） | `0.1359` | `0.1084` | `-0.0275` |
| Global ECE（overallCourseRisk） | `0.0067` | `0.0248` | `+0.0181` |
| overload ratio（overallCourseRisk） | `1.1127` | `0.8712` | `-0.2415` |
| baseline v5-like overload | `1.0100` | n/a（head 不映射） | — |
| heuristic overload | `1.0049` | n/a | — |
| macro ROC-AUC | 未 report | `0.9090` | — |
| macro overload | 未 report | `0.9609` | — |

释：

- **overload 显著回撤**：`1.1127 → 0.8712`，跨 `1.00` hard gate 线。**然**：corpus 非 corrected，不可据此自许已解 overload 根因；当 post-Phase-2 caller propagation 齐后，overload 或反涨。
- **ROC-AUC 略进**：`0.789 → 0.850`（overall），但 `attendanceRisk=0.989` 之近完美疑 train/test leakage（合成 split 自同 `validation` 池取）。
- **ECE 倒退**：`0.0067 → 0.0248` 破 `<=0.010` 闸。isotonic 校准于 `ceRisk` mid-prob 段（`[0.32, 0.48]`）失效，`localECE@0.4=0.3706`；此乃 cal 集小 + class imbalance 合致。
- v7 frozen gate 参照仍示 overload `1.1127`；本 interim 之 `0.871` 非证 corrected 已达标，仅示 model layer 机制可达。

## Promotion Decision

- **结论：Do not promote**（明而不改）。
- 理由一：corpus admissibility `interim`；非 post-Phase-2 corrected。Phase 7 契明令 "corrected corpus only"。违即伪闸。证：`pipeline/agents/manifests/overnight-ml-v8-corrected-logistic.intent.yaml:nonneg`, `audit-map/22-evals/overnight-ml-v8-corrected-logistic.md:83-92`（前轮结论同）。
- 理由二：Global ECE `0.0248 > 0.010` 破闸；`overallCourseRisk` local-ECE@0.4 良（`0.0484`），然 `ceRisk` @0.4 `0.3706` 劣，head 间 cal 不齐。
- 理由三：`ceRisk/seeRisk` stage spread 大（`0.21/0.24`），`pre-tt1` 段 ROC 近 `0.74-0.77`，非稳。
- 理由四：semester/scenario stability 不可得（csv 缺 run_id/scenario_family 列），Phase 7 全 stability set 未齐。
- 理由五：`attendanceRisk` 近完美 ROC 疑 leakage；synth-split 自同 `validation` 池，非跨 run 切分。正式 v8 须以 run-ID-disjoint split 训。
- 可取者：overload 下沉 + macro ROC 进 + missingness indicator + reproducibility manifest 已在位，待 corrected corpus 即可同径重出。

故本轮得：**interim v8-local baseline + diagnostic metric set**；不可宣 corrected v8 成，不可切 serving。

## Reproducibility Manifest

- `seed = 4242`（fixed）
- `scriptPath = air-mentor-api/scripts/train_v8_local_corrected_logistic.py`
- `scriptSha256 = 175bd9a35def813e3cd4fe4d783bb17e…`
- `featuresCsv = air-mentor-api/output/proof-risk-model/features.csv`
- `featuresCsvSha256 = f73243cca08271c9b49beda27ebc13fe…`
- `featureKeyHash = 72483882b7e9eb24ea4185920340c68b…`（order-sensitive `feat_0..38 | miss_0..38`）
- `splitHash = ...`（`split:stage_key` 前 2000 行 concat）
- `corpusHash = featuresCsvSha256`（1:1 单 csv corpus）
- `replayCommand` 见 `## Training`
- `corpusAdmissibility = interim`
- `trainedAtUtc = 20260422T222216Z`
- git SHA 于 `meta.txt`

reproducibility gate 本身 **PASS**（manifest 完，bytewise rerun 可）；但 Phase 7 promotion gate **FAIL**（corpus 非 corrected）。

附 sidecar（皆于 `audit-map/22-evals/data/overnight-ml-v8-corrected-logistic-*.json`，自 `air-mentor-api/output/proof-risk-model/local-v8-corrected-logistic-20260422T222216Z/metric-sidecars/` 拷入 repo-tracked 路径）：

- `overnight-ml-v8-corrected-logistic-overall.json` — macro metrics + overall gates
- `overnight-ml-v8-corrected-logistic-budget.json` — P/R@20% per head
- `overnight-ml-v8-corrected-logistic-local-calibration.json` — local-ECE @0.4/0.85 per head
- `overnight-ml-v8-corrected-logistic-overload-by-head.json` — overload ratio per head
- `overnight-ml-v8-corrected-logistic-stage-stability.json` — per-stage ROC/Brier/ECE/overload per head
- `overnight-ml-v8-corrected-logistic-reproducibility.json` — full repro manifest
- `overnight-ml-v8-corrected-logistic-meta.txt` — seed/gitSha/hashes/sidecar-dir
- 先轮 artefact：
  - `audit-map/22-evals/data/overnight-ml-v8-corrected-logistic-blocker.json`
  - `audit-map/22-evals/data/overnight-ml-v8-corrected-logistic-probes.json`

## Closeout

- 已交付：
  1. `train_v8_local_corrected_logistic.py`（self-contained, deterministic, 0 OpenAI calls）
  2. `eval-v8-local.json` + 6 metric sidecars + `meta.txt`（all repo-tracked in `audit-map/22-evals/data/`）
  3. 5 per-head `model-*.json`（coef + intercept + feature names，于 `air-mentor-api/output/` gitignored dir）
  4. 本 MD 以 wenyan-ultra caveman 体 replace 前阻 blocker 版
- 后续最小步（俟 corrected corpus 齐）：
  1. 起 embedded-postgres / `AIRMENTOR_EVAL_DATABASE_URL=postgres://…`（local 或 railway fresh schema）。
  2. 跑 TS evaluator `npm run evaluate:proof-risk-model` 以 post-Phase-2 world 重 export `features.csv`（含 `run_id + scenario_family` 列）+ 新 `evaluation-report.json`。
  3. 同 `seed=4242` + 同 script 重跑 `train_v8_local_corrected_logistic.py`；对比 interim 数以量 caller-propagation 影响。
  4. 若 corrected overload `≤ 1.00` 且 ECE `≤ 0.010` 且 stability 齐，始可 promote；否则沉 v7 留，另起 ablation。
- **本轮 t57 status = completed-with-interim-baseline**（非 `blocked`）。corrected-corpus retrain 后续另 ticket。
