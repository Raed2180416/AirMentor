import assert from 'node:assert/strict'
import { copyFile, mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import {
  resolveSemesterWalkCheckpoint,
  sanitizeArtifactPrefix,
} from './proof-risk-semester-walk.mjs'
import { resolveSystemAdminLiveCredentials } from './system-admin-live-auth.mjs'
import { resolveTeachingPasswordViaSession } from './teaching-password-resolution.mjs'

const playwrightRoot = process.env.PLAYWRIGHT_ROOT
const appUrl = process.env.PLAYWRIGHT_APP_URL ?? 'http://127.0.0.1:4173'
const apiUrl = process.env.PLAYWRIGHT_API_URL ?? appUrl
const outputDir = process.env.PLAYWRIGHT_OUTPUT_DIR ?? 'output/playwright'
const firefoxExecutablePath = process.env.PLAYWRIGHT_FIREFOX_EXECUTABLE_PATH || undefined
const isLiveStack = process.env.AIRMENTOR_LIVE_STACK === '1'
const keyboardArtifactPrefix = sanitizeArtifactPrefix((process.env.AIRMENTOR_KEYBOARD_ARTIFACT_PREFIX ?? '').trim())

assert(playwrightRoot, 'PLAYWRIGHT_ROOT is required')

const { firefox } = await import(`file://${playwrightRoot}/lib/node_modules/playwright/index.mjs`)

const proofPlaybackSelectionStorageKey = 'airmentor-proof-playback-selection'
const seededProofRoute = '#/admin/faculties/academic_faculty_engineering_and_technology/departments/dept_cse/branches/branch_mnc_btech/batches/batch_branch_mnc_btech_2023'
const seededProofBatchId = 'batch_branch_mnc_btech_2023'
const defaultRequestSummary = 'Grant additional mentor mapping coverage'
const teachingPasswordCandidates = ['faculty1234', '1234']
const defaultTeachingUsername = isLiveStack ? 'kavitha.rao' : 'devika.shetty'
let proofRouteState = {
  routeHash: seededProofRoute,
  batchId: seededProofBatchId,
}
let lateCheckpointDescriptor = null
let requestState = {
  id: 'request_001',
  summary: defaultRequestSummary,
  status: 'Closed',
}

await mkdir(outputDir, { recursive: true })

const successScreenshot = path.join(outputDir, 'system-admin-live-keyboard-regression.png')
const failureScreenshot = path.join(outputDir, 'system-admin-live-keyboard-regression-failure.png')
const failureTrace = path.join(outputDir, 'system-admin-live-keyboard-regression-failure.zip')
const failureHtml = path.join(outputDir, 'system-admin-live-keyboard-regression-failure.html')
const successReport = path.join(outputDir, 'system-admin-live-keyboard-regression-report.json')
const failureReport = path.join(outputDir, 'system-admin-live-keyboard-regression-failure.json')
let currentStep = 'launch-browser'
const report = {
  generatedAt: new Date().toISOString(),
  appUrl,
  apiUrl,
  liveStack: isLiveStack,
  proofRoute: null,
  requestRoute: null,
  lateCheckpointWalk: null,
  artifacts: {
    successScreenshot,
    successReport,
    failureScreenshot,
    failureTrace,
    failureHtml,
    failureReport,
    prefixedSuccessScreenshot: buildPrefixedArtifactPath(successScreenshot),
    prefixedSuccessReport: buildPrefixedArtifactPath(successReport),
    prefixedFailureScreenshot: buildPrefixedArtifactPath(failureScreenshot),
    prefixedFailureTrace: buildPrefixedArtifactPath(failureTrace),
    prefixedFailureHtml: buildPrefixedArtifactPath(failureHtml),
    prefixedFailureReport: buildPrefixedArtifactPath(failureReport),
  },
  checks: [],
}
const systemAdminCredentials = resolveSystemAdminLiveCredentials({
  scriptLabel: 'System admin live keyboard regression',
})

function buildPrefixedArtifactPath(rawPath) {
  if (!keyboardArtifactPrefix) return null
  return path.join(path.dirname(rawPath), `${keyboardArtifactPrefix}-${path.basename(rawPath)}`)
}

async function copyPrefixedArtifact(rawPath) {
  const prefixedPath = buildPrefixedArtifactPath(rawPath)
  if (!prefixedPath) return null
  await copyFile(rawPath, prefixedPath)
  return prefixedPath
}

const browser = await firefox.launch({
  headless: true,
  ...(firefoxExecutablePath ? { executablePath: firefoxExecutablePath } : {}),
})
const context = await browser.newContext({ viewport: { width: 1440, height: 1280 } })
await context.tracing.start({ screenshots: true, snapshots: true, sources: true })
const page = await context.newPage()
page.on('console', message => {
  console.log(`[browser:${message.type()}] ${message.text()}`)
})
page.on('pageerror', error => {
  console.error(`[pageerror] ${error.stack ?? error.message}`)
})
page.on('requestfailed', request => {
  console.error(`[requestfailed] ${request.method()} ${request.url()} :: ${request.failure()?.errorText ?? 'unknown'}`)
})
page.on('response', response => {
  if (response.status() >= 400) {
    console.error(`[response:${response.status()}] ${response.url()}`)
  }
})

function markStep(label) {
  currentStep = label
  console.log(`[keyboard] step: ${label}`)
}

async function writeReport(targetPath, payload) {
  await writeFile(targetPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')
}

async function expectVisible(locator, description, timeout = 30_000) {
  await locator.waitFor({ state: 'visible', timeout })
  assert(await locator.isVisible(), `${description} should be visible`)
}

async function expectText(locator, pattern, description) {
  await expectVisible(locator, description)
  const text = (await locator.textContent().catch(() => '')) ?? ''
  if (pattern instanceof RegExp) {
    assert(pattern.test(text), `${description} should match ${pattern}, received ${text}`)
    return
  }
  assert(text.includes(pattern), `${description} should include ${pattern}, received ${text}`)
}

async function focusAndActivate(locator, description, key = 'Enter') {
  await expectVisible(locator, description)
  await locator.scrollIntoViewIfNeeded().catch(() => {})
  await locator.focus()
  const isFocused = await locator.evaluate(node => node === document.activeElement)
  assert.equal(isFocused, true, `${description} should receive focus before keyboard activation`)
  await page.keyboard.press(key)
}

async function expectFocused(locator, description) {
  await expectVisible(locator, description)
  const isFocused = await locator.evaluate(node => node === document.activeElement)
  assert.equal(isFocused, true, `${description} should have focus`)
}

async function adminApiRequest(apiPath, init = {}) {
  const { body, ...restInit } = init
  const browserRequestUrl = new URL(apiPath, isLiveStack ? apiUrl : appUrl).toString()
  const response = await page.evaluate(async request => {
    const csrfToken = document.cookie
      .split('; ')
      .find(item => item.startsWith('airmentor_csrf='))
      ?.slice('airmentor_csrf='.length) ?? null
    const browserResponse = await fetch(request.apiPath, {
      method: request.method,
      headers: {
        accept: 'application/json',
        ...(csrfToken ? { 'x-airmentor-csrf': decodeURIComponent(csrfToken) } : {}),
        ...(request.body === undefined ? {} : { 'content-type': 'application/json' }),
      },
      body: request.body === undefined
        ? undefined
        : typeof request.body === 'string'
          ? request.body
          : JSON.stringify(request.body),
      credentials: 'include',
    })
    const contentType = browserResponse.headers.get('content-type') ?? ''
    const text = await browserResponse.text().catch(() => '')
    return {
      ok: browserResponse.ok,
      status: browserResponse.status,
      contentType,
      text,
    }
  }, {
    apiPath: browserRequestUrl,
    method: restInit.method ?? 'GET',
    body,
  })
  if (!response.ok) {
    throw new Error(`Admin API ${apiPath} failed with ${response.status}: ${response.text.slice(0, 800)}`)
  }
  return response.contentType.includes('application/json')
    ? JSON.parse(response.text)
    : response.text
}

async function readProofDashboard() {
  return adminApiRequest(`/api/admin/batches/${proofRouteState.batchId}/proof-dashboard`)
}

function describeCheckpointDescriptor(checkpoint) {
  assert(checkpoint?.simulationStageCheckpointId, 'Late checkpoint must expose a simulationStageCheckpointId')
  assert.equal(typeof checkpoint.semesterNumber, 'number', 'Late checkpoint must expose a semester number')
  return {
    simulationStageCheckpointId: checkpoint.simulationStageCheckpointId,
    semesterNumber: checkpoint.semesterNumber,
    stageKey: checkpoint.stageKey ?? null,
    stageLabel: checkpoint.stageLabel ?? null,
    stageDescription: checkpoint.stageDescription ?? null,
    stageOrder: typeof checkpoint.stageOrder === 'number' ? checkpoint.stageOrder : null,
    stageAdvanceBlocked: checkpoint.stageAdvanceBlocked ?? null,
    playbackAccessible: checkpoint.playbackAccessible ?? null,
    blockedByCheckpointId: checkpoint.blockedByCheckpointId ?? null,
    blockedProgressionReason: checkpoint.blockedProgressionReason ?? null,
    surfaceLabel: `Sem ${checkpoint.semesterNumber} · ${checkpoint.stageLabel ?? 'Unknown stage'}`,
    bannerLabel: `semester ${checkpoint.semesterNumber} · ${checkpoint.stageLabel ?? 'Unknown stage'}`,
  }
}

function resolveLateCheckpointWalk(checkpoints) {
  const availableOperationalSemesters = Array.from(new Set(
    checkpoints
      .map(item => Number(item?.semesterNumber))
      .filter(Number.isFinite),
  )).sort((left, right) => left - right)
  assert(availableOperationalSemesters.length > 0, 'Proof dashboard should expose at least one checkpoint semester')
  const lateSemester = availableOperationalSemesters.at(-1)
  const checkpoint = resolveSemesterWalkCheckpoint(checkpoints, lateSemester)
  return {
    availableOperationalSemesters,
    checkpoint: describeCheckpointDescriptor(checkpoint),
  }
}

async function readProofDashboardForBatch(batchId) {
  return adminApiRequest(`/api/admin/batches/${batchId}/proof-dashboard`)
}

async function discoverProofRouteState() {
  if (!isLiveStack) return proofRouteState

  const seededDashboard = await readProofDashboardForBatch(seededProofBatchId)
  const seededCheckpointCount = seededDashboard.activeRunDetail?.checkpoints?.length ?? 0
  const seededProofRunCount = seededDashboard.proofRuns?.length ?? 0
  const seededImportCount = seededDashboard.imports?.length ?? 0
  if (seededCheckpointCount > 0 || seededProofRunCount > 0 || seededImportCount > 0) {
    proofRouteState = {
      routeHash: seededProofRoute,
      batchId: seededProofBatchId,
    }
    report.proofRoute = {
      ...proofRouteState,
      pinnedSeededBatch: true,
      batchLabel: '2023',
    }
    console.log(
      `[keyboard] live proof route pinned to seeded batch: batch=2023 checkpoints=${seededCheckpointCount} proofRuns=${seededProofRunCount} imports=${seededImportCount}`,
    )
    return proofRouteState
  }

  const [facultiesPayload, departmentsPayload, branchesPayload, batchesPayload] = await Promise.all([
    adminApiRequest('/api/admin/academic-faculties'),
    adminApiRequest('/api/admin/departments'),
    adminApiRequest('/api/admin/branches'),
    adminApiRequest('/api/admin/batches'),
  ])

  const activeFaculties = new Map((facultiesPayload.items ?? []).filter(item => item.status === 'active').map(item => [item.academicFacultyId, item]))
  const activeDepartments = new Map((departmentsPayload.items ?? []).filter(item => item.status === 'active').map(item => [item.departmentId, item]))
  const activeBranches = new Map((branchesPayload.items ?? []).filter(item => item.status === 'active').map(item => [item.branchId, item]))
  const activeBatches = (batchesPayload.items ?? []).filter(item => item.status === 'active')

  const candidates = []
  for (const batch of activeBatches) {
    const branch = activeBranches.get(batch.branchId)
    if (!branch) continue
    const department = activeDepartments.get(branch.departmentId)
    if (!department?.academicFacultyId) continue
    const faculty = activeFaculties.get(department.academicFacultyId)
    if (!faculty) continue
    const dashboard = await readProofDashboardForBatch(batch.batchId)
    const checkpointCount = dashboard.activeRunDetail?.checkpoints?.length ?? 0
    const proofRunCount = dashboard.proofRuns?.length ?? 0
    const importCount = dashboard.imports?.length ?? 0
    if (checkpointCount === 0 && proofRunCount === 0 && importCount === 0) continue
    candidates.push({
      faculty,
      department,
      branch,
      batch,
      checkpointCount,
      proofRunCount,
      importCount,
    })
  }

  candidates.sort((left, right) =>
    (right.checkpointCount - left.checkpointCount)
    || (right.proofRunCount - left.proofRunCount)
    || (right.importCount - left.importCount)
    || (right.batch.currentSemester - left.batch.currentSemester)
    || (right.batch.admissionYear - left.batch.admissionYear),
  )

  const selected = candidates[0]
  assert(selected, 'No live proof-enabled active batch is available for keyboard validation')
  proofRouteState = {
    routeHash: `#/admin/faculties/${selected.faculty.academicFacultyId}/departments/${selected.department.departmentId}/branches/${selected.branch.branchId}/batches/${selected.batch.batchId}`,
    batchId: selected.batch.batchId,
  }
  report.proofRoute = {
    ...proofRouteState,
    pinnedSeededBatch: false,
    facultyName: selected.faculty.name,
    departmentName: selected.department.name,
    branchName: selected.branch.name,
    batchLabel: selected.batch.batchLabel,
  }
  console.log(`[keyboard] live proof route discovered: faculty=${selected.faculty.name} department=${selected.department.name} branch=${selected.branch.name} batch=${selected.batch.batchLabel} checkpoints=${selected.checkpointCount}`)
  return proofRouteState
}

async function resolveTeachingPassword(username) {
  return resolveTeachingPasswordViaSession({
    appUrl,
    apiUrl,
    username,
    candidates: teachingPasswordCandidates,
    logPrefix: 'live-keyboard',
  })
}

async function discoverRequestState() {
  const payload = await adminApiRequest('/api/admin/requests')
  const items = payload.items ?? []
  assert(items.length > 0, 'At least one governed request should exist for keyboard validation')
  const actionable = items
    .filter(item => item.status !== 'Closed' && item.status !== 'Rejected')
    .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt))
  const fallback = [...items].sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt))
  const selected = actionable[0] ?? fallback[0]
  requestState = {
    id: selected.adminRequestId,
    summary: selected.summary,
    status: selected.status,
  }
  console.log(`[keyboard] request route discovered: id=${requestState.id} status=${requestState.status} summary=${requestState.summary}`)
  return requestState
}

