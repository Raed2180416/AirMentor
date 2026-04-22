# Overnight Impl Phase 5: Next Day / Next Stage / Reset / Stop

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

Implement Phase 5 (next day / next stage / reset / stop). Surgical edits only, matching unified implementation plan. Preserve UI/UX flow. Add/update tests. Produce per-edit summary report.

## READ FIRST
- audit-map/14-reconciliation/final-decision-appendix.md
- audit-map/14-reconciliation/overnight-prior-ai-flow9-handoff.md
- audit-map/14-reconciliation/overnight-unified-ledger.md
- audit-map/14-reconciliation/overnight-implementation-plan.md
- audit-map/32-reports/overnight-unified-mitigation-plan.md
- audit-map/32-reports/overnight-audit-run-authority.md
- air-mentor-api/src/lib/proof-control-plane-advance-service.ts
- air-mentor-api/src/lib/proof-control-plane-activation-service.ts
- air-mentor-api/src/lib/proof-control-plane-tail-service.ts
- air-mentor-api/src/lib/proof-control-plane-playback-reset-service.ts

## SCOPE
Apply Phase 5 edits from the unified plan. Targets:
- Real advance-day: simulated date += 1 day.
- Real advance-stage: snap to next stage boundary via the same transition pipeline.
- Next Day auto-advances stage on boundary crossing (one transition, no duplicates).
- Demo auto-resolution semantics on Next Stage (open actionable cases may auto-resolve).
- Reset Current Stage (restore stage-entry snapshot).
- Complete Reset (recreate clean Sem1 / pre-TT1).
- Stop Simulation (credential deletion + session invalidation).
- Preserve completed-inspectable after Semester 6.

Test additions: boundary-crossing idempotency; auto-resolution branch coverage;
reset restores stage-entry snapshot; stop invalidates sessions.

## VALIDATION GATE

All listed edits applied with file:line evidence; `npm --prefix air-mentor-api test` (or targeted subset) passes for touched modules; report cites every edit with line range.

## OUTPUT CONTRACT

Emit the `<<AIRMENTOR_PASS_RESULT>>` block exactly once at end.
All artifacts declared in the manifest must exist with real content.
`intent_affirmed=true` only if product intent preserved.
