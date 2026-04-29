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

## Remaining Blockers

- Teacher edit persistence not fully proven; smoke only verified scoped page visibility.
- Manual demo must switch role to HOD before HoD analytics.
- UI preference stale-version 409s remain visible in browser console.

## Next Actions

- Run one safe teacher edit + recompute + re-read proof.
- Keep role-switch step explicit in demo script.
- Clean browser console noise from `/api/preferences/ui` stale-version conflicts.
