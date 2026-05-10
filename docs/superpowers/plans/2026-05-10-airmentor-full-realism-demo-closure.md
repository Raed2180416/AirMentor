# AirMentor Full Realism Demo Closure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the remaining local AirMentor realism/demo evidence gaps with proof-plane realism, evaluator-visible browser flows, claim-safety checks, and exact audit/capability evidence.

**Architecture:** Keep the existing audit harness as the backend source of truth, add narrow tests around true override-run behavior and browser-visible edit/recompute behavior, and update reports only from verified evidence. Browser specs reuse the seeded-run fixture and role-login helpers so the evaluator path stays realistic.

**Tech Stack:** TypeScript, Vitest, Drizzle/Postgres test harness, React/Vite, Playwright Firefox, existing AirMentor proof-run APIs.

---

## File Structure

- `air-mentor-api/src/lib/proof-realism-audit.ts`
  - Existing read-only auditor. Modify only if true override-run comparison needs reusable section/run comparison helpers.
- `air-mentor-api/tests/proof-realism-audit.test.ts`
  - Existing backend audit tests. Add true baseline-vs-stressed proof-run verifier here.
- `tests-e2e/helpers/proof-run-api.ts`
  - Existing Playwright API helper. Add small helpers for creating proof runs, activating semesters, recomputing risk, and reading student details if needed.
- `tests-e2e/specs/editable-data-recompute.spec.ts`
  - New browser/API hybrid proof that Course Leader edits persist and recompute affects proof evidence/risk or reports a clear no-change reason.
- `tests-e2e/specs/full-demo-ladder.spec.ts`
  - New focused browser ladder for sysadmin, Course Leader, Mentor, HoD, Sem 1, and Sem 6 evidence surfaces.
- `tests/causal-language.test.ts`
  - New text guard for causal/production overclaim language in UI/docs.
- `docs/paper-evidence/causal-evaluation-protocol.md`
  - New concise protocol separating synthetic proof evidence from production claims.
- `audit-map/32-reports/proof-realism-audit-2026-05-10.md`
  - Existing audit ledger. Update with new commands/results only after verification.
- `docs/CAPABILITY_MATRIX.md`
  - Update only rows directly proven by new tests.

---

## Task 1: True Override-Run Realism Proof

**Intent:** Prove the adaptation verifier compares real generated proof runs, not synthetic row perturbations.

**Feature Intent:** A system admin can create baseline and stressed Section B proof runs for the same cohort, and the stressed run shows lower marks and higher risk in generated rows.

**Files:**

- Modify: `air-mentor-api/tests/proof-realism-audit.test.ts`
- Modify if necessary: `air-mentor-api/src/lib/proof-realism-audit.ts`
- Read: `air-mentor-api/src/modules/admin-proof-sandbox.ts:336-365`
- Read: `air-mentor-api/src/lib/proof-section-override-applier.ts`

- [ ] **Step 1: Add the failing backend test**

Add this test inside `describe('proof realism audit', () => { ... })` in `air-mentor-api/tests/proof-realism-audit.test.ts`:

```ts
  it('compares two real proof runs when Section B overrides stress classroom conditions', async () => {
    process.env.AIRMENTOR_SECTION_OVERRIDES_V1 = '1'
    current = await createTestApp()
    if (!current) throw new Error('Expected test app')
    const adminLogin = await loginAs(current.app, 'sysadmin', 'admin1234')

    const createBaseline = await current.app.inject({
      method: 'POST',
      url: '/api/admin/batches/batch_branch_mnc_btech_2023/proof-runs',
      headers: { cookie: adminLogin.cookie, origin: TEST_ORIGIN },
      payload: {
        curriculumImportVersionId: 'curriculum_import_mnc_2023_first6_v1',
        seed: 20260316,
        runLabel: 'vitest-realism-baseline',
        activate: false,
      },
    })
    expect(createBaseline.statusCode).toBe(200)
    const baselineRun = createBaseline.json() as { simulationRunId: string }

    const createStressed = await current.app.inject({
      method: 'POST',
      url: '/api/admin/batches/batch_branch_mnc_btech_2023/proof-runs',
      headers: { cookie: adminLogin.cookie, origin: TEST_ORIGIN },
      payload: {
        curriculumImportVersionId: 'curriculum_import_mnc_2023_first6_v1',
        seed: 20260316,
        runLabel: 'vitest-realism-section-b-stressed',
        activate: false,
        sectionOverridesJson: JSON.stringify({
          B: {
            practiceCompliance: 0.3,
            interventionReceptivity: 0.35,
            examPressure: 0.9,
            attendanceDiscipline: 0.35,
            volatility: 0.85,
          },
        }),
      },
    })
    expect(createStressed.statusCode).toBe(200)
    const stressedRun = createStressed.json() as { simulationRunId: string }

    for (const run of [baselineRun, stressedRun]) {
      const recomputeResponse = await current.app.inject({
        method: 'POST',
        url: `/api/admin/proof-runs/${run.simulationRunId}/recompute-risk`,
        headers: { cookie: adminLogin.cookie, origin: TEST_ORIGIN },
        payload: {},
      })
      expect(recomputeResponse.statusCode).toBe(200)
    }

    const baselineCheckpointRows = await current.db.select().from(simulationStageCheckpoints).where(
      eq(simulationStageCheckpoints.simulationRunId, baselineRun.simulationRunId),
    ).orderBy(asc(simulationStageCheckpoints.semesterNumber), asc(simulationStageCheckpoints.stageOrder))
    const stressedCheckpointRows = await current.db.select().from(simulationStageCheckpoints).where(
      eq(simulationStageCheckpoints.simulationRunId, stressedRun.simulationRunId),
    ).orderBy(asc(simulationStageCheckpoints.semesterNumber), asc(simulationStageCheckpoints.stageOrder))
    const baselineProjectionRows = await current.db.select().from(simulationStageStudentProjections).where(
      eq(simulationStageStudentProjections.simulationRunId, baselineRun.simulationRunId),
    )
    const stressedProjectionRows = await current.db.select().from(simulationStageStudentProjections).where(
      eq(simulationStageStudentProjections.simulationRunId, stressedRun.simulationRunId),
    )

    const baseline = auditProofRealismRows({ checkpointRows: baselineCheckpointRows, projectionRows: baselineProjectionRows })
    const stressed = auditProofRealismRows({ checkpointRows: stressedCheckpointRows, projectionRows: stressedProjectionRows })
    const comparison = compareProofClassroomSetups({
      baseline,
      candidate: stressed,
      expectedDirection: 'candidate-section-b-stressed',
    })

    expect(baseline.stageMatrix.verdict).toBe('pass')
    expect(stressed.stageMatrix.verdict).toBe('pass')
    expect(baseline.markProgression.invalidMarkCount).toBe(0)
    expect(stressed.markProgression.invalidMarkCount).toBe(0)
    expect(comparison.verdict).toBe('pass')
    expect(comparison.sectionBMeanOverallDelta).toBeLessThan(-4)
    expect(comparison.sectionBRiskDelta).toBeGreaterThan(5)
  }, 300_000)
```

- [ ] **Step 2: Run the failing test**

Run:

```bash
npx vitest run tests/proof-realism-audit.test.ts --reporter=dot --testTimeout=300000
```

Expected first failure if the route ignores `sectionOverridesJson`:

```text
expected 0 to be less than -4
```

or schema failure for unknown body field:

```text
expected 400 to be 200
```

- [ ] **Step 3: Implement the minimal route/service support if the RED failure proves missing override wiring**

In `air-mentor-api/src/modules/admin-proof-sandbox.ts`, pass `body.sectionOverridesJson` to `enqueueProofSimulationRun`:

```ts
    const result = await enqueueProofSimulationRun(context.db, {
      batchId: params.batchId,
      curriculumImportVersionId: body.curriculumImportVersionId,
      policy: resolved.effectivePolicy,
      curriculumFeatureProfileId: resolvedFeatures.primaryCurriculumFeatureProfileId,
      curriculumFeatureProfileFingerprint: resolvedFeatures.curriculumFeatureProfileFingerprint,
      now: context.now(),
      seed: body.seed,
      runLabel: body.runLabel,
      activate: body.activate,
      sectionOverridesJson: body.sectionOverridesJson ?? null,
    })
```

If TypeScript reports that `startRunSchema` does not allow the field, extend that schema in the same file with:

```ts
  sectionOverridesJson: z.string().optional().nullable(),
```

If TypeScript reports that `enqueueProofSimulationRun` input does not accept the field, add `sectionOverridesJson?: string | null` to its input type and persist it to `simulationRuns.sectionOverridesJson` where the run row is inserted.

- [ ] **Step 4: Run the backend verifier again**

Run:

```bash
npx vitest run tests/proof-realism-audit.test.ts --reporter=dot --testTimeout=300000
```

Expected:

```text
Test Files  1 passed
Tests  3 passed
```

- [ ] **Step 5: Typecheck backend**

Run:

```bash
npx tsc -p tsconfig.json --noEmit --pretty false
```

Expected: no TypeScript errors.

- [ ] **Step 6: Commit Task 1**

