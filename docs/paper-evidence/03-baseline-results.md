# 03 — Baseline Results

> Phase: P2 (Validation Methodology Fix), tasks 2.2 + 2.4 + 2.5
> Companion: `docs/paper-evidence/02-validation-protocol.md`,
> `docs/references.bib`,
> `air-mentor-api/scripts/generate-baseline-paper-evidence.ts`
> Generated: deterministic — re-run the script to refresh.

Two paper baselines on two synthetic test corpora.
Baselines: **majority-class** (empirical positive rate) and
**two-feature logistic** (attendance + CGPA, Newton-Raphson IRLS).
Test corpora: **power-law forgetting** (adversarial — heavier tail than
the engine's near-exponential dynamics) and **exponential forgetting**
(control — matched α). Both corpora are produced by the same code
path, so AUC differences are attributable to the kernel rather than
to confounded code paths.

Configuration:
- Corpus size: 96 rows per corpus, 6-semester student trajectories.
- Power-law decay exponent α = 0.6 (Wickelgren-Rubin range).
- Train seed: 11; adversarial test seed: 7; control test seed: 23.
- Bootstrap B = 1000, α = 0.05 (95% CI).
- Two-feature logistic: ridge = 1e-3, max iterations = 50, tolerance = 1e-8.

Train cohort: 96 rows, positive rate 22.9%.
Two-feature logistic converged at iteration 11 (converged=true).
Weights: intercept=-8.1404, w_attendance=-10.6559, w_cgpa=-0.7905.

## AUC + Brier on the two test corpora

| Corpus | n | Positive rate | Majority AUC | 2-feature AUC | 2-feature AUC 95% CI | Majority Brier | 2-feature Brier | 2-feature Brier 95% CI |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| adversarial-power-law | 96 | 39.6% | 0.5000 | 0.9918 | [0.9795, 0.9996] | 0.2669 | 0.0411 | [0.0161, 0.0702] |
| control-exponential | 96 | 53.1% | 0.5000 | 0.9974 | [0.9911, 1.0000] | 0.3403 | 0.0237 | [0.0035, 0.0499] |

Notes:
- Majority-class AUC is exactly 0.5 by construction (no information).
  The Brier score for majority-class is the variance of the label
  distribution (≤ 0.25 for any cohort).
- 2-feature logistic AUC well above 0.5 → the (attendance, CGPA)
  pair carries real signal even before the engine's 43-feature
  representation kicks in. This is the **floor** the production-v8
  model has to clear; numbers below this floor would invalidate
  paper claim N1.
- The CI gap between adversarial and control corpora is the
  literal "boundary of generalisation" disclosure for the paper.

## Reliability diagram data — 2-feature logistic

| Corpus | bins | ECE | MCE |
|---|---:|---:|---:|
| adversarial-power-law | 10 | 0.0458 | 0.6285 |
| control-exponential | 10 | 0.0332 | 0.6815 |

Per-bin breakdown for the adversarial corpus (load-bearing for the paper figure):

| Bin | Range | Count | Mean predicted | Fraction positive |
|---:|---|---:|---:|---:|
| 0 | [0.00, 0.10) | 52 | 0.0053 | 0.0000 |
| 1 | [0.10, 0.20) | 3 | 0.1516 | 0.3333 |
| 2 | [0.20, 0.30) | 2 | 0.2328 | 0.5000 |
| 3 | [0.30, 0.40) | 1 | 0.3715 | 1.0000 |
| 4 | [0.40, 0.50) | 1 | 0.4229 | 1.0000 |
| 5 | [0.50, 0.60) | 1 | 0.5920 | 0.0000 |
| 6 | [0.60, 0.70) | 3 | 0.6893 | 0.6667 |
| 7 | [0.70, 0.80) | 1 | 0.7491 | 1.0000 |
| 8 | [0.80, 0.90) | 2 | 0.8632 | 0.5000 |
| 9 | [0.90, 1.00) | 30 | 0.9932 | 1.0000 |

## Permutation feature importance — 2-feature logistic on adversarial corpus

| Feature | Δ AUC | std | baseline AUC | mean permuted AUC |
|---|---:|---:|---:|---:|
| attendancePct | 0.4633 | 0.0596 | 0.9918 | 0.5285 |
| currentCgpa | 0.0016 | 0.0031 | 0.9918 | 0.9903 |

Δ AUC reads "how much does AUC drop when this feature is
shuffled within the corpus?" Larger Δ → the model relied more
heavily on the feature. The result must show **attendancePct >
currentCgpa** for paper claim alignment with the Credé attendance
meta-analysis (`docs/references.bib::crede2010class`).

## Reproduction

```
npx tsx air-mentor-api/scripts/generate-baseline-paper-evidence.ts
```

Determinism is locked by the seeds in this script. To rerun
with different α / corpus size / bootstrap B, edit the
constants at the top of the file and re-run.

Engineering-tier disclosures (paper Limitations §):
1. The adversarial corpus is itself synthetic — power-law
   forgetting is one of several literature-supported retention
   models, not the only one (see `docs/references.bib`).
2. Train and test corpora share the same code path; only the
   forgetting kernel and seed differ. This bounds what we can
   claim about real-cohort generalisation.
3. The 2-feature logistic is the *floor* baseline, not a
   competitive model. Paper Experiments compares the full
   production-v8 against this floor and the majority-class
   chance line.
