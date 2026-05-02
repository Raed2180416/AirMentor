# Direct Self-Run Realism Verdict - 2026-04-29

## Scope

No automation pipeline and no delegated agents were used for this pass. The run was local/direct: source inspection, targeted fixes, API tests, direct proof-plane audit, and Playwright browser smoke.

## Intent

Defend a realistic college evaluator demo, not a green API facade.

Every checked surface was evaluated against actor, role, semester/stage, evidence timing, queue/playback blocking, and browser/API truth.

## Fixes Made In This Pass

- Published operational projections now ensure canonical proof offerings exist before Sem1-6 activation/recompute, preventing empty Sem4+ live rows when curriculum imports exist but offerings were not materialized.
- Projection publishing maps live observed rows to real offering IDs by direct `offeringId` or observed `courseCode`/title, and only falls back to stage projections when no live observed mapping exists.
- Academic bootstrap now filters assessment cells by active proof stage so rewound proof playback does not leak future teacher-entered assessment evidence.
- Stage realization now treats `post-tt2` as TT1+TT2 only; quiz/assignment/CE evidence first appears at `post-assignments`.
- Seeded proof sandbox now generates TT1, TT2, quiz, assignment, CE, SEE, final mark, course code, and course title evidence across Sem1-6 instead of sparse CE/SEE-only historical rows.
- Queue playback gating now uses queue-case timeline state for live blocking counts so later resolved/watching items do not block accessible playback.
- Default student shell now follows the active operational semester unless an explicit checkpoint is supplied.
- HoD watch rows now select risk primary separately from action/governance primary, preserving risk semantics while still surfacing intervention state.

## Direct Evidence

### Typecheck

- `npx tsc -p tsconfig.app.json --noEmit` passed.
- `cd air-mentor-api && npx tsc -p tsconfig.json --noEmit` passed.

### Focused Tests

- `cd air-mentor-api && npx vitest run tests/proof-stage-evidence-realization-wire.test.ts tests/proof-control-plane-checkpoint-service.test.ts --reporter=dot`
  - 2 files passed, 9 tests passed.
- `npx vitest run tests/repositories-http.test.ts tests/hod-counterfactual-wiring.test.ts tests/system-admin-proof-dashboard-workspace.test.tsx --reporter=dot`
  - 3 files passed, 22 tests passed.
- `cd air-mentor-api && npx vitest run tests/academic-parity.test.ts tests/admin-control-plane.test.ts tests/hod-proof-analytics.test.ts tests/student-agent-shell.test.ts --reporter=dot -t "persists authoritative queue|reacts immediately to newly entered quiz|keeps checkpoint playback summaries|re-activates proof semesters|serves live in-scope HoD analytics|keeps the default student shell aligned"`
  - In-sandbox run failed before test bodies with `listen EPERM: operation not permitted 127.0.0.1`.
  - Rerun outside sandbox passed: 4 files passed, 7 tests passed, 47 skipped.

### Direct Proof-Plane Audit

- Command: `npx tsx scripts/direct-proof-plane-audit.ts`
- Result: passed.
- Artifact: `output/direct-proof-plane/direct-proof-plane-audit-2026-04-29.json`
- Matrix: 30 checkpoints.
- Findings: 0.
- Sample invariant: Sem1 `pre-tt1` audited 120 students, hid TT1/TT2/quiz/assignment/SEE, and remained playback-accessible.

### Browser Smoke

- Command:
  `PLAYWRIGHT_OUTPUT_DIR=output/playwright/direct-2026-04-29-postfix2 AIRMENTOR_PROOF_SEMESTER_TARGETS=1,2,3,4,5,6 AIRMENTOR_PROOF_ARTIFACT_PREFIX=direct-postfix2 AIRMENTOR_PROOF_COVERAGE_TARGET=full bash scripts/playwright-admin-live-proof-risk-smoke.sh`
- Result: passed for semesters 1 through 6.
- Frontend: `http://127.0.0.1:4174`
- Backend: `http://127.0.0.1:45415`
- Combined summary: `output/playwright/direct-2026-04-29-postfix2/direct-postfix2-semester-walk-summary.json`
- Semester summaries:
  - `output/playwright/direct-2026-04-29-postfix2/direct-postfix2-semester-1-proof-risk-walk-summary.json`
  - `output/playwright/direct-2026-04-29-postfix2/direct-postfix2-semester-2-proof-risk-walk-summary.json`
  - `output/playwright/direct-2026-04-29-postfix2/direct-postfix2-semester-3-proof-risk-walk-summary.json`
  - `output/playwright/direct-2026-04-29-postfix2/direct-postfix2-semester-4-proof-risk-walk-summary.json`
  - `output/playwright/direct-2026-04-29-postfix2/direct-postfix2-semester-5-proof-risk-walk-summary.json`
  - `output/playwright/direct-2026-04-29-postfix2/direct-postfix2-semester-6-proof-risk-walk-summary.json`

## Browser Caveat

Sem1-5 browser smoke passed sysadmin activation, proof dashboard, HoD analytics, HoD student shell, and HoD risk explorer, but the teacher panel had no row-backed monitoring/elective-fit entry at those Post SEE checkpoints, so the harness skipped teacher-specific risk explorer and teacher-owned student shell there.

Sem6 did exercise the full teacher path, including teacher risk explorer and student shell.

## Remaining Hard Truth

This is now much stronger local demo proof, but it is still not production proof. Still unproven:

- Real college SIS/LMS import data contract with owner/source/stage availability.
- Production deploy, TLS, secret handling, audit log retention, backup/restore, rollback, and load test proof.
- CERT-In incident process and breach-response evidence.
- Real subgroup/fairness governance on non-synthetic data.
- Sem1-5 teacher-specific row-backed risk explorer coverage, if product intent requires teacher drilldown for historical semesters and not only HoD drilldown.

