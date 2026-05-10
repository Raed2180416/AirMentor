# Stage Evidence Matrix — 2026-05-09

## Intent

Prove that the MSRUAS proof simulation exposes only stage-authoritative evidence at each of the 30 checkpoints: 6 semesters × 5 stages. This matrix is backed by `air-mentor-api/tests/stage-evidence-matrix.test.ts`, which recomputes the seeded active proof run, parses `projectionJson.currentEvidence` and `projectionJson.currentStatus` for every `simulationStageStudentProjections` row, and asserts the visibility/null contract below.

## Feature Intent

A realistic System Admin or evaluator can trust that teacher/HoD risk surfaces do not see future marks early. Attendance is visible from `pre-tt1`; TT marks, coursework/CE, SEE, and overall are unlocked only when that stage has occurred. Prior-semester carryover is exposed through `currentStatus.currentCgpa` and `currentStatus.backlogCount` for semesters after Sem1.

## Verification

| Check | Result |
|---|---|
| Backend TypeScript | PASS: `npx tsc -p tsconfig.json --noEmit --pretty false` |
| Stage evidence regression | PASS: `npx vitest run tests/stage-evidence-matrix.test.ts tests/proof-stage-evidence-realization-wire.test.ts --reporter=dot` |
| Test files | 2 passed |
| Test cases | 8 passed |
| Evidence rows checked | 21,600 projection rows total; 720 projection rows per checkpoint |
| Seeded proof run | `sim_mnc_2023_first6_v1` |

## Criteria

| Stage | Attendance | TT1 | TT2 | Quiz | Assignment | CE | SEE | Overall | Future leak guard |
|---|---|---|---|---|---|---|---|---|---|
| pre-tt1 | visible | null | null | null | null | null | null | null | no TT/quiz/assignment/CE/SEE/overall |
| post-tt1 | visible | visible | null | null | null | null | null | null | no TT2/quiz/assignment/CE/SEE/overall |
| post-tt2 | visible | visible | visible | null | null | null | null | null | no quiz/assignment/CE/SEE/overall |
| post-assignments | visible | visible | visible | visible | visible | visible | null | null | no SEE/overall |
| post-see | visible | visible | visible | visible | visible | visible | visible | visible | complete only now |

## Matrix

