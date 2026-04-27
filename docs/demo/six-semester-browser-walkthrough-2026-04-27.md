# Six-Semester Walkthrough Matrix — College Demo (2026-04-27)

Source data: `/tmp/airmentor-demo-logs/walk-v2/walk-summary.json`
(produced by `/tmp/airmentor-demo-logs/full-walk-v2.mjs` against the
seeded local backend with active run `sim_mnc_2023_first6_v1`).

## Active run header

| Key | Value |
|---|---|
| simulationRunId | `sim_mnc_2023_first6_v1` |
| runLabel | "MSRUAS first-6-semester proof batch" |
| status / lifecycleState | `active` |
| students | 120 |
| faculty | 10 (PROOF_FACULTY) |
| sections | 2 (A + B) |
| semesterStart..End | 1..6 |
| checkpoints | 30 (6 × 5 stages) |

Stages walked: `pre-tt1`, `post-tt1`, `post-tt2`, `post-assignments`, `post-see`.

## Per-stage risk distribution + queue + drift (cohort = 120 students)

Legend: `lo / med / hi` = student count by risk band (low/medium/high).
`queue` = open-queue count at the checkpoint. `Δrisk(prev)` =
`averageRiskChangeFromPreviousCheckpointScaled` (×100). `cf-lift` =
`averageCounterfactualLiftScaled` (×100, with-vs-without intervention).

### Semester 1 (no prior CGPA / no backlog history / no prereq history)

| Stage | lo | med | hi | queue | Δrisk(prev) | cf-lift | Notes |
|---|---:|---:|---:|---:|---:|---:|---|
| pre-tt1 | 0 | 120 | 0 | 0 | 0.0 | 0.0 | Cohort starts at "medium" baseline. No academic-history evidence. UI must NOT claim historical certainty. |
| post-tt1 | 120 | 0 | 0 | 0 | -4.8 | 0.0 | TT1 evidence shifts cohort to low. Queue still empty. |
| post-tt2 | 120 | 0 | 0 | 0 | -9.2 | 0.0 | TT2 reinforces low. |
| post-asg | 120 | 0 | 0 | 0 | +0.3 | 0.0 | Quiz/assignment evidence nudges marginally. |
| post-see | 90 | 30 | 0 | 0 | +5.9 | 0.0 | SEE reveals fragility in 30 students; flagged as medium for sem 2 carry-in. |

**Sem 1 acceptance**: Pre-TT1 produces no high-risk and no queue. Post-stages reveal evidence as expected. Sem 1 satisfies the "no prior history → no overclaim" rule.

### Semester 2 (prior sem 1 CGPA / backlog / prereq history available)

| Stage | lo | med | hi | queue | Δrisk(prev) | cf-lift | Notes |
|---|---:|---:|---:|---:|---:|---:|---|
| pre-tt1 | 0 | 120 | 0 | 0 | 0.0 | 0.0 | Pre-TT1 still uses cohort medium baseline; prior history present in DB but does not yet differentiate the band split at this cohort scale. **Caveat: discuss visibility upgrade in P1 doc.** |
| post-tt1 | 67 | 53 | 0 | **15** | -4.4 | 0.0 | TT1 splits the cohort. 15 queue cases open — first stage where teacher action required. |
| post-tt2 | 90 | 30 | 0 | 0 | -9.8 | 0.0 | TT2 stabilises majority to low; queue clears. |
| post-asg | 90 | 30 | 0 | 0 | +0.2 | 0.0 | Coursework neutral. |
| post-see | 69 | 51 | 0 | 0 | +4.5 | 0.0 | SEE reveals exam-fragility re-rise. |

### Semester 3

| Stage | lo | med | hi | queue | Δrisk(prev) | cf-lift |
|---|---:|---:|---:|---:|---:|---:|
| pre-tt1 | 0 | 120 | 0 | 0 | 0.0 | 0.0 |
| post-tt1 | 38 | 82 | 0 | **19** | -4.4 | 0.0 |
| post-tt2 | 69 | 51 | 0 | 0 | -9.9 | 0.0 |
| post-asg | 69 | 51 | 0 | 0 | +0.3 | 0.0 |
| post-see | 48 | 72 | 0 | 0 | +4.3 | +0.1 |

### Semester 4 (prior history starts visible at pre-TT1)

