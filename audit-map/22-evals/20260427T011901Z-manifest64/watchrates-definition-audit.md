# `watchRatesWithinLimit` definition audit — `20260427T011901Z-manifest64`

Status: **AMBER**.
Decision: do **not** waive the failed gate. Document the metric-definition mismatch and require either a naming/reporting fix or a B1-time re-run before flipping classification.

## 1. The two numbers that look contradictory

The lightning memo `docs/proof-risk-manifest64-lightning-analysis-2026-04-27.md` cites two facts that appear to disagree:

- **per-run gate**: `passesWatchRate = false`, with sem-2 post-tt1 P95 watch rate `0.4667` against limit `0.45`, max watch rate `0.7333`, mean `0.0678`.
- **cross-run union view**: "watch state = 0" for all stages.

Both numbers come from the same evaluator output. Both are correct. They are measuring different quantities and should not be reconciled by treating one as cosmetic.

## 2. Code references

`/home/raed/projects/air-mentor-ui/air-mentor-api/src/lib/proof-queue-governance.ts`

```ts
export const PROOF_QUEUE_DEFAULT_ACTIONABLE_RATE_LIMIT = 0.3
export const PROOF_QUEUE_LATE_STAGE_ACTIONABLE_RATE_LIMIT = 0.35
export const PROOF_QUEUE_SECTION_EXCESS_TOLERANCE = 0.1
export const PROOF_QUEUE_WATCH_RATE_LIMIT = 0.45
```

`/home/raed/projects/air-mentor-ui/air-mentor-api/scripts/evaluate-proof-risk-model.ts`

Per-run rollup (the gate):

```ts
const watchRates = stageObservations.map(observation => (
  observation.uniqueStudentCount > 0
    ? observation.watchStudentCount / observation.uniqueStudentCount
    : 0
))
// …
passesWatchRate: sample.stageKey === 'pre-tt1' || percentile(watchRates, 0.95) <= PROOF_QUEUE_WATCH_RATE_LIMIT,
```

Per-run student counts inside one simulation run:

```ts
} else if (row.queueState === 'watch' && !stageRollup.openQueueStudents.has(row.studentId)) {
  stageRollup.watchStudents.add(row.studentId)
  if (!queueStageRunRollup.openQueueStudents.has(queueStudentKey)) {
    queueStageRunRollup.watchStudents.add(queueStudentKey)
  }
}
```

Cross-run union diagnostic (not a gate):

```ts
const diagnosticCrossRunUnionByStage = stageRollups.map(item => {
  const stageKey = `${item.semesterNumber}::${item.stageKey}`
  const seed = stageRollupSeed.get(stageKey)
  const actionableOpenRate = item.uniqueStudentCount > 0 ? roundToFour(item.openQueueStudentCount / item.uniqueStudentCount) : 0
  const watchRate = item.uniqueStudentCount > 0 ? roundToFour(item.watchStudentCount / item.uniqueStudentCount) : 0
  // …
})
```

with the explicit metric note in the same file:

```ts
const queueBurdenSummary = {
  metricNote: 'Queue burden acceptance uses per-run stage statistics. Open queue counts reflect actionable items only; watching rows remain visible but do not block progression. Cross-run union counts are retained only as a diagnostic view.',
  thresholds: PROOF_QUEUE_GOVERNANCE_THRESHOLDS,
  byStage: queueBurdenByStage,
  diagnosticCrossRunUnionByStage,
  acceptanceGates: { … }
}
```

## 3. Numerator, denominator, threshold — exact

### 3.1 Per-run gate (`queueBurdenSummary.byStage[*].passesWatchRate`)

- **Source**: `projectionRows` from one `simulationRunId × stageKey` slice; rebuilt independently per simulation run.
- **Numerator**: number of distinct `studentId` values where `row.queueState === 'watch'` and the same `studentId` is **not** present in `openQueueStudents` for the same stage rollup of the same run. Watch rows are explicitly demoted whenever the student is later opened in the same run.
- **Denominator**: `uniqueStudentCount` for that `simulationRunId × stageKey`.
- **Aggregate**: per-stage **across runs**, the evaluator computes `mean`, `median`, `p95`, `max`. The gate uses `percentile(watchRates, 0.95)`.
- **Threshold**: `PROOF_QUEUE_WATCH_RATE_LIMIT = 0.45`.
- **Special case**: stage `pre-tt1` always passes (`stageKey === 'pre-tt1' || …`). Operationally this means pre-TT1 has no watch evaluation because there is no scored evidence yet.
- **Failure semantics**: a single `(semester, stage)` pair where ≥ 5% of simulation runs put more than 45% of unique students in pure-watch state will trip the gate.

### 3.2 Cross-run union view (`diagnosticCrossRunUnionByStage[*].watchRate`)

- **Source**: `stageRollupSeed` accumulated **across all simulation runs** at evaluator scope.
- **Numerator**: `watchStudentCount = [...data.watchStudents].filter(studentId => !data.openQueueStudents.has(studentId)).length` where both sets are union-of-all-runs at that stage.
- **Denominator**: union-of-all-runs `uniqueStudents.size` at that stage.
- **No threshold, no gate.**

