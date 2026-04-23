# Playwright Harness Bootstrap Pass

> **You are a subagent dispatched by the AirMentor pipeline. Read this entire prompt before touching code. The sections below are ordered by importance — product intent first, technical instructions second.**

## 1. Product intent (read carefully)

AirMentor is an academic mentoring dashboard built for Ramaiah University of Applied Sciences (MSRUAS). The core product runs **proof simulations** that model a cohort of 120 students across 5 semesters and surface risk/intervention recommendations to HoDs, Course Leaders, and Mentors.

The **fresh-sem1 demo** — the demo the founding team is currently rehearsing — starts a simulation at Semester 1 Stage `pre-tt1` and advances it stage by stage. At each stage transition (`pre-tt1 → post-tt1 → post-tt2 → post-assignments → post-see`), the system recomputes risk, enqueues intervention cases, and surfaces recommendations. When a faculty applies an intervention, the student's **future** marks must reflect that intervention's effect when the next stage advances. This is the feature that proves the system is not just static dashboarding — it is a living model of academic trajectory.

The user just finished **Track A Phase 1-6b** — six engine modules + a render-side evidence applier + a text-humanisation helper (133 tests green). The per-stage intervention-response pipeline is wired behind the feature flag `AIRMENTOR_STAGE_REALIZATION_V1=1`.

## 2. Feature intent for this task

**Bootstrap a Playwright end-to-end test harness** that can drive the demo flows deterministically. This harness is the foundation that all the Track D flow specs (11 flows) will build on later. This task does NOT write the flow specs themselves — it sets up the infrastructure.

## 3. Real-world grounding

- MSRUAS is a real university. Every flow you test must be one a real HoD / faculty would follow at a real university.
- The simulation uses a REAL MSRUAS policy document — attendance rules (75 % minimum, condonation under 65 %), pass rules (20/50 CE min, 20/50 SEE min, 40 % overall), grading scale.
- Student USNs, faculty IDs, course codes follow MSRUAS conventions. Respect them in fixtures.
- The demo flow assumes an Indian academic calendar (`AIRMENTOR_SEED_NOW=2026-03-16T00:00:00Z` → active semester 1, pre-tt1).

## 4. How it ties into the rest of the app

- Frontend: React/Vite at `src/App.tsx`, `src/pages/**`, `src/portal-entry.tsx`. Launches the demo through a portal launcher (`src/proof-surface-launcher.tsx`).
- Backend: Hono API at `air-mentor-api/src/app.ts`. Key endpoints: `/proof/runs`, `/proof/runs/:id/activate`, `/proof/runs/:id/advance`.
- State families: `src/repositories.ts` fetches, `src/selectors.ts` derives, domain types in `src/domain.ts`.
- The seeded proof run is created with `npm run start:seeded` (see `air-mentor-api/scripts/` for the exact wrapper).

## 5. Deliverables (acceptance criteria)

Create these files and no others within `write_scope_glob`:

### `tests-e2e/playwright.config.ts`
- Uses `@playwright/test`.
- `testDir` = `tests-e2e/specs`.
- Runs against `http://localhost:5173` (Vite dev server) with `webServer` config that auto-starts the API (`npm run dev:api` or equivalent) AND the Vite dev server.
- Deterministic: one browser (chromium), single worker, fullyParallel = false, retries = 0.
- Artifacts under `tests-e2e/artifacts/`.
- Sets env `AIRMENTOR_STAGE_REALIZATION_V1=1` + `AIRMENTOR_SEED_NOW=2026-03-16T00:00:00Z` in `webServer.env`.

### `tests-e2e/fixtures/seeded-run-fixture.ts`
- Exports a Playwright `test` fixture that:
  1. Hits the API `/proof/runs` endpoint to create a fresh seeded run.
  2. Activates the run at sem 1, pre-tt1.
  3. Returns `{ runId, batchId, simulatedDateIso }` for the test body.
  4. Tears down the run in `afterEach` via the API (or leaves it — choose the less-flaky path, documented in the fixture file).

### `tests-e2e/helpers/login-as.ts`
- Helper that logs in as a given role (`hod`, `course-leader`, `mentor`, `student`, `system-admin`) using existing seeded credentials. Read `air-mentor-api/src/lib/msruas-proof-control-plane.ts` for the seeded PROOF_FACULTY entries to extract realistic IDs.

### `tests-e2e/specs/smoke.spec.ts`
- ONE smoke test that:
  1. Uses the fixture to boot a seeded run.
  2. Logs in as HoD.
  3. Navigates to the HoD dashboard.
  4. Asserts the proof-dashboard page loads without console errors and the banner shows "Semester 1 · pre-tt1".
- Must pass deterministically when run via `npx playwright test --config=tests-e2e/playwright.config.ts smoke.spec.ts`.

### `package.json`
- Add `@playwright/test` to `devDependencies` (latest stable).
- Add scripts:
  - `"e2e": "playwright test --config=tests-e2e/playwright.config.ts"`
  - `"e2e:install": "playwright install chromium"`
- Do **NOT** touch other scripts or dependencies.

### `audit-map/32-reports/playwright-harness-bootstrap.md`
- Summarise what was created, how to run, known limitations, and what the next 11 flow specs should follow-up.

## 6. Non-negotiables

- **Do not** modify any source code under `src/**` or `air-mentor-api/src/**`.
- **Do not** modify any existing test files under `tests/**` or `air-mentor-api/tests/**`.
- **Do not** delete or rename any existing files.
- If the MSRUAS seeded proof run bootstrap is not reachable from the API (e.g., no such endpoint exists), document the gap in the report and use a mocked backend stub — but do NOT fabricate claims that the harness works against a real backend if it doesn't.
- **Verify** by actually running `npx playwright test --config=tests-e2e/playwright.config.ts smoke.spec.ts` and including the output (or a reproducible command the user can run) in the report.

## 7. Exit contract

When you are done, emit the structured exit marker expected by the pipeline validator (see `pipeline/orchestrator/contracts.py` for the exact format). Include in it:
- `artifacts` — every file you created/modified.
- `verification_commands` — copy-pastable commands the user can run to see the harness work.
- `known_gaps` — any place you faked data or skipped coverage.
- `followup_tasks` — concrete todos for the next 11 flow specs.
