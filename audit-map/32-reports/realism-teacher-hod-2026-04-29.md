# Teacher And HoD Realism Audit — 2026-04-29

## Intent And Feature Intent

吾驗 teacher/HoD 操作是否像真院系使用：faculty must see the right scope, switch role correctly, and not receive fake authority.

Feature intent:

- HoD analytics require active HOD role, not merely a user who owns an HOD grant.
- Course leaders and mentors must see scoped bootstrap data.
- Sysadmin and HoD surfaces must remain permission-separated.
- Counterfactual simulator must be framed as projected/simulated, not causal proof.
- Edits/recompute must be explicit and auditable.

## Method

Evidence:

- Local API probes used seeded credentials from `tests-e2e/helpers/login-as.ts:10-27`.
- Role switching logic follows `tests-e2e/helpers/login-as.ts:75-89`.
- HoD routes read from `air-mentor-api/src/modules/academic-proof-routes.ts:66-248`.
- Session/role payload read from `air-mentor-api/src/modules/session.ts:39-88`.
- API full-walk artifact: `/tmp/airmentor-demo-logs/realism-2026-04-29/full-walk/walk-summary.json`.
- Role-switch precision probe output was captured in terminal and reflected in this report.

## Teacher Operations Matrix

| Actor | Login | Active role behavior | Bootstrap result | Realism verdict |
|---|---:|---|---|---|
| `devika.shetty` | 200 | Initial active role is `COURSE_LEADER`; HOD grant available | teachersVisible 1, coursesVisible 2 | Realistic multi-role faculty; must switch to HOD. |
| `rohit.menon` | 200 | Course leader / mentor | teachersVisible 1, coursesVisible 2 | Course-leader scope plausible. |
| `harish.bhat` | 200 | Mentor | teachersVisible 1, coursesVisible 0 | Mentor has no course offering scope; plausible if only mentee scope expected. |
| `sysadmin` | 200 | SYSTEM_ADMIN plus separate HOD CSE grant | academic bootstrap 403 | Admin academic bootstrap blocked; permission separation strict. |

Teacher edit smoke:

- Course leader `rohit.menon` saw offering `course_amc_s6_32`, title `Data Science and Analytics`.
- Risk recompute endpoint returned status 200 after the walk.
- The smoke did not mutate attendance; it only verified at least one offering was scoped.

## HoD Analytics Matrix

After login as `devika.shetty`, active role was initially `COURSE_LEADER`:

- `GET /api/academic/hod/proof-summary` returned 403.
- Same for proof bundle, courses, faculty, students, reassessments.

After switching to grant `grant_mnc_t1_hod`:

| Endpoint | Status | Payload shape | Verdict |
|---|---:|---|---|
| `/api/academic/hod/proof-summary?batchId=...` | 200 | summary keys include active run context and scope descriptor | Pass |
| `/api/academic/hod/proof-bundle?batchId=...` | 200 | summary, courses, faculty, students, reassessments | Pass |
| `/api/academic/hod/proof-courses?batchId=...` | 200 | 6 course rollups | Pass |
| `/api/academic/hod/proof-faculty?batchId=...` | 200 | 15 faculty rollups | Pass |
| `/api/academic/hod/proof-students?batchId=...` | 200 | 120 student rows | Pass |
| `/api/academic/hod/proof-reassessments?batchId=...` | 200 | 0 reassessment rows | Pass |
| `/api/academic/hod/proof-counterfactual-simulator?runId=sim_mnc_2023_first6_v1` | 200 | runId, generatedAt, perStudentPerStage, bySemesterStage, bySemester, projectedFinal | Pass |

Sysadmin negative check:

- Sysadmin received 403 on scoped HoD summary endpoints.
- This is strict role boundary behavior. If the product intends sysadmin override, routes must change; current route code requires `HOD` for those surfaces.

## Permission And Scope Findings

1. **HOD grant is not the same as active HOD role.**

`devika.shetty` has HOD grant but initially logs in as course leader. Browser specs already switch role. Manual demo must do the same.

2. **HoD endpoints enforce `requireRole(['HOD'])`.**

This is visible in `air-mentor-api/src/modules/academic-proof-routes.ts:72`, `92`, `118`, `138`, `158`, and `178`.

3. **Counterfactual simulator allows SYSTEM_ADMIN or HOD.**

Route uses `requireRole(['SYSTEM_ADMIN', 'HOD'])` at `air-mentor-api/src/modules/academic-proof-routes.ts:235`. The early 400 was missing `runId`, not an authorization defect.

4. **Teacher scope appears plausible.**

Course leaders see course offerings. Mentor-only user sees zero courses, which is plausible if the UI expects mentor lists instead of course leadership.

## Edit Persistence And Recompute Findings

- The full-walk did not perform a real attendance mark mutation, so edit persistence is not fully proven.
- Recompute risk returned 200 and changed dashboard readiness from 0 checkpoints initially to 30 checkpoints finally.
- This is a strong proof-plane readiness signal but also means recompute must be part of demo prep.

## Blockers

- **Browser blocker:** no Chrome installed, so HoD UI role switch was API-verified only.
- **Edit-persistence blocker:** attendance/marks edit was not actually mutated and re-read.
- **Manual demo blocker:** if user logs in as `devika.shetty` and does not switch role, HoD page will 403.

## Reverification Needed

- Browser-run HoD role switch and confirm HoD dashboard renders.
- Perform one bounded teacher edit on a safe fixture, recompute, and re-read affected risk/queue row.
- Verify mentor page shows expected mentee scope, not merely zero courses.
- Verify counterfactual panel UI always supplies `runId` and labels projection as simulated.

## Verdict

**Teacher/HoD verdict: CONDITIONAL PASS.**

Permission boundaries are mostly correct and strict. HoD analytics work after explicit role switch. Remaining gap is browser proof and actual edit-persistence proof.