async function waitForProofCheckpoints(label, timeoutMs = 240_000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const dashboard = await readProofDashboard()
    const run = dashboard.activeRunDetail ?? null
    if (run?.checkpoints?.length) return dashboard
    if (run?.status === 'failed') {
      throw new Error(`Proof run ${run.simulationRunId} failed during ${label}: ${run.failureMessage ?? run.failureCode ?? 'unknown failure'}`)
    }
    await page.waitForTimeout(2_500)
  }
  throw new Error(`Timed out waiting for proof checkpoints during ${label}`)
}

async function ensureProofRunReady() {
  let dashboard = await readProofDashboard()
  if (dashboard.activeRunDetail?.checkpoints?.length) return dashboard

  if (!dashboard.imports?.length) {
    await adminApiRequest(`/api/admin/batches/${proofRouteState.batchId}/proof-imports`, {
      method: 'POST',
      body: {},
    })
    dashboard = await readProofDashboard()
  }

  let latestImport = dashboard.imports?.[0] ?? null
  assert(latestImport, 'proof import should exist after prewarm import creation')

  if (latestImport.status !== 'validated' && latestImport.status !== 'approved') {
    await adminApiRequest(`/api/admin/proof-imports/${encodeURIComponent(latestImport.curriculumImportVersionId)}/validate`, {
      method: 'POST',
    })
    dashboard = await readProofDashboard()
    latestImport = dashboard.imports?.[0] ?? latestImport
  }

  if ((dashboard.crosswalkReviewQueue?.length ?? 0) > 0) {
    await adminApiRequest(`/api/admin/proof-imports/${encodeURIComponent(latestImport.curriculumImportVersionId)}/review-crosswalks`, {
      method: 'POST',
      body: {
        reviews: dashboard.crosswalkReviewQueue.map(item => ({
          officialCodeCrosswalkId: item.officialCodeCrosswalkId,
          reviewStatus: 'accepted-with-note',
          overrideReason: 'Deterministic keyboard regression prewarm.',
        })),
      },
    })
    dashboard = await readProofDashboard()
    latestImport = dashboard.imports?.[0] ?? latestImport
  }

  if (latestImport.status !== 'approved') {
    await adminApiRequest(`/api/admin/proof-imports/${encodeURIComponent(latestImport.curriculumImportVersionId)}/approve`, {
      method: 'POST',
    })
    dashboard = await readProofDashboard()
    latestImport = dashboard.imports?.find(item => item.status === 'approved') ?? dashboard.imports?.[0] ?? latestImport
  }

  if (!dashboard.activeRunDetail?.checkpoints?.length) {
    await adminApiRequest(`/api/admin/batches/${proofRouteState.batchId}/proof-runs`, {
      method: 'POST',
      body: {
        curriculumImportVersionId: latestImport.curriculumImportVersionId,
        activate: true,
      },
    })
    dashboard = await waitForProofCheckpoints('proof run creation')
  }

  assert(dashboard.activeRunDetail?.checkpoints?.length, 'proof run checkpoints should exist after prewarm')
  return dashboard
}

