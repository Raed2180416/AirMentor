import fs from 'node:fs/promises'
import path from 'node:path'
import { expect } from '../support/playwright-runtime'
import { test } from '../fixtures/seeded-run-fixture'
import { loginAs, loginWithApiContext } from '../helpers/login-as'
import { pinProofPlaybackCheckpoint } from '../helpers/proof-playback'
import { findCheckpoint, readProofDashboard, readProofRunCheckpoints } from '../helpers/proof-run-api'

const OUTPUT_ROOT = path.join(process.cwd(), 'output/playwright/shared-proof-playback-sync')

async function capture(page: { screenshot(options: { path: string; fullPage?: boolean }): Promise<Buffer> }, fileName: string) {
  await fs.mkdir(OUTPUT_ROOT, { recursive: true })
  await page.screenshot({ path: path.join(OUTPUT_ROOT, fileName), fullPage: true })
}

test('system-admin proof playback selection stays shared across course leader, mentor, and HoD', async ({ page, request, seededRun }) => {
  test.setTimeout(360_000)
  await fs.rm(OUTPUT_ROOT, { recursive: true, force: true })
  await fs.mkdir(OUTPUT_ROOT, { recursive: true })

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
  const activeRunId = seededRun.runId
  expect(dashboard.activeRunDetail?.simulationRunId).toBe(activeRunId)
  const dashboardCheckpoints = dashboard.activeRunDetail?.checkpoints ?? []
  const checkpointEnvelope = dashboardCheckpoints.length > 0
    ? dashboardCheckpoints
    : await readProofRunCheckpoints(request, activeRunId, session.csrfToken)
  const checkpoints = Array.isArray(checkpointEnvelope) ? checkpointEnvelope : checkpointEnvelope.items
  const preTt1Checkpoint = findCheckpoint(checkpoints, 1, 'pre-tt1')
  const checkpointPattern = /Semester\s*1\s*[·/]\s*Pre TT1/i

  await loginAs(page, 'system-admin')
  await pinProofPlaybackCheckpoint(page, activeRunId!, preTt1Checkpoint.simulationStageCheckpointId, 'system-admin')
  await page.goto('/#/admin/proof-dashboard', { waitUntil: 'domcontentloaded' })
  await expect(page.locator('[data-proof-surface="system-admin-proof-control-plane"]').first()).toBeVisible({ timeout: 45_000 })
  await expect(page.getByText(checkpointPattern).first()).toBeVisible({ timeout: 30_000 })
  await capture(page, 'system-admin-sem1-pre-tt1.png')

  await loginAs(page, 'course-leader')
  await page.goto('/#/app', { waitUntil: 'domcontentloaded' })
  await page.locator('[data-proof-action="open-faculty-profile"]').click()
  const teacherPanel = page.locator('[data-proof-surface="teacher-proof-panel"]').first()
  await expect(teacherPanel).toBeVisible({ timeout: 45_000 })
  await expect(page.locator('[data-proof-section="proof-playback-notice"]').first()).toBeVisible({ timeout: 30_000 })
  await expect(page.getByText(checkpointPattern).first()).toBeVisible({ timeout: 30_000 })
  await expect(page.locator('[data-proof-surface="academic-proof-summary"]')).toHaveCount(0)
  await capture(page, 'course-leader-restored-from-system-admin.png')

  await loginAs(page, 'mentor')
  await page.goto('/#/app', { waitUntil: 'domcontentloaded' })
  const mentorBanner = page.locator('[data-proof-section="mentor-checkpoint-banner"]').first()
  await expect(mentorBanner).toBeVisible({ timeout: 45_000 })
  await expect(mentorBanner).toContainText(/Semester 1/i)
  await expect(mentorBanner).toContainText(/Pre TT1/i)
  await expect(page.getByText('Awaiting TT1').first()).toBeVisible({ timeout: 30_000 })
  await expect(page.locator('text=CGPA:')).toHaveCount(0)
  await capture(page, 'mentor-restored-from-system-admin.png')

  await loginAs(page, 'hod')
  await page.goto('/#/app', { waitUntil: 'domcontentloaded' })
  const hodSurface = page.locator('[data-proof-surface="hod-proof-analytics"]').first()
  await expect(hodSurface).toBeVisible({ timeout: 45_000 })
  await expect(page.locator('[data-proof-section="proof-playback-notice"]').first()).toBeVisible({ timeout: 30_000 })
  await expect(page.getByText(checkpointPattern).first()).toBeVisible({ timeout: 30_000 })
  await capture(page, 'hod-restored-from-system-admin.png')

  await fs.writeFile(
    path.join(OUTPUT_ROOT, 'shared-proof-playback-sync.json'),
    `${JSON.stringify({
      generatedAt: new Date().toISOString(),
      runId: activeRunId,
      checkpointId: preTt1Checkpoint.simulationStageCheckpointId,
      checkpoint: 'Semester 1 / pre-tt1',
      consoleErrors,
      pageErrors,
    }, null, 2)}\n`,
    'utf8',
  )

  expect(consoleErrors, `Unexpected browser console errors:\n${consoleErrors.join('\n')}`).toEqual([])
  expect(pageErrors, `Unexpected page errors:\n${pageErrors.join('\n')}`).toEqual([])
})
