# Realism Proof-Plane Audit — 2026-04-29

## CAVEMAN WENYAN-ULTRA MODE — HARD-ENFORCED

`CAVEMAN_ENFORCED=1 CAVEMAN_MODE=wenyan-ultra` active. Prose short. Technical strings exact.

## INTENT FIRST

Mission intent: verify the proof plane as a realistic six-semester academic simulation, not selected-story cherry-picking.

Feature intent: every student at every semester/stage must expose only evidence available at that time, keep missing evidence missing, use prior history only when prior history exists, populate queue/calendar coherently, and produce explanations/recommendations that match actual evidence and role purpose.

## WRITE LIMIT

Write only:
- `audit-map/32-reports/realism-proof-plane-2026-04-29.md`
- `audit-map/24-agent-memory/realism-proof-plane-2026-04-29.md`

Do not modify product code.

## READ FIRST

- `HANDOFF_RISK_BAND_REALISM_2026-04-29.md`
- `docs/demo/risk-band-realism-audit-2026-04-27.md`
- `scripts/analyze-trajectory-realism.mjs`
- `scripts/proof-risk-semester-walk-probe.mjs`
- `scripts/proof-risk-semester-walk.mjs`
- `air-mentor-api/src/lib/proof-control-plane-stage-summary-service.ts`
- `air-mentor-api/src/lib/proof-control-plane-dashboard-service.ts`
- `air-mentor-api/src/lib/proof-control-plane-runtime-service.ts`
- `air-mentor-api/src/lib/proof-risk-model.ts`
- `air-mentor-api/src/lib/proof-observed-state.ts`
- `air-mentor-api/src/lib/proof-provenance.ts`
- `air-mentor-api/tests/proof-stage-realization-service.test.ts`
- `air-mentor-api/tests/proof-stage-realization-evidence-applier.test.ts`
- `air-mentor-api/tests/proof-stage-evidence-realization-wire.test.ts`

## REQUIRED MATRIX

For each of 6 semesters × 5 stages, audit:

- semester
- stage
- low/medium/high counts
- queue count
- top drivers
- marks visible
- marks hidden
- prior history visible?
- risk explanation quality
- recommendation quality
- calendar state
- pass/fail

Stages:
- `pre-tt1`
- `post-tt1`
- `post-tt2`
- `post-assignments-and-quizzes`
- `post-see`

## CRITICAL RULES

Sem 1 pre-TT1 must say:
- no prior CGPA
- no prior backlog
- no prereq history
- risk conservative
- no overclaim

Sem 2-6 pre-TT1 may use:
- prior CGPA
- backlogs
- prerequisite history

Post-TT1:
- TT1 visible
- TT2/quiz/assignment/SEE hidden or not recorded

Post-TT2:
- TT1 + TT2 visible where generated/recorded
- future SEE hidden

Post-assignments/quizzes:
- TT1 + TT2 + quiz + assignment visible
- SEE hidden

Post-SEE:
- all evidence visible
- final result visible
- SEE fragility may be shown

## WHOLE-STUDENT RULE

Do not audit only named examples. Verify whether the seeded progression and predictions are realistic across all students. Identify any cohort collapse, identical-driver repetition, impossible marks, missing history shown as zero, or future evidence leak.

## REPORT FORMAT

Create `audit-map/32-reports/realism-proof-plane-2026-04-29.md` with sections:

# Proof-Plane Realism Audit — 2026-04-29
## Intent And Feature Intent
## Method
## Six-Semester Stage Matrix
## Whole-Student Realism Findings
## Evidence Timing Findings
## Queue Calendar Findings
## Blockers
## Reverification Needed
## Verdict

Also create `audit-map/24-agent-memory/realism-proof-plane-2026-04-29.md` with concise handoff.
