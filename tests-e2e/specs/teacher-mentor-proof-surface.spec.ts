import fs from 'node:fs/promises'
import path from 'node:path'
import { expect } from '../support/playwright-runtime'
import { test } from '../fixtures/seeded-run-fixture'
import { loginAs, loginWithApiContext } from '../helpers/login-as'
import { pinProofPlaybackCheckpoint } from '../helpers/proof-playback'
import { findCheckpoint, readProofDashboard, readProofRunCheckpoints } from '../helpers/proof-run-api'

const OUTPUT_ROOT = path.join(process.cwd(), 'output/playwright/teacher-mentor-proof-surface')

test.setTimeout(360_000)

async function capture(page: { screenshot(options: { path: string; fullPage?: boolean }): Promise<Buffer> }, fileName: string) {
  await fs.mkdir(OUTPUT_ROOT, { recursive: true })
  await page.screenshot({ path: path.join(OUTPUT_ROOT, fileName), fullPage: true })
}

test('teacher proof controls stay visible and mentor cards stay checkpoint-bound at sem1 pre-tt1', async ({ page, request, seededRun }) => {
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

  await loginAs(page, 'course-leader')
  await pinProofPlaybackCheckpoint(page, activeRunId!, preTt1Checkpoint.simulationStageCheckpointId)
  await page.goto('/#/app', { waitUntil: 'domcontentloaded' })
  await page.locator('[data-proof-action="open-faculty-profile"]').click()

  const teacherProofPanel = page.locator('[data-proof-surface="teacher-proof-panel"]').first()
  await expect(teacherProofPanel).toBeVisible({ timeout: 45_000 })
  await expect(teacherProofPanel).toContainText(/Proof Control Plane/i)
  await expect(page.locator('[data-proof-section="proof-playback-notice"]').first()).toBeVisible({ timeout: 30_000 })
  await expect(page.locator('[data-proof-surface="academic-proof-summary"]')).toHaveCount(0)
  await teacherProofPanel.scrollIntoViewIfNeeded()
  const teacherPanelBox = await teacherProofPanel.boundingBox()
  expect(teacherPanelBox, 'Teacher proof panel should render in the viewport').toBeTruthy()
  expect((teacherPanelBox?.y ?? 9_999)).toBeLessThan(900)
  await capture(page, 'course-leader-sem1-pre-tt1-profile.png')

  await loginAs(page, 'mentor')
  await pinProofPlaybackCheckpoint(page, activeRunId!, preTt1Checkpoint.simulationStageCheckpointId)
  await page.goto('/#/app', { waitUntil: 'domcontentloaded' })

  const mentorBanner = page.locator('[data-proof-section="mentor-checkpoint-banner"]').first()
  await expect(mentorBanner).toBeVisible({ timeout: 45_000 })
  await expect(mentorBanner).toContainText(/Semester 1/i)
  await expect(mentorBanner).toContainText(/Pre TT1/i)
  await expect(mentorBanner).toContainText(/Student-shell and risk-explorer drilldowns follow this same semester and stage/i)
  await expect(page.getByText('Awaiting TT1').first()).toBeVisible({ timeout: 30_000 })
  await expect(page.getByText('High Watch').first()).toBeVisible({ timeout: 30_000 })
  await expect(page.locator('text=CGPA:')).toHaveCount(0)
  await capture(page, 'mentor-sem1-pre-tt1-dashboard.png')

  await fs.writeFile(
    path.join(OUTPUT_ROOT, 'teacher-mentor-proof-surface.json'),
    `${JSON.stringify({
      generatedAt: new Date().toISOString(),
      runId: activeRunId,
      checkpointId: preTt1Checkpoint.simulationStageCheckpointId,
      checkpoint: 'Semester 1 / pre-tt1',
      teacherPanelViewportY: teacherPanelBox?.y ?? null,
      consoleErrors,
      pageErrors,
    }, null, 2)}\n`,
    'utf8',
  )

  expect(consoleErrors, `Unexpected browser console errors:\n${consoleErrors.join('\n')}`).toEqual([])
  expect(pageErrors, `Unexpected page errors:\n${pageErrors.join('\n')}`).toEqual([])
})
