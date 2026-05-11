# Guided Demo Reality Loop Closeout — 2026-05-11

## Scope

This closeout covers the local AirMentor Course Leader guided demo reality loop and proof evidence pack for the synthetic MSRUAS B.Tech Mathematics & Computing demo.

## Landed commits

- `0bb760af` — `feat: add guided demo reality loop`
- `082bc373` — `perf: skip proof artifact rebuild on teacher recompute`

## What changed

- Added the Course Leader `Demo Reality Loop` panel.
- Added a guided local path for:
  - before snapshot
  - attendance edit through the academic attendance route
  - academic observed-only recompute
  - risk/card refresh
  - intervention resolution or honest no-open-intervention fallback
  - next-stage advance validation
- Added academic recompute endpoint:
  - `POST /api/academic/proof-runs/:simulationRunId/recompute-risk`
- Fixed guided-panel stale UI state by letting the panel call proof actions with `{ refreshWorkspace: false }` for recompute, resolve, and advance. Normal proof controls still refresh by default.
- Fixed guided recompute slowness by passing `rebuildModelArtifacts: false` from the academic recompute route. This reuses active proof-risk artifacts instead of retraining/rebuilding them on every teacher recompute.
- Fixed worktree Playwright Vite resolution so focused E2E runs can boot from this worktree.

## UX persistence evidence

Problem found:

- Recompute/resolve/advance caused `refreshAcademicProjection()`.
- The academic workspace remounted.
- Panel-local status/delta state disappeared before the E2E assertion.

Fix:

- `DemoRealityLoopPanel` passes `{ refreshWorkspace: false }` to guided panel actions.
- `App.tsx` honors that option for recompute, resolve, and advance.
- The panel then loads the needed risk/card snapshot directly.

Verification:

- `npx --no-install vitest run tests/academic-route-pages.test.tsx -t "threads guided demo actions" --reporter=dot` passed.
- `npx --no-install vitest run tests/demo-reality-loop.test.tsx --reporter=dot` passed.
- Focused Nix Firefox guided panel E2E passed.

## Performance evidence

Before:

- Focused guided-panel Firefox E2E passed only after a second full `[rebuild]` block during Course Leader recompute.
- The route retrained/rebuilt proof artifacts during the teacher recompute click.
- Focused run evidence before fast patch: `1/1 passed in 2.8m`.

After:

- Academic recompute route passes `rebuildModelArtifacts: false`.
- The second full `[rebuild]` block no longer appears during the Course Leader recompute click.
- Focused run evidence after fast patch: `1/1 passed in 2.2m`.

Remaining known cost:

- Initial seeded proof run materialization still performs a full playback/model artifact rebuild and commonly costs about 70–80s locally. That is separate from the guided panel recompute click and remains a future performance lane.

## Verification pack

### Focused guided panel

Command:

```bash
PLAYWRIGHT_TEST_IMPORT=/nix/store/w94nd74jw950wlwm06f51n62d0sb5yp0-playwright-test-1.57.0/lib/node_modules/@playwright/test/index.js AIRMENTOR_PW_DISABLE_VIDEO=1 AIRMENTOR_PW_BROWSER=firefox AIRMENTOR_PW_API_BASE_URL=http://127.0.0.1:4100 AIRMENTOR_PW_FRONTEND_BASE_URL=http://127.0.0.1:5173 nix develop -c playwright test tests-e2e/specs/guided-demo-reality-loop.spec.ts --config tests-e2e/playwright.config.ts --reporter=list
```

Result:

- `1 passed (2.2m)` after the fast recompute patch.

### Browser proof pack

Command:

```bash
PLAYWRIGHT_TEST_IMPORT=/nix/store/w94nd74jw950wlwm06f51n62d0sb5yp0-playwright-test-1.57.0/lib/node_modules/@playwright/test/index.js AIRMENTOR_PW_DISABLE_VIDEO=1 AIRMENTOR_PW_BROWSER=firefox AIRMENTOR_PW_API_BASE_URL=http://127.0.0.1:4100 AIRMENTOR_PW_FRONTEND_BASE_URL=http://127.0.0.1:5173 nix develop -c playwright test tests-e2e/specs/full-demo-ladder.spec.ts tests-e2e/specs/editable-data-recompute.spec.ts tests-e2e/specs/flow-6-nextstage-autoresolve.spec.ts --config tests-e2e/playwright.config.ts --reporter=list
```

Result:

- `3 passed (8.2m)`
- Covered:
  - editable Course Leader attendance recompute projection
  - Next Stage auto-resolve behavior
  - full demo ladder surfaces for sysadmin, teacher, mentor, and HoD from Sem 1 to Sem 6

### Backend realism and stage evidence

Command:

```bash
npx --no-install vitest run air-mentor-api/tests/proof-realism-audit.test.ts air-mentor-api/tests/stage-evidence-matrix.test.ts --config air-mentor-api/vitest.config.ts --reporter=dot --testTimeout=300000
```

Result:

- `2 passed` test files
- `4 passed` tests
- Duration: `529.26s`

### Causal-language guard

Command:

```bash
npx --no-install vitest run tests/causal-language.test.ts --reporter=dot
```

Result:

- `1 passed` test file
- `2 passed` tests
- Duration: `217ms`

### Unit/type/lint gates

Commands:

```bash
npx --no-install vitest run tests/demo-reality-loop.test.tsx tests/academic-route-pages.test.tsx tests/api-client.test.ts --reporter=dot
npx --no-install vitest run air-mentor-api/tests/academic-proof-routes.test.ts --config air-mentor-api/vitest.config.ts --reporter=dot
npx --no-install tsc -p tsconfig.app.json --noEmit
npx --no-install tsc -p tsconfig.tests.json --noEmit
npx --no-install tsc -p air-mentor-api/tsconfig.json --noEmit --pretty false
npm run lint -- --max-warnings=0
git diff --check
```

Results:

- Frontend unit/API pack: `3 passed`, `27 passed` tests.
- Backend route pack: `1 passed`, `5 passed` tests.
- Typecheck gates passed.
- Lint passed with `--max-warnings=0`.
- `git diff --check` passed.

## Non-claims

- No real institutional data validation is claimed.
- No production ML accuracy is claimed.
- No causal intervention effect is claimed.
- No deployed production readiness, rollback, cold-start, or live probe evidence is claimed.
- Multi-program template switching remains missing.
- Broad physical per-demo schema routing for every table remains deferred.

## Current verdict

The local guided demo reality loop is demo-defensible for the synthetic MSRUAS proof run, with focused browser evidence, full local proof-pack evidence, and honest boundaries around production readiness and real-data validation.