```bash
git add air-mentor-api/tests/proof-realism-audit.test.ts air-mentor-api/src/modules/admin-proof-sandbox.ts air-mentor-api/src/lib/proof-realism-audit.ts air-mentor-api/src/lib/msruas-proof-control-plane.ts
git commit -m "test: prove override-run proof realism"
```

Only include implementation files that actually changed.

---

## Task 2: Editable Data Recompute Browser Proof

**Intent:** Prove Course Leader edits are real academic evidence, not cosmetic UI state.

**Feature Intent:** A Course Leader edits attendance and legal marks for an assigned student; after recompute, persisted evidence appears in proof projections or the UI explains why risk did not change.

**Files:**

- Create: `tests-e2e/specs/editable-data-recompute.spec.ts`
- Modify: `tests-e2e/helpers/proof-run-api.ts`
- Read: `tests-e2e/specs/flow-2-evidence-reaction.spec.ts`
- Read: `tests-e2e/specs/proof-ui-population.spec.ts`
- Read: `src/academic-faculty-profile-page.tsx`

- [ ] **Step 1: Add Playwright API helpers**

Append to `tests-e2e/helpers/proof-run-api.ts`:

```ts
export async function recomputeProofRunRisk(requestContext: RequestContext, runId: string, csrfToken: string) {
  const response = await requestContext.post(apiPath(`/api/admin/proof-runs/${encodeURIComponent(runId)}/recompute-risk`), {
    headers: csrfHeaders(csrfToken),
    data: {},
  })
  return readJson(response, `Recompute proof risk for ${runId}`)
}

export async function activateProofRunSemester(requestContext: RequestContext, runId: string, csrfToken: string, semesterNumber: number) {
  const response = await requestContext.post(apiPath(`/api/admin/proof-runs/${encodeURIComponent(runId)}/activate-semester`), {
    headers: csrfHeaders(csrfToken),
    data: { semesterNumber },
  })
  return readJson(response, `Activate semester ${semesterNumber} for ${runId}`)
}
```

- [ ] **Step 2: Add the failing browser/API proof spec**

Create `tests-e2e/specs/editable-data-recompute.spec.ts`:

```ts
import { expect } from '../support/playwright-runtime'
import { apiPath } from '../helpers/api-url'
import { loginAs, loginWithApiContext } from '../helpers/login-as'
import {
  findCheckpoint,
  readProofCheckpointStudentDetail,
  readProofDashboard,
  recomputeProofRunRisk,
} from '../helpers/proof-run-api'
import { test } from '../fixtures/seeded-run-fixture'

// Intent: Prove an average Course Leader can edit observable academic evidence and that
// the local proof plane recomputes risk/queue projections from the persisted edit.
// Feature intent: editable marks/attendance must not be cosmetic; it must affect risk
// where logically relevant and must not leak future-stage evidence.
// Role: Course Leader, with sysadmin recompute authority.
// Semester/stage: Sem-1 pre-TT1 fresh run and Sem-1 post-TT1 checkpoint detail.
// Evaluator observation: saved edit appears in UI/proof detail, no console crash.

test('editable data recompute: Course Leader attendance evidence reaches proof projections', async ({ page, request, seededRun }) => {
  const consoleErrors: string[] = []
  const pageErrors: string[] = []
  page.on('console', message => {
    if (message.type() === 'error') consoleErrors.push(message.text())
  })
  page.on('pageerror', error => {
    pageErrors.push(error.message)
  })

  const { session } = await loginWithApiContext(request, 'system-admin')
  const dashboard = await readProofDashboard(request, seededRun.batchId, session.csrfToken)
  const checkpoint = findCheckpoint(dashboard.activeRunDetail?.checkpoints ?? [], 1, 'pre-tt1')
  const studentId = 'mnc_student_001'

  await loginAs(page, 'course-leader')
  await page.goto('/#/app', { waitUntil: 'domcontentloaded' })
  const courseLeaderSummary = page.locator('[data-proof-surface="academic-proof-summary"][data-proof-scope="course-leader-dashboard"]').first()
  await expect(courseLeaderSummary).toBeVisible({ timeout: 30_000 })

  const attendanceResponse = await request.put(apiPath('/api/academic/offerings/mnc_s1_amc_s1_02_a/attendance'), {
    headers: { 'X-AirMentor-CSRF': session.csrfToken },
    data: {
      studentId,
      present: 1,
      totalClasses: 2,
    },
  })
  expect(attendanceResponse.ok()).toBeTruthy()

  await recomputeProofRunRisk(request, seededRun.runId, session.csrfToken)

  const detail = await readProofCheckpointStudentDetail(request, seededRun.runId, checkpoint.simulationStageCheckpointId, studentId, session.csrfToken)
  const evidenceRows = detail.projections.map((projection: { projection?: { currentEvidence?: { attendancePct?: number | null } } }) => projection.projection?.currentEvidence ?? {})
  const attendanceValues = evidenceRows.map((evidence: { attendancePct?: number | null }) => Number(evidence.attendancePct ?? -1))
  expect(attendanceValues).toContain(50)

  await loginAs(page, 'hod')
  const [proofBundleResponse] = await Promise.all([
    page.waitForResponse(response => response.url().includes('/api/academic/hod/proof-bundle') && response.status() === 200, { timeout: 75_000 }),
    page.goto('/#/app', { waitUntil: 'domcontentloaded' }),
  ])
  expect(proofBundleResponse.ok()).toBeTruthy()
  await expect(page.locator('[data-proof-surface="hod-proof-analytics"]').first()).toBeVisible({ timeout: 30_000 })

  expect(consoleErrors, `Unexpected browser console errors:\n${consoleErrors.join('\n')}`).toEqual([])
  expect(pageErrors, `Unexpected page errors:\n${pageErrors.join('\n')}`).toEqual([])
})
```

