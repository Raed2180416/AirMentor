# Realism Verification Verdict — 2026-04-29

## Intent And Feature Intent

吾總判：AirMentor 是否能向 average college user 展示一個可信六學期 academic-risk workflow。

Feature intent preserved:

- Average system admin can activate and inspect a proof run.
- HoD can see scoped analytics only after active HOD role is selected.
- Teachers see scoped operations, not global authority.
- Risk bands are operational urgency, not fake calibrated probability.
- Six-semester proof-plane must obey evidence timing.
- Final readiness must distinguish demo-safe, browser-verified, and production-ready.

## Inputs Reviewed

Reports and artifacts reviewed:

- `audit-map/32-reports/realism-browser-e2e-2026-04-29.md`
- `audit-map/32-reports/realism-proof-plane-2026-04-29.md`
- `audit-map/32-reports/realism-teacher-hod-2026-04-29.md`
- `audit-map/32-reports/realism-ml-sanity-2026-04-29.md`
- `audit-map/32-reports/realism-readiness-security-2026-04-29.md`
- `/tmp/airmentor-demo-logs/realism-2026-04-29/full-walk/walk-summary.json`
- `/tmp/airmentor-demo-logs/realism-2026-04-29/full-walk/proof-dashboard-final.json`
- `/tmp/airmentor-demo-logs/realism-2026-04-29/precision/precision-summary.json`
- `/tmp/airmentor-demo-logs/realism-2026-04-29/browser/browser-smoke-summary.json`
- `/tmp/airmentor-demo-logs/realism-2026-04-29/browser/browser-console.json`
- `/tmp/airmentor-demo-logs/realism-2026-04-29/browser/browser-network.json`
- Browser screenshots: `hod-proof-analytics.png`, `hod-counterfactual.png`, `course-leader.png`, `mentor.png`, `system-admin-app.png`.

Infra context:

- DAG inputs committed at `4ba2fdfb`.
- Codex stderr exposure committed at `41060b1d`.
- Codex `max→xhigh` regression fix committed at `ba8b8559` with tests.
- Coordinator browser rerun used Playwright Chromium under NixOS-compatible 64-bit shared libraries.
- Product fix added HoD counterfactual simulator loader wiring and regression test.

## Executive Verdict

**NO full Go yet. DEMO-CONDITIONAL with Deep Wave faculty-context repair, Fix B timeline-aware playback gating, teacher-edit proof bridge, browser, keyboard, and accessibility evidence now verified.**

Why not full Go:

- Sem 6 post-SEE playback is fixed at backend/API-consumer level by Fix B; fresh browser smoke is still needed if visual proof of accessible final-stage playback is required.
- Teacher attendance persistence is now proven to flow into recomputed immutable proof checkpoint projections by API regression.
- Real-data production readiness is not proven.

Why not hard product no-go:

- Browser smoke now renders HoD, counterfactual, course leader, mentor, and sysadmin dashboard API flows.
- Final live proof-risk smoke renders Sem 1 and Sem 6 sysadmin, teacher, HoD, risk-explorer, and student-shell surfaces.
- Stage A repaired Sem 1/Sem 6 proof-risk smoke now passes after the Sem 6 blocker-message fix and teacher-edit proof bridge.
- Deep Wave repaired Sem 1 and Sem 6 full-role browser proof smokes now pass from source after proof recompute repairs all-semester offerings/ownerships.
- Dedicated live keyboard regression passed six checks.
- Dedicated live accessibility regression passed with 16 report entries and 0 violations.
- UI preference stale-version 409 console noise was fixed and absent from final targeted artifact scans.
- Browser smoke captured screenshots, console logs, and network logs.
- API proof-plane produced all 30 checkpoints after recompute.
- Six-semester risk trajectory is coherent.
- HoD analytics work after active HOD role switch.
- Counterfactual simulator works in browser with `runId=sim_mnc_2023_first6_v1`.
- ML truth contract is intact: operational band overlay does not rewrite calibrated probability.

## Demo Blockers

1. **Sem 6 playback browser evidence is stale after Fix B.**

Pre-Fix-B browser artifacts showed Sem 6 post-SEE `playbackAccessible=false`, blocked by `stage_checkpoint_45dd134a0ac969ea05a049e7`. Fix B changes the semantic: a historical open queue case is live-blocking only if no later checkpoint row for the same case transitions to `Watching`, `Resolved`, or `Closed`. Targeted API regressions now prove Sem 6 post-SEE `playbackAccessible=true` while Sem 2 post-TT1 can still report historical `openQueueCount > 0`.

2. **Teacher edit proof-projection bridge fixed and proven.**

