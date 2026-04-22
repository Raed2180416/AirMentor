# Overnight Impl Phase 2: Feature / Evidence / Runtime Correctness

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

Implement Phase 2 (feature/evidence/runtime correctness). Surgical edits only, matching unified implementation plan. Preserve UI/UX flow. Add/update tests. Produce per-edit summary report.

## READ FIRST
- audit-map/14-reconciliation/final-decision-appendix.md
- audit-map/14-reconciliation/overnight-prior-ai-flow9-handoff.md
- audit-map/14-reconciliation/overnight-unified-ledger.md
- audit-map/14-reconciliation/overnight-implementation-plan.md
- audit-map/32-reports/overnight-unified-mitigation-plan.md
- audit-map/32-reports/overnight-audit-feature-evidence.md
- air-mentor-api/src/lib/proof-risk-model.ts
- air-mentor-api/src/lib/inference-engine.ts
- air-mentor-api/src/lib/proof-observed-state.ts
- air-mentor-api/src/modules/academic-runtime-routes.ts

## SCOPE
Apply Phase 2 edits from the unified plan. Targets:
- Stop deriving live stage from evidence presence. Use authoritative run stage.
- Remove stale checkpoint evidence reuse from live scoring.
- Make Semester 1 prior history null-safe.
- Add explicit missingness indicators (companion features).
- Ensure early absent TT/SEE are NOT encoded as worst-case.
- Make quiz/assignment evidence visible to risk as soon as entered.
- Unify route write semantics with playback/runtime visibility semantics.
- Keep model serving on authoritative observed state only.

Test additions: missingness-aware feature unit tests; stale checkpoint
leakage regression test; early-evidence immediate-reaction integration test.

## VALIDATION GATE

All listed edits applied with file:line evidence; `npm --prefix air-mentor-api test` (or targeted subset) passes for touched modules; report cites every edit with line range.

## OUTPUT CONTRACT

Emit the `<<AIRMENTOR_PASS_RESULT>>` block exactly once at end.
All artifacts declared in the manifest must exist with real content.
`intent_affirmed=true` only if product intent preserved.