- [ ] **Step 3: Run the focused spec and capture RED/GREEN**

Run with existing local servers if available:

```bash
AIRMENTOR_PW_REUSE_SERVER=1 AIRMENTOR_PW_DISABLE_VIDEO=1 AIRMENTOR_PW_BROWSER=firefox AIRMENTOR_PW_FIREFOX_EXECUTABLE=/nix/store/jqpxpar1pvk37f1kjwhkp26dj1wrpw4d-playwright-firefox/firefox/firefox npx playwright test tests-e2e/specs/editable-data-recompute.spec.ts --config=tests-e2e/playwright.config.ts --reporter=line --output=output/playwright/local-deep-realism/editable-data-recompute
```

Expected if already supported:

```text
1 passed
```

Expected if proof projection bridge is missing:

```text
Expected array: [50]
Received array: [...]
```

- [ ] **Step 4: Fix only evidence-backed product gaps**

If Step 3 fails because attendance saves but proof projection does not update after recompute, inspect and patch only the recompute bridge in the backend path that rebuilds `simulationStageStudentProjections.projectionJson.currentEvidence` from latest teacher-workspace attendance snapshots.

If Step 3 fails because the route is unauthorized, change the test to login with the correct Course Leader CSRF token instead of weakening authorization.

If Step 3 fails because route shape differs, inspect `air-mentor-api/src/modules/academic.ts` and update the test payload to match the existing API, not the product route.

- [ ] **Step 5: Re-run focused browser spec**

Run:

```bash
AIRMENTOR_PW_REUSE_SERVER=1 AIRMENTOR_PW_DISABLE_VIDEO=1 AIRMENTOR_PW_BROWSER=firefox AIRMENTOR_PW_FIREFOX_EXECUTABLE=/nix/store/jqpxpar1pvk37f1kjwhkp26dj1wrpw4d-playwright-firefox/firefox/firefox npx playwright test tests-e2e/specs/editable-data-recompute.spec.ts --config=tests-e2e/playwright.config.ts --reporter=line --output=output/playwright/local-deep-realism/editable-data-recompute
```

Expected:

```text
1 passed
```

- [ ] **Step 6: Commit Task 2**

```bash
git add tests-e2e/helpers/proof-run-api.ts tests-e2e/specs/editable-data-recompute.spec.ts air-mentor-api/src
git commit -m "test: prove editable data recomputes proof evidence"
```

Remove `air-mentor-api/src` from the `git add` command if no backend files changed.

---

## Task 3: Full Browser Demo Ladder

**Intent:** Prove what a college evaluator sees in browser across core personas and late-stage proof playback.

**Feature Intent:** Sysadmin, Course Leader, Mentor, and HoD surfaces populate from the active seeded run across Sem 1 and Sem 6 without future evidence leak or stale/loading failures.

**Files:**

- Create: `tests-e2e/specs/full-demo-ladder.spec.ts`
- Modify if needed: `tests-e2e/helpers/proof-run-api.ts`
- Read: `tests-e2e/specs/proof-ui-population.spec.ts`
- Read: `tests-e2e/specs/flow-10-completion-counterfactual.spec.ts`
- Read: `tests-e2e/specs/multi-semester-carryover.spec.ts`

- [ ] **Step 1: Add helper for advancing to a target checkpoint if needed**

Append to `tests-e2e/helpers/proof-run-api.ts` if no equivalent exists:

