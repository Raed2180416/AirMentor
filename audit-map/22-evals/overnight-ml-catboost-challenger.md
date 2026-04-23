# Overnight ML Phase 10: CatBoost Challenger

## Inputs

- 依 `Phase 10` 权柄：CatBoost 训于 corrected frozen corpus 为 shadow challenger；与 corrected v8 logistic 对决不止 AUC，尽 decision-aware 数；须同过 ranking + proper scoring + local calibration + overload + replayability 五闸方可 promote，否则守 shadow。证：`pipeline/agents/manifests/overnight-ml-catboost-challenger.intent.yaml:1-8`。
- 上游：`t57 v8-local logistic` + `t58 Beta calibration diagnostic`（皆 interim）。本轮 t59 径 train CatBoost on 同 corpus (pre-Phase-2 `features.csv`，`corpusAdmissibility=interim`) 作同径 challenger。证：`audit-map/22-evals/overnight-ml-v8-corrected-logistic.md:16-30`, `audit-map/22-evals/overnight-ml-beta-calibration.md:5-10`。
- 代出 codex 径（codex-02 usage_limit 冷却至 `2026-04-23T02:05Z`，codex-03 正为 t54 占）；以 `train_catboost_challenger_local.py` 于 local Python 训练，零 OpenAI 成本，同 seed (`4242`)，同 synth train/cal/test split with t57/t58 以 fair head-to-head。
- Baseline：logistic v8-local (`sklearn.LogisticRegression` + `IsotonicRegression`)，即 t57 交付之同 model。
- Challenger：CatBoost `1.2.10` CPU-only（nix shell 无 GPU），`iterations=300, depth=6, lr=0.05, l2_leaf_reg=3.0, class_weight=balanced via scale_pos_weight=neg/pos, loss=Logloss, metric=AUC, random_seed=4242`。
- features.csv 载 `39 feat + 39 missingness indicator = 78 feat`，与 t57 一同（missingness-aware contract 延续）。

## Training

- 径：per-head CatBoostClassifier，early-stopping on cal set（`early_stopping_rounds=30, use_best_model=True`）。
- Cal：于同 `validation` 80/20 synth split 取 `cal`，以 IsotonicRegression fit cal score → predict test（与 logistic baseline 完全同径，以控 cal 变数）。
- 模型存 `.cbm` 二进制（CatBoost 原生序列化）于 output dir，replayability gate 此 PASS。
- Train size（per head）：`17280`；cal size：`4320`；test size：`21600`。
- 每 head 之 CatBoost 训练过程（summary）：

| Head | trees | bestIter | scalePosWeight |
| --- | ---: | ---: | ---: |
| attendanceRisk | `300` | `299` | `9.70` |
| ceRisk | `260` | `259` | `51.84`（极稀，pos_rate≈2%） |
| seeRisk | `300` | `299` | `5.91` |
| overallCourseRisk | `300` | `299` | `5.76` |
| downstreamCarryoverRisk | `300` | `299` | `2.98` |

释：`ceRisk` 以 pos_rate `~2%` 致 `scale_pos_weight≈52`，极 class-imbalance 下 CatBoost 261 trees 后 early-stop；余 head 皆 300 iters 到顶未 plateau，示或可 hyperparam tune 加 iter 再改善。

## Metrics

CatBoost 测结：

| Head | ROC-AUC | PR-AUC | Brier | Global ECE | local-ECE@0.4 | local-ECE@0.85 | Overload | P@20% | R@20% | rocSpread |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| attendanceRisk | `0.9854` | `0.8342` | `0.0140` | `0.0067` | `0.0224` | `0.2010` | `1.1199` | `0.2019` | `0.9853` | `0.0151` |
| ceRisk | `0.9309` | `0.3484` | `0.0246` | `0.0192` | `0.1535` | `0.2939` | `0.7506` | `0.1382` | `0.9328` | `0.2225` |
| seeRisk | `0.8599` | `0.6447` | `0.1072` | `0.0467` | `0.0025` | `0.2157` | `0.8790` | `0.5650` | `0.5861` | `0.2701` |
| overallCourseRisk | `0.9039` | `0.7346` | `0.0850` | `0.0304` | `0.0075` | `0.1023` | `0.9004` | `0.6252` | `0.6786` | `0.2133` |
| downstreamCarryoverRisk | `0.9423` | `0.8454` | `0.0894` | `0.0436` | `0.0844` | `0.0927` | `0.9711` | `0.8343` | `0.5913` | `0.0039` |
| **macro avg** | **`0.9245`** | **`0.6815`** | **`0.0640`** | **`0.0293`** | **`0.0541`** | **`0.1811`** | **`0.9242`** | **`0.4729`** | **`0.7548`** | **`0.1450`** |

