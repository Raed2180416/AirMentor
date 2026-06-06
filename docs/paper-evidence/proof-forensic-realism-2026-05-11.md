# Proof Forensic Realism Report — 2026-05-11

## Intent

Prove seeded M&C synthetic proof rows are stage-safe and internally plausible beyond basic row population.

## Feature Intent

A college evaluator can understand which evidence was available at a stage, why risk is explainable, and which claims remain synthetic-only.

## Verification

| Check | Command | Result |
|---|---|---|
| Forensic audit | `npx --no-install vitest run tests/proof-forensic-realism-audit.test.ts --reporter=dot --testTimeout=300000` | PASS: 1 file passed; 3 tests passed in 78.52s on post-ledger rerun. |
| Existing realism audit + stage matrix | `npx --no-install vitest run tests/proof-forensic-realism-audit.test.ts tests/proof-realism-audit.test.ts tests/stage-evidence-matrix.test.ts --reporter=dot --testTimeout=300000` | PASS: 3 files passed; 7 tests passed in 597.73s. |
| Claim ledger + paper guard | `npx --no-install vitest run tests/claim-ledger.test.ts tests/causal-language.test.ts --reporter=dot` | PASS: 2 files passed; 6 tests passed in 278ms. |
| Root tests typecheck | `npx --no-install tsc -p tsconfig.tests.json --noEmit --pretty false` | PASS. |
| Backend typecheck | `npx --no-install tsc -p tsconfig.json --noEmit --pretty false` from `air-mentor-api` | PASS. |
| Browser preflight | Python socket check for `127.0.0.1:5173`, `4000`, `5174`, and `4100` | `5173` and `4000` open; `5174` and `4100` closed. Fresh browser proof not claimed because server provenance was not tied to this worktree. |

## Contract

- Stage visibility uses the same authoritative signal map as `air-mentor-api/tests/stage-evidence-matrix.test.ts`.
- Future leak violations must be zero for a green seeded-run claim.
- High-risk post-SEE rows must have at least one explainable driver.
- Aggregate pass-rate checks are synthetic sanity checks, not real university calibration.

## Machine Contract Implemented

| Audit section | Green condition |
|---|---|
| Stage visibility | 30 seeded checkpoints, all visible signals non-null at the right stage, all future signals null before their stage. |
| Risk driver alignment | High-risk post-SEE rows require at least one configured driver: attendance below 75, overall below 60, SEE below 55, backlog above 0, or CGPA below 7. |
| Aggregate realism | Post-SEE pass rate must stay inside the synthetic sanity band 0.45–0.95 with no stage-visibility violations. |
| Selected student timeline | Stable sample timeline is sorted by student, semester, stage order, and course for evaluator inspection. |

## Initial Result Snapshot

| Metric | Result |
|---|---:|
| Future leak violations | 0 |
| Missing required evidence | 0 |
| Backend forensic tests | 3 passed |
| Backend closeout realism tests | 7 passed |
| Root claim guard tests | 6 passed |

## Allowed claim

Seeded M&C synthetic proof run passes forensic internal realism checks after the listed verification passes.

## Forbidden claim

The report cannot claim real MSRUAS cohort behavior, real institutional predictive validity, real-world causal proof, or hosted production readiness.