```ts
export async function advanceProofRunToCheckpoint(
  requestContext: RequestContext,
  runId: string,
  batchId: string,
  csrfToken: string,
  targetSemester: number,
  targetStageKey: string,
) {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const dashboard = await readProofDashboard(requestContext, batchId, csrfToken)
    const active = dashboard.activeRunDetail ?? null
    if (active?.activeOperationalSemester === targetSemester && String(active.activeStageKey).toLowerCase() === targetStageKey) {
      return dashboard
    }
    const response = await requestContext.post(apiPath(`/api/admin/proof-runs/${encodeURIComponent(runId)}/advance`), {
      headers: csrfHeaders(csrfToken),
      data: { mode: 'stage' },
    })
    await readJson(response, `Advance ${runId} toward semester ${targetSemester} ${targetStageKey}`)
  }
  throw new Error(`Timed out advancing ${runId} to semester ${targetSemester} stage ${targetStageKey}`)
}
```

- [ ] **Step 2: Create the browser ladder spec**

Create `tests-e2e/specs/full-demo-ladder.spec.ts`:

```ts
import { expect } from '../support/playwright-runtime'
import { loginAs, loginWithApiContext } from '../helpers/login-as'
import {
  advanceProofRunToCheckpoint,
  findCheckpoint,
  readProofCheckpointDetail,
  readProofDashboard,
} from '../helpers/proof-run-api'
import { test } from '../fixtures/seeded-run-fixture'

// Intent: Prove the local AirMentor demo is evaluator-visible across sysadmin,
// Course Leader, Mentor, and HoD roles, not just API-green.
// Feature intent: six-semester proof playback must populate realistic surfaces,
// avoid future evidence leak, and keep counterfactual language non-causal.

test('full demo ladder: sysadmin, teacher, mentor, and HoD surfaces stay populated from Sem 1 to Sem 6', async ({ page, request, seededRun }) => {
  test.setTimeout(420_000)
  const consoleErrors: string[] = []
  const pageErrors: string[] = []
  page.on('console', message => {
    if (message.type() === 'error') consoleErrors.push(message.text())
  })
  page.on('pageerror', error => {
    pageErrors.push(error.message)
  })

  const { session } = await loginWithApiContext(request, 'system-admin')
  const sem1Dashboard = await readProofDashboard(request, seededRun.batchId, session.csrfToken)
  expect(sem1Dashboard.activeRunDetail?.simulationRunId).toBe(seededRun.runId)
  const sem1PreTt1 = findCheckpoint(sem1Dashboard.activeRunDetail?.checkpoints ?? [], 1, 'pre-tt1')
  const sem1Detail = await readProofCheckpointDetail(request, seededRun.runId, sem1PreTt1.simulationStageCheckpointId, session.csrfToken)
  const sem1ProjectionJson = JSON.stringify(sem1Detail.students ?? sem1Detail.items ?? sem1Detail)
  expect(sem1ProjectionJson).not.toMatch(/"tt1Pct":\s*[1-9]/)
  expect(sem1ProjectionJson).not.toMatch(/"seePct":\s*[1-9]/)

  await loginAs(page, 'system-admin')
  const [adminDashboardResponse] = await Promise.all([
    page.waitForResponse(response => response.url().includes(`/api/admin/batches/${seededRun.batchId}/proof-dashboard`) && response.status() === 200, { timeout: 75_000 }),
    page.goto('/#/admin/proof-dashboard', { waitUntil: 'domcontentloaded' }),
  ])
  expect(adminDashboardResponse.ok()).toBeTruthy()
  await expect(page.locator('[data-proof-surface="system-admin-proof-control-plane"]').first()).toBeVisible({ timeout: 30_000 })
  await expect(page.locator('[data-proof-section="checkpoint-buttons"]').first()).toBeVisible()

  await loginAs(page, 'course-leader')
  await page.goto('/#/app', { waitUntil: 'domcontentloaded' })
  const courseLeaderSurface = page.locator('[data-proof-surface="academic-proof-summary"][data-proof-scope="course-leader-dashboard"]').first()
  await expect(courseLeaderSurface).toBeVisible({ timeout: 30_000 })
  await expect(courseLeaderSurface).toContainText(/Course Leader Dashboard/i)
  await expect(page.getByText(/Total Students/i).first()).toBeVisible()

  await loginAs(page, 'mentor')
  await page.goto('/#/app', { waitUntil: 'domcontentloaded' })
  await expect(page.getByText(/Mentor|Mentees|My Mentees/i).first()).toBeVisible({ timeout: 30_000 })

  await advanceProofRunToCheckpoint(request, seededRun.runId, seededRun.batchId, session.csrfToken, 6, 'post-see')
  const sem6Dashboard = await readProofDashboard(request, seededRun.batchId, session.csrfToken)
  expect(sem6Dashboard.activeRunDetail?.activeOperationalSemester).toBe(6)
  expect(String(sem6Dashboard.activeRunDetail?.activeStageKey).toLowerCase()).toBe('post-see')

  await loginAs(page, 'hod')
  const [hodBundleResponse] = await Promise.all([
    page.waitForResponse(response => response.url().includes('/api/academic/hod/proof-bundle') && response.status() === 200, { timeout: 90_000 }),
    page.goto('/#/app', { waitUntil: 'domcontentloaded' }),
  ])
  expect(hodBundleResponse.ok()).toBeTruthy()
  const hodSurface = page.locator('[data-proof-surface="hod-proof-analytics"]').first()
  await expect(hodSurface).toBeVisible({ timeout: 45_000 })
  await expect(hodSurface).toContainText(/Department proof records for the active simulation run/i)
  await expect(hodSurface).toContainText(/Semester\s*6|Sem\s*6/i)

  const counterfactualTab = page.getByRole('tab', { name: /Counterfactual Impact/i }).first()
  await expect(counterfactualTab).toBeVisible({ timeout: 30_000 })
  const [simulatorResponse] = await Promise.all([
    page.waitForResponse(response => response.url().includes('/api/academic/hod/proof-counterfactual-simulator') && response.status() === 200, { timeout: 90_000 }),
    counterfactualTab.click(),
  ])
  expect(simulatorResponse.ok()).toBeTruthy()
  const simulatorPanel = page.locator('[data-proof-section="hod-counterfactual-simulator"]').first()
  await expect(simulatorPanel).toBeVisible({ timeout: 30_000 })
  await expect(simulatorPanel).toContainText(/Projected|simulated|counterfactual/i)
  await expect(page.locator('text=/interventions proved|caused by interventions|risk model proved/i')).toHaveCount(0)

  expect(consoleErrors, `Unexpected browser console errors:\n${consoleErrors.join('\n')}`).toEqual([])
  expect(pageErrors, `Unexpected page errors:\n${pageErrors.join('\n')}`).toEqual([])
})
```

