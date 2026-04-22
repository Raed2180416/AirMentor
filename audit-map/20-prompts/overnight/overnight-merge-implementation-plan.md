# Overnight Merge: Implementation Plan

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

Consolidate every code audit into ordered implementation plan. Per phase: edit list, test additions, validation gates, rollback strategy.

## READ FIRST
- audit-map/32-reports/overnight-audit-run-authority.md
- audit-map/32-reports/overnight-audit-feature-evidence.md
- audit-map/32-reports/overnight-audit-case-queue-workflow.md
- audit-map/32-reports/overnight-audit-frontend-flows.md
- audit-map/32-reports/overnight-audit-ml-boundaries.md
- audit-map/32-reports/overnight-unified-mitigation-plan.md

## SCOPE
Emit master plan with numbered edits per phase. Each edit row:
  file | location | change | test | rollback | owner_phase.

Downstream impl nodes MUST read this plan first.

## VALIDATION GATE

Every phase section ≥3 edit rows; all rows have file:line.

## OUTPUT CONTRACT

Emit the `<<AIRMENTOR_PASS_RESULT>>` block exactly once at end.
All artifacts declared in the manifest must exist with real content.
`intent_affirmed=true` only if product intent preserved.
