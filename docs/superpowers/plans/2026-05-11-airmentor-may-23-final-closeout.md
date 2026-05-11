# AirMentor May 23 Final Closeout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship one clean, pushed, demo-defensible AirMentor branch by May 23 that proves the local MSRUAS B.Tech Mathematics & Computing 2023 demo works end-to-end, feels fast, and has an honest evidence dossier for real-world transfer readiness.

**Architecture:** Treat AirMentor as two coupled products: System Admin proof/demo control and Academic teacher portfolio. Freeze May 23 scope to local frontend + local backend, one-program M&C 2023 demo, proof-backed synthetic realism, and measured performance; do not claim real-data production accuracy, multi-program generality, or hosted production readiness without evidence. Work in small proof gates: browser reality, data realism, editable recompute, intervention progression, performance/stale-server, documentation truth, then final commit/push.

**Tech Stack:** React, TypeScript, Vitest, Fastify, Drizzle/Postgres, existing proof control-plane services, Nix-wrapped Firefox Playwright, local seeded backend, Git/GitHub.

---

## Scope Freeze

### Must be true by May 23

- [ ] Local System Admin can provision/reset a seeded MSRUAS M&C 2023 demo workspace.
- [ ] Generated teacher credentials allow Course Leader, Mentor, and HoD login in demo scope.
- [ ] Course Leader dashboard can show risk, queue, Student Shell/Risk Explorer, and the guided Demo Reality Loop.
- [ ] Editable attendance/marks evidence affects risk after recompute where the model contract says it should.
- [ ] Interventions visibly alter immediate queue state and are reflected in next-stage validation when the demo progresses.
- [ ] Six-semester staged proof run is inspectable with realistic stage evidence and plausible student trajectories.
- [ ] Local backend no longer feels stale/slow for demo-critical screens; slow calls have measured baselines and targeted fixes or documented limits.
- [ ] Capability matrix and final evidence report state exactly what works, what is demo-only, and what is not production-proven.
- [ ] Final branch is committed and pushed to GitHub.

### Explicit non-goals before May 23

- [ ] No claim of real-world institutional prediction accuracy.
- [ ] No claim of production ML readiness on real student data.
- [ ] No multi-program generality beyond M&C 2023 unless separately implemented and proven.
- [ ] No Railway/Render/GitHub Pages migration unless explicitly requested after local closeout.
- [ ] No broad rewrite outside blockers found by the closeout gates.

---

## Task 1: Stabilize and browser-prove the current Guided Demo Reality Loop

**Files:**
- Modify: `tests-e2e/specs/guided-demo-reality-loop.spec.ts`
- Modify only if failures demand: `src/demo-reality-loop.tsx`, `src/App.tsx`, `src/academic-route-pages.tsx`, `src/academic-workspace-route-surface.tsx`, `air-mentor-api/src/modules/academic-proof-routes.ts`
- Docs: `docs/CAPABILITY_MATRIX.md`, `docs/CHANGELOG.md`

- [ ] **Step 1: Create a focused Playwright spec**

Create `tests-e2e/specs/guided-demo-reality-loop.spec.ts` that:

1. Uses the existing local backend/frontend environment helpers.
2. Provisions or reuses a seeded demo workspace.
3. Logs in as the generated Course Leader.
4. Opens the Course Leader dashboard.
5. Asserts `[data-proof-surface="demo-reality-loop"]` appears.
6. Clicks Capture before snapshot.
7. Clicks Apply attendance edit.
8. Clicks Recompute risk.
9. Clicks Resolve intervention if available.
10. Clicks Advance stage.
11. Asserts the UI shows a non-empty delta or a clear proof-message explaining no queue item is available.
12. Asserts page text contains no causal overclaim strings such as `guaranteed`, `proves improvement`, or `real-world accuracy`.

- [ ] **Step 2: Run the spec with Nix Firefox**

Run from repo/worktree root:

