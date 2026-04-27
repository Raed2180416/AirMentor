# Marks Evolution + CO Audit — College Demo (2026-04-27)

Source artifacts:
- `/tmp/airmentor-demo-logs/walk-v2/teacher-bootstrap.json` (per-student rows under `studentsByOffering`)
- `/tmp/airmentor-demo-logs/walk-v2/checkpoint-detail-sem6-post-see.json` (offering rollups + queue at post-SEE)
- `/tmp/airmentor-demo-logs/edit/edit-recompute-summary.json` (round-trip)

## Sample students (from sem 6 cohort, default seed)

| # | studentId | usn | name | Archetype evidence | Notes |
|---|---|---|---|---|---|
| 1 | mnc_student_001 | 1MS23MC001 | Aarav Sharma | medium-risk in pre-tt1, prevCgpa=6.01 | "weak-foundation" archetype |
| 2 | mnc_student_004 | 1MS23MC004 | Ananya Reddy (cohort row) | strong stable | prevCgpa>7 |
| 3 | mnc_student_011 | 1MS23MC011 | Krish Iyer | low-attendance, mid-marks | |
| 4 | mnc_student_023 | 1MS23MC023 | Saanvi Patel | high-attendance, weak-marks | |
| 5 | mnc_student_037 | 1MS23MC037 | Yash Bhat | prerequisite-dominant | prereq history surfaces in sem 4+ |
| 6 | mnc_student_058 | 1MS23MC058 | Ira Sharma | coursework-inflated, SEE-fragile | post-SEE jump |
| 7 | mnc_student_072 | 1MS23MC072 | Tara Joshi | intervention-responsive | watch in sem 3, recovers sem 4 |
| 8 | mnc_student_096 | 1MS23MC096 | Kabir Singh | persistent-risk | medium across multiple sems |

(Student selection is the canonical demo set — the trajectories are
deterministic per the seeded `runSeed=101` so row #N maps to the same
synthetic profile every run.)

## What we can show on stage

The bootstrap payload exposes exactly the columns the UI's
risk-explorer uses, so for each student × offering × stage we can
state on stage:

| Field | Source | Stage availability |
|---|---|---|
| `present / totalClasses` | studentsByOffering | always (attendance is the open evidence) |
| `tt1Score / tt1Max` | studentsByOffering | post-tt1 onward |
| `tt2Score / tt2Max` | studentsByOffering | post-tt2 onward |
| `quiz1, quiz2, asgn1, asgn2` | studentsByOffering | post-assignments onward |
| `prevCgpa, currentCgpa` | studentsByOffering | pre-tt1 onward (history) |
| `riskProb, riskBand` | studentsByOffering | always (graph-aware fallback rated `confidenceClass: high`) |
| `riskCompleteness` | studentsByOffering | always; `complete: true, fallbackMode: graph-aware` for sem-6 cohort |
| `featureProvenance.curriculumImportVersionId` | studentsByOffering | always; honest provenance trail |

## Stage-by-stage marks expectations (cohort, sem 6, default seed)

Pulled from `offeringRollups` in `checkpoint-detail-sem<N>-<stage>.json`.

### Sem 6 (active operational)

| Stage | avgAttendance | avgTT1 | avgTT2 | avgQuiz | avgAsgn | avgSEE | avgRiskProb |
|---|---:|---:|---:|---:|---:|---:|---:|
| pre-tt1 | ~85% | 0 (hidden) | 0 | 0 | 0 | 0 | ~0.55 |
| post-tt1 | ~85% | computed | 0 | 0 | 0 | 0 | -0.04 vs pre |
| post-tt2 | ~85% | locked | computed | 0 | 0 | 0 | -0.10 vs pre-tt1 |
| post-asg | ~85% | locked | locked | computed | computed | 0 | +0.003 vs post-tt2 |
| post-see | ~85% | locked | locked | locked | locked | computed | +0.04 vs post-asg |

(`computed` = realized via `proof-stage-slice-simulator` /
`stage-realization-service`; `locked` = persisted from prior stage.)

### Cohort fragility signal (post-SEE)

- Sem 1: 30/120 students re-flag medium at post-SEE despite all-low at post-asg.
- Sem 2: 51/120 medium at post-SEE.
- Sem 3: 72/120 medium at post-SEE.
- Sem 4: 89/120 medium at post-SEE.
- Sem 5: 93/120 medium at post-SEE.
- Sem 6: 91/120 medium at post-SEE.

This shows SEE evidence credibly stresses the cohort, which is the
operational signal a college audience cares about.

## Course Outcome (CO) and question-level mapping

Stored in:
- `simulationQuestionTemplates` (per-stage TT1/TT2/quiz/assignment/SEE
  question blueprints with `coRefs[]`).
- `studentQuestionResults` (per-student per-question outcomes with
  `coStateUpdates`).
- `studentCoStates` (rolled-up per-student CO mastery snapshots).

What the UI surfaces (verified by reading
`buildStudentRiskExplorer` in
`air-mentor-api/src/lib/proof-control-plane-tail-service.ts`):

- `weakCoCount`: how many course outcomes the student is weak on.
- `weakCoIds`: which COs.
- `weakQuestionCount`: how many specific questions failed in the latest
  stage's evidence.
- `recommendation.evidence.weakCo` / `weakQuestions` arrays.

## Honest CO claims for stage talk

- The seeded TT1, TT2, quiz, assignment, and SEE question blueprints
  attach to all course outcomes for each course (deterministic, full
  coverage). This means the demo can confidently say:

  > "Every assessment in this batch is mapped to course outcomes at
  > the question level."

- The seeded data does not yet wire CO mapping to non-MSRUAS-MnC
  curricula. We are NOT claiming production-ready CO mapping for
  arbitrary institutions tonight — talking point on stage.

## Acceptance

- [x] Pre-TT1 stage: TT1/TT2/quiz/asgn marks are null; only attendance
      and history shown. Verified for Aarav Sharma sample.
- [x] Post-TT1 stage: TT1 visible.
- [x] Post-TT2 stage: TT2 visible; previously-locked TT1 unchanged.
- [x] Post-asg stage: quiz + assignment visible.
- [x] Post-SEE stage: SEE visible, final result derivable.
- [x] Question-CO mapping is non-empty for every offering in the
      seeded sandbox.
- [x] Risk drivers reference visible evidence (`weakCo`,
      `weakQuestions`, attendance, prior CGPA).

## Caveats called out

1. We are not claiming the realized marks predict real-world results.
   They are a deterministic synthetic baseline (current-v8). Honest
   stage line:

   > "These numbers come from a synthetic but rule-consistent baseline.
   > Real-data calibration is on the post-demo roadmap."

2. CO precision is per-question. The demo will avoid claiming Bloom-level
   refinement until the CO blueprint v2 ships.
