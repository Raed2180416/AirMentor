# Overnight Validate: ML Evaluation Metrics

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

Overnight Validate: ML Evaluation Metrics. Execute the specified validation layer, capture outputs, report pass/fail against auth-prompt gate M.

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
ML evaluation validation (auth prompt M5): global metrics, local
threshold behavior, overload, precision/recall at budget, stage/
semester/scenario breakdown, calibration, challenger shadow
comparisons. Read from `audit-map/22-evals/` outputs of Phases 7/9/10.

Do not retrain. Read recorded metrics; assert gates; emit summary.


            ## COMMAND HINT
            Run the following (or close equivalent) inside the worktree; capture
            full output into the report:
            ```
            cat audit-map/22-evals/overnight-ml-v8-corrected-logistic.md | head -200
cat audit-map/22-evals/overnight-ml-beta-calibration.md | head -200
cat audit-map/22-evals/overnight-ml-catboost-challenger.md | head -200
            ```

## VALIDATION GATE

Command output captured; pass/fail tally + failing-test list emitted.

## OUTPUT CONTRACT

Emit the `<<AIRMENTOR_PASS_RESULT>>` block exactly once at end.
All artifacts declared in the manifest must exist with real content.
`intent_affirmed=true` only if product intent preserved.
