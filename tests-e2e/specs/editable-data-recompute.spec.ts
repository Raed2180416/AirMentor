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

const STUDENT_ID = 'mnc_student_001'
const OFFERING_ID = 'mnc_s1_amc_s1_02_a'

test('editable data recompute: Course Leader attendance evidence reaches proof projections', async ({ page, request, seededRun }) => {
  const consoleErrors: string[] = []
  const pageErrors: string[] = []
  page.on('console', message => {
    if (message.type() === 'error') consoleErrors.push(message.text())
  })
  page.on('pageerror', error => {
    pageErrors.push(error.message)
  })

  const { session: adminSession } = await loginWithApiContext(request, 'system-admin')
  const dashboard = await readProofDashboard(request, seededRun.batchId, adminSession.csrfToken)
  const postSeeCheckpoint = findCheckpoint(dashboard.activeRunDetail?.checkpoints ?? [], 1, 'post-see')

  await loginAs(page, 'course-leader')
  await page.goto('/#/app', { waitUntil: 'domcontentloaded' })
  const courseLeaderSummary = page.locator('[data-proof-surface="academic-proof-summary"][data-proof-scope="course-leader-dashboard"]').first()
  await expect(courseLeaderSummary).toBeVisible({ timeout: 30_000 })

  const { session: courseLeaderSession } = await loginWithApiContext(request, 'course-leader')
  const attendanceResponse = await request.put(apiPath(`/api/academic/offerings/${OFFERING_ID}/attendance`), {
    headers: { 'X-AirMentor-CSRF': courseLeaderSession.csrfToken },
    data: {
      capturedAt: '2026-03-16T02:00:00.000Z',
      entries: [{
        studentId: STUDENT_ID,
        presentClasses: 1,
        totalClasses: 2,
      }],
    },
  })
  expect(attendanceResponse.ok(), `attendance edit status ${attendanceResponse.status()}: ${await attendanceResponse.text()}`).toBeTruthy()

  const { session: recomputeSession } = await loginWithApiContext(request, 'system-admin')
  await recomputeProofRunRisk(request, seededRun.runId, recomputeSession.csrfToken)

  const detail = await readProofCheckpointStudentDetail(request, seededRun.runId, postSeeCheckpoint.simulationStageCheckpointId, STUDENT_ID, recomputeSession.csrfToken)
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
