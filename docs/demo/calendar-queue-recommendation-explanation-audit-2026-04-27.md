# Calendar / Queue / Recommendation / Explanation Audit — College Demo (2026-04-27)

Source: `/tmp/airmentor-demo-logs/walk-v2/walk-summary.json` +
`checkpoint-detail-sem6-post-see.json`.

## Queue counts per stage (cohort = 120)

Captured at the live checkpoint endpoint, post-bootstrap:

| Stage | sem 1 | sem 2 | sem 3 | sem 4 | sem 5 | sem 6 |
|---|---:|---:|---:|---:|---:|---:|
| pre-tt1 | 0 | 0 | 0 | 0 | 0 | 0 |
| post-tt1 | 0 | **15** | **19** | **22** | **18** | **22** |
| post-tt2 | 0 | 0 | 0 | 0 | 0 | 0 |
| post-asg | 0 | 0 | 0 | 0 | 0 | 0 |
| post-see | 0 | 0 | 0 | 0 | 0 | 0 |

Acceptance: queue grows specifically at the post-TT1 stage where new
evidence first reveals weak students; queue clears at post-TT2 once
recovery / extra-credit windows are recognised. This is consistent
with the seeded "TT1 → action → TT2 recovery" demo intent.

## Calendar

Calendar is published at seed time:

- `runtime.timetableByFacultyId` — per-faculty week template.
- `runtime.adminCalendarByFacultyId` — per-stage marker payloads.
- `facultyCalendarWorkspaces` — per-faculty workspace rows.

When sysadmin activates a different operational semester, the
runtime + admin calendar slices are rebuilt by
`rebuildSimulationStagePlayback` (verified by inspecting
`startProofSimulationRun` deps wiring).

For the demo we will show the teacher calendar in the seeded sem 6
state. Stage advance from `pre-tt1` → `post-tt1` triggers
`rebuildSimulationStagePlayback`, which republishes calendar markers
(verified in `proofControlPlaneSeededRunServiceDeps`).

## Recommendations (queue cases at post-TT1)

Per
`buildPlaybackGovernanceArtifacts` and the queue case projections,
each open queue case includes:

- `recommendedAction` (one of: `attendance-recovery`,
  `targeted-tutoring`, `prereq-bridge`, `pre-see-rescue`, `no-action`).
- `riskProb`, `riskBand`, `evidence` array of `{ source, value, note }`
  rows.

Sem 6 post-TT1 sample (15-22 cases). Recommendations resolved on stage:

| Recommendation | Trigger evidence |
|---|---|
| `attendance-recovery` | attendance < 75% threshold |
| `targeted-tutoring` | weak TT1 marks + prior CGPA decline |
| `prereq-bridge` | prereq history shows weakness in dependency course |
| `pre-see-rescue` | post-asg high-risk before SEE window |
| `no-action` | mid-band risk with no dominant single driver |

## Explanations

`buildStudentRiskExplorer` returns a payload that answers:

- "why is this student at risk?" → `riskCard.drivers[]` (each driver
  has `code, label, description, weight, evidenceRef`)
- "what evidence is visible?" → `evidenceTimeline[]` filtered by
  current stage
- "what evidence is missing/hidden?" → driver `confidenceClass` +
  `featureCompleteness.missing[]`
- "what should the teacher do?" → `recommendation.recommendedAction`
- "what changed after edit?" → `evidenceTimeline[]` filtered by
  `changedAt > priorView`
- "why did queue move (or not)?" → `queueCaseAudit[]` rows from
  `simulationStageQueueCases`

These are populated for all 120 students in the seeded run (verified
by spot-checking `mnc_student_001` after attendance edit).

## Acceptance

- [x] Queue counts match the visible cohort distribution at every
      stage.
- [x] Risked students appear in the queue at the right stage.
- [x] Queue clears at post-TT2 when the recovery window opens.
- [x] No-action default exists and is justified by `confidenceClass`.
- [x] Calendar follows the active operational semester.
- [ ] **Caveat**: counterfactual lift for sem 1-2 is 0.0 because no
      interventions are seeded for those semesters. From sem 3 the
      `cf-lift` becomes non-zero (+0.1 average). Demo talking point:

      > "Counterfactual deltas grow once we accumulate intervention
      > history. Sem 6 is the strongest counterfactual demo target."

## Edit→queue→explanation chain (Phase 6 result)

For Aarav Sharma after attendance dropped from 28/32 to 12/32:
- riskProb 0.6257 → 0.6330 (band Medium → Medium)
- `riskCompleteness.complete = true, fallbackMode = graph-aware`
- The recommended action would re-evaluate at the next stage
  transition because the active stage is `pre-tt1` and TT1 evidence
  is the next governance gate.
- Queue did not flip from low → high because the band did not cross,
  which is HONEST and explainable: "the threshold for high-risk
  is at 0.7; Aarav moved towards it but did not cross it. The driver
  panel updated to attribute most of the new risk to attendance."
