# Overnight ML Phase 9: Beta Calibration

## Inputs

- 依 `Phase 9` 契：Beta 為 default candidate；VA 僅 shadow；promotion gate 須同驗 global ECE 與 local bands `0.4 / 0.85`，不可徒恃 global。證：`audit-map/20-prompts/fresh-sem1-principal-architect-overnight-pass.md` §I/§N，暨 `pipeline/agents/manifests/overnight-ml-beta-calibration.intent.yaml`。
- 本輪校準基線已翻正為 `raw-uncalibrated`。先前 t58 草稿誤以 `isotonic` 為 promotion 基線，遂得 `3/5 blocked`；依 node 契改正後，真 gate 為 `beta vs raw`，`isotonic` 僅留 shadow reference，不入 promotion 判決。
- corpus 仍承 t57 interim：`air-mentor-api/output/proof-risk-model/features.csv`，`43200` 行，`featuresCsvSha256=f73243cca08271c9b49beda27ebc13fefa906498b9fcb05f2b2395b9f3a9845b`。pre-Phase-2，故 admissibility 仍為 `interim`。
- script：`air-mentor-api/scripts/beta_calibrate_v8_local.py`。今輪重跑產物：`air-mentor-api/output/proof-risk-model/beta-calibration-v8-local-20260423T022222Z/`。seed=`4242`。sidecars 已回填 `audit-map/22-evals/data/overnight-ml-beta-calibration-*.json`。
- logistic base 與 t57 同構：per-head `LogisticRegression`，validation `80/20` 切 synth-train/cal，test 不變；故本輪專辨 calibrator 之效。

## Calibration Curves

曲線以 test 指標代圖。RAW→BETA 為本輪正式比較；ISOTONIC 僅為影參。

| Head | ROC raw/beta | Brier raw → beta | globalECE raw → beta | shadow iso globalECE |
| --- | ---: | ---: | ---: | ---: |
| attendanceRisk | `0.9906 / 0.9906` | `0.0357 → 0.0148` | `0.0741 → 0.0083` | `0.0083` |
| ceRisk | `0.9580 / 0.9580` | `0.0875 → 0.0203` | `0.1495 → 0.0062` | `0.0072` |
| seeRisk | `0.8258 / 0.8258` | `0.1799 → 0.1186` | `0.2308 → 0.0243` | `0.0282` |
| overallCourseRisk | `0.8515 / 0.8515` | `0.1560 → 0.1079` | `0.2024 → 0.0241` | `0.0248` |
| downstreamCarryoverRisk | `0.9279 / 0.9279` | `0.1081 → 0.1018` | `0.0774 → 0.0396` | `0.0315` |

要點：

- Beta 不改 rank，故 ROC 近 RAW 恆等；其效主要在概率重映射，非排序改寫。
- global ECE `5/5` 俱進；Brier 亦 `5/5` 俱進。若只觀 global，Beta 近可 promote。
- `isotonic` 對 `attendance/overall/downstream` 某些局部 band 仍較 Beta 佳；然 Phase 9 真 gate 非 `beta vs isotonic`，乃 `beta vs raw`。此為本輪結論翻盤之本。

## Local Bands (0.4 / 0.85)

此節為硬閘。條件：`beta L@0.4 <= raw L@0.4`，`beta L@0.85 <= raw L@0.85`，且 `beta globalECE <= raw globalECE`。

| Head | raw L@0.4 | beta L@0.4 | delta | raw L@0.85 | beta L@0.85 | delta | globalECE delta | Verdict |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | :---: |
| attendanceRisk | `0.3605` | `0.1313` | `-0.2293` | `0.4899` | `0.0607` | `-0.4292` | `-0.0658` | PASS |
| ceRisk | `0.3719` | `0.0126` | `-0.3593` | `0.6537` | `0.1480` | `-0.5057` | `-0.1433` | PASS |
| seeRisk | `0.2544` | `0.0131` | `-0.2413` | `0.3205` | `0.0104` | `-0.3102` | `-0.2065` | PASS |
| overallCourseRisk | `0.2596` | `0.0640` | `-0.1956` | `0.2831` | `0.0671` | `-0.2160` | `-0.1783` | PASS |
| downstreamCarryoverRisk | `0.0250` | `0.1278` | `+0.1029` | `0.2162` | `0.0626` | `-0.1537` | `-0.0378` | BLOCK |