- [ ] **Step 3: Run ladder spec**

Run:

```bash
AIRMENTOR_PW_REUSE_SERVER=1 AIRMENTOR_PW_DISABLE_VIDEO=1 AIRMENTOR_PW_BROWSER=firefox AIRMENTOR_PW_FIREFOX_EXECUTABLE=/nix/store/jqpxpar1pvk37f1kjwhkp26dj1wrpw4d-playwright-firefox/firefox/firefox npx playwright test tests-e2e/specs/full-demo-ladder.spec.ts --config=tests-e2e/playwright.config.ts --reporter=line --output=output/playwright/local-deep-realism/full-demo-ladder
```

Expected:

```text
1 passed
```

If it times out, split into two specs:

- `tests-e2e/specs/full-demo-ladder-sem1.spec.ts`
- `tests-e2e/specs/full-demo-ladder-sem6-hod.spec.ts`

and keep the same assertions.

- [ ] **Step 4: Fix selector brittleness only from evidence**

If a surface exists but lacks durable selectors, add `data-proof-*` attributes to the smallest component:

- Course Leader: `src/academic-route-pages.tsx`
- Mentor: `src/academic-route-pages.tsx`
- HoD: `src/pages/hod-pages.tsx`
- Sysadmin proof dashboard: `src/system-admin-proof-dashboard-workspace.tsx`

Do not alter UI behavior unless the failure proves behavior is wrong.

- [ ] **Step 5: Re-run ladder spec**

Run the same command from Step 3. Expected `1 passed` or both split specs passed.

- [ ] **Step 6: Commit Task 3**

```bash
git add tests-e2e/helpers/proof-run-api.ts tests-e2e/specs/full-demo-ladder.spec.ts tests-e2e/specs/full-demo-ladder-sem1.spec.ts tests-e2e/specs/full-demo-ladder-sem6-hod.spec.ts src
git commit -m "test: prove full browser demo ladder"
```

Only include split spec files or `src` files if they actually changed.

---

## Task 4: Claim-Safety Guard

**Intent:** Prevent synthetic proof evidence from being presented as production causal or real-world predictive proof.

**Feature Intent:** UI/docs must use projected/simulated language and keep real-data validation as a blocker.

**Files:**

- Create: `tests/causal-language.test.ts`
- Create: `docs/paper-evidence/causal-evaluation-protocol.md`
- Modify if failing: specific UI/doc files flagged by the test.

- [ ] **Step 1: Add causal protocol doc**

Create `docs/paper-evidence/causal-evaluation-protocol.md`:

