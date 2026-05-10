# AirMentor Full Realism Demo Closure Design — 2026-05-10

## Intent

Audit and close the remaining local AirMentor realism/demo evidence gaps without overstating production readiness.

The work must answer what an average college evaluator sees in browser for the MSRUAS B.Tech Mathematics & Computing 2023 demo, while also proving that the seeded proof plane has plausible stage, marks, risk, and adaptation behavior.

## Feature Intent

AirMentor must show a believable six-semester academic proof run where:

- a system admin can operate the proof control plane and see the active run,
- teachers see only scoped academic work and edits are not cosmetic,
- HoDs see department analytics and counterfactuals without causal overclaim,
- all six semesters and five stages have materialized evidence,
- risk and marks move in plausible directions,
- synthetic proof remains clearly separated from production real-data claims.

## Scope

This design covers local-only verification and targeted test/audit additions for the current demo branch.

In scope:

1. True baseline-vs-stressed proof-run comparison.
2. Browser proof for editable attendance and valid-stage marks recompute.
3. Full role/stage browser ladder for system admin, Course Leader, Mentor, and HoD.
4. Causal/production-claim safety guard.
5. Capability matrix and final audit ledger updates with exact evidence.

Out of scope:

- Deployment changes.
- Real institutional data import.
- Model promotion or CatBoost end-to-end promotion.
- Changing seeded generator semantics unless a failing verifier proves a product defect and the user approves the fix.
- Claiming production ML accuracy.

## Design Overview

The closure is split into five lanes. Each lane has a concrete user role, semester/stage context, evidence type, and pass/fail contract.

### Lane 1: True Override-Run Realism Proof

Role/context: system admin prepares two proof runs for the same M&C 2023 cohort.

Implementation shape:

- Reuse the existing `proof-realism-audit` module.
- Add a backend test that creates or locates two real proof runs:
  - baseline run with default section behavior,
  - stressed run with `sectionOverridesJson` that makes one section academically weaker.
- Materialize both runs through the same recompute/materialization path used by the proof dashboard.
- Compare generated rows, not synthetic row perturbations.

Pass contract:

- Both runs expose 30 checkpoints.
- Both runs expose projection rows at scale.
- Stressed section mean overall marks are lower than baseline by a material margin.
- Stressed section mean risk is higher than baseline by a material margin.
- No invalid marks outside 0..100.

Failure handling:

- If the API cannot create two independent runs, document the product gap and add the narrowest backend capability or test harness seam only after failing evidence.
- Do not weaken the auditor threshold to pass.

### Lane 2: Editable Data Recompute Browser Proof

Role/context: average Course Leader edits observable evidence for an assigned course; evaluator sees whether the edit matters.

Implementation shape:

- Add `tests-e2e/specs/editable-data-recompute.spec.ts` or extend an existing focused spec if selectors already exist.
- Flow:
  1. Login as Course Leader.
  2. Open assigned course or dashboard surface.
  3. Edit attendance for one scoped student.
  4. Edit one legal marks field for the currently realized stage.
  5. Save and reload to prove persistence.
  6. Trigger recompute through system-admin/API session.
  7. Open HoD/student/risk surface and assert changed evidence appears in proof projections or a clear queued/no-change reason appears.

Pass contract:

- The Course Leader cannot edit unrelated/off-scope records.
- Attendance edit persists after reload.
- Valid-stage marks edit persists after reload.
- Invalid future-stage evidence is hidden or blocked.
- Recompute updates risk/evidence where the model contract says it should, or displays an explicit no-change explanation.
- Browser has no console errors, page errors, or failed API requests for the tested path.

Failure handling:

- Root-cause from browser/network evidence before patching.
- Product fixes are limited to persistence, stage gating, recompute bridge, or UI evidence visibility.

### Lane 3: Full Browser Demo Ladder

Role/context: college evaluator watches the demo across core personas and late-stage playback.

Implementation shape:

- Add a focused Playwright ladder spec or split specs if runtime becomes too long.
- Reuse seeded-run fixture and local Firefox setup.
- Cover:
  - public portal shell,
  - system-admin proof dashboard and controls,
  - proof stage advance/selection for Sem 1 and Sem 6,
  - Course Leader dashboard, course scope, risk explorer or queue summary,
  - Mentor scope sanity,
  - HoD summary, courses, faculty, students, reassessments, counterfactual simulator,
  - session restore/relogin for at least one academic user.

