# Overnight Validate: Deterministic Replay

## Commands Run

- 二度 rerun t57 / t58 / t59 三脚本于同机、同 venv、同 seed=`4242`、同 features.csv；比两 run 之 sidecar metric delta：

```bash
LD_LIBRARY_PATH=/nix/store/ab3753m6i7isgvzphlar0a8xb84gl96i-gcc-15.2.0-lib/lib:\
/nix/store/ri9paa3mri4kqakljak8ldvbcp7lpmif-zlib-1.3.1/lib \
  pipeline/.venv/bin/python air-mentor-api/scripts/train_v8_local_corrected_logistic.py   # t57 replay
  pipeline/.venv/bin/python air-mentor-api/scripts/beta_calibrate_v8_local.py             # t58 replay
  pipeline/.venv/bin/python air-mentor-api/scripts/train_catboost_challenger_local.py     # t59 replay
```

- 对 `eval-v8-local.json` / `calibration-summary.json` / `head-to-head.json` 之 per-head metric（ROC-AUC / PR-AUC / Brier / globalECE / overloadRatio / local-ECE bands）抽每对差值；取最大绝对值 delta。

## Results Summary

| Pipeline | 两 run dir | # metric pairs | max abs delta | Verdict |
| --- | --- | ---: | ---: | :---: |
| t57 logistic v8-local | `local-v8-corrected-logistic-20260422T222216Z` vs `...20260422T230930Z` | `25` | `0.00e+00` | **BYTEWISE_DETERMINISTIC** |
| t58 Beta calibration | `beta-calibration-v8-local-20260422T225234Z` vs `...20260422T231022Z` | `30` | `0.00e+00` | **BYTEWISE_DETERMINISTIC** |
| t59 CatBoost challenger | `catboost-challenger-local-20260422T225904Z` vs `...latest` | `20` | `0.00e+00` | **BYTEWISE_DETERMINISTIC** |

- 三链皆 bytewise reproducible：`max Δ = 0.00` 于 75 metric pairs 全集。
- replayability gate：PASS（Phase 10 五闸之第五即此）。
- script SHA256、features.csv SHA256、seed、lib versions 皆落 `meta.txt`；任何后手以同文可再现。

## Failing Tests

- 无 metric drift → 无 failing replay test。
- **惟一 caveat**：`catboost` replay delta=`0.00` 于 CPU 且 `thread_count=-1`；若未来切 GPU 则另验。CatBoost CPU 之 symmetric tree + fixed seed + bitexact float op 即可复现；GPU 之 cuDNN stochastic op 不保证。本轮 CPU-only 故 PASS。

## Conclusion

- 本轮 **validate-determinism-replay** = **GREEN**。
- replay contract 已落；`train_v8_local_corrected_logistic.py` / `beta_calibrate_v8_local.py` / `train_catboost_challenger_local.py` 三者之 artefact 可于任何同机 / 同 LD_LIBRARY_PATH / 同 venv 同一 bit 复。
- 后续 corrected corpus 至，同 script 可同一流程 rerun；diff 将只反 corpus 差，非 training noise。
- Phase 10 Gate 5 `replayable` 于 t59 per-head **满足 5/5**（即便其他四 gate 破）；t57/t58 之 reproducibility manifest 亦齐。

证：
- `audit-map/22-evals/data/overnight-ml-v8-corrected-logistic-reproducibility.json`
- `audit-map/22-evals/data/overnight-ml-beta-calibration-meta.txt`
- `audit-map/22-evals/data/overnight-ml-catboost-challenger-meta.txt`