判讀：

- 真 gate 下，Beta 非 `3/5 blocked`，而是 **`1/5 blocked`**。先前 blocker 之大半，實由錯基線（vs isotonic）所致。
- `downstreamCarryoverRisk` 為唯一阻塞：high band 明進，global ECE 亦進，然 `@0.4` 自 `0.0250` 惡化至 `0.1278`。此乃硬敗，無可粉飾。
- `attendance/ce/see/overall` 四頭皆達 gate；其中 `ceRisk` 改善最劇，`L@0.4: 0.3719 → 0.0126`，`L@0.85: 0.6537 → 0.1480`。
- shadow isotonic 仍具訊：對 `downstream` 而言，`iso L@0.4=0.0729`、`iso L@0.85=0.0061`，示此頭 raw→beta 之中段形變仍非最優。

## Venn-Abers Diagnostic

| Head | meanIntervalWidth | maxIntervalWidth | coverage@0.5 |
| --- | ---: | ---: | ---: |
| attendanceRisk | `0.8350` | `0.8439` | `0.9995` |
| ceRisk | `0.8337` | `0.9160` | `1.0000` |
| seeRisk | `0.8341` | `0.8969` | `1.0000` |
| overallCourseRisk | `0.8338` | `0.8641` | `1.0000` |
| downstreamCarryoverRisk | `0.8336` | `0.8629` | `1.0000` |

判讀：

- interval width 皆近 `0.834`，幾近滿域；`coverage@0.5` 亦近 `1.0`。是則本輪 inductive VA 幾近空訊寬區間。
- 故 VA 僅證「此 corpus 上 uncertainty 極寬」，不能作 promote/non-promote 裁判，亦不足分辨 `beta` vs `isotonic`。
- 其價值僅在 shadow：提醒此 interim corpus 與單批 inductive VA 配伍甚弱；若後續仍需 uncertainty path，宜另試 transductive 或 deferred-online 變體。

## Promotion Decision

- **結論：Do not promote Beta as default production path on current interim corpus.**
- blocker 唯一且足夠：`downstreamCarryoverRisk` 之 `local-ECE@0.4` 惡化 `+0.1029`。依契，單頭單 band 惡化即止 promotion。
- 故本 pass 不再對 `air-mentor-api/src/lib/proof-risk-model.ts` 施新 surgical edit；僅翻正 Phase 9 evaluator 與 artifacts，使判決忠於 node 契。
- 但 Beta 仍為強 candidate：`4/5` 頭全過，且 global ECE / Brier 於 `5/5` 俱進。待 corrected corpus 重出，可優先重跑此徑。
- 本輪 reproducibility：
  - `outputDir = air-mentor-api/output/proof-risk-model/beta-calibration-v8-local-20260423T022222Z/`
  - `scriptSha256 = 9d78123abbaddc168f4d35773ea35d5af4a0357ad794363413e8dee919303322`
  - `promotionDecision = do-not-promote`
  - `blockedHeads = 1`

## Closeout

- 已更新：`beta_calibrate_v8_local.py` promotion gate、repo-tracked JSON sidecars、本文。
- 未更新：serving calibration hook。因 gate 未全過，依 pass 契不進 production wiring。
- 後續最小步：
  1. 取 corrected corpus 重跑同 script。
  2. 專剖 `downstream` 中段 band 形狀；必要時於 Beta 族內加 local-aware selection，然須先證不 overfit。
  3. 若 corrected corpus 下 `5/5` 頭俱過，始可宣 Beta 正式 promotion。
