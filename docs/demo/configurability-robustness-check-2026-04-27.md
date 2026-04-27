# Configurability / Mock-Data Robustness — College Demo (2026-04-27)

The proof system is deterministic-by-seed. The configurability surface
exposed in the seeded demo is intentionally narrow — only changes that
respect the deterministic invariants are safe.

## Tested representative changes

| Change | Where | Verb | Result | Risk |
|---|---|---|---|---|
| Login as HOD | `POST /api/session/role-context` | POST | 200, scope rebroadcasts as HOD | safe |
| Switch active operational semester | `POST /api/admin/proof-runs/<run>/activate-semester` | POST | 200 for sem 1..6 | safe; restoration via reactivating sem 6 |
| Activate proof run | `POST /api/admin/proof-runs/<run>/activate` | POST | 200 (already active) | safe |
| Edit attendance for one student in one offering | `PUT /api/academic/offerings/<id>/attendance` | PUT | 200, risk recomputes | safe; revertable |
| Recompute risk | `POST /api/admin/proof-runs/<run>/recompute-risk` | POST | 200 | safe |
| Restart backend (full reset) | process-level | n/a | embedded postgres torn down + recreated; everything re-seeded | safe; canonical reset |

## NOT exercised tonight (out-of-demo-path)

| Change | Where | Why deferred |
|---|---|---|
| Add teacher | `POST /api/admin/faculty` | Outside the proof sandbox demo path. Adding a non-proof faculty does not affect the deterministic proof allocations. |
| Add student | admin/people endpoints | Same — not part of the seeded proof cohort. |
| Reassign mentor | seeded into PROOF_FACULTY allocations | Changing the seed mid-demo would invalidate the playback. |
| Change timetable | runtime slice rewrite | Would require rebuilding playback. Out of stage path. |
| Reassign class/course | runtime slice rewrite | Same. |
| Edit marks (TT1/TT2/quiz/assignment) | `PUT /api/academic/offerings/<id>/assessment-entries/<kind>` | Not exercised tonight. Requires stage to be at or before lock window. Demo will use attendance edit (always editable) instead. |
| Add intervention | reassessment-resolve endpoint | Available for live demo; not part of the canned script. |

## Failure modes observed during walkthrough

| Symptom | Cause | Mitigation |
|---|---|---|
| `400 The selected student is not actively enrolled in this offering` when using USN as studentId | Bootstrap composite id is `${offeringId}::${studentId}`; route expects bare studentId | Use `id.split('::')[1]` (encoded in `/tmp/airmentor-demo-logs/edit-recompute.mjs`). Demo script uses pre-extracted IDs. |
| `403 FORBIDDEN` on HoD endpoints when logged in as `devika.shetty` | Default active grant is COURSE_LEADER even when HOD grant is available | Demo flow explicitly hits `POST /api/session/role-context` to switch to HOD before opening the HoD page. |
| Active operational semester stays at 1 after `activate-semester` for an earlier number | API allows forward-only or backward switch but the dashboard shape latches; restoration command needed | `POST /api/admin/proof-runs/<id>/activate-semester { semesterNumber: 6 }` resets to sem 6. Verified. |
| `npm run dev` cannot bind 5173 | port already in use | `lsof -ti :5173 \| xargs -r kill -9` then re-run. |
| Seeded backend cannot bind 4000 | port already in use | `lsof -ti :4000 \| xargs -r kill -9`. |

## Acceptance

- [x] Each tested representative change either succeeds, or fails
      with a 4xx that surfaces a clear `details` payload (no 5xx).
- [x] Backend restart fully resets demo state without manual cleanup.
- [x] No silent corruption of seeded data observed in the walkthrough.
- [x] Refresh + relogin restore the active role + scope.

## Talking-point caveat

> "Tonight's demo respects the deterministic seed. Adding new teachers
> or students is supported elsewhere in the platform but is not part
> of the proof-sandbox demo. The proof sandbox is the controlled
> environment where every assertion is reproducible."
