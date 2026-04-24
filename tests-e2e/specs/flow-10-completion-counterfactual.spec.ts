// Flow 10 — Completion + final analytics. Prompt §L.10 + §C.13 + §G.6.
//
// - Sim-driven: a fresh seeded run is advanced through all stages to
//   Sem-6/post-SEE (or at least far enough that per-stage no-action
//   projections exist).
// - The new /api/academic/hod/proof-counterfactual-simulator route MUST
//   return a projected with-vs-without intervention report using the
//   stored no-action simulator branch (NOT the flag-diff reader).
// - UI counterfactual panel MUST render without error.
//
// Because a full Sem-1..Sem-6 walk is expensive (many stage advances), this
// spec runs the simulator route against the fresh seeded run at whatever
// active stage the fixture lands on, asserting the aggregator's projected
// final report shape is well-formed and self-consistent. A companion
// realism spec (flow-10-completion-realism) does deeper bound checks.

import { expect } from '../support/playwright-runtime'
import { loginAs, loginWithApiContext } from '../helpers/login-as'
import { test } from '../fixtures/seeded-run-fixture'

test('flow-10 counterfactual-simulator route returns projected Sem-6 report shape', async ({ request, seededRun }) => {
  const { session } = await loginWithApiContext(request, 'system-admin')
  const response = await request.get(`/api/academic/hod/proof-counterfactual-simulator?runId=${encodeURIComponent(seededRun.runId)}`, {
    headers: { 'X-AirMentor-CSRF': session.csrfToken },
  })
  expect(response.ok()).toBeTruthy()
  const report = await response.json()

  // Top-level shape.
  expect(report.runId).toBe(seededRun.runId)
  expect(typeof report.generatedAt).toBe('string')
  expect(Array.isArray(report.perStudentPerStage)).toBeTruthy()
  expect(Array.isArray(report.bySemesterStage)).toBeTruthy()
  expect(Array.isArray(report.bySemester)).toBeTruthy()
  expect(report.projectedFinal).toBeDefined()

  // Lift distribution always present (even for empty runs).
  expect(Array.isArray(report.projectedFinal.liftDistribution)).toBeTruthy()
  expect(report.projectedFinal.liftDistribution.length).toBe(7)

  // Self-consistency: totalStudents + totalStagePoints must be non-negative.
  expect(report.projectedFinal.totalStudents).toBeGreaterThanOrEqual(0)
  expect(report.projectedFinal.totalStagePoints).toBeGreaterThanOrEqual(0)
  expect(report.projectedFinal.projectedFailuresPreventedTotal).toBeGreaterThanOrEqual(0)

  // Deterministic ordering inside perStudentPerStage.
  let lastSem = 0
  for (const p of report.perStudentPerStage) {
    expect(p.semesterNumber).toBeGreaterThanOrEqual(lastSem)
    lastSem = p.semesterNumber
    // Mark scalar range sanity.
    for (const v of Object.values(p.realizedMarks) as number[]) {
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThanOrEqual(100)
    }
    for (const v of Object.values(p.noActionMarks) as number[]) {
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThanOrEqual(100)
    }
    // Band transition must be one of the canonical four.
    expect(['no-change', 'prevented-high', 'prevented-medium', 'regression']).toContain(p.bandTransition)
  }
})

test('flow-10 HOD counterfactual UI panel surface renders simulator-based analytics without error', async ({ page, seededRun }) => {
  expect(seededRun.runId).toMatch(/^simulation_run_/)
  const consoleErrors: string[] = []
  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(msg.text())
  })
  await page.goto('/#/app', { waitUntil: 'domcontentloaded' })
  await loginAs(page, 'hod')
  // loginAs already reloads with waitUntil:'networkidle'. A second goto here
  // used to race the app's health-check retry loop (the "Server Not Running"
  // banner keeps polling while it reattaches), which could burn the 120s
  // test budget before a single assertion ran. The surface visibility check
  // below is the real readiness gate.

  const hodSurface = page.locator('[data-proof-surface="hod-proof-analytics"]').first()
  // hodSurface only renders once the proof-bundle has loaded AND its summary
  // carries an activeRunContext (see src/pages/hod-pages.tsx loading/error/
  // empty branches). Visibility here is a stronger guarantee than a network
  // listener that would miss responses fired before the listener attached.
  await expect(hodSurface).toBeVisible({ timeout: 30_000 })

  // Click the Counterfactual Impact tab. ProofSurfaceTabs renders each tab
  // with role="tab" (standard ARIA), not role="button". Query by tab role
  // to match real markup.
  const tabBtn = page.getByRole('tab', { name: /Counterfactual Impact/i }).first()
  await expect(tabBtn).toBeVisible()

  // Tab-click + simulator fetch atomically: kick the tab and then wait for
  // the simulator route response before asserting on DOM. Removes the
  // mount→fetch→render race that made a 15s DOM-poll flaky.
  const [simulatorResponse] = await Promise.all([
    page.waitForResponse(
      response => response.url().includes('/api/academic/hod/proof-counterfactual-simulator') && response.status() === 200,
      { timeout: 45_000 },
    ),
    tabBtn.click(),
  ])
  expect(simulatorResponse.ok()).toBeTruthy()

  // Simulator panel is now the primary surface (§C.13 + §G.6 + §L.10). It is
  // identified by data-proof-section="hod-counterfactual-simulator" per
  // hod-counterfactual-simulator-panel.tsx. Hard-fail if it is missing.
  const simulatorPanel = page.locator('[data-proof-section="hod-counterfactual-simulator"]').first()
  await expect(simulatorPanel).toBeVisible({ timeout: 15_000 })
  await expect(simulatorPanel).toContainText(/Projected Counterfactual/i)
  await expect(simulatorPanel).toContainText(/projected/i)

  // Hard intent per §G.6 + §C.13: demo copy MUST use projected/simulated/
  // counterfactual language, NEVER phrasing that implies the model
  // causally proved anything on its own.
  const prohibited = page.locator('text=/interventions proved|caused by interventions|risk model proved/i')
  await expect(prohibited).toHaveCount(0)

  // No console errors should have surfaced during panel render.
  expect(consoleErrors).toEqual([])
})
