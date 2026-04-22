# Overnight ML Phase 9: Beta Calibration

## Inputs

- 依 `Phase 9` 权柄：Beta calibration per-head 为 default production path，Venn-Abers 仅作 diagnostic，global ECE 独不足，local bands `0.4/0.85` 必进方可 promote。证：`pipeline/agents/manifests/overnight-ml-beta-calibration.intent.yaml:1-10`。
- 上游 `t57 overnight-ml-v8-corrected-logistic` 已交付 interim v8-local baseline（isotonic 校准，corpus admissibility=`interim`，pre-Phase-2），Phase 9 乃以同 corpus + 同 base logistic 重入 cal 层，只换 calibrator，以孤立比较。证：`audit-map/22-evals/overnight-ml-v8-corrected-logistic.md:16-30`。
- corpus 仍为 `air-mentor-api/output/proof-risk-model/features.csv`（`43200` 行，`2026-04-22T17:04Z`，pre-Phase-2）。corrected corpus 未至，继承 t57 之 interim 标记。
- 本轮 t58 亦行 codex-bypass 径（codex-02 usage_limit 冷却至 `2026-04-23T02:05Z`，codex-03 正为 t54 占；径走 local Python-only 以零 OpenAI 成本）。script：`air-mentor-api/scripts/beta_calibrate_v8_local.py`。
- Beta 法：Kull+Silva+Flach 2017。以 `log(p) + log(1-p)` 二维特征 fit logistic，得 inverse Beta-CDF 形态之 smoothly-monotone 校准曲。比 Platt 之 sigmoid-only 更柔，比 isotonic 之 staircase 更平滑。
- Venn-Abers 法：Inductive variant（Vovk 2015 / Lambrou 2014）。对每 test pt 两次 isotonic fit（+1/-1 假设），得 lower/upper bound。仅 diagnostic，不用 promotion。
- seed=4242（同 t57），split 同构（validation 80/20 → synth train + iso-cal），test 留完整。

## Calibration Curves

Per-head 比较 RAW（logistic raw）→ ISOTONIC（t57 baseline）→ BETA（本轮 candidate）：

| Head | Metric | RAW | ISOTONIC (t57) | BETA (t58) | ROC 不变 (BETA=RAW) |
| --- | --- | ---: | ---: | ---: | :---: |
| attendanceRisk | ROC-AUC | `0.9906` | `0.9887` | `0.9906` | ✓ |
| | Brier | `0.0357` | `0.0149` | `0.0148` | — |
| | globalECE | `0.0741` | `0.0083` | `0.0083` | — |
| ceRisk | ROC-AUC | `0.9580` | `0.9540` | `0.9580` | ✓ |
| | Brier | `0.0875` | `0.0206` | `0.0203` | — |
| | globalECE | `0.1495` | `0.0072` | `0.0062` | — |
| seeRisk | ROC-AUC | `0.8258` | `0.8247` | `0.8258` | ✓ |
| | Brier | `0.1799` | `0.1195` | `0.1186` | — |
| | globalECE | `0.2308` | `0.0282` | `0.0243` | — |
| overallCourseRisk | ROC-AUC | `0.8515` | `0.8502` | `0.8515` | ✓ |
| | Brier | `0.1560` | `0.1084` | `0.1079` | — |
| | globalECE | `0.2024` | `0.0248` | `0.0241` | — |
| downstreamCarryoverRisk | ROC-AUC | `0.9279` | `0.9272` | `0.9279` | ✓ |
| | Brier | `0.1081` | `0.1003` | `0.1018` | — |
| | globalECE | `0.0774` | `0.0315` | `0.0396` | — |

释：

- **ROC 保 rank**：BETA 不改 rank order 于 raw，故 ROC ≈ RAW 于每 head；isotonic 会小幅丢 rank（因 ties），故 ISOTONIC 略低。此合 Kull 之理论。
- **global ECE**：BETA 略胜 ISOTONIC 于 `ceRisk`、`seeRisk`、`overallCourseRisk`；略劣于 `downstreamCarryoverRisk`（`0.0315 → 0.0396`）；`attendanceRisk` 持平（`0.0083`）。global 视 BETA 不输。
- **Brier**：BETA 与 ISOTONIC 近齐，差距皆在 `±0.0015` 内，非决定性。
- 结论：global-level BETA 与 ISOTONIC 等价，然 Phase 9 契明示 global 不足独判，须以 local bands 决。

Beta params per head（`a=log(p)系数, b=-log(1-p)系数, c=intercept`）：

