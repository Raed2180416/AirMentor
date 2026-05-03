# Teacher HoD Handoff — 2026-04-29

## Tested

- `devika.shetty` login can start in `COURSE_LEADER`; HOD grant `grant_mnc_t1_hod` is available.
- Switching to `grant_mnc_t1_hod` makes HoD endpoints return 200.
- Browser smoke now verifies HoD analytics renders after active HOD role selection.
- HoD bundle returns courses/faculty/students/reassessments.
- Counterfactual simulator returns 200 with `runId=sim_mnc_2023_first6_v1` and browser panel renders.
- Course leader page renders scoped dashboard and proof overlay.
- Mentor page renders mentee scope and proof overlay.
- Sysadmin receives 403 on scoped HoD summary endpoints, preserving role boundary.
- Deep Wave faculty-context blocker is fixed: proof recompute now repairs all-semester proof offerings/ownerships before rebuilding risk.
- Deep Wave repaired Sem 1 and Sem 6 full-role browser smokes passed with `devika.shetty`.
- Backend repaired counts: Sem 1/Sem 6 Course Leader bootstrap `offeringCount=2, facultyCount=1`; Sem 1/Sem 6 HOD bootstrap `offeringCount=12, facultyCount=12`.
- `rohit.menon` bounded attendance edit persisted academically for offering `mnc_s1_amc_s1_02_a`, student `mnc_student_001`: `0/0` -> `1/2`.
- Recompute returned `{"ok":true}` and seeded proof projection evidence now proves consumption of that teacher edit with `attendancePct=50`.

## Remaining Blockers

- Teacher attendance edit projection bridge is proven for the bounded attendance path; non-attendance edit paths remain unproven.
- Manual demo must switch role to HOD before HoD analytics.
- Fix B backend/API timeline-aware playback gating now unblocks Sem 6 when historical queue cases later move to Watching/Resolved/Closed; fresh browser proof is still needed if visual playback evidence is required.
- Faculty context unavailable is no longer a blocker.

## Next Actions

- Do not claim non-attendance teacher edits alter seeded proof projections until those bridges are fixed/proven.
- Keep role-switch step explicit in demo script.
- Re-run browser proof smoke after Fix B before final playback walkthrough screenshots/video.
