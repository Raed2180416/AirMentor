# Realism Verification Design

## Intent

Validate AirMentor as a real college product, not as an API checklist. Every finding must be judged through role, permission, semester, stage, and evidence-time realism.

## Feature intent

An average evaluator should be able to watch a sysadmin create and advance a proof run, see generated faculty credentials, log in as teacher and HoD, inspect risk, queue, recommendations, explanations, calendar, counterfactuals, and resets, without stale data, future evidence leaks, fake probability claims, crashes, infinite loading, or missing evidence rendered as zero.

## Approach

Create a purpose-built pipeline DAG for April 29 realism verification. The first wave runs independent adversarial audits in parallel. The final node merges them into a single defensible verdict and fix queue.

## Parallel tracks

- **Browser E2E**: browser-first verification of landing, sysadmin, proof dashboard, teacher, HoD, risk explorer, edits, persistence, queue, calendar, counterfactual, reset/fallback.
- **Proof plane**: 6 semesters by 5 stages across all students, with evidence visibility, band counts, queue count, drivers, explanations, recommendations, and calendar state.
- **Teacher and HoD operations**: real role permissions, editability, persistence, recompute, session restore, HoD analytics, reassessments, and counterfactual.
- **ML realism**: risk-band, marks, CO, drivers, calibration caveats, overclaim guards, and model-governance concerns.
- **Readiness**: real-data contract, import validation, privacy/security, audit logs, model governance, backtesting, operational readiness.
- **Merge verdict**: combine all reports, preserve dissent, identify blockers and fix order.

## Safety

Initial agents may write only audit reports and agent-memory notes. Product code changes require reproduced root cause and separate verification. The pipeline worktree guard and write-scope guard remain active.

## Evidence standard

Browser evidence outranks API-only evidence for display behavior. API/DB evidence may support browser findings but cannot prove UI readiness alone. Every claim needs a file:line citation or a concrete artifact path.

## Handoff rule

Every prompt begins with the mission intent and feature intent. Agents must not simply validate; they must try to falsify demo readiness and report blockers plainly.
