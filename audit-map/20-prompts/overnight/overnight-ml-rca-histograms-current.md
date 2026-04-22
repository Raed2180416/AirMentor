# Overnight ML RCA: overallCourseRisk histograms by stage & semester

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

Overnight ML RCA: overallCourseRisk histograms by stage & semester. Read-only diagnostic on current corpus. No threshold changes.

## READ FIRST
- audit-map/14-reconciliation/final-decision-appendix.md
- audit-map/14-reconciliation/overnight-implementation-plan.md
- audit-map/32-reports/overnight-audit-ml-boundaries.md
- air-mentor-api/air-mentor-api/output/
- air-mentor-api/catboost_info/
- air-mentor-api/src/lib/proof-risk-model.ts

## SCOPE
Produce stage- and semester-conditioned score histograms for
overallCourseRisk on CURRENT corpus (auth prompt N2). Bins: {pre-tt1,
post-tt1, post-tt2, post-assignments, post-see} × semester{1..6}.
Record counts, means, p10/p25/p50/p75/p90, overload mass >0.85.
Emit a markdown table per stage × semester. CSV optional under
`audit-map/22-evals/data/`.

## VALIDATION GATE

Report cites corpus path + produces ≥1 actionable hypothesis.

## OUTPUT CONTRACT

Emit the `<<AIRMENTOR_PASS_RESULT>>` block exactly once at end.
All artifacts declared in the manifest must exist with real content.
`intent_affirmed=true` only if product intent preserved.
