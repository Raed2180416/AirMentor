# Overnight Audit: Frontend UI/UX Flow Preservation

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

Deep audit: Overnight Audit: Frontend UI/UX Flow Preservation. Per-file findings table — expected vs current code truth (file:line) — with target-phase and severity.

## READ FIRST
- audit-map/14-reconciliation/final-decision-appendix.md
- audit-map/14-reconciliation/overnight-prior-ai-flow9-handoff.md
- audit-map/14-reconciliation/overnight-unified-ledger.md
- audit-map/32-reports/overnight-unified-mitigation-plan.md
- src/App.tsx
- src/domain.ts
- src/pages/calendar-pages.tsx
- src/pages/hod-pages.tsx
- src/pages/course-pages.tsx
- src/system-admin-live-app.tsx

## FOCUS
Read-only audit. Map each visible flow to auth-prompt flows L1..L11. NO UI/UX
redesign proposals — user mandates preservation. Only surface architectural/
data-wiring gaps that cause wrong data or hidden editability.

- Navigation visibility vs editability separation.
- Risk Watch visible in Sem1 pre-TT1 (no actionable queue rows).
- Assessment surfaces always visible; lock/unlock governs edit.
- Queue/calendar agree on owner/date/state.
- Calendar uses simulated date in proof mode.

Map every gap to the specific backend phase that owns the fix.

## VALIDATION GATE

≥8 findings with file:line evidence; every finding has target_phase.

## OUTPUT CONTRACT

Emit the `<<AIRMENTOR_PASS_RESULT>>` block exactly once at end.
All artifacts declared in the manifest must exist with real content.
`intent_affirmed=true` only if product intent preserved.
