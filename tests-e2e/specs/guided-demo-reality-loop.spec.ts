import { expect } from '../support/playwright-runtime'
import { apiPath } from '../helpers/api-url'
import { loginAs, loginWithApiContext } from '../helpers/login-as'
import { readJson } from '../helpers/proof-run-api'
import { test } from '../fixtures/seeded-run-fixture'

type AcademicBootstrapLike = {
  faculty?: Array<{ facultyId?: string }>
}

type FacultyProfileLike = {
  proofOperations?: {
    activeOperationalSemester?: number | null
    selectedCheckpoint?: { stageKey?: string | null } | null
    monitoringQueue?: unknown[]
  }
}

function csrfHeaders(csrfToken: string) {
  return { 'X-AirMentor-CSRF': csrfToken }
}

async function readCourseLeaderFacultyId(request: { get(url: string, options?: Record<string, unknown>): Promise<unknown> }, csrfToken: string) {
  const bootstrap = await readJson(await request.get(apiPath('/api/academic/bootstrap'), {
    headers: csrfHeaders(csrfToken),
  }) as never, 'Read Course Leader bootstrap') as AcademicBootstrapLike
  const facultyId = bootstrap.faculty?.[0]?.facultyId
  if (!facultyId) throw new Error('Course Leader bootstrap did not expose a faculty id.')
  return facultyId
}

async function readCourseLeaderProfile(request: { get(url: string, options?: Record<string, unknown>): Promise<unknown> }, csrfToken: string, facultyId: string) {
  return readJson(await request.get(apiPath(`/api/academic/faculty-profile/${encodeURIComponent(facultyId)}`), {
    headers: csrfHeaders(csrfToken),
  }) as never, 'Read Course Leader faculty profile') as Promise<FacultyProfileLike>
}

async function advanceAcademicProofStage(request: { post(url: string, options?: Record<string, unknown>): Promise<unknown> }, csrfToken: string, runId: string) {
  await readJson(await request.post(apiPath(`/api/academic/proof-runs/${encodeURIComponent(runId)}/advance`), {
    headers: csrfHeaders(csrfToken),
    data: { mode: 'stage' },
  }) as never, `Advance academic proof run ${runId}`)
}

async function ensureCourseLeaderQueueCheckpoint(request: {
  get(url: string, options?: Record<string, unknown>): Promise<unknown>
  post(url: string, options?: Record<string, unknown>): Promise<unknown>
}, csrfToken: string, runId: string) {
  const facultyId = await readCourseLeaderFacultyId(request, csrfToken)
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const profile = await readCourseLeaderProfile(request, csrfToken, facultyId)
    const queueCount = profile.proofOperations?.monitoringQueue?.length ?? 0
    if (queueCount > 0) return { facultyId, profile }
    await advanceAcademicProofStage(request, csrfToken, runId)
  }
  const finalProfile = await readCourseLeaderProfile(request, csrfToken, facultyId)
  const semester = finalProfile.proofOperations?.activeOperationalSemester ?? 'unknown'
  const stage = finalProfile.proofOperations?.selectedCheckpoint?.stageKey ?? 'unknown'
  throw new Error(`Could not find a Course Leader proof queue checkpoint after advancing; final sem=${semester} stage=${stage}.`)
}

test('guided demo reality loop: Course Leader can run evidence edit, recompute, intervention, and next-stage actions', async ({ page, request, seededRun }) => {
  test.setTimeout(420_000)
  const consoleErrors: string[] = []
  const pageErrors: string[] = []
  page.on('console', message => {
    if (message.type() === 'error') consoleErrors.push(message.text())
  })
  page.on('pageerror', error => {
    pageErrors.push(error.message)
  })

  const { session: courseLeaderSession } = await loginWithApiContext(request, 'course-leader')
  await ensureCourseLeaderQueueCheckpoint(request, courseLeaderSession.csrfToken, seededRun.runId)

  await loginAs(page, 'course-leader')
  const [bootstrapResponse] = await Promise.all([
    page.waitForResponse(response => response.url().includes('/api/academic/bootstrap') && response.status() === 200, { timeout: 75_000 }),
    page.goto('/#/app', { waitUntil: 'domcontentloaded' }),
  ])
  expect(bootstrapResponse.ok()).toBeTruthy()

  const panel = page.locator('[data-proof-surface="demo-reality-loop"]').first()
  await expect(panel).toBeVisible({ timeout: 75_000 })
  await expect(panel).toContainText(/Guided local synthetic MSRUAS demo/i, { timeout: 75_000 })
  await expect(panel).toContainText(/Demo student:/i)

  await panel.locator('[data-proof-action="demo-loop-capture-before"]').click()
  await expect(panel.getByRole('status')).toContainText(/Before snapshot captured/i, { timeout: 30_000 })

  await panel.locator('[data-proof-action="demo-loop-apply-attendance-edit"]').click()
  await expect(panel.getByRole('status')).toContainText(/attendance edit submitted/i, { timeout: 60_000 })

  const [recomputeResponse] = await Promise.all([
    page.waitForResponse(response => response.url().includes('/api/academic/proof-runs/') && response.url().includes('/recompute-risk') && response.status() === 200, { timeout: 90_000 }),
    panel.locator('[data-proof-action="demo-loop-recompute-risk"]').click(),
  ])
  expect(recomputeResponse.ok()).toBeTruthy()
  await expect(panel.getByRole('status')).toContainText(/risk recomputed/i, { timeout: 60_000 })
  await expect(panel.locator('[data-proof-section="demo-loop-delta"]')).toContainText(/Attendance:/i)
  await expect(panel.locator('[data-proof-section="demo-loop-delta"]')).toContainText(/Risk:/i)

  await panel.locator('[data-proof-action="demo-loop-load-next-stage"]').click()
  await expect(panel.getByRole('status')).toContainText(/proof card refreshed/i, { timeout: 60_000 })

  const resolveButton = panel.locator('[data-proof-action="demo-loop-resolve-intervention"]')
  await resolveButton.click()
  await expect(panel.locator('[role="status"], [role="alert"]')).toContainText(/Intervention resolution recorded|No open intervention is available/i, { timeout: 60_000 })

  const [advanceResponse] = await Promise.all([
    page.waitForResponse(response => response.url().includes('/api/academic/proof-runs/') && response.url().includes('/advance') && response.status() === 200, { timeout: 90_000 }),
    panel.locator('[data-proof-action="demo-loop-next-stage"]').click(),
  ])
  expect(advanceResponse.ok()).toBeTruthy()
  await expect(panel.locator('[data-proof-section="demo-loop-next-stage-validation"]')).toContainText(/Next checkpoint risk|not recorded/i, { timeout: 90_000 })

  await expect(page.locator('body')).not.toContainText(/guaranteed improvement|proves improvement|real-world accuracy|caused by intervention/i)
  expect(consoleErrors, `Unexpected browser console errors:\n${consoleErrors.join('\n')}`).toEqual([])
  expect(pageErrors, `Unexpected page errors:\n${pageErrors.join('\n')}`).toEqual([])
})