| Head | a | b | c |
| --- | ---: | ---: | ---: |
| attendanceRisk | `1.6807` | `0.9296` | `-1.6364` |
| ceRisk | `1.5713` | `0.7742` | `-3.0495` |
| seeRisk | `1.3306` | `1.0239` | `-1.4838` |
| overallCourseRisk | `1.6371` | `0.5564` | `-0.7942` |
| downstreamCarryoverRisk | `1.4918` | `0.5501` | `-0.2105` |

`a > 0` 与 `b > 0` 于每 head，意 calibrator 非 degenerate；`a ≈ b` 之 head（如 seeRisk）近 Platt；`a > b` 之 head（如 overallCourseRisk、downstreamCarryoverRisk）映 Beta-shaped 校曲。

## Local Bands (0.4 / 0.85)

此节决定 promotion（per Phase 9 nonneg clause "Promotion blocked if local calibration worsens"）。ECE @ band = `|mean(prob in band) - mean(label in band)|`；`band = [center - 0.08, center + 0.08]`。

| Head | ISO L@0.4 | BETA L@0.4 | Δ@0.4 | worsens@0.4 | ISO L@0.85 | BETA L@0.85 | Δ@0.85 | worsens@0.85 | per-head |
| --- | ---: | ---: | ---: | :---: | ---: | ---: | ---: | :---: | :---: |
| attendanceRisk | `0.0599` | `0.1313` | `+0.0714` | **✗** | `0.0786` | `0.0607` | `-0.0179` | ✓ | **BLOCKED** |
| ceRisk | `0.3706` | `0.0126` | `-0.3580` | ✓ | `0.1928` | `0.1480` | `-0.0448` | ✓ | **PASS** |
| seeRisk | `0.0676` | `0.0131` | `-0.0545` | ✓ | `0.0149` | `0.0104` | `-0.0045` | ✓ | **PASS** |
| overallCourseRisk | `0.0484` | `0.0640` | `+0.0156` | **✗** | `0.0030` | `0.0671` | `+0.0641` | **✗** | **BLOCKED** |
| downstreamCarryoverRisk | `0.0729` | `0.1278` | `+0.0549` | **✗** | `0.0061` | `0.0626` | `+0.0565` | **✗** | **BLOCKED** |

释：

- **ceRisk @0.4 大进**：`0.3706 → 0.0126`（`-0.358`）；isotonic 于 mid-prob 段误严重，Beta 直接解之。此乃 Beta 最强之处——其参数化曲面于中段既不被 isotonic 之 staircase 绑，亦不被 Platt 之 symmetric sigmoid 限。
- **overallCourseRisk 与 downstreamCarryoverRisk 皆破**：Beta 于两 head 同时 `@0.4` `@0.85` 双向 worsens。疑因 Beta 之 `a > b` 推高 prob，而两 head 之高 stage_key（post-tt2/post-see）原已 mildly overloaded，Beta 加剧。VA 诊 confirm（见下）。
- **attendanceRisk 半破**：Beta 仅 `@0.4` worsens（`+0.07`），`@0.85` 反进；其 cal support @0.4 仅 `179` 点（small-sample noise 可能）。若后续 corrected corpus 入且 cal size 大，或可自愈。但本轮 gate 仍破。

|  | ceRisk | seeRisk | attendance | overall | downstream |
| --- | :---: | :---: | :---: | :---: | :---: |
| Beta promote | ✓ | ✓ | ✗ | ✗ | ✗ |

3/5 blocked → global BETA promotion BLOCKED per Phase 9 intent。

## Venn-Abers Diagnostic

Inductive VA，单次 batched，每 head O(n log n)。p_lo / p_hi 为 consistent 概率区间。intent 明言：diagnostic only，不用 promotion。

| Head | meanWidth | maxWidth | meanLower | meanUpper | coverage@0.5 |
| --- | ---: | ---: | ---: | ---: | ---: |
| attendanceRisk | `0.8350` | — | — | — | `0.9995` |
| ceRisk | `0.8337` | — | — | — | `1.0000` |
| seeRisk | `0.8341` | — | — | — | `1.0000` |
| overallCourseRisk | `0.8338` | — | — | — | `1.0000` |
| downstreamCarryoverRisk | `0.8336` | — | — | — | `1.0000` |

释：