async function waitForSystemAdminShellReady() {
  const readinessChecks = [
    expectVisible(page.getByRole('button', { name: 'Logout', exact: true }), 'system admin logout action'),
    expectVisible(page.getByText('Operations Dashboard', { exact: true }).first(), 'system admin operations dashboard heading'),
  ]
  await Promise.any(readinessChecks)
  const facultiesButton = page.getByRole('button', { name: 'Faculties', exact: true }).first()
  if (await facultiesButton.isVisible().catch(() => false)) {
    await expectVisible(facultiesButton, 'system admin faculties rail entry')
  }
  await page.waitForTimeout(750)
}

async function loginAsSystemAdmin() {
  await page.goto(appUrl, { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: /Open System Admin/i }).click()
  await expectVisible(page.getByText(/System Admin Live Mode/), 'system admin login')
  await page.getByPlaceholder('sysadmin', { exact: true }).fill(systemAdminCredentials.identifier)
  await page.getByPlaceholder('••••••••', { exact: true }).fill(systemAdminCredentials.password)
  await page.getByRole('button', { name: 'Sign In', exact: true }).click()
  await waitForSystemAdminShellReady()
}

async function primeSeededProofRouteState() {
  const routeStorageKey = `airmentor-admin-ui:${proofRouteState.routeHash}`
  await page.evaluate(storageKey => {
    window.sessionStorage.setItem(storageKey, JSON.stringify({
      tab: 'overview',
      sectionCode: null,
    }))
  }, routeStorageKey)
}

