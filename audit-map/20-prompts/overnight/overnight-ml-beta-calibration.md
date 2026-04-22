# Overnight ML Phase 9: Beta Calibration (default) + Venn-Abers (shadow)

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

Apply Beta calibration by head as default production path. Run Venn-Abers as diagnostic. Evaluate global + local calibration.

## READ FIRST
- audit-map/22-evals/overnight-ml-v8-corrected-logistic.md
- air-mentor-api/src/lib/proof-risk-model.ts

## SCOPE
1. Fit Beta calibration per head on corrected corpus.
2. Evaluate global ECE and local ECE at 0.4 / 0.85 bands.
3. Run Venn-Abers as shadow diagnostic (uncertainty path).
4. Emit promotion decision: calibrated vs uncalibrated.
5. If promotion accepted, update `proof-risk-model.ts` calibration hook
   with a surgical edit (≤150 lines net diff).

## VALIDATION GATE

Local ECE at 0.4 ≤ pre-cal; local ECE at 0.85 ≤ pre-cal; global ECE not worse.

## OUTPUT CONTRACT

Emit the `<<AIRMENTOR_PASS_RESULT>>` block exactly once at end.
All artifacts declared in the manifest must exist with real content.
`intent_affirmed=true` only if product intent preserved.
