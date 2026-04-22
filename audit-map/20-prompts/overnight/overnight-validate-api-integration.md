# Overnight Validate: API / Integration Tests

## CAVEMAN WENYAN-ULTRA MODE — HARD-ENFORCED, NEVER REVERT

`CAVEMAN_ENFORCED=1 CAVEMAN_MODE=wenyan-ultra` active. All prose
(docs, briefings, commit bodies, result notes, visible reasoning)
must be wenyan-ultra caveman: max compression, classical particles
OK (之乃為其), drop articles/filler, abbreviate (DB/auth/config/
req/res/fn/impl), arrows for causality (X → Y). Stay in-mode.

Normal English ONLY for: source code, tests, fixtures, schema SQL,
commit subject line, user-facing error strings, the structured
`<<AIRMENTOR_PASS_RESULT>>` JSON marker. Nothing else.

## AUTHORITATIVE PROMPT

Single source of truth:
`audit-map/20-prompts/fresh-sem1-principal-architect-overnight-pass.md`
Read sections A..Q before acting. Authoritative prompt > per-node.

## FROZEN APPENDIX (do not reopen)

`audit-map/14-reconciliation/final-decision-appendix.md`

## UI/UX PRESERVATION

No UI/UX flow changes. Architectural/data-wiring edits only for
`src/**/*.tsx`. If uncertain, stop and surface in `notes`.

## PARALLELISM SAFETY

Write only files matched by `write_scope_glob`. Never touch
`.windsurf/`, `.claude/`, `AGENTS.md`, `CLAUDE.md`, migrations
(unless scope explicitly allows).


## PURPOSE

Overnight Validate: API / Integration Tests. Execute the specified validation layer, capture outputs, report pass/fail against auth-prompt gate M.

## READ FIRST
- audit-map/14-reconciliation/final-decision-appendix.md
- audit-map/14-reconciliation/overnight-implementation-plan.md
- audit-map/32-reports/overnight-impl-phase1-run-authority.md
- audit-map/32-reports/overnight-impl-phase2-feature-correctness.md
- audit-map/32-reports/overnight-impl-phase3-case-queue.md
- audit-map/32-reports/overnight-impl-phase4-calendar-bridge.md
- audit-map/32-reports/overnight-impl-phase5-advance-reset-stop.md
- audit-map/32-reports/overnight-impl-phase6-hod-correction.md
- audit-map/32-reports/overnight-impl-phase11-final-analytics.md

## SCOPE
Run API/integration suites (auth prompt M2): run creation, day
advance, stage advance, reset stage, complete reset, stop, correction
cycle, queue/calendar bridge.

Only integration-flagged tests. Do not trigger heavyweight ML
training/eval workloads inside this node.


            ## COMMAND HINT
            Run the following (or close equivalent) inside the worktree; capture
            full output into the report:
            ```
            npm --prefix air-mentor-api test -- --run --reporter=verbose --include '**/*integration*.test.ts' 2>&1 | tail -200
npm test -- --run --reporter=verbose --include '**/*integration*.test.ts' 2>&1 | tail -200
            ```

## VALIDATION GATE

Command output captured; pass/fail tally + failing-test list emitted.

## OUTPUT CONTRACT

Emit the `<<AIRMENTOR_PASS_RESULT>>` block exactly once at end.
All artifacts declared in the manifest must exist with real content.
`intent_affirmed=true` only if product intent preserved.
