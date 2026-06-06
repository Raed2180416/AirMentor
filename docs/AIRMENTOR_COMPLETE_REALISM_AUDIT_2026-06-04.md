# AirMentor Complete Realism Audit - 2026-06-04

Generated from fresh evidence on 2026-06-05 IST. This dossier uses the hybrid proof strategy: Firefox verifies demo-critical role workflows and screenshots, while backend/API ledgers verify the full 120-student, 6-semester, 5-stage proof population.

## Verdict

Demo-critical realism audit status: **PASS with documented caveats**.

The final Firefox-backed audit passed against run `simulation_run_63402818-2130-4ba5-9233-6b5450f0facc`. Backend evidence also passed for canonical seeded coverage, fresh governed trajectories, role/course parity, served risk artifact contract, intervention effect wiring, and fresh risk-tail coverage.

## Final Browser Evidence

Command:

```bash
AIRMENTOR_TMPDIR=/home/raed/.cache/airmentor-pg-scratch AIRMENTOR_PW_DISABLE_VIDEO=1 AIRMENTOR_PW_BROWSER=firefox npx playwright test tests-e2e/specs/complete-realism-audit-2026-06-04.spec.ts --config=tests-e2e/playwright.config.ts
```

Result: `1 passed (2.2m)`.

Final run:

- Browser: Firefox.
- Run id: `simulation_run_63402818-2130-4ba5-9233-6b5450f0facc`.
- Generated at: `2026-06-04T20:48:21.970Z`.
- Checkpoints: `30`.
- Projection rows: `21,600`.
- Driverless High rows: `0`.
- Bad checkpoint rows: `[]`.
- Student coverage: `120/120` students, `720` student-semester rows with five stages each, no missing complete semester-stage coverage.
- Console/page errors captured by the spec: `[]`.

Browser artifact root:

```text
output/playwright/complete-realism-audit-2026-06-04/
```

JSON artifacts:

- `json/00-complete-realism-audit-manifest.json` - final run manifest, browser name, console/page errors, screenshot dir.
- `json/01-checkpoint-coverage.json` - 30-checkpoint coverage and driverless-High checks.
- `json/02-student-semester-trajectory-summary.json` - 120 student sem-wise stage summaries.
- `json/03-course-leader-queue-pressure.json` - per-faculty and per-course queue pressure.
- `json/04-dynamic-coursework-matrix.json` - saved scheme variants: `2A/2Q`, `3A/0Q`, `0A/2Q`.
- `json/05-student-card-parity.json` - sampled Low/Medium/High card parity between Risk Explorer and Student Shell.

Screenshots:

- `screenshots/01-system-admin-proof-dashboard-sem1-pre-tt1.png`
- `screenshots/02-course-leader-dashboard-sem1-pre-tt1.png`
- `screenshots/03-risk-reevaluation-visible-during-role-switch.png`
- `screenshots/04-mentor-dashboard-sem1-pre-tt1.png`
- `screenshots/05-hod-proof-analytics-risk-tail.png`

## Backend Evidence

Canonical active seeded run coverage:

- Artifact: `air-mentor-api/output/proof-coverage/proof-coverage-120-manifest-2026-06-01.json`
- Run id: `sim_mnc_2023_first6_v1`
- Students: `120`
- Checkpoints: `30`
- Projection rows: `21,600`
- Bad checkpoint coverage: `[]`
- High rows: `4,953`
- High student-stage gaps: `0`
- Driverless High rows: `0`

Fresh governed trajectory ledger:

- Artifact: `air-mentor-api/output/proof-coverage/proof-student-trajectory-ledger-2026-06-02.summary.json`
- Run id: `simulation_run_dfa02096-4b69-4071-b276-e205c3ded6c7`
- Students: `120`
- Checkpoints: `30`
- Projection rows: `21,600`
- Stage counts: `4,320` rows each for `pre-tt1`, `post-tt1`, `post-tt2`, `post-assignments`, `post-see`
- Bad checkpoint coverage: `[]`
- Driverless High rows: `0`
- Rows missing course snapshot: `0`
- Rows missing semester summary: `0`
- Rows with prerequisite carryover risk: `265`
- Rows with upstream prerequisite evidence: `12,600`
- Rows with cross-course drivers: `545`
- Rows with intervention evidence: `5,790`
- Rows with simulated action: `1,311`
- Warnings: `[]`

