# Overnight Closure Verification + Demo Script

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

Verify every deliverable from auth-prompt P. Emit final implementation summary + demo-script checklist + remaining-risk register.

## READ FIRST
- audit-map/14-reconciliation/final-decision-appendix.md
- audit-map/14-reconciliation/overnight-unified-ledger.md
- audit-map/14-reconciliation/overnight-implementation-plan.md
- audit-map/32-reports/overnight-impl-phase1-run-authority.md
- audit-map/32-reports/overnight-impl-phase2-feature-correctness.md
- audit-map/32-reports/overnight-impl-phase3-case-queue.md
- audit-map/32-reports/overnight-impl-phase4-calendar-bridge.md
- audit-map/32-reports/overnight-impl-phase5-advance-reset-stop.md
- audit-map/32-reports/overnight-impl-phase6-hod-correction.md
- audit-map/32-reports/overnight-impl-phase11-final-analytics.md
- audit-map/22-evals/overnight-ml-v8-corrected-logistic.md
- audit-map/22-evals/overnight-ml-beta-calibration.md
- audit-map/22-evals/overnight-ml-catboost-challenger.md
- audit-map/32-reports/overnight-validate-unit-tests.md
- audit-map/32-reports/overnight-validate-api-integration.md
- audit-map/32-reports/overnight-validate-determinism-replay.md
- audit-map/32-reports/overnight-validate-ml-metrics.md

## SCOPE
Emit the final implementation summary + demo-script checklist
following auth-prompt P. Sections:
- What was changed
- Why
- What remains
- What is safe for demo
- What is still experimental
- Demo script checklist: exact click-path to show each auth-prompt L flow
- Remaining risk register (with severity + owner + follow-up task)

## VALIDATION GATE

Verdict present; demo script covers flows L1..L11.

## OUTPUT CONTRACT

Emit the `<<AIRMENTOR_PASS_RESULT>>` block exactly once at end.
All artifacts declared in the manifest must exist with real content.
`intent_affirmed=true` only if product intent preserved.
