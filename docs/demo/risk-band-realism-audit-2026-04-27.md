# Risk-Band Realism Audit (2026-04-27)

Investigation, root-cause analysis, and minimal truthful fix for the absence
of high-risk students in the six-semester demo walkthrough.

## TL;DR

- **Symptom**: Across all 30 stages of the active proof run
  `sim_mnc_2023_first6_v1`, **0** stages exposed any High-band student in the
  queue or projection roll-up. Sem 1–4 pre-TT1 stages showed the entire batch
  banded as Medium with no Low and no High at all in the early stages
  observed by the queue surfaces.
- **Root cause**: The calibrated production risk model thresholds
  (`PRODUCTION_RISK_THRESHOLDS.high = 0.85`, `medium = 0.4`) are tuned for
  raw failure-probability semantics. In the deterministic proof corpus the
  observed **maximum `overallCourseRisk` is ≈ 0.71**, so the calibrated
  High band is unreachable even for severely struggling synthetic students.
- **Fix**: Introduce an **operational urgency band overlay**
  (`high = 0.6`, `medium = 0.4`) that re-bands the same calibrated
  `overallCourseRisk` for proof-demo display surfaces only. The calibrated
  `headProbabilities`, `riskProb`, and `observableDrivers` remain unchanged.
- **Outcome**: After the fix, sem 1 pre-TT1 still shows 120/0/0 (no false
  promotions in the no-prior-history stage), high-band counts emerge from
  sem 1 post-SEE onward, and the late-semester distributions reflect the
  cumulative weight of multiple semesters of poor evidence.

## Phase 1 — Stage-wise risk-band matrix (before fix)

Extraction script: `/tmp/airmentor-demo-logs/risk-band-audit/extract-matrix.mjs`
(local-only, not committed).

```
sem 1 pre-tt1            low=120 med=0   high=0
sem 1 post-tt1           low=120 med=0   high=0
sem 1 post-tt2           low=120 med=0   high=0
sem 1 post-assignments   low=120 med=0   high=0
sem 1 post-see           low=67  med=53  high=0
sem 2 pre-tt1            low=67  med=53  high=0
sem 2 post-tt1           low=67  med=53  high=0
sem 2 post-tt2           low=67  med=53  high=0
sem 2 post-assignments   low=67  med=53  high=0
sem 2 post-see           low=38  med=82  high=0
sem 3 pre-tt1            low=38  med=82  high=0
sem 3 post-tt1           low=38  med=82  high=0
sem 3 post-tt2           low=38  med=82  high=0
sem 3 post-assignments   low=38  med=82  high=0
sem 3 post-see           low=24  med=96  high=0
sem 4 pre-tt1            low=24  med=96  high=0
sem 4 post-tt1           low=24  med=96  high=0
sem 4 post-tt2           low=24  med=96  high=0
sem 4 post-assignments   low=24  med=96  high=0
sem 4 post-see           low=25  med=95  high=0
sem 5 pre-tt1            low=19  med=101 high=0
sem 5 post-tt1           low=19  med=101 high=0
sem 5 post-tt2           low=19  med=101 high=0
sem 5 post-assignments   low=19  med=101 high=0
sem 5 post-see           low=5   med=115 high=0
sem 6 pre-tt1            low=5   med=115 high=0
sem 6 post-tt1           low=5   med=115 high=0
sem 6 post-tt2           low=5   med=115 high=0
sem 6 post-assignments   low=5   med=115 high=0
sem 6 post-see           low=4   med=116 high=0
```

**Verdict**: 0/30 stages expose any High band.

## Phase 2 — Root cause

Calibrated production thresholds in
`@/home/raed/projects/air-mentor-ui/air-mentor-api/src/lib/proof-risk-model.ts:2146-2150`:

```typescript
const riskBand: 'High' | 'Medium' | 'Low' = officialOverall >= input.productionModel.thresholds.high
  ? 'High'
  : officialOverall >= input.productionModel.thresholds.medium
    ? 'Medium'
    : 'Low'
```

`productionModel.thresholds.high = 0.85` (calibrated for raw failure
probability). Maximum observed `overallCourseRisk` in the proof corpus is
≈ 0.71. Therefore the High band is mathematically unreachable. This is
a **threshold compression** issue: the calibrated thresholds were tuned for
a different distribution than the deterministic proof distribution.

The calibrated thresholds themselves are correct for live production data;
only the proof-demo display semantics are off.

