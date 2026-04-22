# Overnight Reconcile: Proof Lifecycle

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

Reconcile proof-lifecycle docs (activation, runtime, stage/date authority, completed-inspectable vs stopped, reset semantics) with authoritative prompt. Produce per-claim ledger with file:line evidence.

## READ FIRST
- audit-map/20-prompts/fresh-sem1-principal-architect-overnight-pass.md sections B, C(1), C(10-15), D, L (flows 1-6, 10-11)
- audit-map/14-reconciliation/final-decision-appendix.md
- audit-map/14-reconciliation/overnight-prior-ai-flow9-handoff.md
- air-mentor-api/src/lib/proof-control-plane-activation-service.ts
- air-mentor-api/src/lib/proof-control-plane-runtime-service.ts
- air-mentor-api/src/lib/proof-control-plane-tail-service.ts
- air-mentor-api/src/lib/proof-control-plane-seeded-run-service.ts
- air-mentor-api/src/lib/proof-control-plane-seeded-semester-service.ts
- air-mentor-api/src/lib/proof-control-plane-live-run-service.ts
- air-mentor-api/src/lib/proof-control-plane-rebuild-context-service.ts
- air-mentor-api/src/lib/proof-control-plane-playback-reset-service.ts
- air-mentor-api/src/lib/proof-control-plane-advance-service.ts

## SCOPE
Topics: proof lifecycle (setup-draft → active-run → completed-inspectable
/ stopped / reset-current-stage / complete-reset), stage/date authority,
Next Day / Next Stage transition pipeline, semester boundaries.

Emit one ledger row per claim:
  claim_id | intent_section | current_doc (file:line) | current_code (file:line) | resolved_rule | files_to_change | validation_hook

If doc contradicts frozen appendix, mark `needs-doc-update`. Never touch appendix.
Emit `## Mitigation Plan` keyed by phase 1/5/7 of auth prompt.

## VALIDATION GATE

Ledger must contain ≥10 rows AND Mitigation Plan section populated.

## OUTPUT CONTRACT

Emit the `<<AIRMENTOR_PASS_RESULT>>` block exactly once at end.
All artifacts declared in the manifest must exist with real content.
`intent_affirmed=true` only if product intent preserved.