Twelve-seed realism analysis:

- Artifact: `air-mentor-api/output/proof-coverage/proof-realism-deep-analysis-2026-06-02.json`
- Seeds: `20260320, 101, 202, 303, 404, 505, 606, 707, 808, 909, 1010, 1111`
- Per-seed reports: `12`
- Hard contract failures: `[]`
- Hard realism failures: `[]`
- Medium findings: `2`
- Scenario coverage included high-forgetting, balanced, weak-foundation, low-attendance, coursework-inflation, exam-fragility, carryover-heavy, intervention-resistant, chronic-absentee, attendance-shock, and mental-health-disruption.

Intervention effect ledger:

- Artifact: `air-mentor-api/output/proof-coverage/proof-realized-intervention-effect-ledger-2026-06-02.json`
- Run id: `sim_mnc_2023_first6_v1`
- Candidate rows: `9,460`
- Selected interventions: `48`
- High selected rows: `36`
- Medium selected rows: `12`
- Intervention types: `mentor-check-in`, `pre-see-rescue`, `prerequisite-bridge`, `structured-study-plan`, `targeted-tutoring`
- Positive downstream rows: `48`
- Negative assessment deltas: `0`
- Pre-application positive deltas: `0`
- Visibility gaps: `0`
- Caveat: deterministic simulation evidence only; no real-world causal claim is made.

Single intervention scenario:

- Artifact: `air-mentor-api/output/proof-coverage/proof-realized-intervention-scenario-2026-06-01.json`
- Selected student: `mnc_student_003`
- Course: `CSF106A`
- Intervention type: `targeted-tutoring`
- Positive assessment deltas: `15`
- Negative assessment deltas: `0`

Role/course API matrix:

- Artifact: `air-mentor-api/output/proof-coverage/proof-role-course-api-matrix-2026-06-01.json`
- Checkpoints: `30`
- Role endpoint rows: `180`
- Status failures: `0`
- Checkpoint match failures: `0`
- Bad DB coverage: `[]`
- Failure rows: `0`

Risk artifact serving contract:

- Artifact: `air-mentor-api/output/proof-coverage/proof-risk-served-artifact-consistency-2026-06-02.json`
- Served contract OK: `true`
- Raw default family: `catboost`
- Promotion decision: `keep-as-shadow`
- Runtime production family: `logistic`
- Active DB production families: `logistic`
- Verified warning: raw default bundle still names CatBoost, but runtime correctly serves seeded logistic production while keeping challenger/shadow artifacts active.

Fresh risk tail:

- Artifact: `air-mentor-api/output/proof-coverage/proof-fresh-run-risk-tail-2026-06-02.json`
- Run id: `simulation_run_5906a537-f49b-4e80-ad21-1d947cc95280`
- Seed: `20260320`
- Scenario family: `high-forgetting`
- Checkpoints: `30`
- Projection rows: `21,600`
- Risk bands: `Low=13,874`, `Medium=4,068`, `High=3,658`
- Max risk: `65`

## Fixes Implemented

