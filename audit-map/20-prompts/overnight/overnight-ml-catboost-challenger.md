# Overnight ML Phase 10: CatBoost Challenger

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

Train CatBoost challenger on corrected frozen corpus as shadow. Compare vs corrected v8 logistic on decision-aware metrics, not AUC alone.

## READ FIRST
- audit-map/22-evals/overnight-ml-v8-corrected-logistic.md
- audit-map/22-evals/overnight-ml-beta-calibration.md

## SCOPE
1. Train CatBoost challenger on corrected corpus. GPU search if available.
2. Evaluate full decision-metric set (same as Phase 7).
3. Compare logistic vs CatBoost head-to-head.
4. Decide: shadow-continue vs candidate-promotion vs reject.
5. If promotable, rerun top candidate through reproducible official path.

## VALIDATION GATE

CatBoost metrics table emitted; head-to-head comparison vs v8 present; promotion decision stated.

## OUTPUT CONTRACT

Emit the `<<AIRMENTOR_PASS_RESULT>>` block exactly once at end.
All artifacts declared in the manifest must exist with real content.
`intent_affirmed=true` only if product intent preserved.
