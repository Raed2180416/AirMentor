# Realism Browser E2E Audit — 2026-04-29

## CAVEMAN WENYAN-ULTRA MODE — HARD-ENFORCED

`CAVEMAN_ENFORCED=1 CAVEMAN_MODE=wenyan-ultra` active. Prose short. Technical strings exact.

## INTENT FIRST

Mission intent: validate AirMentor as a real browser product for an average college evaluator using realistic roles, permissions, semesters, stages, and evidence timing. Do not rubber-stamp. Try to falsify readiness.

Feature intent: the browser demo must let a sysadmin launch/advance a proof run, reveal real generated teacher credentials, let teacher and HoD users inspect only permitted scope, edit only valid evidence, persist saves, recompute risk, show queues/recommendations/explanations/calendar/counterfactuals truthfully, and recover sessions without stale inactive proof runs or future evidence leaks.

## WRITE LIMIT

Read code and run probes if useful. Write only:
- `audit-map/32-reports/realism-browser-e2e-2026-04-29.md`
- `audit-map/24-agent-memory/realism-browser-e2e-2026-04-29.md`

Do not modify product code.

## READ FIRST

- `HANDOFF_RISK_BAND_REALISM_2026-04-29.md`
- `package.json`
- `tests-e2e/playwright.config.ts`
- `tests-e2e/fixtures/seeded-run-fixture.ts`
- `tests-e2e/helpers/login-as.ts`
- `tests-e2e/specs/flow-1-fresh-start.spec.ts`
- `tests-e2e/specs/flow-9-hod-cycle.spec.ts`
- `tests-e2e/specs/flow-10-completion-counterfactual.spec.ts`
- `scripts/system-admin-proof-risk-smoke.mjs`
- `src/App.tsx`
- `src/system-admin-live-app.tsx`
- `src/pages/hod-pages.tsx`
- `src/pages/course-pages.tsx`
- `src/pages/calendar-pages.tsx`

## BROWSER CHECKLIST

Judge these as a human evaluator, not as endpoint shape checks:

1. Landing page.
2. Sysadmin login.
3. Create/activate simulation.
4. Proof dashboard active run.
5. Generated teacher credentials.
6. Sysadmin stage advancement.
7. Teacher login.
8. Teacher course scope.
9. Student risk explorer.
10. Attendance edit.
11. Mark edit at valid stage.
12. Save persistence after refresh.
13. Risk recompute.
14. Queue/recommendation/explanation.
15. Relogin/session restore.
16. Calendar.
17. HoD role switch/login.
18. HoD summary.
19. HoD courses/faculty/students.
20. Counterfactual simulator.
21. Reset/fallback.

For every page inspect:
- no crash
- no fatal console error
- no infinite loading
- no stale inactive proof run
- no future evidence leak
- no missing evidence displayed as `0%`
- no fake probability/cause claim

## EXECUTION GUIDANCE

If browser execution is possible, use existing Playwright scripts or tests. If worktree lacks `node_modules`, run commands from canonical checkout `/home/raed/projects/air-mentor-ui` but copy/log conclusions into the required report in your worktree. Do not start multiple dev servers blindly; check ports/processes first. Screenshots/traces may live under `/tmp/airmentor-demo-logs/realism-2026-04-29/`.

## REPORT FORMAT

Create `audit-map/32-reports/realism-browser-e2e-2026-04-29.md` with sections:

# Browser E2E Realism Audit — 2026-04-29
## Intent And Feature Intent
## Method
## Browser Evidence Matrix
## Findings
## Blockers
## Reverification Needed
## Artifact Paths
## Verdict

Each finding must include role, route/page, semester/stage if relevant, realistic expectation, actual result, severity, reproduction, and evidence.

Also create `audit-map/24-agent-memory/realism-browser-e2e-2026-04-29.md` with concise handoff: what was tested, blockers, commands, artifacts, next actions.

## EXIT

End with required `<<AIRMENTOR_PASS_RESULT>>` marker injected by pipeline. `intent_affirmed=true` only means your audit preserved intent, not that the product passed.
