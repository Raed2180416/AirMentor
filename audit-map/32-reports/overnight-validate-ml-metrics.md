# Overnight Validate: ML Evaluation Metrics

## Commands Run

- 读既落 sidecar（非 codex 途）：
  - `audit-map/22-evals/data/overnight-ml-v8-corrected-logistic-overall.json` / `-stage-stability.json` / `-local-calibration.json` / `-overload-by-head.json`
  - `audit-map/22-evals/data/overnight-ml-beta-calibration-promotion-decision.json` / `-calibration-after.json` / `-venn-abers.json`
  - `audit-map/22-evals/data/overnight-ml-catboost-challenger-gates.json` / `-promotion-decision.json`
- 合以 Python 聚合脚本（inline）抽 gate pass/fail 并 check Phase 7 / 9 / 10 nonneg clauses。
- 无新训；纯 metric aggregation + contract verification。

## Results Summary

**v7 baseline (frozen reference):**

| metric | value |
| --- | ---: |
| ROC-AUC (overallCourseRisk) | `0.7894` |
| Brier | `0.1359` |
| Global ECE | `0.0067` |
| overload ratio | `1.1127` |

**v8-local (interim) 5-head summary:**

| Head | ROC | Brier | gECE | L@0.4 | L@0.85 | OV | P@20% | R@20% |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| attendance | `0.9887` | `0.0149` | `0.0083` | `0.0599` | `0.0786` | `1.2030` | `0.2039` | `0.9955` |
| ce | `0.9540` | `0.0206` | `0.0072` | `0.3706` | `0.1928` | `0.9176` | `0.1400` | `0.9453` |
| see | `0.8247` | `0.1195` | `0.0282` | `0.0676` | `0.0149` | `0.9174` | `0.5102` | `0.5292` |
| overall | `0.8502` | `0.1084` | `0.0248` | `0.0484` | `0.0030` | `0.8712` | `0.5444` | `0.5910` |
| downstream | `0.9272` | `0.1003` | `0.0315` | `0.0729` | `0.0061` | `0.8951` | `0.7856` | `0.5568` |
| **macro** | **`0.9090`** | **`0.0727`** | **`0.0200`** | `0.1239` | `0.0591` | **`0.9609`** | `0.4368` | `0.7235` |

**Beta calibration verdict (vs isotonic):**

- promotion = `do-not-promote`
- blocked heads = `attendance / overall / downstream`（3/5 regress local ECE）
- ce 大进 @0.4（`0.3706 → 0.0126`）but global policy 不可单 head pivot

**CatBoost challenger verdict (vs logistic):**

- promotion = `keep-as-shadow`
- 0/5 heads pass 5-gate（localCal@0.85 systemic break）
- ranking wins 3/5 heads + Brier wins 4/5 + overload wins 3/5 — strong signal for Phase 10+ hybrid

## Failing Tests

- **contract gate check table:**

| Gate | phase | value | threshold | pass? |
| --- | --- | ---: | ---: | :---: |
| ROC-AUC (overall) | 7 | `0.8502` | `≥ 0.78` | ✓ |
| Global ECE (macro) | 7 | `0.0200` | `≤ 0.010` | ✗ |
| overload (macro) | 7 | `0.9609` | `≤ 1.00` | ✓ |
| reproducibility manifest | 7 | present | — | ✓ |
| Beta no-regression local | 9 | 3/5 regress | 0/5 | ✗ |
| CatBoost 5-gate | 10 | 0/5 pass all | 5/5 | ✗ |
| corpus admissibility | 7/9/10 | `interim` | `corrected` | ✗ |

- **failing**：`4` of `7` contract gates；皆 **expected** per 前三 MD 之 honest caveat chain：corpus 是 pre-Phase-2 interim；corrected corpus 未至，promotion 不可为。

## Conclusion

- ML validation **CONDITIONAL-GREEN**：
  - 全 3 ML script 皆 reproducible (Phase 10 Gate 5 PASS)
  - metric magnitudes 合理 (v8 > v7 ROC + 显著 overload 回撤)
  - honest promotion verdict 落 (do-not-promote × 3 artefacts)
- **gated-red**：corpus admissibility 非 corrected；per Phase 7 contract，切 serving 阻。本轮不宣 promote。
- 后续 corrected corpus (post-Phase-2) 重 export 后重跑 3 script 即可自动 re-evaluate 全闸；delta 只反 corpus 差，不反 training noise。

证：
- `audit-map/22-evals/overnight-ml-v8-corrected-logistic.md`
- `audit-map/22-evals/overnight-ml-beta-calibration.md`
- `audit-map/22-evals/overnight-ml-catboost-challenger.md`
- `audit-map/22-evals/data/overnight-ml-*.json`