释：

- macro 观：CatBoost 胜于 ranking / PR / Brier（`ROC 0.9089→0.9245`, `PR 0.6301→0.6815`, `Brier 0.0728→0.0640`），然 global ECE 反退（`0.0200→0.0293`），故不可仅看 rank/proper。
- ROC 大胜于 `overallCourseRisk`（`0.850 → 0.904`）、`seeRisk`（`0.825 → 0.860`）、`downstreamCarryoverRisk`（`0.927 → 0.942`）；`attendanceRisk` 反微退；`ceRisk` 明退。
- Brier 改于 4/5 head（`ceRisk` 除外）；PR-AUC 亦改于 4/5 head（同为 `ceRisk` 独退）。
- 显著症：**local-ECE @0.4 于 4/5 head 改，然 @0.85 于 5/5 head 俱倒退**。CatBoost 之 raw score 分布更陡，isotonic 于高 prob 段 support 稀薄，致 `mean_prob` 普高于 `mean_label`。
- `overallCourseRisk` 与 `downstreamCarryoverRisk`（policy-critical heads）overload `0.9004` / `0.9711`，较 baseline `0.8712` / `0.8951` 更近 `1.0`，此门为进。
- stage-stability 未全优：`rocSpread` 于 4/5 head 较 logistic 更大，仅 `downstreamCarryoverRisk` 由 `0.0096 → 0.0039` 得稳。
- `ceRisk` 三闸同破（rank/proper/overload）：CatBoost 于极稀阶组（pos_rate≈2%）表现远劣于 linear model；class imbalance 下 tree-based 易 memorise negative cluster，logistic 借 class_weight 更稳。

## Head-to-Head vs Logistic v8

5-gate 验，逐 head：

| Gate | 定义 |
| --- | --- |
| `ranking` | CatBoost ROC-AUC ≥ Logistic ROC-AUC |
| `proper` | CatBoost Brier ≤ Logistic Brier |
| `localCal` | CatBoost local-ECE@0.4 ≤ Logistic AND @0.85 ≤ Logistic |
| `overload` | `|CatBoost OV − 1.0| ≤ |Logistic OV − 1.0|` |
| `replayable` | `.cbm` + seed + hash + feature manifest 记存 |

| Head | rank | proper | localCal | overload | replayable | PASS | per-head verdict |
| --- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| attendanceRisk | ✗ (`.985`<`.989`) | ✓ (`.014`<`.015`) | ✗ (@0.85 `.20`>`.08`) | ✓ (`1.12`<`1.20`) | ✓ | **3/5** | **shadow** |
| ceRisk | ✗ (`.931`<`.954`) | ✗ (`.025`>`.021`) | ✗ (@0.85 `.29`>`.19`) | ✗ (`.75`>`.92`—更离 1.0) | ✓ | **1/5** | **shadow** |
| seeRisk | ✓ (`.860`>`.825`) | ✓ (`.107`<`.120`) | ✗ (@0.85 `.22`>`.01`) | ✗ (`.879` 距 `1.0` 远于 `.917`) ⚠ | ✓ | **3/5** | **shadow** |
| overallCourseRisk | ✓ (`.904`>`.850`) | ✓ (`.085`<`.108`) | ✗ (@0.85 `.10`>`.003`) | ✓ (`.90`>`.87`—更近 1.0) | ✓ | **4/5** | **shadow** |
| downstreamCarryoverRisk | ✓ (`.942`>`.927`) | ✓ (`.089`<`.100`) | ✗ (@0.85 `.09`>`.006`) | ✓ (`.97`>`.90`—更近 1.0) | ✓ | **4/5** | **shadow** |

注 `⚠`（seeRisk overload）：CatBoost OV=`0.879`，logistic OV=`0.917`；两皆 <1.0，logistic 更近 1.0，故 CatBoost gate 破；然 decision-aware 上 CatBoost 亦非过载，仅 "过度保守" 一侧。记以防误释。

全盘：

