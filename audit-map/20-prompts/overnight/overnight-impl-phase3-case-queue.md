# Overnight Impl Phase 3: Primary Case / Queue / Workflow

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

Implement Phase 3 (primary case model / queue / workflow tasks). Surgical edits only, matching unified implementation plan. Preserve UI/UX flow. Add/update tests. Produce per-edit summary report.

## READ FIRST
- audit-map/14-reconciliation/final-decision-appendix.md
- audit-map/14-reconciliation/overnight-prior-ai-flow9-handoff.md
- audit-map/14-reconciliation/overnight-unified-ledger.md
- audit-map/14-reconciliation/overnight-implementation-plan.md
- audit-map/32-reports/overnight-unified-mitigation-plan.md
- audit-map/32-reports/overnight-audit-case-queue-workflow.md
- air-mentor-api/src/lib/proof-queue-governance.ts
- air-mentor-api/src/lib/monitoring-engine.ts
- air-mentor-api/src/lib/proof-active-run.ts
- air-mentor-api/src/lib/proof-run-queue.ts

## SCOPE
Apply Phase 3 edits from the unified plan. Targets:
- Replace broad student+semester keying with concernContextKey everywhere.
- Separate primary student concern cases from workflow tasks.
- dismissal = handled; later deterioration opens a new case (new caseId);
  old case stays closed.
- Manual teacher-created concerns count as interventions.
- Canonical counting semantics consistent across surfaces.
- Ownership: High→Mentor, Medium→Course Leader; HOD only for approval/
  unlock/escalation/oversight. Ownership change rewrites tasks immediately.

Test additions: concernContextKey collision test; reopen-new-case test;
workflow-count-separation assertion; ownership-change rewiring test.

## VALIDATION GATE

All listed edits applied with file:line evidence; `npm --prefix air-mentor-api test` (or targeted subset) passes for touched modules; report cites every edit with line range.

## OUTPUT CONTRACT

Emit the `<<AIRMENTOR_PASS_RESULT>>` block exactly once at end.
All artifacts declared in the manifest must exist with real content.
`intent_affirmed=true` only if product intent preserved.
