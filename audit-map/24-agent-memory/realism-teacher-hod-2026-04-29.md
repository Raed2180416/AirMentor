# Teacher HoD Handoff — 2026-04-29

## Tested

- `devika.shetty` login returns COURSE_LEADER active role first and HOD grant available.
- Switching to `grant_mnc_t1_hod` makes HoD endpoints return 200.
- HoD bundle returns courses/faculty/students/reassessments.
- Counterfactual simulator returns 200 when called with `runId=sim_mnc_2023_first6_v1`.
- Sysadmin receives 403 on scoped HoD summary endpoints.

## Blockers

- Browser UI not run because Chrome missing.
- Teacher edit persistence not fully proven; smoke only verified offering visibility.
- Manual demo must switch role to HOD before HoD analytics.

## Next Actions

- Install Chrome and rerun browser role-switch flow.
- Run one safe teacher edit + recompute + re-read proof.
- Confirm mentor page scope visually.
