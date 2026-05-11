import { expect } from '../support/playwright-runtime'
import { loginAs } from '../helpers/login-as'
import { test } from '../fixtures/seeded-run-fixture'

test('hod smoke: fresh seeded proof run loads Semester 1 analytics without console faults', async ({ page, seededRun }) => {
  const consoleErrors: string[] = []
  const pageErrors: string[] = []

  page.on('console', message => {
    if (message.type() === 'error') consoleErrors.push(message.text())
  })
  page.on('pageerror', error => {
    pageErrors.push(error.message)
  })

  expect(seededRun.runId).toMatch(/^simulation_run_/)
  expect(seededRun.batchId).toBe('batch_branch_mnc_btech_2023')
  expect(String(seededRun.simulatedDateIso)).toMatch(/^\d{4}-\d{2}-\d{2}/)

  await loginAs(page, 'hod')
  await page.goto('/#/app', { waitUntil: 'networkidle' })

  const hodSurface = page.locator('[data-proof-surface="hod-proof-analytics"]').first()
  await expect(hodSurface).toBeVisible()
  await expect(hodSurface).toContainText(/department proof records for the active simulation run/i)
  await expect(hodSurface).toContainText(/Semester\s*1/i)

  const logoutButton = page.getByRole('button', { name: 'Logout', exact: true }).first()
  await expect(logoutButton).toBeVisible()

  await page.waitForTimeout(1_000)
  expect(consoleErrors, `Unexpected browser console errors:\n${consoleErrors.join('\n')}`).toEqual([])
  expect(pageErrors, `Unexpected page errors:\n${pageErrors.join('\n')}`).toEqual([])
})