| Semester | Stage | Checkpoint ID | Students sampled | Criteria result | Carryover result | Notes |
|---|---|---|---:|---|---|---|
| 1 | pre-tt1 | `stage_checkpoint_e22816d896f73351902c3e1e` | 720 projection rows | PASS | Sem1 baseline: `backlogCount` remains 0 before SEE | Full population checked; no future signal leak. |
| 1 | post-tt1 | `stage_checkpoint_182e4d047d959f28a86c6b39` | 720 projection rows | PASS | Sem1 baseline: `backlogCount` remains 0 before SEE | TT1 visible; TT2/coursework/CE/SEE/overall null. |
| 1 | post-tt2 | `stage_checkpoint_ac9de94785d2101c671e6add` | 720 projection rows | PASS | Sem1 baseline: `backlogCount` remains 0 before SEE | TT1/TT2 visible; coursework/CE/SEE/overall null. |
| 1 | post-assignments | `stage_checkpoint_d587764dad75695887094057` | 720 projection rows | PASS | Sem1 baseline: `backlogCount` remains 0 before SEE | Coursework and CE visible; SEE/overall null. |
| 1 | post-see | `stage_checkpoint_78ee47d5a45be74db6419d24` | 720 projection rows | PASS | Sem1 close state available in `currentStatus` | All evidence signals visible only at semester close. |
| 2 | pre-tt1 | `stage_checkpoint_f21fd86d7c3fe2750f0b78f1` | 720 projection rows | PASS | Prior CGPA/backlog available in `currentStatus` | Full population checked; no future signal leak. |
| 2 | post-tt1 | `stage_checkpoint_45dd134a0ac969ea05a049e7` | 720 projection rows | PASS | Prior CGPA/backlog available in `currentStatus` | TT1 visible; TT2/coursework/CE/SEE/overall null. |
| 2 | post-tt2 | `stage_checkpoint_7ac08db07d8702409002266e` | 720 projection rows | PASS | Prior CGPA/backlog available in `currentStatus` | TT1/TT2 visible; coursework/CE/SEE/overall null. |
| 2 | post-assignments | `stage_checkpoint_d9d2a0c1ea709c1ad371fcf7` | 720 projection rows | PASS | Prior CGPA/backlog available in `currentStatus` | Coursework and CE visible; SEE/overall null. |
| 2 | post-see | `stage_checkpoint_d6aa3455a8cf8433f94ab773` | 720 projection rows | PASS | Closing CGPA/backlog available in `currentStatus` | All evidence signals visible only at semester close. |
| 3 | pre-tt1 | `stage_checkpoint_b47d44443e38ee77f48ba231` | 720 projection rows | PASS | Prior CGPA/backlog available in `currentStatus` | Full population checked; no future signal leak. |
| 3 | post-tt1 | `stage_checkpoint_5cb58722ec96706d583b3d50` | 720 projection rows | PASS | Prior CGPA/backlog available in `currentStatus` | TT1 visible; TT2/coursework/CE/SEE/overall null. |
| 3 | post-tt2 | `stage_checkpoint_99d2b518f2152f133e6e5f34` | 720 projection rows | PASS | Prior CGPA/backlog available in `currentStatus` | TT1/TT2 visible; coursework/CE/SEE/overall null. |
| 3 | post-assignments | `stage_checkpoint_d2a63a3bfb896a648dc40004` | 720 projection rows | PASS | Prior CGPA/backlog available in `currentStatus` | Coursework and CE visible; SEE/overall null. |
| 3 | post-see | `stage_checkpoint_6452ecb8ca56b5b88168e2da` | 720 projection rows | PASS | Closing CGPA/backlog available in `currentStatus` | All evidence signals visible only at semester close. |
| 4 | pre-tt1 | `stage_checkpoint_686ef511cc7b02005cb60101` | 720 projection rows | PASS | Prior CGPA/backlog available in `currentStatus` | Full population checked; no future signal leak. |
| 4 | post-tt1 | `stage_checkpoint_7a89536edab4dff9697d46a3` | 720 projection rows | PASS | Prior CGPA/backlog available in `currentStatus` | TT1 visible; TT2/coursework/CE/SEE/overall null. |
| 4 | post-tt2 | `stage_checkpoint_37e51f0c8a43fb4d598829bf` | 720 projection rows | PASS | Prior CGPA/backlog available in `currentStatus` | TT1/TT2 visible; coursework/CE/SEE/overall null. |
| 4 | post-assignments | `stage_checkpoint_77e060abdc1ccfe0d2c73958` | 720 projection rows | PASS | Prior CGPA/backlog available in `currentStatus` | Coursework and CE visible; SEE/overall null. |
| 4 | post-see | `stage_checkpoint_fd713de15d3771038ced9bfd` | 720 projection rows | PASS | Closing CGPA/backlog available in `currentStatus` | All evidence signals visible only at semester close. |
| 5 | pre-tt1 | `stage_checkpoint_f17e672ff500ce9a09543b06` | 720 projection rows | PASS | Prior CGPA/backlog available in `currentStatus` | Full population checked; no future signal leak. |
| 5 | post-tt1 | `stage_checkpoint_08456ada2201f20cec4df2ac` | 720 projection rows | PASS | Prior CGPA/backlog available in `currentStatus` | TT1 visible; TT2/coursework/CE/SEE/overall null. |
| 5 | post-tt2 | `stage_checkpoint_435c767c27dd7405b2ee191c` | 720 projection rows | PASS | Prior CGPA/backlog available in `currentStatus` | TT1/TT2 visible; coursework/CE/SEE/overall null. |
| 5 | post-assignments | `stage_checkpoint_3b723b3e3d9e8a3a5ce98b9c` | 720 projection rows | PASS | Prior CGPA/backlog available in `currentStatus` | Coursework and CE visible; SEE/overall null. |
| 5 | post-see | `stage_checkpoint_19ede662df23cf9be4d8c7e8` | 720 projection rows | PASS | Closing CGPA/backlog available in `currentStatus` | All evidence signals visible only at semester close. |
| 6 | pre-tt1 | `stage_checkpoint_7b2006310ea4591badd87549` | 720 projection rows | PASS | Prior CGPA/backlog available in `currentStatus` | Full population checked; no future signal leak. |
| 6 | post-tt1 | `stage_checkpoint_4be7d2c6597f4d0f78be92d2` | 720 projection rows | PASS | Prior CGPA/backlog available in `currentStatus` | TT1 visible; TT2/coursework/CE/SEE/overall null. |
| 6 | post-tt2 | `stage_checkpoint_3fe03edd5c065a9cf6f64992` | 720 projection rows | PASS | Prior CGPA/backlog available in `currentStatus` | TT1/TT2 visible; coursework/CE/SEE/overall null. |
| 6 | post-assignments | `stage_checkpoint_beeea412e892c7c549a09e10` | 720 projection rows | PASS | Prior CGPA/backlog available in `currentStatus` | Coursework and CE visible; SEE/overall null. |
| 6 | post-see | `stage_checkpoint_654335929a345857eab259b0` | 720 projection rows | PASS | Closing CGPA/backlog available in `currentStatus` | All evidence signals visible only at semester close. |

## Payload Shape Proven

`projectionJson.currentEvidence` now contains the stage-gated scalar evidence fields:

- **Always considered**: `attendancePct`, `tt1Pct`, `tt2Pct`, `quizPct`, `assignmentPct`, `cePct`, `seePct`, `overallPct`.
- **Null until visible**: every future-stage scalar remains `null` or absent-equivalent before its stage.
- **Visible at stage**: required fields are non-null/non-undefined for every checked projection row.

`projectionJson.currentStatus` now includes:

- **Risk state**: `riskBand`, `riskProbScaled`, prior risk fields, risk deltas, policy comparison.
- **Carryover state**: `currentCgpa`, `backlogCount`.

## Root Cause Found During RED Test

The initial RED test failed at Sem1 `post-assignments` because `currentEvidence.cePct` was absent even though CE is authoritative at that stage. The fix made CE and overall first-class `StageEvidenceSnapshot` fields and persisted them into `projectionJson.currentEvidence` with the same stage gating asserted by this matrix.