function buildSeededProofRouteUrl(forceReload = false) {
  const baseUrl = appUrl.replace(/\/$/, '')
  const query = forceReload ? `/?keyboard-reload=${Date.now()}` : '/'
  return `${baseUrl}${query}${proofRouteState.routeHash}`
}

function buildPortalHomeUrl() {
  return `${appUrl.replace(/\/$/, '')}/#/home`
}

function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function visibleProofSurface(name) {
  return page.locator(`[data-proof-surface="${name}"]:visible`).first()
}

async function ensureProofControlPlaneTab(proofControlPlane, label) {
  const tab = proofControlPlane.getByRole('tab', { name: label, exact: true }).first()
  if (!(await tab.isVisible().catch(() => false))) return
  const deadline = Date.now() + 15_000
  while (Date.now() < deadline) {
    const isSelected = (await tab.getAttribute('aria-selected').catch(() => null)) === 'true'
    if (isSelected) return
    await focusAndActivate(tab, `${label} proof tab`)
    await page.waitForTimeout(250)
  }
  throw new Error(`${label} proof tab did not become selected`)
}

async function waitForAdminDataRefreshToSettle(timeout = 60_000) {
  const deadline = Date.now() + timeout
  while (Date.now() < deadline) {
    const refreshVisible = await page.getByText('Refreshing live admin data…', { exact: true }).first().isVisible().catch(() => false)
    if (!refreshVisible) {
      await page.waitForTimeout(300)
      return
    }
    await page.waitForTimeout(500)
  }
}