Pass contract:

- Sysadmin dashboard shows active seeded run and checkpoint controls.
- Sem 1 pre/post evidence does not leak future marks.
- Sem 6 post-SEE evidence is accessible when gating rules allow it.
- Teacher surfaces show populated scoped records.
- HoD surfaces show populated department records.
- Counterfactual copy stays projected/simulated, not causal.
- No loading deadlock, stale-run warning, console/page error, or failed critical API call.

Failure handling:

- If selector fragility is the cause, fix selectors once with durable `data-proof-*` attributes.
- If product behavior is wrong, add a targeted regression before the fix.

### Lane 4: Claim-Safety Guard

Role/context: evaluator or paper reader must not mistake synthetic demo evidence for validated production accuracy.

Implementation shape:

- Add or update a textual audit test that scans high-risk UI/docs language.
- Flag phrases that imply real-world causal proof or production-grade predictive accuracy unless accompanied by synthetic/demo caveat.
- Add a short protocol document if missing.

Pass contract:

- Counterfactual language uses projected/simulated framing.
- Model language states synthetic-world or demo-validation boundaries.
- Real-data production readiness remains marked blocked until import, governance, privacy, security, and real historical validation are proven.

Failure handling:

- Prefer copy/doc edits over code changes when the product behavior is correct but wording overclaims.

### Lane 5: Truth Matrix And Capability Updates

Role/context: future developer/evaluator needs exact evidence, not vague status.

Implementation shape:

- Update `audit-map/32-reports/proof-realism-audit-2026-05-10.md` or create a follow-up report.
- Update `docs/CAPABILITY_MATRIX.md` only for rows directly proven by new evidence.
- Include exact commands, results, artifact paths, and residual gaps.

Pass contract:

- Each original prompt intent maps to code/test/browser/runtime evidence.
- Each capability status has evidence and remaining gap.
- Conditional passes remain conditional.
- No production-readiness row is promoted without real evidence.

## Data Flow

1. Seeded fixture prepares or reuses local proof run data.
2. Backend tests materialize/recompute checkpoint projections.
3. Auditor reads projection rows and computes summaries/comparisons.
4. Browser specs login through seeded credentials and role switching.
5. UI surfaces fetch proof dashboard, academic bootstrap, HoD bundle, and student/detail endpoints.
6. Edits save through academic endpoints, then recompute materializes proof projection changes.
7. Reports capture exact command evidence and verdicts.

## Testing Strategy

Use TDD for every new behavior claim:

- Write failing backend verifier before any backend/product fix.
- Write failing Playwright assertion before UI/product fix.
- Run targeted tests first, then typechecks, then focused browser suite.
- If a failure is pre-existing or out of scope, document it and avoid unrelated changes.

Minimum verification set:

- Backend realism tests for audit and true override comparison.
- Frontend/root typechecks affected by E2E helpers or UI selectors.
- Playwright focused specs with reused local server when available.
- Existing stage evidence matrix.
- Final git diff/status review.

## Risks

- Long-running Playwright specs may time out. Mitigation: split ladder by role/stage if needed.
- Existing local server state may conflict with proof-run creation. Mitigation: prefer seeded fixture isolation or explicit reuse-server mode.
- Two-run override support may expose missing product capability. Mitigation: document as blocker or add minimal verified seam.
- Editable marks selectors may be brittle. Mitigation: add durable `data-proof-*` attributes only where necessary.
- Browser evidence can pass while statistical realism remains weak. Mitigation: keep Lane 1 separate and mandatory.

## Deliverables

Expected deliverables after implementation:

- Backend test proving true override-run realism or documenting the missing seam.
- Playwright test proving editable data recompute.
- Playwright ladder test(s) proving evaluator-visible role/stage flows.
- Claim-safety test or report guard.
- Updated audit ledger and capability matrix.
- Verification command log in the final response.

## Non-Claims

Even after this closure, AirMentor will not claim:

- validated production prediction on real MSRUAS historical data,
- deploy readiness beyond already proven local/demo surfaces,
- general multi-program support unless separately tested,
- real causal intervention impact.
