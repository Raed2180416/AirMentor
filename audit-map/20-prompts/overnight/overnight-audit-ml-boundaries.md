# Overnight Audit: Model / Policy / Monitoring / Simulator Layer Separation

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

Deep audit: Overnight Audit: Model / Policy / Monitoring / Simulator Layer Separation. Per-file findings table — expected vs current code truth (file:line) — with target-phase and severity.

## READ FIRST
- audit-map/14-reconciliation/final-decision-appendix.md
- audit-map/14-reconciliation/overnight-prior-ai-flow9-handoff.md
- audit-map/14-reconciliation/overnight-unified-ledger.md
- audit-map/32-reports/overnight-unified-mitigation-plan.md
- air-mentor-api/src/lib/proof-risk-model.ts
- air-mentor-api/src/lib/proof-queue-governance.ts
- air-mentor-api/src/lib/monitoring-engine.ts
- air-mentor-api/src/lib/proof-control-plane-seeded-semester-service.ts
- air-mentor-api/src/lib/proof-control-plane-seeded-run-service.ts
- air-mentor-api/src/lib/proof-control-plane-policy-service.ts

## FOCUS
Audit the model/policy/monitoring/simulator boundary (auth prompt C9).
Find every cross-layer violation:
- Model picking an action (should be policy).
- Simulator as authoritative scorer (runtime must rescore).
- Monitoring emitting a predicted risk number (should only route).
- Policy making calibration decisions (should only map risk → action).

Audit intervention-response formula (auth prompt H): runSeed + studentId +
semester + stage + caseId + actionCode → bounded delta must be deterministic.

Map findings to Phase 7 (training), Phase 11 (final analytics), or
cross-layer cleanup under Phase 3/4.

## VALIDATION GATE

≥8 findings with file:line evidence; every finding has target_phase.

## OUTPUT CONTRACT

Emit the `<<AIRMENTOR_PASS_RESULT>>` block exactly once at end.
All artifacts declared in the manifest must exist with real content.
`intent_affirmed=true` only if product intent preserved.
