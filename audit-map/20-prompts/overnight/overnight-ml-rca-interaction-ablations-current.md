# Overnight ML RCA: interaction-feature ablations

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

Overnight ML RCA: interaction-feature ablations. Read-only diagnostic on current corpus. No threshold changes.

## READ FIRST
- audit-map/14-reconciliation/final-decision-appendix.md
- audit-map/14-reconciliation/overnight-implementation-plan.md
- audit-map/32-reports/overnight-audit-ml-boundaries.md
- air-mentor-api/air-mentor-api/output/
- air-mentor-api/catboost_info/
- air-mentor-api/src/lib/proof-risk-model.ts

## SCOPE
Run interaction-feature ablations on current corpus (auth prompt N5,
Phase 8):
  - none
  - TT interaction only
  - coursework interaction only
  - stage × TT only
  - stage × coursework only
  - all
Report ROC-AUC, Brier, ECE, overload for each ablation.
Determine whether overload is caused by local miscalibration,
score bunching near thresholds, specific interaction features,
or stage-conditioned distribution shift.

## VALIDATION GATE

Report cites corpus path + produces ≥1 actionable hypothesis.

## OUTPUT CONTRACT

Emit the `<<AIRMENTOR_PASS_RESULT>>` block exactly once at end.
All artifacts declared in the manifest must exist with real content.
`intent_affirmed=true` only if product intent preserved.
