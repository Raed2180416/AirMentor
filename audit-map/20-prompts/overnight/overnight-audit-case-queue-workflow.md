# Overnight Audit: Primary Case / Queue / Workflow

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

Deep audit: Overnight Audit: Primary Case / Queue / Workflow. Per-file findings table — expected vs current code truth (file:line) — with target-phase and severity.

## READ FIRST
- audit-map/14-reconciliation/final-decision-appendix.md
- audit-map/14-reconciliation/overnight-prior-ai-flow9-handoff.md
- audit-map/14-reconciliation/overnight-unified-ledger.md
- audit-map/32-reports/overnight-unified-mitigation-plan.md
- air-mentor-api/src/lib/proof-queue-governance.ts
- air-mentor-api/src/lib/monitoring-engine.ts
- air-mentor-api/src/lib/proof-active-run.ts
- air-mentor-api/src/lib/proof-run-queue.ts

## FOCUS
- concernContextKey = studentId + offeringId + concernFamily + semesterNumber.
- Primary vs workflow separation; workflow must not inflate headline counts.
- Dismissal = handled = case closed for that episode.
- Later deterioration → new caseId; old case stays closed.
- Manual teacher-created concerns count as interventions when student-facing.
- Ownership: High→Mentor, Medium→Course Leader, HOD only for approval/
  unlock/escalation/oversight. Ownership change rewrites tasks immediately.

Map every finding to Phase 3.

## VALIDATION GATE

≥8 findings with file:line evidence; every finding has target_phase.

## OUTPUT CONTRACT

Emit the `<<AIRMENTOR_PASS_RESULT>>` block exactly once at end.
All artifacts declared in the manifest must exist with real content.
`intent_affirmed=true` only if product intent preserved.
