# HoD Analytics Validation — College Demo (2026-04-27)

Source artifact: `/tmp/airmentor-demo-logs/walk-v2/hod-bundle.json`.

## Setup to reproduce

1. `POST /api/session/login` with `devika.shetty / faculty1234`.
2. Active grant defaults to `COURSE_LEADER`. Switch to HOD:
   `POST /api/session/role-context { roleGrantId: "grant_mnc_t1_hod" }`.
3. Hit the seven HoD endpoints listed below.

## Endpoint health

| Endpoint | Status | Payload signal |
|---|---:|---|
| `GET /api/academic/hod/proof-summary?batchId=...` | **200** | `monitoringSummary, totals, sectionComparison(2), semesterRiskDistribution(6), backlogDistribution(4), electiveDistribution(5), facultyLoadSummary` |
| `GET /api/academic/hod/proof-bundle?batchId=...` | **200** | full analytics bundle (everything below in one call) |
| `GET /api/academic/hod/proof-courses?batchId=...` | **200** | `items: 6` course hotspots |
| `GET /api/academic/hod/proof-faculty?batchId=...` | **200** | `items: 15` faculty operations rows (including allocations) |
| `GET /api/academic/hod/proof-students?batchId=...` | **200** | `items: 120` student watch rows |
| `GET /api/academic/hod/proof-reassessments?batchId=...` | **200** | `items: 0` (no reassessments active in default seed; non-zero once teacher resolves a queue case on stage) |
| `GET /api/academic/hod/proof-counterfactual-simulator?runId=...` | **200** | `runId, generatedAt, perStudentPerStage, bySemesterStage, bySemester, projectedFinal` |

## What the HoD page can show on stage

Verified non-empty from the bundle response:

- **Live proof summary**: active run context (id, label, status,
  branch name) plus monitoring counts.
- **Course hotspots**: 6 courses ranked. Sample shape: `{ courseCode,
  courseTitle, averageRiskProbScaled, highRiskCount, openQueueCount,
  ... }`.
- **Faculty operations**: 15 faculty rows (the proof allocations span
  the 10 PROOF_FACULTY plus the section ownership entries).
- **Student watch**: 120 rows. Each carries
  `{ studentId, usn, name, riskBand, riskProb, queueState, ... }`.
- **Reassessment audit**: 0 rows in the default seed (acknowledge or
  resolve a queue case to populate this on stage if you want a
  non-empty list).
- **Counterfactual / no-action vs intervention**: simulator-based
  projection report with per-student-per-stage rows and a
  `projectedFinal` aggregate. This is the authoritative sem-6
  analytics surface per Phase-11.

## Acceptance

- [x] All seven endpoints return 200 once the active role is HOD.
- [x] Course hotspots, faculty operations, student watch all populate
      with non-empty arrays when the active proof run is the
      first-six-semester batch.
- [x] Counterfactual simulator returns the expected six keys.
- [x] Reassessment audit returns an empty array as expected for the
      default seed (and grows when a queue case is resolved).
- [ ] **Caveat**: HoD page in the browser surfaces these endpoints via
      the `proofPlayback` slice of the academic bootstrap. If a
      Course-Leader visits the HoD-only routes, the API correctly
      returns 403. Demo presenter must remember to switch the role to
      HOD before opening the HoD page.

## Talking points

- "These analytics come from the same active proof run sysadmin just
  generated. They are not pre-baked screenshots."
- "Faculty operations panel reflects the deterministic teacher
  allocations. Student watch reflects the live risk roster."
- "Counterfactual simulator is honest about what it is: projected
  with-vs-without intervention for the active run. Not a real-data
  prediction."