### 3.3 Why they differ in the same report

In a 64-run manifest with 120 unique synthetic students per stage, almost every student gets opened in **some** run at any post-pre-tt1 stage. The cross-run union therefore reports `openQueueStudentCount = 120` and `watchStudentCount = 0` everywhere from sem-1 post-tt1 onward (verified directly in `evaluation-report.json`):

| Sem | Stage | uniqueStudentCount | openQueueStudentCount | watchStudentCount | watchRate |
|---|---|---:|---:|---:|---:|
| 1 | pre-tt1 | 120 | 0 | 0 | 0 |
| 1 | post-tt1 | 120 | 120 | 0 | 0 |
| 1 | post-tt2 | 120 | 120 | 0 | 0 |
| … | … | 120 | 120 | 0 | 0 |
| 2 | post-tt1 | 120 | 120 | 0 | 0 |

This collapse to zero is **structural to union-over-runs**, not evidence that "no student was on watch". In the very same report, the per-run statistic for sem-2 post-tt1 reports `meanWatchRate = 0.0678`, `p95WatchRate = 0.4667`, `maxWatchRate = 0.7333`.

## 4. What `watchRatesWithinLimit = false` actually says

It says: in **at least 5%** of the 64 simulation runs at sem-2 post-tt1, more than **45%** of the cohort was placed in pure-watch state. That is per-run staffing pressure inside one stage of one semester. It is not a global queue-overload claim; it is not a model-quality claim; and it is not the same metric as the cross-run union story.

The mean of `0.0678` reveals the typical run is well below the limit. The failure is concentrated in the upper tail of the run distribution. Whether that upper tail is operationally relevant depends on:

- whether stress-test scenario families (`weak-foundation`, `low-attendance`, `high-forgetting`, `coursework-inflation`, `exam-fragility`, `carryover-heavy`, `intervention-resistant`) are intentionally over-represented in the manifest,
- whether the `0.45` ceiling was set as an *expected-pass* operating target or as a *no-stress-pass* target,
- whether the watching rows at the 0.7333 max really lead to staff-time burden or are visibility-only signals that a course leader can ignore.

None of those have been answered with text inside the run itself. The acceptance-gate field gives a binary, not a justification.

## 5. Sufficient conditions for each status

### 5.1 GREEN (waive as expected stress-test artifact)

Require all of:

- documented evidence that the stress-test scenario mix in `manifest-64` over-represents pathological worlds relative to operational rollout expectations;
- agreement that `PROOF_QUEUE_WATCH_RATE_LIMIT = 0.45` is a no-stress-pass ceiling, not an expected operational mean;
- explicit annotation in the evaluator output (e.g. `acceptanceGateSummary.queueBurden.watchRatesWithinLimit.expectedFail = true` or a sibling field) so the failed gate cannot be silently confused with a real regression;
- a paired non-stress-only sub-corpus that **does** pass the gate, included in the same artifact for comparison.

If any of those are missing, GREEN is not yet defensible.

### 5.2 AMBER (current status — chosen)

The two co-existing facts (per-run sem-2 post-tt1 P95 0.4667 fails the 0.45 limit; cross-run union shows 0 across all stages) are not yet **named or reported** in a way that prevents reasonable readers from conflating them. The per-run gate is real; the cross-run view is not a gate; and neither the prior memo nor the evaluator MD output makes that distinction prominent enough to support a waiver.

Required actions before AMBER → GREEN:

1. Rename the cross-run union table to something that cannot be read as a watch-rate gate (e.g. `Cross-Run Union Diagnostic — Open / Pure-Watch Coverage Across All 64 Runs`, with explicit "**this is not a gate**" caption).
2. Add a per-stage breakdown of how many runs out of 64 contributed to the failing P95 at sem-2 post-tt1 (i.e. how concentrated the upper-tail failure is).
3. Document whether the 0.45 limit is an expected-mean ceiling or a no-stress-pass ceiling.
4. Add a non-stress-only sub-corpus comparison if a no-stress-pass interpretation is preferred.

These are reporting fixes, not model fixes, so they can be done **after** B1 in the same baseline freeze.

### 5.3 RED (real operational blocker)

The current data does not support RED. RED would require evidence that:

- the failure is not concentrated in stress-only manifest scenarios but appears in balanced/typical runs;
- the queue at sem-2 post-tt1 is operationally unmanageable at typical staffing;
- watching rows actually produce staff-time burden (not visibility-only).

None of those are demonstrated by the artifact itself. RED is not currently warranted.

## 6. Non-actions in this audit

- **No** evaluator gate is being changed.
- **No** acceptance-gate boolean is being flipped.
- **No** threshold is being renamed.
- **No** simulation manifest is being narrowed.

Behavior change requires either (a) the reporting/naming fix described in 5.2, or (b) a follow-up audit specifically commissioned with B1 marks in place.

## 7. One-line answer

`watchRatesWithinLimit` is **AMBER**. The per-run gate measures per-run pure-watch student fraction at a stage; the cross-run union diagnostic measures union-of-runs pure-watch coverage and is not a gate. The two metrics are not interchangeable and the failure should not be waived until either the reporting is clarified or a B1-time re-run is examined.