```md
# Causal Evaluation Protocol

AirMentor proof runs use synthetic but realistic world-simulator data for the MSRUAS B.Tech Mathematics & Computing 2023 demo.

The demo may claim:

- projected risk changes inside the seeded proof world,
- simulated counterfactual comparisons,
- local browser/API proof that product surfaces are populated,
- sanity evidence that marks and risk move in plausible directions.

The demo must not claim:

- real-world causal proof of intervention impact,
- production-grade prediction on institutional data,
- validated deployment readiness from local proof alone,
- model retraining on real MSRUAS history.

Production claims require real historical data import, governance approval, privacy/security review, calibration metrics, monitoring, and external validation.
```

- [ ] **Step 2: Add text guard test**

Create `tests/causal-language.test.ts`:

```ts
import { readFileSync } from 'node:fs'
import { globSync } from 'glob'
import { describe, expect, it } from 'vitest'

const checkedFiles = [
  ...globSync('src/**/*.{ts,tsx}', { nodir: true }),
  ...globSync('docs/**/*.md', { nodir: true }),
  ...globSync('audit-map/32-reports/**/*.md', { nodir: true }),
].filter(file => !file.includes('node_modules'))

const prohibitedPatterns = [
  /interventions proved/i,
  /caused by interventions/i,
  /risk model proved/i,
  /guarantees? student success/i,
  /production-grade prediction/i,
  /validated on real MSRUAS data/i,
]

describe('causal and production claim language', () => {
  it('does not overclaim causal or production predictive proof', () => {
    const offenders: string[] = []
    for (const file of checkedFiles) {
      const text = readFileSync(file, 'utf8')
      for (const pattern of prohibitedPatterns) {
        if (pattern.test(text)) offenders.push(`${file} matches ${pattern}`)
      }
    }
    expect(offenders).toEqual([])
  })

  it('keeps a written protocol for synthetic proof boundaries', () => {
    const protocol = readFileSync('docs/paper-evidence/causal-evaluation-protocol.md', 'utf8')
    expect(protocol).toMatch(/synthetic but realistic/i)
    expect(protocol).toMatch(/must not claim/i)
    expect(protocol).toMatch(/Production claims require real historical data/i)
  })
})
```

- [ ] **Step 3: Run text guard**

Run:

```bash
npx vitest run tests/causal-language.test.ts --reporter=dot
```

Expected:

```text
Test Files  1 passed
Tests  2 passed
```

- [ ] **Step 4: Fix any flagged copy**

If the test flags files, replace prohibited phrases with one of these exact safe patterns:

```text
projected in the seeded proof run
```

```text
simulated counterfactual comparison
```

```text
not causally proven
```

```text
requires real historical validation before production use
```

- [ ] **Step 5: Commit Task 4**

```bash
git add tests/causal-language.test.ts docs/paper-evidence/causal-evaluation-protocol.md src docs audit-map/32-reports
git commit -m "test: guard causal claim language"
```

Only include `src`, `docs`, or `audit-map` files that actually changed.

---

## Task 5: Final Truth Matrix And Capability Updates

**Intent:** Turn verified test/browser evidence into an honest audit ledger.

**Feature Intent:** Future evaluator sees exact commands, statuses, artifacts, and residual gaps.

**Files:**

- Modify: `audit-map/32-reports/proof-realism-audit-2026-05-10.md`
- Modify: `docs/CAPABILITY_MATRIX.md`

- [ ] **Step 1: Update audit report with new evidence**

Append this section to `audit-map/32-reports/proof-realism-audit-2026-05-10.md`, replacing command results with the actual observed results from Tasks 1-4:

```md
## Full ladder closure evidence

| Lane | Command / artifact | Result | Verdict |
|---|---|---:|---|
| True override-run realism | `npx vitest run tests/proof-realism-audit.test.ts --reporter=dot --testTimeout=300000` | Record the exact pass/fail count and runtime from the command output. | Mark `Green` only if the command passes; otherwise mark `Blocked` with root cause. |
| Editable data recompute | `tests-e2e/specs/editable-data-recompute.spec.ts` | Record the exact Playwright pass/fail count and artifact path. | Mark `Green` only if the focused spec passes; otherwise mark `Blocked` with root cause. |
| Full browser demo ladder | `tests-e2e/specs/full-demo-ladder.spec.ts` | Record the exact Playwright pass/fail count and artifact path. | Mark `Green` only if the focused spec passes; otherwise mark `Blocked` with root cause. |
| Claim-safety guard | `npx vitest run tests/causal-language.test.ts --reporter=dot` | Record the exact pass/fail count and runtime from the command output. | Mark `Green` only if the command passes; otherwise mark `Blocked` with offending files. |

### Final residual gaps

- Real institutional data import and validation remain blocked.
- Production ML accuracy remains unclaimed.
- Deployment closeout remains separate from local proof realism.
- Multi-program generalization remains unproven unless a separate program run is added.
```