The bounded attendance edit persisted through the course-leader API and academic bootstrap re-read (`0/0` -> `1/2` for `mnc_student_001`). New API regression `projects teacher attendance edits into recomputed proof checkpoint evidence` first failed, then passed after rebuilding historical sources with offering IDs and overlaying latest `teacher-workspace` attendance snapshots during proof replay. It now asserts recomputed `simulationStageStudentProjections.projectionJson.currentEvidence.attendancePct === 50` for `mnc_student_001` / `mnc_s1_amc_s1_02_a`.

3. **Recompute/readiness is mandatory.**

Initial dashboard showed `checkpointCount=0`; final dashboard after recompute showed `checkpointCount=30`. Demo must begin from the recomputed state. Deep Wave root cause was in this readiness path: recompute rebuilt checkpoint playback before ensuring all-semester proof `section_offerings` and active `faculty_offering_ownerships`, causing Sem 1 course-leader bootstrap `facultyCount=0`. This is now fixed in source and covered by regression tests.

4. **HoD active-role switch is mandatory.**

`devika.shetty` can start as `COURSE_LEADER`; HoD analytics require switching to `grant_mnc_t1_hod`.

5. **Real-data production readiness remains outside this proof.**

Synthetic demo evidence is stronger, but real institutional data import, model governance, privacy/security, and deploy closeout are still not proven.

## Must Fix Before Demo

- Run recompute/readiness immediately before demo capture.
- Re-run browser smoke after Fix B before using screenshots/video to claim Sem 6 playback is accessible.
- Teacher edits may be claimed to alter recomputed seeded proof checkpoint projections only with the current bounded evidence path: attendance edit, proof recompute, and projection evidence re-read.
- Keep demo script language as “operational urgency band,” not calibrated failure probability.

## Browser Evidence Now Passed

Browser smoke status: `completed`.

Verified by `/tmp/airmentor-demo-logs/realism-2026-04-29/browser/browser-smoke-summary.json`:

- HoD active role: `HOD` / `grant_mnc_t1_hod`.
- HoD analytics: visible, has semester context, has department proof records.
- Counterfactual: tab visible, simulator response 200, panel visible, `prohibitedCopyFound=false`.
- Course leader: visible, active role `COURSE_LEADER`.
- Mentor: visible, active role `MENTOR`.
- Sysadmin dashboard API: status 200, `checkpointCount=30`, `runId=sim_mnc_2023_first6_v1`, active stage `pre-tt1`, active operational semester 1.
- Network failures: 0.
- Final targeted keyboard/accessibility/proof-smoke artifact scan found no `/api/preferences/ui`, `response:409`, `Stale version`, `requestfailed`, or `pageerror` hits.
- Keyboard regression passed 6 checks: request flow, modal focus trap, proof checkpoint controls, portal role switch, teacher proof surface, and playback restore/reset path.
- Accessibility regression passed with 16 report entries and 0 axe violations.
- Final full-role Sem 1/Sem 6 proof-risk smoke passed using `devika.shetty`; its Sem 6 `playbackAccessible=false` evidence predates Fix B and is now stale for playback gating.
- Stage A after-fixes local browser proof smoke passed for Sem 1 and Sem 6 using `devika.shetty`: `/tmp/airmentor-demo-logs/realism-2026-04-29/stage-a-after-fixes/browser-proof-source-sem1-sem6-devika/stage-a-after-fixes-devika-semester-walk-summary.json`.
- Stage A Sem 6 selected-checkpoint banner fixed the earlier/local blocker wording; Fix B subsequently removes the false backend/API block by computing live queue-case blockers from timeline state.
- Stage A backend smoke counts stayed healthy: Sem 1 Course Leader `offeringCount=2, facultyCount=1`; Sem 1 HOD `offeringCount=12, facultyCount=12`; Sem 6 Course Leader `offeringCount=2, facultyCount=1`; Sem 6 HOD `offeringCount=12, facultyCount=12`.
- Deep Wave Sem 1 repaired smoke passed: `/tmp/airmentor-demo-logs/realism-2026-04-29/deep-wave-self/browser-proof-source-sem1-devika-after-recompute-repair/deep-wave-source-sem1-devika-after-recompute-repair-semester-walk-summary.json`.
- Deep Wave Sem 6 repaired smoke passed: `/tmp/airmentor-demo-logs/realism-2026-04-29/deep-wave-self/browser-proof-source-sem6-devika-after-recompute-repair/deep-wave-source-sem6-devika-after-recompute-repair-semester-walk-summary.json`.
- Backend logs show repaired scoped bootstrap counts: Sem 1 Course Leader `offeringCount=2, facultyCount=1`, Sem 1 HOD `offeringCount=12, facultyCount=12`, Sem 6 Course Leader `offeringCount=2, facultyCount=1`, Sem 6 HOD `offeringCount=12, facultyCount=12`.

## Acceptable With Explicit Caveat