- **0/5 head 过全 5 闸**。全 5 head **localCal @0.85 全破**——此乃 CatBoost 之 systemic calibration issue 于本 corpus；而非单 head noise。
- `overallCourseRisk` 与 `downstreamCarryoverRisk` 最接近 promotion（4/5）：ranking + proper + overload + replay 皆进，仅 local-cal @0.85 为唯一阻因。若 corrected corpus 带更平均 prob 分布 + 更大 cal set，或可达 5/5。然本轮不可假设。
- `ceRisk` 最劣（1/5）：CatBoost 于极稀 class 无优势，应避以之替 logistic。

## Promotion Decision

- **结论：Keep as shadow**（challenger 不 promote）。
- 理由一：Phase 10 contract 明令 "Do not promote CatBoost unless it beats logistic on ranking AND proper scoring AND local calibration AND overload AND replayability" —— 5 gates conjunction. 0/5 heads 过全闸。
- 理由二：local-ECE @0.85 破于 5/5 head，系 systemic bias；非 per-head noise。若 switch serving 必伤高-prob 决策。
- 理由三：`ceRisk` head CatBoost 于极稀 class 之 3 闸破示 tree challenger 不宜 one-size-fits-all；hybrid scheme（per-head pick winner）须 Phase 10 外另立。
- 理由四：corpus admissibility `interim` 继承 t57；即便 5/5 过闸亦不可 promote 于非 corrected corpus。
- 理由五：Venn-Abers（t58 diag）仍 non-discriminative，unreliability quantification 未得；promotion 亦需 uncertainty story。

可取者：

- CatBoost 于 `overallCourseRisk` + `downstreamCarryoverRisk` ROC + overload 双进，示 tree feature interactions 可补 logistic 线性假设；**保 shadow 数据以备 Phase 11 analytics 引**。
- `seeRisk` ranking 胜 + local@0.4 胜 (`.068 → .003`)，示 mid-prob 段 tree 可学到 logistic 漏 signal。
- `.cbm` 模型 + metric sidecars + seed/hash manifest 齐全；若 corrected corpus 重出，同径可 bytewise rerun。

## Reproducibility Manifest

- `seed = 4242`（同 t57/t58）
- `scriptPath = air-mentor-api/scripts/train_catboost_challenger_local.py`
- `featuresCsv = air-mentor-api/output/proof-risk-model/features.csv`
- challenger = `catboost` (`1.2.10`)，CPU-only
- baseline = `logistic-v8-local` isotonic-calibrated
- CatBoost params：`iterations=300, depth=6, lr=0.05, l2_leaf_reg=3.0, loss=Logloss, metric=AUC`
- output dir: `air-mentor-api/output/proof-risk-model/catboost-challenger-local-20260422T225904Z/`
- model artefacts: `catboost-<head>.cbm` × 5（gitignored output tree）
- 今轮复核依 repo-tracked sidecar/json；现地未重训，盖此 workspace 缺 `catboost` Python 依赖。
- repo-tracked sidecars (under `audit-map/22-evals/data/overnight-ml-catboost-challenger-*.json`):
  - `-head-to-head.json` — full summary with all heads + 5-gate
  - `-per-head-metrics.json` — challenger only
  - `-baseline-metrics.json` — logistic reproduction (for audit)
  - `-gates.json` — per-head gate booleans
  - `-promotion-decision.json` — global verdict
  - `-meta.txt` — seed/git/hash/params
- replay cmd:
  ```
  python3 air-mentor-api/scripts/train_catboost_challenger_local.py
  ```
- 后续最小步（俟 corrected corpus 齐）：
  1. rerun `train_v8_local_corrected_logistic.py` on corrected features.csv (post-Phase-2)。
  2. rerun `train_catboost_challenger_local.py` on 同 corrected corpus。
  3. 若 corrected corpus 下 CatBoost 过 5/5 head 全闸，始可 promote；否则 Phase 10 hybrid (per-head mix) 另立。
  4. GPU search candidates（若 access 可得）以 `iterations in [500, 1000]`, `depth in [4,6,8]`, `l2 in [1,3,10]` 扩 grid；然必经 CPU 同 seed rerun 复核 replayability gate。

- 本轮 t59 status = **completed-as-shadow-benchmark**（promote=no，keep-as-shadow）。corrected-corpus rerun 后续另 ticket。
