# Realism Verification Verdict — 2026-04-29

## Intent And Feature Intent

吾總判：AirMentor 是否能向 average college user 展示一個可信六學期 academic-risk workflow。

Feature intent preserved:

- Average system admin can activate and inspect a proof run.
- HoD can see scoped analytics only after active HOD role is selected.
- Teachers see scoped operations, not global authority.
- Risk bands are operational urgency, not fake calibrated probability.
- Six-semester proof-plane must obey evidence timing.
- Final readiness must distinguish demo-safe, browser-unverified, and production-ready.

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

Infra context:

- DAG inputs committed at `4ba2fdfb`.
- Codex stderr exposure committed at `41060b1d`.
- Codex `max→xhigh` regression fix committed at `ba8b8559` with tests.
- ML sanity report was produced by an agent and salvaged after citation line-range correction.
- Other agent attempts were blocked by provider/marker failures; coordinator probes filled evidence gaps.

## Executive Verdict

**NO full Go yet. DEMO-CONDITIONAL after browser and queue prep.**

Why not full Go:

- No real browser evidence exists because Chrome/Chromium is missing from the workstation.
- Sem 6 post-SEE playback is currently inaccessible because earlier queue items remain unresolved.
- Teacher edit persistence was not fully mutated and re-read.
- Real-data production readiness is not proven.

Why not hard product no-go:

- API proof-plane produced all 30 checkpoints after recompute.
- Six-semester risk trajectory is coherent.
- HoD analytics work after active HOD role switch.
- Counterfactual simulator works when supplied `runId`.
- ML truth contract is intact: operational band overlay does not rewrite calibrated probability.

## Demo Blockers

1. **Chrome missing.**

Playwright and Puppeteer cannot launch. Browser UI, console, screenshot, accessibility, and network evidence are absent.

2. **Sem 6 playback blocked.**

Sem 6 post-SEE has `playbackAccessible=false`, blocked by unresolved queue at `stage_checkpoint_45dd134a0ac969ea05a049e7`.

3. **Recompute/readiness is mandatory.**

Initial dashboard showed `checkpointCount=0`; final dashboard after recompute showed `checkpointCount=30`. Demo must begin from the recomputed state.

4. **HoD active-role switch is mandatory.**

`devika.shetty` logs in first as `COURSE_LEADER`; HoD endpoints return 403 until switched to `grant_mnc_t1_hod`.

## Must Fix Before Demo

- Install Chrome/Chromium or use an environment with browser automation installed.
- Rerun the browser E2E walkthrough and capture screenshots, console logs, and network logs.
- Run recompute/readiness immediately before demo capture.
- Resolve or explain the Sem 2 post-TT1 queue blocker before showing Sem 6 playback.
- Confirm one teacher edit persistence path through browser or API mutation and re-read.
- Ensure demo script says “operational urgency band,” not calibrated failure probability.

## Acceptable With Explicit Caveat

- Sem 6 has 85/120 High-risk students: acceptable only if framed as a heavy-risk synthetic proof corpus.
- Counterfactual simulator: acceptable only if framed as projected/simulated no-intervention comparison.
- Sysadmin 403 on HoD scoped summary: acceptable because those routes are active-HOD scoped.
- No real institutional data: acceptable only for synthetic demo, not deployment claim.

## Production Readiness Debt

- Real-data import validation not run.
- Real calibration artifact and model card not verified.
- Live closeout wrapper not run with Railway/GitHub Pages secrets.
- Security penetration/dependency audit not run.
- Data retention, consent, and institutional privacy workflow not verified.
- CERT-In/institution incident workflow not proven as executable.
- Browser security and accessibility evidence missing.

## Fix Queue

Priority queue:

1. Install Chrome/Chromium for Playwright/Puppeteer.
2. Rerun browser E2E for system-admin, HoD, course leader, and mentor flows.
3. Prepare proof run: recompute/readiness, then verify 30 checkpoints.
4. Resolve queue blocker for `stage_checkpoint_45dd134a0ac969ea05a049e7` if playback is needed.
5. Run safe teacher edit persistence proof.
6. Re-run HoD counterfactual panel in browser with `runId` populated.
7. Correct demo language from “probability band” to “operational urgency band.”
8. Verify Vihaan/missing-mark zero-fill concern in upstream mark builder.
9. Run live closeout when production-like claim is needed.
10. Produce real-data import and model-governance artifacts before deployment claim.

## Reverification Plan

Browser:

- Install Chrome/Chromium.
- Capture `/tmp/airmentor-demo-logs/realism-2026-04-29/browser/system-admin.png`.
- Capture HoD analytics screenshot after role switch.
- Capture course leader offering page.
- Capture mentor page.
- Capture console and network logs.

Proof-plane:

- Re-run precision probe after recompute.
- Confirm `checkpointCount=30` and `missing=[]`.
- Confirm Sem 1 pre-TT1 remains 120/0/0 low/medium/high.
- Confirm Sem 6 post-SEE counts and playback state.

Teacher/HoD:

- Switch `devika.shetty` to HOD through UI.
- Confirm HoD proof endpoints are not 403.
- Perform bounded teacher edit, recompute, and re-read.

Readiness:

- Run deploy readiness wrapper only with redacted live credentials.
- Record live session-contract artifact without secrets.
- Attach calibration/model-card artifacts before production claim.

## Evidence Appendix

Key evidence:

- Final proof dashboard has 30 checkpoints and no missing stage keys.
- Stage keys: `pre-tt1`, `post-tt1`, `post-tt2`, `post-assignments`, `post-see`.
- Sem 1 pre-TT1: 120 Low, 0 Medium, 0 High.
- Sem 6 post-SEE: 4 Low, 31 Medium, 85 High.
- Sem 6 post-SEE playback inaccessible due queue blocker.
- HoD role switch makes six HoD analytics endpoints return 200.
- Counterfactual simulator returns 200 with `runId=sim_mnc_2023_first6_v1`.
- ML sanity: no hard pre-demo ML blockers, but three soft flags and seven post-demo improvements.
- Readiness: deploy/session/security docs are strong, but real-data/live production gates remain incomplete.

## Final Go No-Go

**Final status: DEMO-CONDITIONAL / NO FULL GO.**

The system is close to a defensible synthetic demo, but full readiness is not proven until browser verification and queue/playback preparation are complete. Production readiness is explicitly not proven.