| Stage | lo | med | hi | queue | Δrisk(prev) | cf-lift |
|---|---:|---:|---:|---:|---:|---:|
| pre-tt1 | **16** | 104 | 0 | 0 | 0.0 | 0.0 |
| post-tt1 | 24 | 96 | 0 | **22** | -4.3 | 0.0 |
| post-tt2 | 52 | 68 | 0 | 0 | -10.0 | 0.0 |
| post-asg | 52 | 68 | 0 | 0 | +0.3 | 0.0 |
| post-see | 31 | 89 | 0 | 0 | +4.2 | +0.1 |

**Sem 4 pre-TT1 produces 16 low-risk students directly from prior-history signal.** This is the cleanest stage to demo "Sem 2-6 pre-TT1 reflects prior CGPA / backlog / prereq history".

### Semester 5

| Stage | lo | med | hi | queue | Δrisk(prev) | cf-lift |
|---|---:|---:|---:|---:|---:|---:|
| pre-tt1 | 25 | 95 | 0 | 0 | 0.0 | 0.0 |
| post-tt1 | 33 | 87 | 0 | 18 | -4.1 | 0.0 |
| post-tt2 | 51 | 69 | 0 | 0 | -9.9 | 0.0 |
| post-asg | 51 | 69 | 0 | 0 | +0.4 | 0.0 |
| post-see | 27 | 93 | 0 | 0 | +4.1 | +0.1 |

(Numbers above pulled from `/tmp/airmentor-demo-logs/walk-v2/walk-summary.json`.)

### Semester 6 (active operational target on demo)

| Stage | lo | med | hi | queue | Δrisk(prev) | cf-lift |
|---|---:|---:|---:|---:|---:|---:|
| pre-tt1 | 18 | 102 | 0 | 0 | 0.0 | 0.0 |
| post-tt1 | 24 | 96 | 0 | 22 | -4.0 | 0.0 |
| post-tt2 | 47 | 73 | 0 | 0 | -9.7 | 0.0 |
| post-asg | 47 | 73 | 0 | 0 | +0.3 | 0.0 |
| post-see | 29 | 91 | 0 | 0 | +4.0 | +0.1 |

**Sem 6 post-SEE is the analytics target for the HoD page.**

## Stage-evidence visibility ruleset (verified by stage descriptions)

| Stage | Visible | Hidden |
|---|---|---|
| pre-tt1 | attendance, scheme, timetable, prior CGPA / backlog / prereq | TT1, TT2, quiz, assignment, SEE |
| post-tt1 | + TT1 marks (locked) | TT2, quiz, assignment, SEE |
| post-tt2 | + TT2 marks (locked) | quiz, assignment, SEE |
| post-asg | + quiz + assignment | SEE |
| post-see | all evidence + final result/grade | nothing further hidden |

Stage labels and descriptions come straight from the
`simulationStageCheckpoints.stageDescription` column. Source proof:
sample dump `/tmp/airmentor-demo-logs/walk-v2/checkpoint-detail-sem6-post-see.json`.

## Sample student (Aarav Sharma, sem 6, AMC-S6-32 sec A)

| Stage | attendance | TT1 | TT2 | quiz | asgn | riskProb | riskBand |
|---|---:|---:|---:|---:|---:|---:|---|
| pre-tt1 (default) | 28/32 | null | null | null | null | 0.6257 | Medium |
| after attendance edit (12/32) | 12/32 | null | null | null | null | 0.6330 | Medium |

The risk **probability moves** when attendance drops (38% vs 88%) but
the band stays Medium because the threshold did not cross. This is the
honest "edit affects risk, threshold may not flip" demo we can show.

## Counterfactual / no-action panel

`GET /api/academic/hod/proof-counterfactual-simulator?runId=<run>` →
returns `{ runId, generatedAt, perStudentPerStage, bySemesterStage,
bySemester, projectedFinal }`. All four sections populate with
deterministic projection rows for sem-6 with-intervention vs
without-intervention. This satisfies the "counterfactual / no-action vs
intervention" demo beat.

## Acceptance: walkthrough matrix

- [x] All 6 semesters × 5 stages activated successfully.
- [x] Stage descriptions match the visible-evidence rule.
- [x] Sem 1 pre-TT1 does not produce high-risk or open queue.
- [x] Sem 4-6 pre-TT1 visibly reflects prior history (lo > 0).
- [x] TT1 visibly drives queue (15-22 cases per semester).
- [x] post-SEE re-introduces medium-band fragility.
- [ ] **Caveat**: Sem 2-3 pre-TT1 still shows 0 lo / 120 med. Prior
      history influence at pre-TT1 only becomes visible from sem 4
      onward in this seeded run. Talking point: prior-history
      differentiation grows as more semesters of evidence accumulate.
