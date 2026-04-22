# Overnight Impl Phase 6: HOD Correction Cycle

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

Implement Phase 6 (HOD correction cycle state machine). Surgical edits only, matching unified implementation plan. Preserve UI/UX flow. Add/update tests. Produce per-edit summary report.

## READ FIRST
- audit-map/14-reconciliation/final-decision-appendix.md
- audit-map/14-reconciliation/overnight-prior-ai-flow9-handoff.md
- audit-map/14-reconciliation/overnight-unified-ledger.md
- audit-map/14-reconciliation/overnight-implementation-plan.md
- audit-map/32-reports/overnight-unified-mitigation-plan.md
- audit-map/32-reports/overnight-audit-run-authority.md
- air-mentor-api/src/lib/proof-control-plane-hod-service.ts
- air-mentor-api/src/lib/proof-control-plane-checkpoint-service.ts
- air-mentor-api/src/modules/academic.ts
- src/pages/hod-pages.tsx

## SCOPE
Apply Phase 6 edits from the unified plan. Targets:
- Explicit correction-cycle state machine:
  request → approve/reject → reset & unlock → teacher edit → recompute → relock.
- Scope-aware unlock: evidence-only / scheme / blueprint.
- Scheme/blueprint editors truly reopen when approved.

UI/UX PRESERVATION: `src/pages/hod-pages.tsx` edits data-wiring only.

Test additions: correction-cycle state transitions; scope-aware unlock gates;
relock enforcement after recompute.

## VALIDATION GATE

All listed edits applied with file:line evidence; `npm --prefix air-mentor-api test` (or targeted subset) passes for touched modules; report cites every edit with line range. src/pages/hod-pages.tsx diff ≤ 150 lines net.

## OUTPUT CONTRACT

Emit the `<<AIRMENTOR_PASS_RESULT>>` block exactly once at end.
All artifacts declared in the manifest must exist with real content.
`intent_affirmed=true` only if product intent preserved.