- [ ] **Step 2: Update capability matrix only for directly proven rows**

Edit `docs/CAPABILITY_MATRIX.md` rows as evidence permits:

```md
| E2E suite (Playwright) for full demo walkthrough | partial | focused local Firefox specs: `proof-ui-population`, `editable-data-recompute`, `full-demo-ladder` | H8 remains open for full regression pack/performance |
```

If true override-run proof passes, update the scenario/adaptation evidence note without claiming multi-program support:

```md
| Scenario engine (research claim N1) | works locally for seeded M&C proof; true Section B override-run comparison covered by `air-mentor-api/tests/proof-realism-audit.test.ts` | D6 still missing for per-program family subset |
```

Do not change deployment rows unless deployment commands were run and passed.

- [ ] **Step 3: Run final verification set**

Run:

```bash
npx vitest run tests/proof-realism-audit.test.ts tests/causal-language.test.ts --reporter=dot --testTimeout=300000
npx tsc -p air-mentor-api/tsconfig.json --noEmit --pretty false
npx tsc -p tsconfig.tests.json --noEmit --pretty false
AIRMENTOR_PW_REUSE_SERVER=1 AIRMENTOR_PW_DISABLE_VIDEO=1 AIRMENTOR_PW_BROWSER=firefox AIRMENTOR_PW_FIREFOX_EXECUTABLE=/nix/store/jqpxpar1pvk37f1kjwhkp26dj1wrpw4d-playwright-firefox/firefox/firefox npx playwright test tests-e2e/specs/proof-ui-population.spec.ts tests-e2e/specs/editable-data-recompute.spec.ts tests-e2e/specs/full-demo-ladder.spec.ts --config=tests-e2e/playwright.config.ts --reporter=line --output=output/playwright/local-deep-realism/full-closure
```

Expected:

```text
proof-realism-audit and causal-language pass
backend typecheck pass
root tests typecheck pass
Playwright focused specs pass
```

If root `tsconfig.tests.json` reports the known pre-existing top-level `await` or zod locale errors, document them as pre-existing and do not fix them inside this closure unless they are caused by changed files.

- [ ] **Step 4: Git diff/status review**

Run:

```bash
git status --short
git diff --stat
git diff -- air-mentor-api/src/lib/proof-realism-audit.ts air-mentor-api/tests/proof-realism-audit.test.ts tests-e2e/specs/editable-data-recompute.spec.ts tests-e2e/specs/full-demo-ladder.spec.ts tests/causal-language.test.ts docs/CAPABILITY_MATRIX.md audit-map/32-reports/proof-realism-audit-2026-05-10.md
```

Expected:

```text
Only planned files changed, plus any evidence-backed minimal implementation files.
```

- [ ] **Step 5: Commit Task 5**

```bash
git add audit-map/32-reports/proof-realism-audit-2026-05-10.md docs/CAPABILITY_MATRIX.md
git commit -m "docs: update proof realism closure evidence"
```

- [ ] **Step 6: Final response evidence summary**

Final response must include:

```md
# Completion Status

- **Intent**: local full realism/demo closure.
- **Feature Intent**: proof-plane realism plus evaluator-visible sysadmin/teacher/mentor/HoD browser evidence.

## Verified

- **Backend realism**: COMMAND + RESULT
- **Editable-data recompute**: COMMAND + RESULT
- **Browser ladder**: COMMAND + RESULT
- **Claim safety**: COMMAND + RESULT
- **Typechecks**: COMMAND + RESULT

## Residual Gaps

- **Real-data validation**: still blocked.
- **Production ML accuracy**: not claimed.
- **Deployment readiness**: separate.
```

---

## Plan Self-Review

Spec coverage:

- True override-run proof is covered by Task 1.
- Editable attendance/recompute proof is covered by Task 2.
- Full browser role/stage ladder is covered by Task 3.
- Claim safety is covered by Task 4.
- Truth matrix and capability matrix updates are covered by Task 5.

Placeholder scan:

- The plan contains no unresolved `TBD`, placeholder result tokens, or empty implementation steps.
- Report rows instruct the worker to record exact observed command output instead of inventing results.

Type consistency:

- Playwright helpers use the existing `RequestContext`, `csrfHeaders`, `readJson`, and `apiPath` names from `tests-e2e/helpers/proof-run-api.ts`.
- Backend verifier uses existing `simulationRuns`, `simulationStageCheckpoints`, `simulationStageStudentProjections`, `auditProofRealismRows`, and `compareProofClassroomSetups` imports.
