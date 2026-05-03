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
- Browser smoke summary: `/tmp/airmentor-demo-logs/realism-2026-04-29/browser/browser-smoke-summary.json`.
- Browser screenshots: `hod-proof-analytics.png`, `hod-counterfactual.png`, `course-leader.png`, `mentor.png`, `system-admin-app.png`.
- Teacher attendance persistence probe: `/tmp/airmentor-demo-logs/realism-2026-04-29/teacher-edit/teacher-attendance-persistence.json`.
- Final full-role browser proof smoke: `/tmp/airmentor-demo-logs/realism-2026-04-29/final-browser-smoke-devika/final-live-devika-semester-walk-summary.json`.
- Deep Wave repaired Sem 1 full-role browser proof smoke: `/tmp/airmentor-demo-logs/realism-2026-04-29/deep-wave-self/browser-proof-source-sem1-devika-after-recompute-repair/deep-wave-source-sem1-devika-after-recompute-repair-semester-walk-summary.json`.
- Deep Wave repaired Sem 6 full-role browser proof smoke: `/tmp/airmentor-demo-logs/realism-2026-04-29/deep-wave-self/browser-proof-source-sem6-devika-after-recompute-repair/deep-wave-source-sem6-devika-after-recompute-repair-semester-walk-summary.json`.
- Stage A after-fixes Sem 1/Sem 6 browser proof smoke: `/tmp/airmentor-demo-logs/realism-2026-04-29/stage-a-after-fixes/browser-proof-source-sem1-sem6-devika/stage-a-after-fixes-devika-semester-walk-summary.json`.
- API regression: `npx vitest run tests/academic-parity.test.ts --reporter=dot -t "projects teacher attendance edits"`.

## Teacher Operations Matrix

| Actor | Login | Active role behavior | Bootstrap result | Realism verdict |
|---|---:|---|---|---|
| `devika.shetty` | 200 | Initial active role is `COURSE_LEADER`; HOD grant available | teachersVisible 1, coursesVisible 2 | Realistic multi-role faculty; must switch to HOD. |
| `rohit.menon` | 200 | Course leader / mentor | teachersVisible 1, coursesVisible 2 | Course-leader scope plausible. |
| `harish.bhat` | 200 | Mentor | teachersVisible 1, coursesVisible 0 | Mentor has no course offering scope; plausible if only mentee scope expected. |
| `sysadmin` | 200 | SYSTEM_ADMIN plus separate HOD CSE grant | academic bootstrap 403 | Admin academic bootstrap blocked; permission separation strict. |

Teacher edit smoke:

- Course leader `rohit.menon` committed attendance through `PUT /api/academic/offerings/mnc_s1_amc_s1_02_a/attendance`.
- Target student `mnc_student_001` changed from `present=0,totalClasses=0` to `present=1,totalClasses=2` after academic bootstrap re-read.
- Academic risk moved from `riskProb=0.3997` to `riskProb=0.3828`; attendance reason changed from `0%` to `50%`.
- Recompute endpoint `POST /api/admin/proof-runs/sim_mnc_2023_first6_v1/recompute-risk` returned `{"ok":true}`.
- Stage A bridge regression now proves recomputed seeded proof projection consumption for this bounded attendance path: `simulationStageStudentProjections.projectionJson.currentEvidence.attendancePct === 50` for `mnc_student_001` / `mnc_s1_amc_s1_02_a`.

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

## Browser Role Evidence

