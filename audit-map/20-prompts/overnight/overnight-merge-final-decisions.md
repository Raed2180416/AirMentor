# Overnight Merge: Final Decisions + Unified Mitigation Plan

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

Merge three reconciliations into unified conflict-free ledger + phase-ordered mitigation plan. Append new frozen rules to appendix only if they already exist in the authoritative prompt.

## READ FIRST
- audit-map/32-reports/overnight-reconcile-proof-lifecycle.md
- audit-map/32-reports/overnight-reconcile-ml.md
- audit-map/32-reports/overnight-reconcile-queue-calendar.md
- audit-map/14-reconciliation/contradiction-matrix-proof-lifecycle.md
- audit-map/14-reconciliation/contradiction-matrix-ml.md
- audit-map/14-reconciliation/contradiction-matrix-queue-calendar.md
- audit-map/14-reconciliation/final-decision-appendix.md

## SCOPE
1. Concat all three contradiction matrices + ledgers into
   `audit-map/14-reconciliation/overnight-unified-ledger.md`
   and consolidate into the shared
   `audit-map/14-reconciliation/contradiction-matrix.md`.
2. Dedupe; preserve file:line citations.
3. If auth prompt adds a rule not yet in the frozen appendix, append under
   a new `## Overnight Additions (2026-04-22)` section. Never overwrite.
4. Emit `audit-map/32-reports/overnight-unified-mitigation-plan.md` ordered
   by phase (1 → 11). Each row: file | location | change | test | rollback.

Downstream impl nodes MUST read the unified plan first.

## VALIDATION GATE

Unified ledger ≥40 lines; mitigation plan has all 11 phase sections.

## OUTPUT CONTRACT

Emit the `<<AIRMENTOR_PASS_RESULT>>` block exactly once at end.
All artifacts declared in the manifest must exist with real content.
`intent_affirmed=true` only if product intent preserved.
