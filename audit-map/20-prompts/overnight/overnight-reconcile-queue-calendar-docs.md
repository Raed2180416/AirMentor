# Overnight Reconcile: Queue / Calendar / HOD

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

Reconcile queue/case/calendar/HOD-correction docs vs auth prompt B(14-20), C(2-8), C(15), D(4-6), D(9), L.

## READ FIRST
- audit-map/20-prompts/fresh-sem1-principal-architect-overnight-pass.md sections B(14-20), C(2-8), C(15), D(4-6), D(9), L
- audit-map/14-reconciliation/overnight-prior-ai-flow9-handoff.md
- air-mentor-api/src/lib/proof-queue-governance.ts
- air-mentor-api/src/lib/monitoring-engine.ts
- air-mentor-api/src/lib/proof-active-run.ts
- air-mentor-api/src/lib/proof-run-queue.ts
- air-mentor-api/src/lib/proof-control-plane-hod-service.ts
- src/pages/calendar-pages.tsx
- src/pages/hod-pages.tsx

## SCOPE
Topics: concernContextKey, case taxonomy (primary vs workflow), ownership routing,
dismissal=handled, reopen-later-deterioration, queue↔calendar bridge, drag→due-date,
demo auto-resolution, HOD correction cycle (request→approve→reset-unlock→edit→recompute→relock).

Emit ledger with files_to_change + validation hook per claim.

## VALIDATION GATE

≥10 ledger rows covering all listed topics.

## OUTPUT CONTRACT

Emit the `<<AIRMENTOR_PASS_RESULT>>` block exactly once at end.
All artifacts declared in the manifest must exist with real content.
`intent_affirmed=true` only if product intent preserved.
