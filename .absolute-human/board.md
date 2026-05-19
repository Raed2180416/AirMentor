# Absolute-Human Board — AirMentor Simulation & ML Improvement

Status: in-progress
Started: 2026-05-17
Workspace: `/home/raed/Projects/air-mentor-ui`
Rollback point: `6628e79a` (`phase(P0): risk-hardening-v1 baseline checkpoint`)
Board policy: git-tracked audit trail, because user requested no dirty tree and staged verification.

## Intake summary

User wants every identified simulation/ML/product-intent improvement implemented strategically, not just suggested.

Success criteria:
- All 29 R-items from `docs/plans/2026-05-17-air-mentor-comprehensive-improvement-plan.md` are either implemented or explicitly deferred with reason.
- Each wave has green targeted tests and clean type-checks before commit.
- Working tree is clean at every wave boundary.
- Previous tests, modified tests, and new tests pass.
- Product intent stays aligned across HoD, Mentor, Course Leader, and System Admin surfaces.
- CachyOS environment replaces old Nix assumptions.

## Project conventions

Detected conventions:
- Package manager: npm (`package-lock.json`)
- Runtime: Node >=20, active Node 24 (`.node-version` = `24`)
- Frontend: Vite + React + TypeScript under `src/`
- Backend workspace: `air-mentor-api/` Fastify + Drizzle + TypeScript
- Root tests: Vitest via `npm test`
- Backend tests: `npm --workspace air-mentor-api test`
- Type checks:
  - Root/tests: `npx tsc --noEmit -p tsconfig.tests.json`
  - API: `npx tsc --noEmit -p air-mentor-api/tsconfig.json`
- Python ML tooling: CachyOS + `uv`, not Nix. System Python is 3.14.4; ML venv must use Python 3.11 for CatBoost compatibility.
- Embedded Postgres evaluator runs must use repo-local `AIRMENTOR_EVAL_DB_DIR`; `/tmp` is tmpfs and previously filled.

## Task graph and waves

Primary detailed plan: `docs/plans/2026-05-17-air-mentor-comprehensive-improvement-plan.md`.

### Wave 0 — baseline + plan
- Status: in-progress
- Tasks:
  - Commit pre-existing dirty WIP as clean baseline: done (`6628e79a`)
  - Create comprehensive plan: done, pending commit
  - Create progress ledger: pending

### Wave 1 — ML pipeline foundation
- Status: pending
- R-IDs: R-9, R-1, R-2, R-4
- Dependencies: Wave 0
- Goal: unblock CatBoost on CachyOS, remove cross-run leak, enforce monotonicity, active-region promotion gate.

### Wave 2 — uncertainty + fairness
- Status: pending
- R-IDs: R-5, R-10
- Dependencies: Wave 1

### Wave 3 — explainability + display gate
- Status: pending
- R-IDs: R-6, R-7
- Dependencies: Wave 2

### Wave 4 — simulator label integrity
- Status: pending
- R-IDs: R-14, R-15
- Dependencies: Wave 1

### Wave 5 — cohort mixture + per-role surfaces
- Status: pending
- R-IDs: R-3, R-8
- Dependencies: Wave 4

### Wave 6 — knowledge tracing track
- Status: pending
- R-IDs: R-11, R-12, R-13
- Dependencies: Wave 4

### Wave 7 — tuning + multi-task + uplift + survival + OOD
- Status: pending
- R-IDs: R-16, R-17, R-18, R-19, R-20
- Dependencies: Waves 2, 3, 6

### Wave 8 — paper rigor
- Status: pending
- R-IDs: R-21, R-22, R-23, R-24, R-25, R-26
- Dependencies: Waves 1, 2, 4, 6

### Wave 9 — production seeds design docs
- Status: pending
- R-IDs: R-27, R-28, R-29
- Dependencies: Wave 8

## Verification policy

Wave boundary commands:
```bash
npx tsc --noEmit -p tsconfig.tests.json
npx tsc --noEmit -p air-mentor-api/tsconfig.json
npm --workspace air-mentor-api test
npm test
```

Heavy evaluator commands run only after targeted smoke passes and use repo-local DB dir.

## Notes

Known relevant facts:
- Latest coverage-24 evaluator: `risk-hardening-coverage24-20260517T121109Z`, 518,400 rows, OverallCourseRisk AUC 0.7889, Brier 0.1392, ECE 0.0469, overload 1.0005.
- High threshold 0.85 inactive for OverallCourseRisk on coverage-24: 0 rows near 0.85.
- CatBoost currently missing in Python environment.
