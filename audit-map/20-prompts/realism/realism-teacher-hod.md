# Realism Teacher And HoD Audit — 2026-04-29

## CAVEMAN WENYAN-ULTRA MODE — HARD-ENFORCED

`CAVEMAN_ENFORCED=1 CAVEMAN_MODE=wenyan-ultra` active. Prose short. Technical strings exact.

## INTENT FIRST

Mission intent: audit AirMentor like real faculty using real permissions during a semester.

Feature intent: teacher operations must be scoped to assigned courses, allow attendance/marks edits only when institutionally valid, persist saves, recompute risk, explain queue/recommendation changes, and restore context after relogin. HoD analytics must summarize department-level proof state without violating scope or implying causal proof.

## WRITE LIMIT

Write only:
- `audit-map/32-reports/realism-teacher-hod-2026-04-29.md`
- `audit-map/24-agent-memory/realism-teacher-hod-2026-04-29.md`

Do not modify product code.

## READ FIRST

- `tests-e2e/helpers/login-as.ts`
- `tests-e2e/specs/flow-1-fresh-start.spec.ts`
- `tests-e2e/specs/flow-2-evidence-reaction.spec.ts`
- `tests-e2e/specs/flow-4-scheduled-nextday.spec.ts`
- `tests-e2e/specs/flow-5-boundary-cross.spec.ts`
- `tests-e2e/specs/flow-8-reopen.spec.ts`
- `tests-e2e/specs/flow-9-hod-cycle.spec.ts`
- `tests-e2e/specs/intervention-affects-marks.spec.ts`
- `src/pages/course-pages.tsx`
- `src/pages/hod-pages.tsx`
- `src/academic-session-shell.tsx`
- `air-mentor-api/src/modules/academic.ts`
- `air-mentor-api/src/lib/proof-control-plane-hod-service.ts`
- `air-mentor-api/src/lib/proof-counterfactual-simulator-aggregator.ts`
- `air-mentor-api/tests/hod-proof-analytics.test.ts`
- `air-mentor-api/tests/risk-explorer.test.ts`
- `air-mentor-api/tests/academic-parity.test.ts`

## TEACHER CHECKS

Verify realistic behavior for generated faculty credential login:
- assigned course visible
- unrelated course hidden/blocked
- student risk explorer opens
- attendance edit saves
- refresh keeps saved value
- risk recomputes or clearly explains queued recompute
- queue/recommendation changes or explanation appears
- marks edit only at valid stages
- invalid-stage edit blocked with useful reason
- intervention add/complete if available
- logout/login restores context

## HOD CHECKS

Verify browser/API where needed:
- summary
- proof bundle
- courses
- faculty
- students
- reassessments
- counterfactual simulator
- role switch/login
- session restore
- no causal overclaim
- no future evidence leak

## REPORT FORMAT

Create `audit-map/32-reports/realism-teacher-hod-2026-04-29.md` with sections:

# Teacher And HoD Realism Audit — 2026-04-29
## Intent And Feature Intent
## Method
## Teacher Operations Matrix
## HoD Analytics Matrix
## Permission And Scope Findings
## Edit Persistence And Recompute Findings
## Blockers
## Reverification Needed
## Verdict

Also create `audit-map/24-agent-memory/realism-teacher-hod-2026-04-29.md` with concise handoff.