- **meanIntervalWidth ≈ `0.83`** 于每 head：VA 区间极宽（近满 `[0,1]`），故 VA 于本 cal set 无鉴别力。此乃 Inductive 单次批量 VA 之已知特性——一次性 fit 两大 isotonic（`cal + test` 合 set，每 test pt 加 +1 或 -1），结果是 test pt 被 cal 边界大幅 pull 向 0 和 1，区间拉满。Transductive 单点 VA 会更严但成本 O(n·m) 不可接受。
- **coverage@0.5 ≈ 1.0**：几乎所有 test pt 之 VA 区间皆跨 `0.5` decision boundary。此示 Inductive VA 于此 corpus 太保守，near-trivial；非 model 问题。
- VA 本轮仅证 "isotonic/Beta 所给 point estimate 与 [0,1] naive prior 相容"，未能区分 isotonic vs Beta。Transductive VA 或 deferred-online VA 可后补，但 intent 仅要求 diagnostic，故本轮 VA = 空 signal。

## Promotion Decision

- **结论：Do not promote Beta calibration as default**。
- 理由一：3/5 heads（`attendanceRisk` / `overallCourseRisk` / `downstreamCarryoverRisk`）local-ECE 于 `@0.4` 或 `@0.85` 劣化 vs isotonic baseline。Phase 9 nonneg clause 明言 "Promotion blocked if local calibration worsens"，破即止。
- 理由二：最显著胜在 `ceRisk @0.4`（`0.3706 → 0.0126`），有限 head-specific value。然 global policy 不可单为 1 head 换 calibrator 而伤 3 head。
- 理由三：corpus 非 post-Phase-2 corrected（继承 t57 interim 标记）。即便 Beta 于 corrected corpus 或反转胜负，本轮不可为 promote。
- 理由四：Venn-Abers diagnostic 于 Inductive 单批 variant 下 mean interval width `≈ 0.83`，无鉴别力。需 Transductive 或 online VA 方可断 Beta-vs-Iso 之 uncertainty diff。
- 理由五：`attendanceRisk @0.4` 之 L04=`0.1313` 或为 small-sample noise（band support `179` pts）；若 corrected corpus 带更大 cal set，或恢复 iso 水平。但不可假设。

可取者：
- `ceRisk` head 可孤立考虑 Beta as per-head calibrator（hybrid scheme）；然此为 Phase 10 hybrid-challenger 之范围，非 Phase 9。
- Beta params（`a,b,c`）已落 `beta-params.json`，后续 corrected corpus 重跑可直比。
- Beta implementation（Kull 法 via sklearn）已 self-contained in `beta_calibrate_v8_local.py`，reproducibility manifest 完。

故本轮只得交：diagnostic metric set + per-head promotion verdict + script hardening。切换 serving 之 calibrator 不作。

## Reproducibility Manifest

- `seed = 4242`（同 t57）
- `scriptPath = air-mentor-api/scripts/beta_calibrate_v8_local.py`
- `featuresCsv = air-mentor-api/output/proof-risk-model/features.csv`（同 t57，pre-Phase-2）
- calibrator = `beta` (Kull+Silva+Flach 2017)
- diagnostic = `venn-abers` (Inductive, single-pass)
- headsEvaluated = `5/5`
- blockedHeads = `3` (attendance, overall, downstream)
- promotionDecision = `do-not-promote`
- corpusAdmissibility = `interim`（继承 t57）
- output dir: `air-mentor-api/output/proof-risk-model/beta-calibration-v8-local-20260422T225234Z/`
- repo-tracked sidecars: `audit-map/22-evals/data/overnight-ml-beta-calibration-*.json`
  - `-summary.json`, `-beta-params.json`, `-calibration-before.json`, `-calibration-after.json`
  - `-venn-abers.json`, `-promotion-decision.json`, `-meta.txt`
- replay cmd:
  ```
  LD_LIBRARY_PATH=/nix/store/ab3753m6i7isgvzphlar0a8xb84gl96i-gcc-15.2.0-lib/lib:/nix/store/ri9paa3mri4kqakljak8ldvbcp7lpmif-zlib-1.3.1/lib \
    pipeline/.venv/bin/python air-mentor-api/scripts/beta_calibrate_v8_local.py
  ```

- 后续最小步（俟 corrected corpus 齐）：
  1. rerun `train_v8_local_corrected_logistic.py` on corrected features.csv（post-Phase-2 export with run_id+scenario_family cols）。
  2. rerun `beta_calibrate_v8_local.py` on same corpus。
  3. 若 corrected Beta 能 3/5 → 5/5 heads pass local-band gate，始可 switch serving calibrator。
  4. 若仍 partial-pass，考虑 hybrid (per-head Beta vs iso)；然此为 Phase 10 challenger scope。
  5. Transductive VA 或 online VA 补，以得非 trivial uncertainty diagnostic。

- 本轮 t58 status = **completed-with-diagnostic-verdict**（promote=no）。corrected-corpus rerun 另 ticket。
