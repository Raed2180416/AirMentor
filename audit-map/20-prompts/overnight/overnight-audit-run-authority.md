# Overnight Audit: Run Authority / Fresh-Sem1 Core

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

Deep audit: Overnight Audit: Run Authority / Fresh-Sem1 Core. Per-file findings table — expected vs current code truth (file:line) — with target-phase and severity.

## READ FIRST
- audit-map/14-reconciliation/final-decision-appendix.md
- audit-map/14-reconciliation/overnight-prior-ai-flow9-handoff.md
- audit-map/14-reconciliation/overnight-unified-ledger.md
- audit-map/32-reports/overnight-unified-mitigation-plan.md
- air-mentor-api/src/lib/proof-control-plane-activation-service.ts
- air-mentor-api/src/lib/proof-control-plane-runtime-service.ts
- air-mentor-api/src/lib/proof-control-plane-seeded-run-service.ts
- air-mentor-api/src/lib/proof-control-plane-seeded-semester-service.ts
- air-mentor-api/src/lib/proof-control-plane-live-run-service.ts
- air-mentor-api/src/lib/proof-control-plane-tail-service.ts
- air-mentor-api/src/lib/proof-control-plane-advance-service.ts
- air-mentor-api/src/lib/proof-control-plane-playback-reset-service.ts
- air-mentor-api/src/db/schema.ts

## FOCUS
- `simulation_runs` authority fields (activeOperationalSemester, activeStageKey,
  simulatedDateIso, setupConfigJson, scenarioConfigJson, lifecycleState, runMode,
  stageBoundaryJson).
- Fresh Sem1 / pre-TT1 start: no sem6 bootstrap, no fake prior transcript.
- completed-inspectable vs stopped semantics.
- Next Stage / Next Day / Reset Current Stage / Complete Reset / Stop.
- Stage boundaries strictly increasing; activation fails otherwise.

Map every finding to phase 1/5/11 of auth prompt.

## VALIDATION GATE

≥8 findings with file:line evidence; every finding has target_phase.

## OUTPUT CONTRACT

Emit the `<<AIRMENTOR_PASS_RESULT>>` block exactly once at end.
All artifacts declared in the manifest must exist with real content.
`intent_affirmed=true` only if product intent preserved.