```bash
PLAYWRIGHT_TEST_IMPORT=/nix/store/w94nd74jw950wlwm06f51n62d0sb5yp0-playwright-test-1.57.0/lib/node_modules/@playwright/test/index.js \
AIRMENTOR_PW_DISABLE_VIDEO=1 \
AIRMENTOR_PW_API_BASE_URL=http://127.0.0.1:4100 \
AIRMENTOR_PW_FRONTEND_BASE_URL=http://127.0.0.1:5173 \
nix develop -c playwright test tests-e2e/specs/guided-demo-reality-loop.spec.ts --config tests-e2e/playwright.config.ts --reporter=list
```

Expected: PASS. If ports differ, record exact ports and command in `audit-map/32-reports/may-23-closeout-status-2026-05-11.md`.

- [ ] **Step 3: Fix only proven failures**

If failure is data availability, add an explicit demo-empty state or route to a seeded proof queue item. If failure is stale risk refresh, instrument the API call and refresh path; do not add blind sleeps. If failure is backend scope, fix scope guard with regression test.

- [ ] **Step 4: Rerun focused verification**

Run:

```bash
npx --no-install vitest run tests/demo-reality-loop.test.tsx tests/academic-route-pages.test.tsx tests/api-client.test.ts --reporter=dot
npx --no-install vitest run air-mentor-api/tests/academic-proof-routes.test.ts --config air-mentor-api/vitest.config.ts --reporter=dot
npx --no-install tsc -p tsconfig.app.json --noEmit
npx --no-install tsc -p tsconfig.tests.json --noEmit
npx --no-install tsc -p air-mentor-api/tsconfig.json --noEmit
npm run lint -- --max-warnings=0
git diff --check
```

Expected: all exit 0.

---

## Task 2: Measure and fix local backend slowness/stale-server behavior

**Files:**
- Create: `scripts/profile-local-demo-endpoints.mjs`
- Create/update: `audit-map/32-reports/local-backend-performance-2026-05-11.md`
- Modify if necessary: slow endpoint services found by measurement, not by guess.

- [ ] **Step 1: Write endpoint profiler**

Create `scripts/profile-local-demo-endpoints.mjs` that measures at least these endpoints 5 times each against `AIRMENTOR_PROFILE_API_BASE_URL`:

- `/api/health` or closest available health endpoint.
- Academic bootstrap.
- Course Leader dashboard/bootstrap route used after teacher login.
- Student agent card route.
- Student risk explorer route.
- HoD proof bundle route.
- Proof dashboard route.

Output markdown table: endpoint, p50, p95, max, status codes.

- [ ] **Step 2: Run baseline profile**

Run:

```bash
AIRMENTOR_PROFILE_API_BASE_URL=http://127.0.0.1:4100 node scripts/profile-local-demo-endpoints.mjs | tee audit-map/32-reports/local-backend-performance-2026-05-11.md
```

Expected: report created. Any demo-critical endpoint p95 > 2000 ms or max > 5000 ms is a blocker unless it is a known one-time provisioning route.

- [ ] **Step 3: Root-cause slow calls**

For each slow endpoint:

1. Inspect network timing/browser artifact if UI path is slow.
2. Inspect backend service path and repeated recompute/DB loops.
3. Add timing logs only if needed, guarded so they do not spam production.
4. Fix by caching, narrowing query, avoiding redundant proof recompute, or adding explicit loading/progress state.

- [ ] **Step 4: Rerun profiler and record before/after**

Expected: demo-critical p95 under 2000 ms where feasible, or a documented unavoidable first-run cost with user-visible progress.

---

## Task 3: Run full local demo proof pack

**Files:**
- Existing: `tests-e2e/specs/*.spec.ts`
- Reports: `audit-map/32-reports/may-23-closeout-status-2026-05-11.md`

- [ ] **Step 1: Run focused browser pack**

Run the established local Firefox pack covering:

- `proof-ui-population`
- `editable-data-recompute`
- `intervention-affects-marks`
- `multi-semester-carryover`
- `full-demo-ladder`
- `flow-1`, `flow-2`, `flow-4`, `flow-5`, `flow-6`, `flow-8`, `flow-9`, `flow-10`, `flow-11`
- `guided-demo-reality-loop`