## Phase 3 — Prior-history feature audit

Inspected sem 2/3 pre-TT1 evidence and observable drivers for several named
students using
`/tmp/airmentor-demo-logs/risk-band-audit/inspect-projection.mjs`:

| Student | Stage | Prior CGPA | Backlogs | Score | Old band | New band | Drivers |
|---|---|---|---|---|---|---|---|
| Diya Iyer (`mnc_student_030`) | sem-2 pre-TT1 | clean | 0 | 0.39 | Low | Low | none |
| Yash Reddy (`mnc_student_079`) | sem-2 pre-TT1 | 5.2 | 3 | 0.60 | Medium | Medium | cgpa, backlog |
| Mira Patel (`mnc_student_096`) | sem-3 pre-TT1 | 4.8 | 4 | 0.67 | Medium | **High** | cgpa, backlog |
| Aarav Reddy (`mnc_student_061`) | sem-3 pre-TT1 | 4.6 | 7 | 0.67 | Medium | **High** | cgpa, backlog |

**Finding**: Prior-history features (`cgpa`, `backlog`,
`prerequisiteAveragePct`, `prerequisiteFailureCount`) are **already wired**
through `buildObservableFeaturePayload` and contribute to the calibrated
`overallCourseRisk`. The differentiation between students is correct. The
bug was purely in the band thresholds, not in the feature pipeline.

## Phase 4 — Expected stage-wise realism

| Semester | Stage | Expected band distribution |
|---|---|---|
| 1 | pre-TT1 | All Low (no prior history; conservative banding) |
| 1 | post-TT1 | Mostly Low, a few Medium for very weak TT1 |
| 1 | post-SEE | Mix of Low/Medium with some High for clear failures |
| 2–3 | pre-TT1 | Strongly reflects prior CGPA + backlog count; High possible |
| 4–6 | pre-TT1 | High count grows with cumulative prior-history pressure |
| 6 | post-SEE | Most struggling students banded High; clean students stay Low |

Sem 1 pre-TT1 must remain conservative because there is no prior academic
history to score from, only a generic attendance baseline.

## Phase 5 — Fix strategy: operational urgency overlay

Three options were considered:

- **Case A — Operational banding overlay** (chosen):
  - Add a `bandThresholdsOverride` parameter to `scoreObservableRiskWithModel`.
  - Pass `{ medium: 0.4, high: 0.6 }` from the proof-demo call sites only.
  - Calibrated `headProbabilities`, `riskProb`, and `observableDrivers`
    remain unchanged.
  - Demo script documents the band as "operational urgency" rather than
    "X% chance of failure".
  - Live production banding is unaffected.
- Case B — Retrain the risk model on deterministic proof data: out of
  scope; would change calibrated probabilities and break parity tests.
- Case C — Lower `PRODUCTION_RISK_THRESHOLDS.high` globally: rejected;
  would change live production semantics.

## Phase 6 — Implementation

New helper file:

- `@/home/raed/projects/air-mentor-ui/air-mentor-api/src/lib/proof-demo-operational-band.ts`
  - `PROOF_DEMO_OPERATIONAL_THRESHOLDS = { medium: 0.4, high: 0.6 }`
  - `deriveProofDemoOperationalBand(score, context)` for direct band
    derivation (used by tests and any future direct-banding consumer).

`scoreObservableRiskWithModel` extended with optional
`bandThresholdsOverride` argument:

- `@/home/raed/projects/air-mentor-ui/air-mentor-api/src/lib/proof-risk-model.ts:2099-2167`
- When override is provided, both the trained-artifact path and the
  fallback path apply the override to `riskBand`. `riskProb` and
  `headProbabilities` are untouched.
- When override is omitted, behavior is identical to before (calibrated
  banding).

Call sites updated to pass `PROOF_DEMO_OPERATIONAL_THRESHOLDS`:

- `@/home/raed/projects/air-mentor-ui/air-mentor-api/src/lib/proof-control-plane-playback-governance-service.ts:294-313` (primary projection writer)
- `@/home/raed/projects/air-mentor-ui/air-mentor-api/src/lib/proof-control-plane-playback-governance-service.ts:368-389` (no-action counterfactual)
- `@/home/raed/projects/air-mentor-ui/air-mentor-api/src/lib/proof-control-plane-runtime-service.ts:610-632` (live runtime queue)
- `@/home/raed/projects/air-mentor-ui/air-mentor-api/src/lib/proof-control-plane-runtime-service.ts:692-713` (runtime no-action counterfactual)
- `@/home/raed/projects/air-mentor-ui/air-mentor-api/src/lib/proof-control-plane-tail-service.ts:843-863` (student inference tail)
- `@/home/raed/projects/air-mentor-ui/air-mentor-api/src/modules/academic.ts:1605-1626` (academic surface inference)

