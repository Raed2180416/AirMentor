# Overnight ML Phase 7: Corrected v8 Logistic Baseline

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

Build corrected frozen corpus after world/feature fixes, train v8 logistic baseline with missingness-aware features, evaluate on full decision metric set.

## READ FIRST
- audit-map/14-reconciliation/overnight-implementation-plan.md
- audit-map/22-evals/overnight-ml-rca-overload-breakdowns-current.md
- audit-map/22-evals/overnight-ml-rca-interaction-ablations-current.md
- air-mentor-api/src/lib/proof-risk-model.ts

## SCOPE
1. Build corrected frozen corpus from post-Phase-2 world.
2. Train v8 corrected logistic baseline with missingness-aware features.
3. Evaluate:
   - ROC-AUC, PR-AUC
   - Brier
   - ECE (global)
   - local calibration near 0.4 and 0.85
   - overload ratio
   - precision/recall at budget
   - stage / semester / scenario stability
4. Compare against v7 and heuristic baselines.
5. Emit reproducibility manifest (seed, feature list, split hash).

## VALIDATION GATE

Overload ratio ≤1.00 on corrected corpus; ROC-AUC ≥0.78; ECE ≤0.010; reproducibility manifest present; promotion decision stated.

## OUTPUT CONTRACT

Emit the `<<AIRMENTOR_PASS_RESULT>>` block exactly once at end.
All artifacts declared in the manifest must exist with real content.
`intent_affirmed=true` only if product intent preserved.
