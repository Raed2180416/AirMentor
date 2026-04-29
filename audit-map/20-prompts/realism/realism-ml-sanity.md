# Realism ML Sanity Audit — 2026-04-29

## CAVEMAN WENYAN-ULTRA MODE — HARD-ENFORCED

`CAVEMAN_ENFORCED=1 CAVEMAN_MODE=wenyan-ultra` active. Prose short. Technical strings exact.

## INTENT FIRST

Mission intent: judge whether the risk model and demo seed behave realistically enough for a defensible college evaluation, not whether charts merely render.

Feature intent: risk bands must communicate operational urgency without pretending calibrated probability changed; marks and CO evidence must look institutionally plausible; explanations must cite available evidence, avoid future evidence, avoid causal overclaim, and acknowledge missingness instead of converting it to `0%`.

## WRITE LIMIT

Write only:
- `audit-map/32-reports/realism-ml-sanity-2026-04-29.md`
- `audit-map/24-agent-memory/realism-ml-sanity-2026-04-29.md`

Do not modify product code.

## READ FIRST

- `HANDOFF_RISK_BAND_REALISM_2026-04-29.md`
- `docs/demo/risk-band-realism-audit-2026-04-27.md`
- `docs/demo/college-demo-script-2026-04-27.md`
- `docs/demo/demo-safe-student-picks-2026-04-27.md`
- `scripts/analyze-trajectory-realism.mjs`
- `air-mentor-api/scripts/evaluate-proof-risk-model.ts`
- `air-mentor-api/src/lib/proof-risk-model.ts`
- `air-mentor-api/src/lib/inference-engine.ts`
- `air-mentor-api/src/lib/proof-demo-operational-band.ts`
- `air-mentor-api/src/lib/proof-recommendation-text-generator.ts`
- `air-mentor-api/src/lib/proof-queue-governance.ts`
- `air-mentor-api/tests/proof-demo-operational-band.test.ts`
- `air-mentor-api/tests/proof-risk-model.test.ts`
- `air-mentor-api/tests/proof-recommendation-text-generator.test.ts`

## CHECKS

Audit these critically:
- risk-band sanity across semesters and stages
- whether `High=0.65` operational overlay is clearly demo-only
- whether Sem 6 high count is defensible or too cohort-collapsed
- marks range plausibility
- TT1/TT2/quiz/assignment/SEE progression realism
- CO mapping completeness and display truth
- driver text fidelity to available evidence
- recommendation quality vs actual top drivers
- fake probability/causality claims
- calibration/version governance evidence
- ML improvement opportunities before demo vs post-demo

## REPORT FORMAT

Create `audit-map/32-reports/realism-ml-sanity-2026-04-29.md` with sections:

# ML Realism Sanity Audit — 2026-04-29
## Intent And Feature Intent
## Method
## Risk Band Sanity
## Marks And CO Realism
## Explanation And Recommendation Realism
## Model Governance Gaps
## ML Improvement Queue
## Blockers
## Reverification Needed
## Verdict

Also create `audit-map/24-agent-memory/realism-ml-sanity-2026-04-29.md` with concise handoff.