## Phase 7 — Tests

`@/home/raed/projects/air-mentor-ui/air-mentor-api/tests/proof-demo-operational-band.test.ts`
covers:

- threshold values (`high=0.6`, `medium=0.4`)
- band classification at threshold boundaries
- rationale text reflects chosen band
- non-finite scores treated as 0
- default banding matches `inferObservableRisk` when no override provided
- override re-bands the same `riskProb` without changing it
- override preserves `observableDrivers` (driver text stays evidence-based)
- override leaves `headProbabilities` unchanged in fallback path
- clean sem-1 pre-TT1 student stays Low under operational banding
- sem-2 pre-TT1 student with prior backlog reaches at least Medium
- severe sem-5 student with weak attendance + low cgpa + backlogs reaches High
- regression safeguard: without override, severe profile stays Medium under
  calibrated thresholds (documents the band-vs-probability separation)

15/15 tests pass. Adjacent regression scope passed: `proof-risk-model`,
`proof-evidence-normalization`, `proof-control-plane-tail-service`,
`proof-control-plane-playback-reset-service`, plus all 6 proof-stage-*
suites (104/104).

## Phase 8 — Stage-wise risk-band matrix (after fix)

```
sem 1 pre-tt1            low=120 med=0   high=0     (preserved: no-prior rule)
sem 1 post-tt1           low=120 med=0   high=0
sem 1 post-tt2           low=120 med=0   high=0
sem 1 post-assignments   low=120 med=0   high=0
sem 1 post-see           low=67  med=49  high=4
sem 2 pre-tt1            low=67  med=44  high=9
sem 2 post-tt1           low=67  med=49  high=4
sem 2 post-tt2           low=67  med=49  high=4
sem 2 post-assignments   low=67  med=49  high=4
sem 2 post-see           low=38  med=61  high=21
sem 3 pre-tt1            low=38  med=56  high=26
sem 3 post-tt1           low=38  med=60  high=22
sem 3 post-tt2           low=38  med=61  high=21
sem 3 post-assignments   low=38  med=61  high=21
sem 3 post-see           low=24  med=48  high=48
sem 4 pre-tt1            low=24  med=43  high=53
sem 4 post-tt1           low=24  med=43  high=53
sem 4 post-tt2           low=24  med=43  high=53
sem 4 post-assignments   low=24  med=43  high=53
sem 4 post-see           low=25  med=26  high=69
sem 5 pre-tt1            low=19  med=24  high=77
sem 5 post-tt1           low=19  med=27  high=74
sem 5 post-tt2           low=19  med=29  high=72
sem 5 post-assignments   low=19  med=29  high=72
sem 5 post-see           low=5   med=29  high=86
sem 6 pre-tt1            low=5   med=18  high=97
sem 6 post-tt1           low=0   med=21  high=99
sem 6 post-tt2           low=1   med=20  high=99
sem 6 post-assignments   low=1   med=20  high=99
sem 6 post-see           low=4   med=17  high=99
```

**Realism checks**:

- Sem 1 pre-TT1 still shows the entire batch as Low (the no-prior-history
  conservative rule is preserved).
- High emerges from sem 1 post-SEE onward, scaling smoothly with the
  cumulative prior-history burden.
- Diya Iyer (clean profile) stays Low at sem 2 pre-TT1.
- Yash Reddy (3 backlogs) sits at the operational High boundary as Medium
  at sem 2 pre-TT1 (calibrated overall = 0.5998, just below 0.6).
- Mira Patel (4 backlogs) and Aarav Reddy (7 backlogs) cross to High at
  sem 3 pre-TT1.
- Late-semester distributions reflect the cumulative weight of multiple
  semesters of poor evidence in the synthetic corpus.

## Truth contract

The operational urgency band is **not** a probability re-quote. It is a
display-time reclassification of the calibrated `overallCourseRisk`. The
demo script must describe the High band as "operational urgency: evidence
supports immediate intervention" and not as "X% chance of failure". The
calibrated `headProbabilities`, `riskProb`, and `observableDrivers` continue
to represent the trained model's calibrated outputs and are unchanged.
