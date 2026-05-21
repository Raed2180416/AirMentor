# AirMentor Academic Risk Data Contract

Date: 2026-05-21

This contract defines the proof-simulation data fields that may be displayed in AirMentor faculty views and the source each field must trace back to. Any UI number not traceable to one source field or one documented formula is a defect.

## Scope

Applies to the proof-backed academic risk workflow for:

- HOD department-wide risk and queue governance
- Mentor assigned-mentee risk and intervention review
- Course Leader course-scoped assessment and CO attainment review
- The 6-semester proof simulation with 5 checkpoints per semester

The current serving authority for the demo is the TypeScript proof-risk engine surfaced through the proof-bundle and risk-explorer APIs. CatBoost artifacts remain challenger/offline unless a promotion report explicitly says otherwise.

## Stage Availability

| Stage | Available evidence | Missing evidence rule |
|---|---|---|
| `pre-tt1` | attendance, prior completed semester transcript where available | TT1, TT2, quiz, assignment, SEE are `null`/missing, never zero-filled |
| `post-tt1` | attendance, TT1 | TT2, quiz, assignment, SEE are `null`/missing |
| `post-tt2` | attendance, TT1, TT2 | quiz, assignment, SEE are `null`/missing |
| `post-assignments` | attendance, TT1, TT2, quiz, assignment | SEE is `null`/missing |
| `post-see` | attendance, TT1, TT2, quiz, assignment, SEE, result, SGPA | no assessment field may be inferred if not stored |

## Canonical Queue Status

Only these queue states are valid:

| Status | Meaning |
|---|---|
| `open` | active intervention needed and counts toward capacity |
| `watching` | monitoring without immediate action |
| `deferred` | high-risk but capacity-delayed to a later stage |
| `resolved` | case closed after risk drop or intervention completion |
| `suppressed` | excluded by a policy rule, not the same as resolved |

Any other status string in an API response or UI label is a bug.

## Academic Formula Sources

| Field | Source |
|---|---|
| CE weights | `air-mentor-api/src/lib/grading-formula-config.ts` |
| TT1 CE weight | `CE_COMPONENT_WEIGHTS.tt1 = 0.28` |
| TT2 CE weight | `CE_COMPONENT_WEIGHTS.tt2 = 0.27` |
| quiz CE weight | `CE_COMPONENT_WEIGHTS.quiz = 0.20` |
| assignment CE weight | `CE_COMPONENT_WEIGHTS.assignment = 0.25` |
| CE maximum | `CE_SEE_SPLIT.ceMaximum = 60` |
| SEE maximum | `CE_SEE_SPLIT.seeMaximum = 40` |
| overall maximum | `CE_SEE_SPLIT.overallMaximum = 100` |
| pass rules | `PASS_RULES.ceMinimum`, `PASS_RULES.seeMinimum`, `PASS_RULES.overallMinimum` |
| grade bands | `GRADE_BANDS` in `grading-formula-config.ts` |
| SGPA | `calculateSgpa()` in `grading-formula-config.ts` |

## API Evidence Sources

| Displayed concept | Source endpoint | Required trace artifact |
|---|---|---|
| active proof run and checkpoints | `/api/admin/batches/:batchId/proof-dashboard` | `json/checkpoint-details.json` |
| student risk band / queue state | `/api/academic/students/:studentId/risk-explorer` | `json/student-risk-evidence.json` |
| current marks and formula trace | `/api/academic/students/:studentId/risk-explorer` | `json/cgpa-calculation-trace.json` |
| HoD department queue | `/api/academic/hod/proof-bundle` | `json/final-hod-proof-bundle.json` |
| mentor parity | `/api/academic/faculty/:facultyId/profile` plus HoD proof bundle | `json/same-student-mentor-hod-parity.json` |
| marks edit recompute | `PUT /api/academic/offerings/:offeringId/assessment-entries/:kind` then proof recompute | `json/marks-edit-before-after.json` |
| intervention cap | checkpoint student detail interventions | `json/intervention-cap-audit.json` |
| counterfactual projection | `/api/academic/hod/proof-counterfactual-simulator` | `json/counterfactual-simulator.json` |

## Missing Data Rule

Missing marks must be represented as `null`, omitted fields, or `NaN` in model features where the runtime supports it. A missing mark must never be converted to `0`.

Reason: a pre-TT1 missing mark means the assessment has not happened; a score of `0` means the assessment happened and the student scored nothing. Those are different academic facts.

## Role Access Contract

| Role | May read |
|---|---|
| HOD | students, queues, courses, and faculty scoped to the HOD department |
| Mentor | assigned mentees only |
| Course Leader | students and attainment scoped to the leader's course offering |

Permission boundary tests must remain part of any external demo gate.
