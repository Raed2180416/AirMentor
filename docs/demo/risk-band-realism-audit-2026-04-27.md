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
  (`high = 0.65`, `medium = 0.4`) that re-bands the same calibrated
  `overallCourseRisk` for proof-demo display surfaces only. The calibrated
  `headProbabilities`, `riskProb`, and `observableDrivers` remain unchanged.
  The `high = 0.65` value was chosen via a sensitivity audit (see below)
  to balance "every student High" against "no student ever High".
- **Isolation**: The override is gated by `proofScopeActive` in the
  academic surface; live institutional data (no proof run owning the
  batch) keeps calibrated banding semantics. The proof-control-plane
  services (playback governance, runtime, tail) only operate on proof
  simulation runs and pass the override unconditionally.
- **Outcome**: After the fix, sem 1 pre-TT1 still shows 120/0/0 (no false
  promotions in the no-prior-history stage), high-band counts emerge from
  sem 2 pre-TT1 onward, and the late-semester distributions reflect the
  cumulative weight of multiple semesters of poor evidence without
  collapsing the entire cohort into High.

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
  - Pass `{ medium: 0.4, high: 0.65 }` from the proof-demo call sites only.
  - Calibrated `headProbabilities`, `riskProb`, and `observableDrivers`
    remain unchanged.
  - Demo script documents the band as "operational urgency" rather than
    "X% chance of failure".
  - Live production banding is unaffected.
- Case B — Retrain the risk model on deterministic proof data: out of
  scope; would change calibrated probabilities and break parity tests.
- Case C — Lower `PRODUCTION_RISK_THRESHOLDS.high` globally: rejected;
  would change live production semantics.

## Phase 5b — Sensitivity audit (2026-04-28)

The initial implementation used `high = 0.6`, which over-corrected the
proof corpus distribution. A direct DB-side sensitivity probe pulled
every `simulation_stage_student_projections` row, computed each
student's per-stage maximum `riskProbScaled`, and re-banded the cohort
at `high = 0.60 / 0.65 / 0.70` with `medium` fixed at `0.40`.

| sem | stage | n | avg | max | low/med/high @0.60 | low/med/high @0.65 | low/med/high @0.70 |
|---|---|---|---|---|---|---|---|
| 1 | pre-tt1   | 120 | 37.15 | 38 | 120/0/0 | 120/0/0 | 120/0/0 |
| 1 | post-see  | 120 | 42.02 | 65 | 67/49/4 | 67/49/4 | 67/53/0 |
| 2 | pre-tt1   | 120 | 44.17 | 67 | 67/42/11 | 67/49/4 | 67/53/0 |
| 3 | pre-tt1   | 120 | 49.58 | 67 | 38/46/36 | 38/61/21 | 38/82/0 |
| 4 | pre-tt1   | 120 | 53.9 | 70 | 24/42/54 | 24/51/45 | 24/84/12 |
| 5 | pre-tt1   | 120 | 59.87 | 71 | 19/23/78 | 19/32/69 | 19/65/36 |
| 6 | pre-tt1   | 120 | 62.48 | 67 | 5/16/99 | 5/30/85 | 5/115/0 |
| 6 | post-see  | 120 | 62.52 | 69 | 4/17/99 | 4/31/85 | 4/116/0 |

**Decision: `high = 0.65`.** Rationale:

- `0.70` makes High empty at sem 1–3 (max scaled 67 < 70) and at sem 6
  (zero High students). Severe named examples disappear entirely.
- `0.60` leaves sem 6 at 99/120 High (≈82% of cohort) which strains
  the "High = urgent" semantics: a mentor cannot prioritize 99 cases.
- `0.65` keeps every named severe profile (Mira Patel, Aarav Reddy,
  Student 010 at scaled 65–67) in the High band, lets Yash Reddy
  (3 sem-1 backlogs) sit correctly as Medium at sem 2 pre-TT1, and
  reduces the sem 6 High count from 99 to 85 (≈71%, still high but
  reflecting the synthetic corpus' deliberately heavy backlog load).

Named students at `high = 0.65` (per the sensitivity probe):

| student | sem 2 pre-TT1 | sem 3 pre-TT1 | sem 4 pre-TT1 | sem 5 pre-TT1 | sem 6 post-see |
|---|---|---|---|---|---|
| Diya Iyer (clean) | Low (39) | Low (38) | Low (34) | Low (38) | Medium (40) |
| Yash Reddy (3 backlogs sem 1) | Medium (60) | High (67) | High (69) | High (71) | High (67) |
| Mira Patel (4 backlogs) | Medium (52) | High (67) | High (69) | High (68) | High (66) |
| Aarav Reddy (7 backlogs) | High (67) | High (67) | High (70) | High (71) | High (66) |
| Arjun Reddy (borderline) | Medium (46) | Medium (60) | High (66) | High (67) | High (66) |
| Student 010 (severe) | Low (38) | Medium (60) | Medium (59) | High (67) | High (67) |

Numbers in parentheses are `riskProbScaled` (0–100). The override
re-bands these scores; the calibrated probabilities and drivers are
unchanged.

## Phase 6 — Implementation

New helper file:

- `@/home/raed/projects/air-mentor-ui/air-mentor-api/src/lib/proof-demo-operational-band.ts`
  - `PROOF_DEMO_OPERATIONAL_THRESHOLDS = { medium: 0.4, high: 0.65 }`
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
- `@/home/raed/projects/air-mentor-ui/air-mentor-api/src/modules/academic.ts:1605-1626` (academic surface inference, gated by `applyDemoOperationalBanding: proofScopeActive`)

### Demo-only isolation

The four proof-control-plane services only run within proof simulation
run contexts and pass the override unconditionally. The academic surface
at `@/home/raed/projects/air-mentor-ui/air-mentor-api/src/modules/academic.ts:1546-1640` accepts an
`applyDemoOperationalBanding` flag and only applies the override when the
flag is true. The caller at
`@/home/raed/projects/air-mentor-ui/air-mentor-api/src/modules/academic.ts:3542-3569` passes
`proofScopeActive` (true when a proof simulation run owns the batch).
Real institutional offerings (no proof run owning the batch) receive the
calibrated banding semantics with no override applied.

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

16/16 tests pass (added a "passing `bandThresholdsOverride: null` is
identical to omitting the override" regression safeguard). Adjacent
regression scope passed: `proof-risk-model`,
`proof-evidence-normalization`, `proof-control-plane-tail-service`,
`proof-control-plane-playback-reset-service`, plus all 6 proof-stage-*
suites (104/104).

## Truth contract

The operational urgency band is **not** a probability re-quote. It is a
display-time reclassification of the calibrated `overallCourseRisk`. The
demo script must describe the High band as "operational urgency: evidence
supports immediate intervention" and not as "X% chance of failure". The
calibrated `headProbabilities`, `riskProb`, and `observableDrivers` continue
to represent the trained model's calibrated outputs and are unchanged.