- Made MSRUAS seed recovery idempotent and fail-closed for partial proof cohorts: validates 120 proof students, 120 mentor assignments, mentor faculty coverage, one canonical run, rich curriculum nodes, and complete-or-empty playback payloads.
- Wrapped the proof sandbox seed path in a transaction.
- Preserved all 120 proof students through the six-semester audit horizon: progression-gate pressure remains visible in backlog/risk context, but students are not removed from later semester evidence.
- Replaced unstable fallback queue IDs with stable `studentId + offeringId + semester + stage` IDs and removed broad `task-${i}` fallback behavior.
- Tightened proof queue dedupe to stable task identity instead of coarse student/offering/source-role grouping.
- Wired the global `isReevaluatingRisk` pulse to role switch, save/recompute/advance/loading, task, unlock, remedial, and scheme-save flows.
- Added stage-aware CE/60 projection logic so future TT/quiz/assignment/SEE evidence does not leak into earlier stages.
- Propagated proof stage into Course Leader/HoD course pages, tabs, overview checklist, TT, quiz, assignment, CO, and gradebook surfaces.
- Hardened dynamic coursework automation so `2 assignments / 2 quizzes`, `3 assignments / 0 quizzes`, and `0 assignments / 2 quizzes` are genuinely saved and verified instead of clamped.
- Added the Firefox complete realism audit spec and durable evidence bundle.
- Balanced the intervention ledger selector so it always includes actionable Medium cases when available, instead of filling all 48 rows with High cases first.
- Fixed root build drift: root `npm run build` now passes after test-only unused-symbol relaxation, optional legacy fixture credits handling, and active-stage API typing compatibility.

## Commands Run

```bash
npx playwright install firefox
npm test -- tests/selectors.test.ts --reporter=dot
npx tsc -p tsconfig.app.json --noEmit
npm --workspace air-mentor-api run build
npm run build
AIRMENTOR_TMPDIR=/home/raed/.cache/airmentor-pg-scratch npm --workspace air-mentor-api run test -- tests/msruas-proof-sandbox.test.ts tests/proof-coverage-120-manifest.test.ts --reporter=verbose
AIRMENTOR_TMPDIR=/home/raed/.cache/airmentor-pg-scratch npm --workspace air-mentor-api run test -- tests/proof-realism-deep-analysis.test.ts tests/proof-realized-intervention-effect-ledger.test.ts tests/proof-realized-intervention-scenario.test.ts tests/proof-role-course-api-matrix.test.ts tests/proof-risk-artifact-consistency-and-served-contract.test.ts tests/proof-fresh-run-risk-tail.test.ts --reporter=verbose
AIRMENTOR_TMPDIR=/home/raed/.cache/airmentor-pg-scratch npm --workspace air-mentor-api run test -- tests/proof-realized-intervention-effect-ledger.test.ts --reporter=verbose
AIRMENTOR_TMPDIR=/home/raed/.cache/airmentor-pg-scratch npm --workspace air-mentor-api run test -- tests/proof-realized-intervention-scenario.test.ts tests/proof-role-course-api-matrix.test.ts tests/proof-risk-artifact-consistency-and-served-contract.test.ts tests/proof-fresh-run-risk-tail.test.ts --reporter=verbose
AIRMENTOR_TMPDIR=/home/raed/.cache/airmentor-pg-scratch AIRMENTOR_PW_DISABLE_VIDEO=1 AIRMENTOR_PW_BROWSER=firefox npx playwright test tests-e2e/specs/complete-realism-audit-2026-06-04.spec.ts --config=tests-e2e/playwright.config.ts
```

Notable failed-then-fixed checks:

- `proof-coverage-120-manifest.test.ts` initially found `21,480` rows and four missing Sem5 students per stage in canonical active run. Fixed by retaining all proof students across the six-semester horizon and reran green.
- `proof-realized-intervention-effect-ledger.test.ts` initially selected only High rows. Fixed selector to reserve Medium intervention coverage and reran green.
- `npm run build` initially failed on broader fixture/type drift. Fixed and reran green.

## Residual Risks And Caveats

- The browser screenshot `03-risk-reevaluation-visible-during-role-switch.png` proves the global reevaluation state is visible during role switching and the code now wires the pulse to recompute/save/advance/task/unlock paths. It is not an independent mathematical proof that each path changed the model output.
- Intervention effects are deterministic simulation evidence. They prove wiring, timing, downstream-only application, and visibility, not real-world causal treatment-vs-control impact.
- The risk artifact contract intentionally serves logistic production while CatBoost remains a shadow/challenger artifact. This is verified and acceptable for the demo, but should be explained clearly if asked about "which model is production."
- The repository worktree was already very dirty before this audit. This dossier verifies the touched/demo-critical proof path and generated artifacts; it does not certify every unrelated dirty file.
- Browser proof is Firefox-first and passed. No Chromium fallback was used for the final dossier.