async function resetWorkspaceIfVisible() {
  const resetWorkspaceButton = page.getByRole('button', { name: 'Reset workspace', exact: true }).first()
  if (!await resetWorkspaceButton.isVisible().catch(() => false)) return false
  await focusAndActivate(resetWorkspaceButton, 'reset faculties workspace button')
  await page.waitForFunction(() => !document.body.innerText.includes('Faculties workspace restored'), { timeout: 10_000 }).catch(() => {})
  await page.waitForTimeout(300)
  return true
}

async function openSeededProofRoute(forceReload = false, reloadAttempt = 0) {
  await ensureProofRunReady()
  await primeSeededProofRouteState()
  const seededRouteUrl = buildSeededProofRouteUrl(forceReload)
  await page.goto(seededRouteUrl, { waitUntil: forceReload ? 'networkidle' : 'domcontentloaded' })
  await page.waitForFunction(expectedHash => window.location.hash === expectedHash, proofRouteState.routeHash)
  await waitForAdminDataRefreshToSettle()
  const batchNotFound = page.getByText('Batch not found', { exact: true }).first()
  if (await batchNotFound.isVisible().catch(() => false)) {
    throw new Error(`Proof batch route ${proofRouteState.routeHash} resolved to "Batch not found"`)
  }
  let proofControlPlane = visibleProofSurface('system-admin-proof-control-plane')
  if (!(await proofControlPlane.isVisible().catch(() => false))) {
    await resetWorkspaceIfVisible()
    await waitForAdminDataRefreshToSettle(15_000)
    proofControlPlane = visibleProofSurface('system-admin-proof-control-plane')
  }
  if (!(await proofControlPlane.isVisible().catch(() => false))) {
    const overviewTab = page.locator('button[data-tab="true"]').filter({ hasText: 'Overview' }).first()
    if (await overviewTab.isVisible().catch(() => false)) {
      await focusAndActivate(overviewTab, 'batch overview workspace tab')
      await page.waitForTimeout(500)
      await waitForAdminDataRefreshToSettle(15_000)
    }
    proofControlPlane = visibleProofSurface('system-admin-proof-control-plane')
  }
  if (!(await proofControlPlane.isVisible().catch(() => false))) {
    if (reloadAttempt >= 1) {
      throw new Error(`System admin proof control plane did not materialize for ${proofRouteState.routeHash}`)
    }
    return openSeededProofRoute(true, reloadAttempt + 1)
  }
  await expectVisible(proofControlPlane, 'system admin proof control plane', 60_000)
  await ensureProofControlPlaneTab(proofControlPlane, 'Checkpoint')
  const checkpointPlayback = proofControlPlane.locator('[data-proof-section="checkpoint-playback"]').first()
  if (!(await checkpointPlayback.isVisible().catch(() => false))) {
    try {
      await checkpointPlayback.waitFor({ state: 'visible', timeout: 15_000 })
    } catch {
      if (reloadAttempt >= 1) {
        throw new Error('Checkpoint playback card did not become visible on the seeded proof route')
      }
      return openSeededProofRoute(true, reloadAttempt + 1)
    }
  }
  await expectVisible(checkpointPlayback, 'checkpoint playback card', 180_000)
  return proofControlPlane
}

async function readPlaybackSelection() {
  const raw = await page.evaluate(key => window.localStorage.getItem(key), proofPlaybackSelectionStorageKey)
  assert(raw, 'checkpoint playback selection should be stored in localStorage')
  return JSON.parse(raw)
}