- Sem 6 has 85/120 High-risk students: acceptable only if framed as a heavy-risk synthetic proof corpus.
- Counterfactual simulator: acceptable only if framed as projected/simulated no-intervention comparison.
- Sysadmin 403 on HoD scoped summary: acceptable because those routes are active-HOD scoped.
- No real institutional data: acceptable only for synthetic demo, not deployment claim.
- Teacher edit proof projection bridge: acceptable for bounded attendance edits after proof recompute; do not generalize beyond the tested path without broader edit-type coverage.

## Production Readiness Debt

- Real-data import validation not run.
- Real calibration artifact and model card not verified.
- Live closeout wrapper not run with Railway/GitHub Pages secrets.
- Security penetration/dependency audit not run.
- Data retention, consent, and institutional privacy workflow not verified.
- CERT-In/institution incident workflow not proven as executable.
- Browser accessibility and keyboard smoke now pass, but this is still not a replacement for a human screen-reader review.

## Fix Queue

Priority queue:

1. Prepare proof run: recompute/readiness, then verify 30 checkpoints and nonzero course-leader bootstrap faculty for the selected semester.
2. Rerun browser smoke after Fix B if final-stage accessible playback needs visual evidence.
3. Extend proof-projection bridge coverage beyond attendance if marks/interventions must also alter seeded proof checkpoints.
4. Correct demo language from “probability band” to “operational urgency band.”
5. Verify Vihaan/missing-mark zero-fill concern in upstream mark builder.
6. Run live closeout when production-like claim is needed.
7. Produce real-data import and model-governance artifacts before deployment claim.

## Reverification Plan

Browser:

- Re-run smoke after Fix B to refresh Sem 6 playback screenshots.
- Capture HoD analytics screenshot after role switch.
- Capture counterfactual screenshot and simulator network 200.
- Capture course leader page.
- Capture mentor page.
- Keep final keyboard/accessibility smoke artifacts attached if accessibility claims are made.

Proof-plane:

- Re-run precision probe after recompute and Fix B.
- Confirm `checkpointCount=30` and `missing=[]`.
- Confirm Sem 1 pre-TT1 remains 120/0/0 low/medium/high.
- Confirm Sem 6 post-SEE counts and playback state.

Teacher/HoD:

- Keep `devika.shetty` HOD role switch explicit.
- Keep bounded teacher edit caveat explicit: attendance proof-projection consumption passed after recompute; broader edit types remain unproven.

Readiness:

- Run deploy readiness wrapper only with redacted live credentials.
- Record live session-contract artifact without secrets.
- Attach calibration/model-card artifacts before production claim.

## Evidence Appendix

Key evidence:

- Browser smoke completed with screenshots and logs.
- Final full-role Sem 1/Sem 6 proof-risk smoke completed with screenshots and summary.
- Deep Wave faculty-context RED/GREEN completed: `ensureProofOfferings` ownership-backfill regression passed; targeted Sem 1 `rohit.menon` academic bootstrap regression passed after recompute repair.
- Deep Wave repaired Sem 1/Sem 6 browser smokes passed from source with `devika.shetty`.
- Live keyboard regression completed with 6 passed checks.
- Live accessibility regression completed with 16 report entries and 0 violations.
- Bounded teacher attendance edit persisted academically and now projects into proof evidence: `mnc_student_001` `0/0` -> `1/2`, recomputed proof projection attendance `50`.
- UI preferences 409 regression fixed by serialized saves/retry; final targeted artifact scans found no stale-preference hits.
- Browser network failures: 0.
- Browser counterfactual simulator response: 200.
- Browser counterfactual copy avoided prohibited causal proof language.
- Final proof dashboard has 30 checkpoints and no missing stage keys.
- Stage keys: `pre-tt1`, `post-tt1`, `post-tt2`, `post-assignments`, `post-see`.
- Sem 1 pre-TT1: 120 Low, 0 Medium, 0 High.
- Sem 6 post-SEE: 4 Low, 31 Medium, 85 High.
- Fix B timeline-aware playback regression passed: Sem 6 post-SEE becomes accessible when earlier queue cases later move to `Watching`/`Resolved`/`Closed`; old blocked browser artifacts are stale until rerun.
- HoD role switch makes HoD analytics endpoints return 200 and browser surface render.
- Counterfactual simulator returns 200 with `runId=sim_mnc_2023_first6_v1` and browser panel renders.
- ML sanity: no hard pre-demo ML blockers, but three soft flags and seven post-demo improvements.
- Readiness: deploy/session/security docs are strong, but real-data/live production gates remain incomplete.

## Final Go No-Go

**Final status: DEMO-CONDITIONAL / NO FULL GO.**

The system is now much closer to a defensible synthetic demo because browser E2E, keyboard, accessibility, HoD counterfactual, Sem 1/Sem 6 proof-risk surfaces, Deep Wave faculty-context repair, Fix B timeline-aware playback gating, and bounded teacher-edit proof projection are verified. Full readiness is still not proven until fresh post-Fix-B browser capture and production-readiness gates are complete.
