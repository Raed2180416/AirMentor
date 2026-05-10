import { expect } from '../support/playwright-runtime'
import { apiPath } from '../helpers/api-url'
import { loginAs, loginWithApiContext } from '../helpers/login-as'
import { test } from '../fixtures/seeded-run-fixture'

test('proof UI population: sysadmin, course leader, and HoD render the active seeded run', async ({ page, request, seededRun }) => {
  const consoleErrors: string[] = []
  const pageErrors: string[] = []
  page.on('console', message => {
    if (message.type() === 'error') consoleErrors.push(message.text())
  })
  page.on('pageerror', error => {
    pageErrors.push(error.message)
  })

  const { session } = await loginWithApiContext(request, 'system-admin')
  const dashboardResponse = await request.get(apiPath(`/api/admin/batches/${seededRun.batchId}/proof-dashboard`), {
    headers: { 'X-AirMentor-CSRF': session.csrfToken },
  })
  expect(dashboardResponse.ok()).toBeTruthy()
  const dashboard = await dashboardResponse.json()
  expect(dashboard.activeRunDetail?.simulationRunId).toBe(seededRun.runId)
  expect(dashboard.activeRunDetail?.checkpoints?.length).toBeGreaterThan(0)

  await loginAs(page, 'system-admin')
  const [proofDashboardResponse] = await Promise.all([
    page.waitForResponse(response => response.url().includes(`/api/admin/batches/${seededRun.batchId}/proof-dashboard`) && response.status() === 200, { timeout: 75_000 }),
    page.goto('/#/admin/proof-dashboard', { waitUntil: 'domcontentloaded' }),
  ])
  expect(proofDashboardResponse.ok()).toBeTruthy()
  const sysadminSurface = page.locator('[data-proof-surface="system-admin-proof-control-plane"]').first()
  await expect(sysadminSurface).toBeVisible({ timeout: 30_000 })
  await expect(sysadminSurface).toContainText(/Simulation Controls/i)
  await expect(page.locator('[data-proof-section="proof-dashboard-rail"]').first()).toBeVisible()
  await expect(page.locator('[data-proof-section="checkpoint-buttons"]').first()).toBeVisible()

  await loginAs(page, 'course-leader')
  await page.goto('/#/app', { waitUntil: 'domcontentloaded' })
  const courseLeaderSummary = page.locator('[data-proof-surface="academic-proof-summary"][data-proof-scope="course-leader-dashboard"]').first()
  await expect(courseLeaderSummary).toBeVisible({ timeout: 30_000 })
  await expect(courseLeaderSummary).toContainText(/Course Leader Dashboard/i)
  await expect(courseLeaderSummary).toContainText(/Open Queue|High Watch|Preview Semester|Selected Checkpoint/i)
  await expect(page.getByText(/Total Students/i).first()).toBeVisible()

  await loginAs(page, 'hod')
  const [proofBundleResponse] = await Promise.all([
    page.waitForResponse(response => response.url().includes('/api/academic/hod/proof-bundle') && response.status() === 200, { timeout: 75_000 }),
    page.goto('/#/app', { waitUntil: 'domcontentloaded' }),
  ])
  expect(proofBundleResponse.ok()).toBeTruthy()
  const hodSurface = page.locator('[data-proof-surface="hod-proof-analytics"]').first()
  await expect(hodSurface).toBeVisible({ timeout: 30_000 })
  await expect(hodSurface).toContainText(/Department proof records for the active simulation run/i)
  await expect(hodSurface).toContainText(/Semester\s*1|Sem\s*1/i)

  expect(consoleErrors, `Unexpected browser console errors:\n${consoleErrors.join('\n')}`).toEqual([])
  expect(pageErrors, `Unexpected page errors:\n${pageErrors.join('\n')}`).toEqual([])
})