async function openAcademicPortal(options = {}) {
  const { normalizeHomeUrl = false } = options
  if (normalizeHomeUrl) {
    await page.goto(buildPortalHomeUrl(), { waitUntil: 'domcontentloaded' })
  }
  await focusAndActivate(page.getByRole('button', { name: /Open Academic Portal/i }), 'open academic portal')
  await expectVisible(page.getByText(/Teaching Workspace Live Mode/), 'academic login')
  const teachingPassword = await resolveTeachingPassword(defaultTeachingUsername)
  await page.locator('#teacher-username').fill(defaultTeachingUsername)
  await page.locator('#teacher-password').fill(teachingPassword)
  await page.getByRole('button', { name: 'Sign In', exact: true }).click()
}

async function openFacultyProfileProofPanel() {
  const teacherProofPanel = visibleProofSurface('teacher-proof-panel')
  if (await teacherProofPanel.isVisible().catch(() => false)) return teacherProofPanel
  const facultyProfileButton = page.locator('[data-proof-action="open-faculty-profile"]').first()
  await focusAndActivate(facultyProfileButton, 'faculty profile navigation')
  await expectVisible(teacherProofPanel, 'teacher proof panel')
  return teacherProofPanel
}

async function resolveTeacherProofActionSource(teacherProofPanel) {
  const teacherMonitoringQueue = teacherProofPanel.locator('[data-proof-section="monitoring-queue"]').first()
  await expectVisible(teacherMonitoringQueue, 'teacher monitoring queue')
  const teacherMonitoringRow = teacherMonitoringQueue.locator('[data-proof-row="teacher-monitoring-item"]').first()
  if (await teacherMonitoringRow.isVisible().catch(() => false)) return teacherMonitoringRow
  const teacherElectiveFitRow = teacherProofPanel.locator('[data-proof-row="teacher-elective-fit"]').first()
  if (await teacherElectiveFitRow.isVisible().catch(() => false)) return teacherElectiveFitRow
  return null
}

