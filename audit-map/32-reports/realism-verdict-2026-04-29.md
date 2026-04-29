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

**NO full Go yet. DEMO-CONDITIONAL with browser core now verified.**

Why not full Go:

- Sem 6 post-SEE playback is currently inaccessible because earlier queue items remain unresolved.
- Teacher edit persistence was not fully mutated and re-read.
- Browser console still records `/api/preferences/ui` stale-version 409 conflicts.
- Dedicated accessibility/keyboard browser checks were not run in the new smoke.
- Real-data production readiness is not proven.

Why not hard product no-go:

- Browser smoke now renders HoD, counterfactual, course leader, mentor, and sysadmin dashboard API flows.
- Browser smoke captured screenshots, console logs, and network logs.
- API proof-plane produced all 30 checkpoints after recompute.
- Six-semester risk trajectory is coherent.
- HoD analytics work after active HOD role switch.
- Counterfactual simulator works in browser with `runId=sim_mnc_2023_first6_v1`.
- ML truth contract is intact: operational band overlay does not rewrite calibrated probability.

## Demo Blockers

1. **Sem 6 playback blocked.**

Sem 6 post-SEE has `playbackAccessible=false`, blocked by unresolved queue at `stage_checkpoint_45dd134a0ac969ea05a049e7`.

2. **Teacher edit persistence not proven.**

The audit verified scoped teacher pages and recompute, but not one complete safe mutation + recompute + re-read loop.

3. **Recompute/readiness is mandatory.**

Initial dashboard showed `checkpointCount=0`; final dashboard after recompute showed `checkpointCount=30`. Demo must begin from the recomputed state.

4. **HoD active-role switch is mandatory.**

`devika.shetty` can start as `COURSE_LEADER`; HoD analytics require switching to `grant_mnc_t1_hod`.

5. **Browser console needs cleanup before polished demo.**

The latest smoke has zero network failures, but logs three `/api/preferences/ui` 409 stale-version errors from UI preference save.

## Must Fix Before Demo

- Run recompute/readiness immediately before demo capture.
- Resolve or explain the Sem 2 post-TT1 queue blocker before showing Sem 6 playback.
- Confirm one teacher edit persistence path through browser or API mutation and re-read.
- Fix or suppress stale-version UI preference conflicts.
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
- Non-OK network responses: three `/api/preferences/ui` 409 stale-version conflicts.

## Acceptable With Explicit Caveat

- Sem 6 has 85/120 High-risk students: acceptable only if framed as a heavy-risk synthetic proof corpus.
- Counterfactual simulator: acceptable only if framed as projected/simulated no-intervention comparison.
- Sysadmin 403 on HoD scoped summary: acceptable because those routes are active-HOD scoped.
- No real institutional data: acceptable only for synthetic demo, not deployment claim.
- UI preference stale-version 409s: acceptable for internal evidence capture, not for polished demo.

## Production Readiness Debt

- Real-data import validation not run.
- Real calibration artifact and model card not verified.
- Live closeout wrapper not run with Railway/GitHub Pages secrets.
- Security penetration/dependency audit not run.
- Data retention, consent, and institutional privacy workflow not verified.
- CERT-In/institution incident workflow not proven as executable.
- Browser accessibility and keyboard evidence still missing from the latest smoke.

## Fix Queue

Priority queue:

1. Prepare proof run: recompute/readiness, then verify 30 checkpoints.
2. Resolve queue blocker for `stage_checkpoint_45dd134a0ac969ea05a049e7` if playback is needed.
3. Run safe teacher edit persistence proof.
4. Fix `/api/preferences/ui` stale-version browser console noise.
5. Run dedicated accessibility/keyboard browser checks if required for final claim.
6. Correct demo language from “probability band” to “operational urgency band.”
7. Verify Vihaan/missing-mark zero-fill concern in upstream mark builder.
8. Run live closeout when production-like claim is needed.
9. Produce real-data import and model-governance artifacts before deployment claim.

## Reverification Plan

Browser:

- Re-run smoke after queue/playback preparation.
- Capture HoD analytics screenshot after role switch.
- Capture HoD counterfactual screenshot and simulator network 200.
- Capture course leader page.
- Capture mentor page.
- Capture console and network logs with no stale preference conflicts.

Proof-plane:

- Re-run precision probe after recompute and queue resolution.
- Confirm `checkpointCount=30` and `missing=[]`.
- Confirm Sem 1 pre-TT1 remains 120/0/0 low/medium/high.
- Confirm Sem 6 post-SEE counts and playback state.

Teacher/HoD:

- Keep `devika.shetty` HOD role switch explicit.
- Perform bounded teacher edit, recompute, and re-read.

Readiness:

- Run deploy readiness wrapper only with redacted live credentials.
- Record live session-contract artifact without secrets.
- Attach calibration/model-card artifacts before production claim.

## Evidence Appendix

Key evidence:

- Browser smoke completed with screenshots and logs.
- Browser network failures: 0.
- Browser counterfactual simulator response: 200.
- Browser counterfactual copy avoided prohibited causal proof language.
- Final proof dashboard has 30 checkpoints and no missing stage keys.
- Stage keys: `pre-tt1`, `post-tt1`, `post-tt2`, `post-assignments`, `post-see`.
- Sem 1 pre-TT1: 120 Low, 0 Medium, 0 High.
- Sem 6 post-SEE: 4 Low, 31 Medium, 85 High.
- Sem 6 post-SEE playback inaccessible due queue blocker.
- HoD role switch makes HoD analytics endpoints return 200 and browser surface render.
- Counterfactual simulator returns 200 with `runId=sim_mnc_2023_first6_v1` and browser panel renders.
- ML sanity: no hard pre-demo ML blockers, but three soft flags and seven post-demo improvements.
- Readiness: deploy/session/security docs are strong, but real-data/live production gates remain incomplete.

## Final Go No-Go

**Final status: DEMO-CONDITIONAL / NO FULL GO.**

The system is now much closer to a defensible synthetic demo because core browser E2E is verified. Full readiness is still not proven until queue/playback preparation, teacher edit persistence, UI preference 409 cleanup, and production-readiness gates are complete.
