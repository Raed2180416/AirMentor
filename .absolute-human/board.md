# Absolute-Human Board — AirMentor Maintainability Refactor

Status: in-progress  
Started: 2026-07-10  
Workspace: `/home/raed/Projects/air-mentor-ui`  
Session: Phase 0 — Hygiene and CI Gates  
Board policy: gitignored local working state.

## Intake summary

**Problem:** The AirMentor codebase is maintainable-in-progress but still contains monolithic files, tight coupling between UI/API/domain, no formal `kernel/` domain layer, mixed demo/production simulation code, and 674 lint failures.

**Success criteria:**
- Full Clean Architecture: `kernel/`, `adapters/`, `universities/` layers.
- No production file exceeds 400 lines.
- `npm run lint` exits 0.
- All tests pass.
- ML training/serving parity proven with contract tests.
- University plugin system proven with MSRUAS + IITB stub.
- Demo/proof simulation code physically isolated.

**Constraints:**
- Zero rewrites; preserve all domain logic.
- Preserve hierarchical intent (Institution → Academic Faculty → Department → Branch → Batch → Section → Student/Faculty).
- One commit per extraction boundary.
- Every commit passes build, lint, architecture check, and tests.

**Plan file:** `docs/plans/2026-07-10-air-mentor-maintainability-refactor.md`

## Project conventions

- Package manager: npm
- Runtime: Node 24 (per `.node-version`)
- Frontend: Vite + React + TypeScript under `src/`
- Backend workspace: `air-mentor-api/` (Fastify + Drizzle)
- Tests: Vitest (`npm test`), API tests (`npm --workspace air-mentor-api test`), Playwright e2e
- Lint: `npm run lint`
- Architecture check: `npm run architecture:check`
- Build: `npm run build` and `npm run build:api`

## Task graph and waves — Phase 0

### Wave 1 — Setup
- **Status:** done
- **Tasks:**
  - SH-000: Setup board, gitignore `.absolute-human/`, commit baseline (baseline: `65ef458`)

### Wave 2 — Config foundation
- **Status:** in-progress
- **Tasks:**
  - SH-001: Add path aliases to tsconfig + vite configs
  - SH-005: Add `architecture:check` to CI (done, commit `a142e8d`)
  - SH-006: Add ESLint import boundary rules
  - SH-007: Install and configure `knip` (done, commit `b927652`)
  - SH-008: Run `knip` baseline (done; report generated but not committed — large generated artifact)

### Wave 3 — Lint auto-fix
- **Status:** pending
- **Tasks:**
  - SH-002: Auto-fix lint in `src/`
  - SH-003: Auto-fix lint in `air-mentor-api/src/`
  - SH-004: Auto-fix lint in `tests/` and `tests-e2e/`

### Wave 4 — Dead-code baseline
- **Status:** pending
- **Tasks:**
  - SH-008: Run `knip` baseline and commit report

### Wave 5 — Verification
- **Status:** pending
- **Tasks:**
  - SH-009: Run full verification suite

### Wave 6 — Close-out
- **Status:** pending
- **Tasks:**
  - SH-010: Self code review
  - SH-011: Requirements validation

## Dependency graph

```text
SH-000
├── SH-001 ──┬─ SH-002 ─┐
│            ├─ SH-003 ─┤
│            └─ SH-004 ─┤
├─ SH-005 ──────────────┤
├─ SH-006 ──────────────┤
└─ SH-007 ── SH-008 ────┘
            │
           SH-009
           /   \
        SH-010 SH-011
```

## Verification policy

Every commit in Phase 0 must pass:

```bash
npm run lint
npm run build
npm run build:api
npm run architecture:check
npm test
npm --workspace air-mentor-api test
```

## Notes

- Current lint failures: ~674 (mostly `no-explicit-any` and unused vars in tests-e2e).
- Current architecture check: passing.
- Baseline commit must include all in-flight maintainability refactor work before Phase 0 structural changes begin.