try {
  markStep('login-system-admin')
  await loginAsSystemAdmin()
  await discoverProofRouteState()
  if (!report.proofRoute) {
    report.proofRoute = { ...proofRouteState }
  }
  await discoverRequestState()
  report.requestRoute = { ...requestState }

  markStep('request-flow-keyboard')
  await focusAndActivate(page.getByRole('button', { name: 'Requests', exact: true }).first(), 'requests navigation')
  await expectVisible(page.getByText(/^Requests$/).last(), 'requests heading')
  const requestButton = page.getByRole('button', { name: new RegExp(escapeRegex(requestState.summary), 'i') }).first()
  await focusAndActivate(requestButton, 'request list item')
  const requestDetailSurface = page.locator('[data-request-detail="true"]').first()
  await expectVisible(requestDetailSurface, 'selected request detail surface')
  await expectVisible(requestDetailSurface.getByText(requestState.summary).first(), 'selected request detail title')
  assert(/#\/admin\/requests\//.test(page.url()), `expected deep-linked request URL, got ${page.url()}`)
  const requestAction = requestDetailSurface.getByRole('button', { name: /Take Review|Approve|Mark Implemented|Close/ }).first()
  const requestActionVisible = await requestAction.isVisible().catch(() => false)
  if (requestActionVisible) {
    await focusAndActivate(requestAction, 'request advance action', ' ')
    await expectVisible(page.getByText('Request advanced.', { exact: true }), 'request advance flash')
  } else {
    await expectText(requestDetailSurface, /Closed|Rejected/i, 'request terminal status')
  }
  report.checks.push({ name: 'request_flow_keyboard_navigation', status: 'passed' })

  markStep('student-modal-focus-trap')
  await focusAndActivate(page.getByRole('button', { name: 'Students', exact: true }).first(), 'students navigation')
  const studentRegistryButton = page.getByRole('button', { name: /Aarav Sharma.*1MS23CS001/i }).first()
  await focusAndActivate(studentRegistryButton, 'student registry selection', ' ')
  await expectVisible(page.getByText('Student Detail', { exact: true }).first(), 'student detail heading')
  const editStudentButton = page.getByRole('button', { name: 'Edit Student', exact: true }).first()
  await focusAndActivate(editStudentButton, 'edit student action')
  const closeDialogButton = page.getByRole('button', { name: 'Close dialog', exact: true }).first()
  await expectFocused(closeDialogButton, 'dialog close button')
  await page.keyboard.press('Shift+Tab')
  const saveStudentButton = page.getByRole('button', { name: 'Save Student', exact: true }).first()
  await expectFocused(saveStudentButton, 'save student button after reverse tab wrap')
  await page.keyboard.press('Tab')
  await expectFocused(closeDialogButton, 'dialog close button after forward tab wrap')
  await page.keyboard.press('Escape')
  await expectVisible(editStudentButton, 'edit student action after dialog close')
  await expectFocused(editStudentButton, 'edit student action after dialog close')
  report.checks.push({ name: 'modal_focus_trap_and_restore', status: 'passed' })

  markStep('proof-dashboard-keyboard')
  const proofDashboard = await ensureProofRunReady()
  const checkpoints = Array.isArray(proofDashboard.activeRunDetail?.checkpoints)
    ? proofDashboard.activeRunDetail.checkpoints.slice()
    : []
  const lateCheckpointWalk = resolveLateCheckpointWalk(checkpoints)
  lateCheckpointDescriptor = lateCheckpointWalk.checkpoint
  report.lateCheckpointWalk = lateCheckpointWalk
  let proofControlPlane = await openSeededProofRoute()
  const firstCheckpointButton = proofControlPlane.locator('[data-proof-action="proof-select-checkpoint"]').first()
  const firstCheckpointLabel = ((await firstCheckpointButton.textContent().catch(() => '')) ?? '').trim()
  const firstCheckpointStageLabel = firstCheckpointLabel.includes('·')
    ? firstCheckpointLabel.split('·').slice(1).join('·').trim()
    : firstCheckpointLabel
  const lateCheckpointButton = proofControlPlane
    .locator(`[data-proof-action="proof-select-checkpoint"][data-proof-entity-id="${lateCheckpointDescriptor.simulationStageCheckpointId}"]`)
    .first()
  await focusAndActivate(lateCheckpointButton, 'late checkpoint selection')
  const selectedCheckpointBanner = proofControlPlane.locator('[data-proof-section="selected-checkpoint-banner"]').first()
  await expectText(
    selectedCheckpointBanner,
    new RegExp(escapeRegex(lateCheckpointDescriptor.bannerLabel), 'i'),
    'selected checkpoint banner after late checkpoint selection',
  )
  await focusAndActivate(proofControlPlane.getByRole('button', { name: 'Reset To Start', exact: true }), 'reset playback button')
  await expectText(selectedCheckpointBanner, new RegExp(escapeRegex(firstCheckpointStageLabel), 'i'), 'selected checkpoint banner after reset')
  const playToEndButton = proofControlPlane.getByRole('button', { name: 'Play To End', exact: true })
  await expectVisible(playToEndButton, 'play to end button')
  if (await playToEndButton.isDisabled()) {
    await expectText(selectedCheckpointBanner, new RegExp(escapeRegex(firstCheckpointStageLabel), 'i'), 'selected checkpoint banner when play to end is gated')
  } else {
    await focusAndActivate(playToEndButton, 'play to end button')
    await expectText(
      selectedCheckpointBanner,
      new RegExp(escapeRegex(lateCheckpointDescriptor.bannerLabel), 'i'),
      'selected checkpoint banner after play to end',
    )
  }
  await readPlaybackSelection()
  report.checks.push({ name: 'proof_dashboard_checkpoint_keyboard_controls', status: 'passed' })

  markStep('switch-to-academic-portal')
  await focusAndActivate(page.getByRole('button', { name: 'Logout', exact: true }), 'logout action')
  await expectVisible(page.getByRole('button', { name: /Open Academic Portal/i }), 'portal home after sysadmin logout', 60_000)
  await openAcademicPortal({ normalizeHomeUrl: true })
  const courseLeaderRoleButton = page.locator('[data-proof-action="switch-role"][data-proof-entity-id="Course Leader"]').first()
  await focusAndActivate(courseLeaderRoleButton, 'course leader role switcher')
  const teacherProofPanel = await openFacultyProfileProofPanel()
  await expectVisible(teacherProofPanel, 'teacher proof panel after keyboard navigation')
  report.checks.push({ name: 'portal_role_switch_keyboard_navigation', status: 'passed' })

  markStep('teacher-risk-and-shell-keyboard')
  let teacherProofActionSource = await resolveTeacherProofActionSource(teacherProofPanel)
  if (!teacherProofActionSource) {
    await expectVisible(teacherProofPanel.locator('[data-proof-section="active-run-contexts"]').first(), 'teacher proof panel active-run section')
    await expectText(teacherProofPanel, /No governed queue items are currently linked to this profile\./i, 'teacher proof panel empty monitoring state')
    await expectVisible(teacherProofPanel.locator('[data-proof-section="elective-fit"]').first(), 'teacher proof panel elective-fit section')
  } else {
    const riskExplorerButton = teacherProofActionSource.locator('[data-proof-action="teacher-proof-open-risk-explorer"]').first()
    await focusAndActivate(riskExplorerButton, 'teacher risk explorer action')
    const riskExplorerSurface = visibleProofSurface('risk-explorer')
    await expectVisible(riskExplorerSurface, 'teacher risk explorer surface', 60_000)
    const riskExplorerBackButton = page.locator('[data-proof-action="risk-explorer-back"]').first()
    await focusAndActivate(riskExplorerBackButton, 'risk explorer back button')
    await expectVisible(teacherProofPanel, 'teacher proof panel after risk explorer return')

    teacherProofActionSource = await resolveTeacherProofActionSource(teacherProofPanel)
    assert(teacherProofActionSource, 'teacher proof action source should still exist after returning from risk explorer')
    const studentShellButton = teacherProofActionSource.locator('[data-proof-action="teacher-proof-open-student-shell"]').first()
    await focusAndActivate(studentShellButton, 'teacher student shell action')
    const studentShellSurface = visibleProofSurface('student-shell')
    await expectVisible(studentShellSurface, 'teacher student shell surface', 60_000)
    const studentShellBackButton = page.locator('[data-proof-action="student-shell-back"]').first()
    await focusAndActivate(studentShellBackButton, 'student shell back button')
    await expectVisible(teacherProofPanel, 'teacher proof panel after student shell return')
  }
  report.checks.push({ name: 'teacher_proof_surface_keyboard_navigation', status: 'passed' })

  markStep('proof-playback-restore-reset')
  await focusAndActivate(page.getByRole('button', { name: 'Logout', exact: true }), 'academic logout action')
  await expectVisible(page.getByRole('button', { name: /Open System Admin/i }), 'portal home after academic logout', 60_000)
  await loginAsSystemAdmin()
  proofControlPlane = await openSeededProofRoute(true)
  const restoreBanner = page
    .locator('[data-restore-banner="true"]')
    .filter({ hasText: /Proof playback (restored|reset required)/i })
    .first()
  if (await restoreBanner.isVisible().catch(() => false)) {
    const resetPlaybackButton = restoreBanner.getByRole('button', { name: 'Reset playback', exact: true }).first()
    await focusAndActivate(resetPlaybackButton, 'restore banner reset playback button')
    await restoreBanner.waitFor({ state: 'hidden', timeout: 30_000 })
  } else {
    const restoredCheckpointBanner = proofControlPlane.locator('[data-proof-section="selected-checkpoint-banner"]').first()
    await expectText(
      restoredCheckpointBanner,
      new RegExp(escapeRegex(firstCheckpointStageLabel), 'i'),
      'selected checkpoint banner after safe playback fallback',
    )
  }
  report.checks.push({ name: 'proof_playback_restore_reset_keyboard_path', status: 'passed' })

  await page.screenshot({ path: successScreenshot, fullPage: true })
  await writeReport(successReport, report)
  const prefixedSuccessScreenshot = await copyPrefixedArtifact(successScreenshot)
  const prefixedSuccessReport = await copyPrefixedArtifact(successReport)
  console.log(`System admin live keyboard regression passed. Screenshot: ${successScreenshot}`)
  if (prefixedSuccessScreenshot || prefixedSuccessReport) {
    console.log('Prefixed keyboard artifacts:')
    if (prefixedSuccessScreenshot) console.log(`- screenshot: ${prefixedSuccessScreenshot}`)
    if (prefixedSuccessReport) console.log(`- report: ${prefixedSuccessReport}`)
  }
  await context.tracing.stop()
} catch (error) {
  try {
    console.error(`[keyboard] current step: ${currentStep}`)
    console.error(`[keyboard] failure url: ${page.url()}`)
    const html = await page.content().catch(() => '')
    if (html) {
      await writeFile(failureHtml, html, 'utf8')
      console.error(`Failure HTML: ${failureHtml}`)
    }
    report.error = error instanceof Error
      ? { message: error.message, stack: error.stack ?? null, step: currentStep }
      : { message: String(error), step: currentStep }
    await writeReport(failureReport, report)
    await page.screenshot({ path: failureScreenshot, fullPage: true })
    await context.tracing.stop({ path: failureTrace })
    const prefixedFailureHtml = html ? await copyPrefixedArtifact(failureHtml).catch(() => null) : null
    const prefixedFailureReport = await copyPrefixedArtifact(failureReport).catch(() => null)
    const prefixedFailureScreenshot = await copyPrefixedArtifact(failureScreenshot).catch(() => null)
    const prefixedFailureTrace = await copyPrefixedArtifact(failureTrace).catch(() => null)
    console.error(`System admin live keyboard regression failed. Screenshot: ${failureScreenshot}`)
    console.error(`Trace: ${failureTrace}`)
    if (prefixedFailureScreenshot || prefixedFailureReport || prefixedFailureTrace || prefixedFailureHtml) {
      console.error('Prefixed keyboard failure artifacts:')
      if (prefixedFailureScreenshot) console.error(`- screenshot: ${prefixedFailureScreenshot}`)
      if (prefixedFailureReport) console.error(`- report: ${prefixedFailureReport}`)
      if (prefixedFailureTrace) console.error(`- trace: ${prefixedFailureTrace}`)
      if (prefixedFailureHtml) console.error(`- html: ${prefixedFailureHtml}`)
    }
  } catch {
    // Preserve the root failure.
  }
  throw error
} finally {
  await browser.close()
}
