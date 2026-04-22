# Overnight Reconcile: ML Strategy

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

Reconcile ML/risk/calibration/counterfactual docs with auth prompt F/G/H/J/N. Separate model vs policy vs monitoring vs simulator claims. Record v7 overload diagnosis.

## READ FIRST
- audit-map/20-prompts/fresh-sem1-principal-architect-overnight-pass.md sections F, G, H, J, N
- air-mentor-api/src/lib/proof-risk-model.ts
- air-mentor-api/src/lib/inference-engine.ts
- air-mentor-api/src/lib/monitoring-engine.ts
- air-mentor-api/src/lib/proof-observed-state.ts
- air-mentor-api/air-mentor-api/output/
- air-mentor-api/catboost_info/
- docs/closeout/final-authoritative-plan.md

## SCOPE
Reconcile claims about heads (attendanceRisk, ceRisk, seeRisk, overallCourseRisk,
downstreamCarryoverRisk), operational banding, v7 overload (1.1127 vs 1.0 baseline),
challenger status, calibration method (Beta-by-head default), missingness strategy,
seeded-vs-runtime scoring authority, counterfactual scope (simulator-based),
intervention-response formula.

Ledger columns: claim_id | intent_section | current_doc | current_code | resolved | files_to_change | eval_artifact.
Close every claim that contradicts layer separation rule.

## VALIDATION GATE

v7 overload diagnosis ≥3 candidate causes ranked; ≥8 ledger rows.

## OUTPUT CONTRACT

Emit the `<<AIRMENTOR_PASS_RESULT>>` block exactly once at end.
All artifacts declared in the manifest must exist with real content.
`intent_affirmed=true` only if product intent preserved.
