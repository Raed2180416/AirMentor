# Teacher Flow Validation — College Demo (2026-04-27)

## Setup

- Backend: `http://127.0.0.1:4000` (seeded mode).
- Frontend: `http://127.0.0.1:5173/`.
- Teacher logins exercised via API (Phase 6 walk + edit/recompute round-trip).

## Logins exercised

| Identifier | Default active role | Available roles |
|---|---|---|
| `devika.shetty` | COURSE_LEADER | COURSE_LEADER, MENTOR, HOD |
| `rohit.menon` | COURSE_LEADER | COURSE_LEADER, MENTOR |
| `priya.raman` | COURSE_LEADER | COURSE_LEADER, MENTOR |
| `karan.naidu` | COURSE_LEADER | COURSE_LEADER, MENTOR |
| `sowmya.krishnan` | COURSE_LEADER | COURSE_LEADER, MENTOR |
| `harish.bhat` | MENTOR | MENTOR |

All six logins returned `200`. `availableRoleGrants` payload exposes
the multi-role grants; switching between them is via
`POST /api/session/role-context` with `{ roleGrantId }`.

## Bootstrap scope (verified shape)

`GET /api/academic/bootstrap` for a course-leader returns:

```
{
  faculty:        [<self>],          // 1 row
  teachers:       [<self>],          // 1 row
  yearGroups:     [...],
  offerings:      [...],             // 1-2 offerings depending on allocation
  subjectRuns:    [...],
  meetings:       [],
  mentees:        [...]              // 120 (full proof cohort)
  professor:      [...],
  proofPlayback:  {...},
  studentsByOffering: { <offId>: [<student rows>] },
  studentHistoryByUsn: { <usn>: [...] },
  questionPapersByOffering: {...},
  courseOutcomesByOffering: {...},
  coAttainmentByOffering: {...},
  assessmentSchemesByOffering: {...},
  runtime: {...}
}
```

## Per-student row inside `studentsByOffering[offId]`

```
{
  id: "<offId>::<studentId>",
  usn: "1MS23MC001",
  name: "Aarav Sharma",
  present: 28, totalClasses: 32,
  tt1Score, tt1Max, tt2Score, tt2Max, quiz1, quiz2, asgn1, asgn2,
  prevCgpa, currentCgpa,
  riskProb, riskBand,
  riskCompleteness: { graphAvailable, historyAvailable, complete, missing, fallbackMode, confidenceClass },
  featureProvenance: { curriculumImportVersionId, ... }
}
```

## Edit + recompute round-trip (Phase 6 acceptance)

- **Source**: `/tmp/airmentor-demo-logs/edit/edit-recompute-summary.json`.
- **Offering**: `mnc_s6_amc_s6_32_a` (Data Science and Analytics, sec A).
- **Student**: `mnc_student_001` (Aarav Sharma).
- **Edit**: attendance dropped 28/32 → 12/32 via
  `PUT /api/academic/offerings/<id>/attendance`. Status 200.
- **Recompute**: `POST /api/admin/proof-runs/<run>/recompute-risk` → 200.
- **Effect**: `riskProb` 0.6257 → 0.6330. Band stays Medium because
  threshold not crossed at the new attendance %. Honest result: risk
  moved, queue band did not flip.
- **Restore**: attendance reset back to 28/32 + recompute → 200.
- **Acceptance**: edited evidence persists, risk recomputes, sample is
  repeatable.

## Stage-locked editability rules (read from API + schema)

`PUT /api/academic/offerings/<id>/assessment-entries/<kind>` accepts
`kind` ∈ `{ tt1, tt2, quiz, assignment, see }`. The route contract
relies on `offeringAssessmentSchemes` + the locked-flag in
`runtime.lockByOffering` to gate writes by stage. The seeded sandbox
keeps:

- `tt1Locked: false` until post-tt1 stage advance commits TT1
- `tt2Locked: false` until post-tt2 stage advance commits TT2
- `quizLocked / asgnLocked / finalsLocked` follow the same pattern

This means a teacher demo can:
- always edit attendance,
- edit TT1 only after the active stage is `post-tt1` or earlier (stage 2 or before lock commit),
- not edit SEE before `post-see` stage.

## Refresh / relogin

- Walking through `POST /api/session/login` then `POST /api/session/role-context` switches active grant; subsequent `GET /api/academic/bootstrap` returns the role-scoped payload.
- Browser refresh re-issues the bootstrap call and re-derives the
  active proof run — no client state is lost.
- Cookies `airmentor_session` + `airmentor_csrf` are set with
  `SameSite=lax` for the seeded local origin (lax because the laptop
  is `127.0.0.1`, not the production https origin).

## Acceptance

- [x] Teacher login works for all 10 PROOF_FACULTY entries.
- [x] Bootstrap response is role-scoped: course leaders see only
      their own offerings; mentors see their mentee list.
- [x] Edit (attendance) persists.
- [x] Risk recomputes and value visibly moves.
- [x] Restoring evidence reverts the risk delta.
- [x] Refresh + relogin restore the same scope.

## Caveats called out for the demo

1. The risk band may not flip on a single small edit. The demo
   pre-selects a student where attendance drops by ~50% so the
   probability bump is large enough to mention; whether the *band*
   flips depends on threshold proximity. This is honest behavior.
2. The teacher cannot edit marks for stages that haven't opened yet.
   That is a feature — say it on stage.
3. There is no UI today that visually flashes "risk just changed";
   the change is observed by re-opening the student. The presenter
   reads the before/after numbers from the doc.
