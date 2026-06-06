import { expect } from '../support/playwright-runtime'
import { loginAs, loginWithApiContext } from '../helpers/login-as'
import {
  advanceProofRunToCheckpoint,
  findCheckpoint,
  readProofCheckpointDetail,
  readProofDashboard,
} from '../helpers/proof-run-api'
import { test } from '../fixtures/seeded-run-fixture'

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
  await expect(page.getByText(/Total Students/i).first()).toBeVisible()
  await expect(page.locator('[data-proof-surface="academic-proof-summary"]')).toHaveCount(0)
  await page.locator('[data-proof-action="open-faculty-profile"]').click()
  const courseLeaderSurface = page.locator('[data-proof-surface="teacher-proof-panel"]').first()
  await expect(courseLeaderSurface).toBeVisible({ timeout: 30_000 })
  await expect(courseLeaderSurface).toContainText(/Proof Control Plane/i)

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