Expected: all pass, or failures listed with root cause and fix owner.

- [ ] **Step 2: Run stage realism tests**

Run:

```bash
npx --no-install vitest run air-mentor-api/tests/stage-evidence-matrix.test.ts --config air-mentor-api/vitest.config.ts --reporter=dot --testTimeout=300000
npx --no-install vitest run air-mentor-api/tests/proof-realism-audit.test.ts --config air-mentor-api/vitest.config.ts --reporter=dot --testTimeout=300000
```

Expected: PASS. If output says a stage distribution is unrealistic, treat as product blocker or document as demo-only limitation.

- [ ] **Step 3: Run causal-language guard**

Run the existing causal-language guard test pack. Expected: no UI/docs say the synthetic model proves real causal uplift or real-data accuracy.

---

## Task 4: Critical reasoning audit of real-world mirroring

**Files:**
- Create/update: `audit-map/32-reports/real-world-transfer-readiness-2026-05-11.md`
- Update: `docs/CAPABILITY_MATRIX.md`

- [ ] **Step 1: Build a claim ledger**

For every major claim, classify:

- `proven-local-demo`
- `plausible-with-real-data-tuning`
- `demo-only`
- `not-yet-proven`

Claims to classify:

- simulated marks progression realism
- attendance/marks impact on risk
- CO/question mapping
- intervention response effect
- prior-semester carryover
- queue recommendation usefulness
- model calibration and uncertainty
- teacher UX feasibility
- local backend responsiveness
- deployment readiness

- [ ] **Step 2: Connect each claim to evidence**

Each row must cite a test, browser artifact, source file, or report. Rows without evidence stay `not-yet-proven`.

- [ ] **Step 3: Write the real-world transfer argument honestly**

Required conclusion shape:

> AirMentor is not yet validated on real institutional data. The local demo proves the control-plane, stage evidence, editable recompute, intervention workflow, and synthetic validation harness. With real SIS/LMS data ingestion, institutional calibration, and human-in-the-loop threshold tuning, the architecture is positioned to deliver meaningful early-risk triage; this is plausible but not yet empirically proven.

---

## Task 5: Final branch cleanup, commit, push

**Files:**
- All changed source/test/docs files.

- [ ] **Step 1: Final verification gate**

Run:

```bash
npm run lint -- --max-warnings=0
npx --no-install tsc -p tsconfig.app.json --noEmit
npx --no-install tsc -p tsconfig.tests.json --noEmit
npx --no-install tsc -p air-mentor-api/tsconfig.json --noEmit
npx --no-install vitest run tests/demo-reality-loop.test.tsx tests/academic-route-pages.test.tsx tests/api-client.test.ts --reporter=dot
npx --no-install vitest run air-mentor-api/tests/academic-proof-routes.test.ts --config air-mentor-api/vitest.config.ts --reporter=dot
git diff --check
```

Expected: all exit 0.

- [ ] **Step 2: Review git status and diff**

Run:

```bash
git status --short
git diff --stat
```

Expected: only intended source/test/docs changes.

- [ ] **Step 3: Commit logical chunks**

Commit order:

1. Guided demo reality loop feature.
2. Browser/performance/realism audit fixes.
3. Final docs/evidence matrix.

Use conventional commit messages, for example:

```bash
git add <feature files>
git commit -m "feat: add guided demo reality loop"
```

- [ ] **Step 4: Push final branch**

Run:

```bash
git push -u origin <branch-name>
```

Expected: branch visible on GitHub.

- [ ] **Step 5: Final report**

Final response must include:

- branch name and pushed commit SHA
- commands run and pass/fail counts
- browser artifact paths
- performance before/after table
- claim ledger summary
- remaining non-claims

---

## Self-review

- Spec coverage: covers the user's May 23 goals: demo, realism, real-world transfer argument, stale/backend slowness, final clean branch.
- Placeholder scan: no TBD/TODO placeholders; every task has commands and expected output.
- Scope check: deliberately local/demo-focused; production deployment and real-data validation excluded unless separately requested.
- Type consistency: all paths and command styles match current repo conventions.