- HoD browser flow rendered `data-proof-surface="hod-proof-analytics"` and captured `/tmp/airmentor-demo-logs/realism-2026-04-29/browser/hod-proof-analytics.png`.
- HoD counterfactual browser flow clicked `Counterfactual Impact`, observed simulator response 200, and captured `/tmp/airmentor-demo-logs/realism-2026-04-29/browser/hod-counterfactual.png`.
- Counterfactual copy was checked for prohibited causal framing; `prohibitedCopyFound=false`.
- Course leader browser flow rendered scoped dashboard/proof overlay and captured `/tmp/airmentor-demo-logs/realism-2026-04-29/browser/course-leader.png`.
- Mentor browser flow rendered mentee scope/proof overlay and captured `/tmp/airmentor-demo-logs/realism-2026-04-29/browser/mentor.png`.
- Final full-role smoke used `devika.shetty` because that account owns `COURSE_LEADER`, `MENTOR`, and `HOD` grants; Sem 1 and Sem 6 proof-risk surfaces passed with screenshots under `/tmp/airmentor-demo-logs/realism-2026-04-29/final-browser-smoke-devika/`.
- Deep Wave Sem 1 repaired browser smoke passed after recompute repaired historical proof offerings/ownerships; backend log shows `mnc_t1` Course Leader bootstrap `offeringCount=2, facultyCount=1`, then HOD bootstrap `offeringCount=12, facultyCount=12`.
- Deep Wave Sem 6 repaired browser smoke passed with the same role path and backend counts.
- Stage A after-fixes Sem 1/Sem 6 browser smoke passed again with corrected Sem 6 earlier-checkpoint blocker banner and healthy Course Leader/HOD bootstrap counts; this browser evidence predates Fix B.
- Fix B API regressions now prove dashboard, HoD, and student-shell checkpoint contexts use the same timeline-aware playback gate, so historical queue cases that later moved to `Watching`/`Resolved`/`Closed` no longer block Sem 6 playback.
- Final targeted artifact scan found no `/api/preferences/ui`, `response:409`, `Stale version`, `requestfailed`, or `pageerror` hits in keyboard, accessibility, and proof-smoke artifacts.

## Permission And Scope Findings

1. **HOD grant is not the same as active HOD role.**

`devika.shetty` has HOD grant but initially logs in as course leader. Browser specs already switch role. Manual demo must do the same.

2. **HoD endpoints enforce `requireRole(['HOD'])`.**

This is visible in `air-mentor-api/src/modules/academic-proof-routes.ts:72`, `92`, `118`, `138`, `158`, and `178`.

3. **Counterfactual simulator allows SYSTEM_ADMIN or HOD.**

Route uses `requireRole(['SYSTEM_ADMIN', 'HOD'])` at `air-mentor-api/src/modules/academic-proof-routes.ts:235`. The early 400 was missing `runId`, not an authorization defect.

4. **Teacher scope appears plausible.**

Course leaders see course offerings. Mentor-only user sees zero courses, which is plausible if the UI expects mentor lists instead of course leadership.

5. **Deep Wave faculty-context failure was an academic proof repair gap.**

Sem 1 checkpoint playback originally had students but no matching checkpoint-scoped faculty because the recompute path did not guarantee all-semester `section_offerings` and active `faculty_offering_ownerships`. `ensureProofOfferings` now backfills active ownerships for existing offerings, and `recomputeObservedOnlyRisk` repairs proof offerings before rebuilding risk. Browser Sem 1 and Sem 6 now both pass using `devika.shetty`.

## Edit Persistence And Recompute Findings

- A bounded real attendance mutation now proves academic persistence for one course-leader-owned offering and student.
- The seeded proof replay now proves that this attendance edit flows into immutable proof checkpoint projections after recompute.
- Bridge fix source path: historical seeded sources carry `offeringId`, rebuild recovers historical offering IDs for legacy rows, and latest `teacher-workspace` attendance snapshots override playback evidence before projection persistence.
- Recompute risk returned 200 and changed dashboard readiness from 0 checkpoints initially to 30 checkpoints finally.
- This is a strong proof-plane readiness signal but also means recompute must be part of demo prep.

## Blockers

- **Proof-consumption caveat:** bounded attendance edit projection now passed; marks/interventions still need separate bridge coverage if demo claims those paths.
- **Manual demo caveat:** if user logs in as `devika.shetty` and does not switch role, HoD page will 403 by design.
- **Fresh-browser caveat:** Sem 6 playback is fixed at backend/API-consumer level by Fix B, but a fresh browser smoke is needed if visual screenshot evidence of accessible Sem 6 playback is required.

## Reverification Needed

- Extend proof-projection bridge tests if the demo needs to claim non-attendance teacher edits affect seeded proof checkpoint state.
- Keep manual HoD role switch explicit in the demo script.
- Re-run browser proof smoke after Fix B if final-stage accessible playback must be shown visually.

## Verdict

**Teacher/HoD verdict: CONDITIONAL PASS.**

Permission boundaries are mostly correct and strict. HoD analytics, counterfactual, course leader, mentor, Deep Wave faculty-context repair, keyboard, accessibility, bounded academic edit persistence, bounded attendance proof-projection consumption, and Fix B timeline-aware playback gating now have evidence. Remaining gaps are broader edit-type bridge coverage and fresh browser capture if free final-stage playback must be demonstrated visually.
