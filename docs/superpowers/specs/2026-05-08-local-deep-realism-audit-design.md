# Local Deep Realism Audit + Repair Design — 2026-05-08

## Decision

Run a truth-first, local-only audit and repair campaign for AirMentor. The immediate target is `http://127.0.0.1:4000` backend plus `http://127.0.0.1:5173` frontend. GitHub Pages and hosted backend deployment are not current targets; the system should remain clean enough to deploy later.

## Mission

Make the MSRUAS B.Tech Mathematics & Computing 2023 proof demo feel like a coherent academic product, not a script-only mock. Every visible workflow must be backed by real code paths, persisted seeded data, stage-safe evidence, and risk recomputation that responds to allowed edits.

## Non-negotiables

- Treat existing docs and audit maps as evidence candidates, not truth.
- Prefer browser, API, database, and code agreement over any single green test.
- Use nix-wrapped Playwright for deep local browser flows, screenshots, console logs, and network evidence.
- Preserve existing user/WIP changes unless a fix explicitly requires touching them.
- Keep demo language honest: synthetic simulator and local proof run now; production prediction and real-data calibration later.
- Do not optimize for GitHub Pages in this campaign.

## Pass Structure

### Pass 1 — Current Truth Refresh

Map current scripts, routes, seeders, role surfaces, proof-control-plane services, academic routes, active tests, and stale docs. Produce a short truth ledger before invasive changes.

### Pass 2 — Local E2E Proof

Start the local backend and frontend using existing scripts. Run nix-wrapped Playwright through sysadmin login, proof bootstrap, active run inspection, teacher credential discovery, logout/login as Course Leader/Mentor/HoD, and core page navigation. Capture screenshots, console logs, network failures, and timing notes.

### Pass 3 — Stage Progression and Evidence Realism

Validate 6 semesters × 5 stage checkpoints through API and UI. Check evidence gating, prior-history carryover, visible/hidden marks, CO/question mappings, queue state, recommendations, and no future leakage. Fix contradictions that make the demo logically false.

### Pass 4 — Editability and Recompute Robustness

Exercise realistic edits: attendance, marks, timetable movement, teacher/student/mentor changes where supported, curriculum/config/linkage changes, and queue/intervention actions. Risk, queue, summaries, and visible recommendations must update or clearly state why they cannot.

### Pass 5 — ML and Model Governance Reality

Separate trained model, heuristic fallback, operational urgency banding, synthetic simulation, recalibration, and real retraining claims. Fix UI/API wording or logic where it overclaims. Ensure changed curriculum/config assumptions trigger regeneration/recalibration semantics where the current architecture supports it, and document true blockers otherwise.

### Pass 6 — Readiness Closeout

Run targeted unit/integration/E2E suites. Produce a current readiness ledger with fixed issues, remaining blockers, performance concerns, local startup steps, and deployment-prep notes for later.

## Flow Coverage Matrix

Minimum flows to verify:

- Sysadmin: login, dashboard, seed/import/validate/approve, create run, activate run, activate semester, next day, previous day, next stage, archive/stop/restore/recompute where available.
- Teacher roles: generated credential discovery, login, session persistence, role-scoped visibility, course leader course view, mentor mentee view, HoD analytics/counterfactual view.
- Student/risk: risk explorer drilldown, evidence timeline, driver text, CO weakness, weak question lists, recommendations, no-action/counterfactual comparison.
- Academic operations: attendance edit, marks edit, timetable/calendar interaction, course/offering pages, workflow/queue actions, proof summary strip, stale-run/empty-state handling.
- Data realism: sem1 no prior leakage; sem2+ prior-history influence; TT1/TT2/assignment/quiz/SEE stage availability; current and prior semester consistency; no missing evidence displayed as factual zero unless explicitly marked conservative/fallback.
- Isolation: local seeded demo should not require or mutate hosted production services.

## Evidence Standard

A flow is green only when:

1. UI path works in browser without fatal console/network errors.
2. API payload agrees with UI state.
3. Code path is identified.
4. Test or reproducible script covers the behavior, or the remaining gap is explicitly logged.
5. User-facing wording does not overclaim the underlying logic.

## Fix Strategy

Fix root causes while auditing. Small, high-confidence fixes may be applied immediately after the relevant evidence is collected. Larger changes must be isolated behind existing service boundaries and tested before expanding scope. Avoid broad refactors unless they unblock the audited flow.

## Completion Criteria for This Campaign

The campaign is successful when local demo startup, sysadmin simulation control, teacher role login, stage progression, risk recomputation after edits, HoD analytics, and local-only isolation are all verified or repaired with evidence. Remaining production-readiness gaps must be listed honestly with severity and next action.

## Explicit Deferrals

- Hosted GitHub Pages flow.
- Railway or other hosted backend migration.
- Real institutional data import enablement.
- Claiming real-world dropout/failure prediction.
- Full arbitrary-institution curriculum mapping beyond what the current architecture can prove.

## Self-review Notes

This spec is intentionally broad because the user asked for a multi-pass realism campaign, but each pass has bounded evidence gates. It has no unfinished requirements. It chooses local-only runtime as the immediate target and keeps deployment as a later readiness concern.
