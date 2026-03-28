import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

const playwrightRoot = process.env.PLAYWRIGHT_ROOT
const appUrl = process.env.PLAYWRIGHT_APP_URL ?? 'http://127.0.0.1:4173'
const apiUrl = process.env.PLAYWRIGHT_API_URL ?? appUrl
const outputDir = process.env.PLAYWRIGHT_OUTPUT_DIR ?? 'output/playwright'
const firefoxExecutablePath = process.env.PLAYWRIGHT_FIREFOX_EXECUTABLE_PATH || undefined
const isLiveStack = process.env.AIRMENTOR_LIVE_STACK === '1'

assert(playwrightRoot, 'PLAYWRIGHT_ROOT is required')

const { firefox } = await import(`file://${playwrightRoot}/lib/node_modules/playwright/index.mjs`)

const proofPlaybackSelectionStorageKey = 'airmentor-proof-playback-selection'
const seededProofRoute = '#/admin/faculties/academic_faculty_engineering_and_technology/departments/dept_cse/branches/branch_mnc_btech/batches/batch_branch_mnc_btech_2023'
const seededProofBatchId = 'batch_branch_mnc_btech_2023'
const finalCheckpointLabel = 'Post SEE'
let proofRouteState = {
  routeHash: seededProofRoute,
  batchId: seededProofBatchId,
}

await mkdir(outputDir, { recursive: true })

const screenshots = {
  systemAdmin: path.join(outputDir, 'system-admin-proof-control-plane.png'),
  teacher: path.join(outputDir, 'teacher-proof-panel.png'),
  teacherRiskExplorer: path.join(outputDir, 'teacher-risk-explorer-proof.png'),
  hod: path.join(outputDir, 'hod-proof-analytics.png'),
  hodRiskExplorer: path.join(outputDir, 'hod-risk-explorer-proof.png'),
  studentShell: path.join(outputDir, 'student-shell-proof.png'),
}
const failureScreenshot = path.join(outputDir, 'system-admin-proof-risk-smoke-failure.png')
const failureTrace = path.join(outputDir, 'system-admin-proof-risk-smoke-failure.zip')
const failureHtml = path.join(outputDir, 'system-admin-proof-risk-smoke-failure.html')
let currentStep = 'launch-browser'

const browser = await firefox.launch({
  headless: true,
  ...(firefoxExecutablePath ? { executablePath: firefoxExecutablePath } : {}),
})
browser.on('disconnected', () => {
  console.error('[browser] browser disconnected unexpectedly')
})
const context = await browser.newContext({ viewport: { width: 1440, height: 1400 } })
await context.tracing.start({ screenshots: true, snapshots: true, sources: true })
const page = await context.newPage()
page.on('console', message => {
  console.log(`[browser:${message.type()}] ${message.text()}`)
})
page.on('request', request => {
  if (!request.url().includes('/api/session')) return
  const cookieHeader = request.headers()['cookie'] ?? null
  console.log(`[smoke:session-request] ${request.method()} ${request.url()} cookie=${cookieHeader ? 'present' : 'missing'}`)
})
page.on('request', request => {
  if (!request.url().includes('/api/academic/bootstrap') && !request.url().includes('/api/academic/hod/proof')) return
  console.log(`[smoke:academic-request] ${request.method()} ${request.url()}`)
})
page.on('response', async response => {
  if (!response.url().includes('/api/session')) return
  const headers = await response.allHeaders().catch(() => response.headers())
  const setCookieHeader = headers['set-cookie'] ?? null
  const body = response.status() >= 400
    ? (await response.text().catch(() => '')).slice(0, 400)
    : ''
  console.log(
    `[smoke:session-response] ${response.status()} ${response.url()} set-cookie=${setCookieHeader ? 'present' : 'missing'}${body ? ` body=${body}` : ''}`,
  )
})
page.on('response', async response => {
  if (!response.url().includes('/api/academic/')) return
  const body = response.status() >= 400
    ? (await response.text().catch(() => '')).slice(0, 400)
    : ''
  if (response.status() >= 400 || response.url().includes('/api/academic/bootstrap') || response.url().includes('/api/academic/hod/proof')) {
    console.log(`[smoke:academic-response] ${response.status()} ${response.url()}${body ? ` body=${body}` : ''}`)
  }
})
page.on('pageerror', error => {
  console.error(`[pageerror] ${error.message}`)
})
page.on('crash', () => {
  console.error('[browser] page crashed unexpectedly')
})
page.on('close', () => {
  console.error('[browser] page closed unexpectedly')
})

async function expectVisible(locator, description, timeout = 30_000) {
  await locator.waitFor({ state: 'visible', timeout })
  assert(await locator.isVisible(), `${description} should be visible`)
}

function markStep(label) {
  currentStep = label
  console.log(`[smoke] step: ${label}`)
}

async function expectContainerText(container, pattern, description) {
  const locator = typeof pattern === 'string'
    ? container.getByText(pattern).first()
    : container.getByText(pattern).first()
  await expectVisible(locator, description)
}

async function saveContainerScreenshot(container, filePath, description) {
  await expectVisible(container, description)
  await container.scrollIntoViewIfNeeded().catch(() => {})
  const box = await container.boundingBox()
  if (!box) {
    await page.screenshot({ path: filePath, fullPage: false })
    return
  }
  await page.screenshot({
    path: filePath,
    clip: {
      x: Math.max(0, box.x),
      y: Math.max(0, box.y),
      width: Math.max(1, box.width),
      height: Math.max(1, box.height),
    },
  })
}

async function focusAndActivate(locator, description, key = 'Enter') {
  await expectVisible(locator, description)
  await locator.scrollIntoViewIfNeeded().catch(() => {})
  await locator.focus()
  const isFocused = await locator.evaluate(node => node === document.activeElement)
  assert.equal(isFocused, true, `${description} should receive focus before keyboard activation`)
  await page.keyboard.press(key)
}

function proofSectionLocator(surfaceOrName, sectionName) {
  const surface = typeof surfaceOrName === 'string'
    ? page.locator(`[data-proof-surface="${surfaceOrName}"]:visible`).first()
    : surfaceOrName
  return surface.locator(`[data-proof-section="${sectionName}"]`).first()
}

async function waitForProofSection(surfaceOrName, sectionName, timeout = 60_000) {
  const surfaceLabel = typeof surfaceOrName === 'string' ? surfaceOrName : 'surface-locator'
  await expectVisible(proofSectionLocator(surfaceOrName, sectionName), `${surfaceLabel}/${sectionName}`, timeout)
}

async function waitForProofHeading(heading, timeout = 60_000) {
  await expectVisible(page.getByText(heading, { exact: true }).first(), `${heading} heading`, timeout)
}

async function waitForTextGone(pattern, timeout = 60_000) {
  const locator = page.getByText(pattern).first()
  const visible = await locator.isVisible().catch(() => false)
  if (!visible) return
  await locator.waitFor({ state: 'hidden', timeout })
}

async function waitForSurfaceAfterOptionalLoading(surfaceName, loadingPattern, timeout = 120_000) {
  const surface = visibleProofSurface(surfaceName)
  const loader = page.getByText(loadingPattern).first()
  const deadline = Date.now() + timeout
  let sawLoader = false
  while (Date.now() < deadline) {
    const surfaceVisible = await surface.isVisible().catch(() => false)
    if (surfaceVisible) return surface
    const loaderVisible = await loader.isVisible().catch(() => false)
    sawLoader ||= loaderVisible
    if (sawLoader && !loaderVisible) {
      await expectVisible(surface, `${surfaceName} surface`, Math.max(1_000, deadline - Date.now()))
      return surface
    }
    await page.waitForTimeout(500)
  }
  await expectVisible(surface, `${surfaceName} surface`, timeout)
  return surface
}

async function expectProofCheckpointIdentity(locator, checkpointId, description) {
  await expectVisible(locator, description)
  const deadline = Date.now() + 30_000
  while (Date.now() < deadline) {
    const value = await locator.getAttribute('data-proof-entity-id').catch(() => null)
    if (value === checkpointId) return
    await page.waitForTimeout(250)
  }
  throw new Error(`${description} should expose checkpoint ${checkpointId}`)
}

async function readRequiredAttribute(locator, name, description) {
  await expectVisible(locator, description)
  const value = await locator.getAttribute(name)
  assert(value, `${description} should expose ${name}`)
  return value
}

async function expectProofStudentIdentity(locator, studentId, description) {
  await expectVisible(locator, description)
  const deadline = Date.now() + 30_000
  while (Date.now() < deadline) {
    const value = await locator.getAttribute('data-proof-student-id').catch(() => null)
    if (value === studentId) return
    await page.waitForTimeout(250)
  }
  throw new Error(`${description} should expose student ${studentId}`)
}

async function clickProofButton(proofControlPlane, label, successPattern, timeout = 30_000) {
  const button = proofControlPlane.getByRole('button', { name: label, exact: true })
  await expectVisible(button, `${label} proof action`)
  if (await button.isDisabled()) return false
  await button.click()
  if (successPattern) {
    await expectVisible(page.getByText(successPattern), `${label} success flash`, timeout)
  }
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(250)
  return true
}

async function readPlaybackSelection() {
  return page.evaluate(key => window.localStorage.getItem(key), proofPlaybackSelectionStorageKey)
}

async function readPlaybackSelectionParsed() {
  const raw = await readPlaybackSelection()
  assert(raw, 'checkpoint playback selection should be stored in localStorage')
  const parsed = JSON.parse(raw)
  assert.equal(typeof parsed.simulationRunId, 'string', 'stored playback selection should include a run id')
  assert.equal(typeof parsed.simulationStageCheckpointId, 'string', 'stored playback selection should include a checkpoint id')
  assert.equal(typeof parsed.updatedAt, 'string', 'stored playback selection should include a timestamp')
  return parsed
}

async function adminApiRequest(apiPath, init = {}) {
  const { body, ...restInit } = init
  const timeoutMs = typeof restInit.timeout === 'number' ? restInit.timeout : 180_000
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
        ...(request.headers ?? {}),
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
    apiPath: new URL(apiPath, apiUrl).toString(),
    method: restInit.method ?? 'GET',
    headers: restInit.headers ?? {},
    body,
  })
  if (!response.ok) {
    throw new Error(`Admin API ${apiPath} failed with ${response.status}: ${response.text.slice(0, 800)}`)
  }
  if (response.contentType.includes('application/json')) {
    return JSON.parse(response.text)
  }
  return response.text
}

async function readProofDashboard(batchId = proofRouteState.batchId) {
  return adminApiRequest(`/api/admin/batches/${batchId}/proof-dashboard`)
}

async function discoverProofRouteState() {
  if (!isLiveStack) return proofRouteState

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
    const dashboard = await readProofDashboard(batch.batchId)
    const checkpointCount = dashboard.activeRunDetail?.checkpoints?.length ?? 0
    const proofRunCount = dashboard.proofRuns?.length ?? 0
    const importCount = dashboard.imports?.length ?? 0
    if (checkpointCount === 0 && proofRunCount === 0 && importCount === 0) continue
    candidates.push({
      faculty,
      department,
      branch,
      batch,
      dashboard,
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
  assert(selected, 'No live proof-enabled active batch is available for closeout validation')
  proofRouteState = {
    routeHash: `#/admin/faculties/${selected.faculty.academicFacultyId}/departments/${selected.department.departmentId}/branches/${selected.branch.branchId}/batches/${selected.batch.batchId}`,
    batchId: selected.batch.batchId,
  }
  console.log(`[smoke] live proof route discovered: faculty=${selected.faculty.name} department=${selected.department.name} branch=${selected.branch.name} batch=${selected.batch.batchLabel} checkpoints=${selected.checkpointCount}`)
  return proofRouteState
}

async function waitForProofCheckpoints(label, timeoutMs = 240_000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const dashboard = await readProofDashboard()
    const run = dashboard.activeRunDetail ?? null
    if (run?.checkpoints?.length) {
      console.log(`[smoke] ${label}: activeRun=${run.simulationRunId} status=${run.status} checkpoints=${run.checkpoints.length}`)
      return dashboard
    }
    if (run?.status === 'failed') {
      throw new Error(`Proof run ${run.simulationRunId} failed during ${label}: ${run.failureMessage ?? run.failureCode ?? 'unknown failure'}`)
    }
    console.log(`[smoke] waiting for proof checkpoints during ${label}: activeRun=${run?.simulationRunId ?? 'none'} status=${run?.status ?? 'none'} progress=${JSON.stringify(run?.progress ?? null)}`)
    await page.waitForTimeout(2_500)
  }
  throw new Error(`Timed out waiting for proof checkpoints during ${label}`)
}

async function ensureProofRunReady() {
  let dashboard = await readProofDashboard()
  console.log(`[smoke] proof dashboard before prewarm: imports=${dashboard.imports?.length ?? 0} activeRun=${dashboard.activeRunDetail?.simulationRunId ?? 'none'} checkpoints=${dashboard.activeRunDetail?.checkpoints?.length ?? 0}`)
  if (dashboard.activeRunDetail?.checkpoints?.length) return dashboard

  console.log('[smoke] prewarming proof lifecycle through admin endpoints')
  if (!dashboard.imports?.length) {
    await adminApiRequest(`/api/admin/batches/${proofRouteState.batchId}/proof-imports`, {
      method: 'POST',
      body: JSON.stringify({}),
    })
    dashboard = await readProofDashboard()
    console.log(`[smoke] proof dashboard after import create: imports=${dashboard.imports?.length ?? 0} checkpoints=${dashboard.activeRunDetail?.checkpoints?.length ?? 0}`)
  }

  let latestImport = dashboard.imports?.[0] ?? null
  assert(latestImport, 'proof import should exist after prewarm import creation')

  if (latestImport.status !== 'validated' && latestImport.status !== 'approved') {
    await adminApiRequest(`/api/admin/proof-imports/${encodeURIComponent(latestImport.curriculumImportVersionId)}/validate`, {
      method: 'POST',
    })
    dashboard = await readProofDashboard()
    console.log(`[smoke] proof dashboard after import validate: status=${dashboard.imports?.[0]?.status ?? 'unknown'} checkpoints=${dashboard.activeRunDetail?.checkpoints?.length ?? 0}`)
    latestImport = dashboard.imports?.[0] ?? latestImport
  }

  if ((dashboard.crosswalkReviewQueue?.length ?? 0) > 0) {
    await adminApiRequest(`/api/admin/proof-imports/${encodeURIComponent(latestImport.curriculumImportVersionId)}/review-crosswalks`, {
      method: 'POST',
      body: JSON.stringify({
        reviews: dashboard.crosswalkReviewQueue.map(item => ({
          officialCodeCrosswalkId: item.officialCodeCrosswalkId,
          reviewStatus: 'accepted-with-note',
          overrideReason: 'Deterministic Firefox proof smoke prewarm.',
        })),
      }),
    })
    dashboard = await readProofDashboard()
    console.log(`[smoke] proof dashboard after crosswalk review: queue=${dashboard.crosswalkReviewQueue?.length ?? 0} checkpoints=${dashboard.activeRunDetail?.checkpoints?.length ?? 0}`)
    latestImport = dashboard.imports?.[0] ?? latestImport
  }

  if (latestImport.status !== 'approved') {
    await adminApiRequest(`/api/admin/proof-imports/${encodeURIComponent(latestImport.curriculumImportVersionId)}/approve`, {
      method: 'POST',
    })
    dashboard = await readProofDashboard()
    console.log(`[smoke] proof dashboard after import approval: status=${dashboard.imports?.[0]?.status ?? 'unknown'} checkpoints=${dashboard.activeRunDetail?.checkpoints?.length ?? 0}`)
    latestImport = dashboard.imports?.find(item => item.status === 'approved') ?? dashboard.imports?.[0] ?? latestImport
  }

  if (!dashboard.activeRunDetail?.checkpoints?.length && dashboard.activeRunDetail?.simulationRunId) {
    console.log(`[smoke] active proof run ${dashboard.activeRunDetail.simulationRunId} is missing checkpoints, recomputing seeded baseline risk artifacts`)
    await adminApiRequest(`/api/admin/proof-runs/${encodeURIComponent(dashboard.activeRunDetail.simulationRunId)}/recompute-risk`, {
      method: 'POST',
    })
    dashboard = await waitForProofCheckpoints('recompute-risk prewarm', 120_000).catch(async error => {
      console.log(`[smoke] recompute-risk prewarm did not materialize checkpoints: ${error instanceof Error ? error.message : String(error)}`)
      return readProofDashboard()
    })
    console.log(`[smoke] proof dashboard after seeded baseline recompute: activeRun=${dashboard.activeRunDetail?.simulationRunId ?? 'none'} checkpoints=${dashboard.activeRunDetail?.checkpoints?.length ?? 0}`)
  }

  if (!dashboard.activeRunDetail?.checkpoints?.length) {
    console.log('[smoke] active proof run is missing checkpoints, creating a fresh activated proof run')
    await adminApiRequest(`/api/admin/batches/${proofRouteState.batchId}/proof-runs`, {
      method: 'POST',
      body: JSON.stringify({
        curriculumImportVersionId: latestImport.curriculumImportVersionId,
        activate: true,
      }),
    })
    dashboard = await waitForProofCheckpoints('proof run creation')
    console.log(`[smoke] proof dashboard after run create: activeRun=${dashboard.activeRunDetail?.simulationRunId ?? 'none'} checkpoints=${dashboard.activeRunDetail?.checkpoints?.length ?? 0}`)
  }

  assert(dashboard.activeRunDetail?.checkpoints?.length, 'proof run checkpoints should exist after prewarm')
  return dashboard
}

function visibleProofSurface(name) {
  return page.locator(`[data-proof-surface="${name}"]:visible`).first()
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
  await page.getByPlaceholder('sysadmin', { exact: true }).fill('sysadmin')
  await page.getByPlaceholder('••••••••', { exact: true }).fill('admin1234')
  await page.getByRole('button', { name: 'Sign In', exact: true }).click()
  await page.waitForTimeout(500)
  console.log(`[smoke] cookies after login: ${JSON.stringify(await context.cookies())}`)
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

function buildSeededProofRouteUrl(options = {}) {
  const { forceReload = false } = options
  const baseUrl = appUrl.replace(/\/$/, '')
  const query = forceReload ? `/?proof-reload=${Date.now()}` : '/'
  return `${baseUrl}${query}${proofRouteState.routeHash}`
}

function finalCheckpointButton(proofControlPlane) {
  return proofControlPlane
    .locator('[data-proof-action="proof-select-checkpoint"]')
    .filter({ hasText: /Post SEE/i })
    .last()
}

async function openSeededProofRoute() {
  await waitForSystemAdminShellReady()
  await primeSeededProofRouteState()
  const seededRouteUrl = buildSeededProofRouteUrl()
  console.log(`[smoke] opening seeded proof route: ${seededRouteUrl}`)
  await page.goto(seededRouteUrl, { waitUntil: 'domcontentloaded' })
  await page.waitForFunction(expectedHash => window.location.hash === expectedHash, proofRouteState.routeHash)
  await page.waitForTimeout(500)
  const batchNotFound = page.getByText('Batch not found', { exact: true }).first()
  const batchNotFoundVisible = await batchNotFound.isVisible().catch(() => false)
  if (batchNotFoundVisible) {
    throw new Error(`Proof batch route ${proofRouteState.routeHash} resolved to "Batch not found"`)
  }
  let proofControlPlane = visibleProofSurface('system-admin-proof-control-plane')
  if (!(await proofControlPlane.isVisible().catch(() => false))) {
    const overviewTab = page.locator('button[data-tab="true"]').filter({ hasText: 'Overview' }).first()
    await expectVisible(overviewTab, 'batch overview workspace tab')
    console.log('[smoke] opening seeded proof batch overview tab')
    await overviewTab.click()
    await page.waitForTimeout(250)
  }
  await expectVisible(proofControlPlane, 'system admin proof control plane')
  await expectContainerText(proofControlPlane, /Proof Control Plane/i, 'system admin proof control plane heading')
  let checkpointPlayback = proofControlPlane.locator('[data-proof-section="checkpoint-playback"]')
  if (!(await checkpointPlayback.isVisible().catch(() => false))) {
    console.log('[smoke] checkpoint playback missing, verifying proof controls and prewarming through admin endpoints')
    await expectVisible(proofControlPlane.getByRole('button', { name: 'Create Import', exact: true }), 'Create Import proof action')
    await expectVisible(proofControlPlane.getByRole('button', { name: 'Validate Import', exact: true }), 'Validate Import proof action')
    await expectVisible(proofControlPlane.getByRole('button', { name: 'Review Mappings', exact: true }), 'Review Mappings proof action')
    await expectVisible(proofControlPlane.getByRole('button', { name: 'Approve Import', exact: true }), 'Approve Import proof action')
    await expectVisible(proofControlPlane.getByRole('button', { name: 'Run / Rerun', exact: true }), 'Run / Rerun proof action')
	    await ensureProofRunReady()
	    const reloadedSeededRouteUrl = buildSeededProofRouteUrl({ forceReload: true })
	    console.log(`[smoke] reopening seeded proof route after server-side prewarm: ${reloadedSeededRouteUrl}`)
	    await page.goto(reloadedSeededRouteUrl, { waitUntil: 'domcontentloaded' })
	    await page.waitForFunction(expectedHash => window.location.hash === expectedHash, proofRouteState.routeHash)
	    await page.waitForTimeout(500)
    proofControlPlane = visibleProofSurface('system-admin-proof-control-plane')
    checkpointPlayback = proofControlPlane.locator('[data-proof-section="checkpoint-playback"]')
    await expectVisible(proofControlPlane, 'system admin proof control plane after prewarm', 180_000)
    await checkpointPlayback.waitFor({ state: 'visible', timeout: 180_000 })
    await page.waitForTimeout(500)
  }
  await checkpointPlayback.waitFor({ state: 'visible', timeout: 180_000 })
  await expectVisible(finalCheckpointButton(proofControlPlane), 'post-see checkpoint button')
  return proofControlPlane
}

async function selectFinalCheckpoint(proofControlPlane) {
  await focusAndActivate(finalCheckpointButton(proofControlPlane), 'post-see checkpoint button')
}

async function verifyPlaybackSelectionPersisted(expectedLabel, proofControlPlane = page.locator('[data-proof-surface="system-admin-proof-control-plane"]')) {
  const selection = await readPlaybackSelectionParsed()
  console.log(`[smoke] stored playback selection: ${JSON.stringify(selection)}`)
  const banner = proofControlPlane.locator('[data-proof-section="selected-checkpoint-banner"]')
  await expectVisible(banner, 'selected checkpoint banner')
  console.log(`[smoke] selected checkpoint banner: ${(await banner.textContent().catch(() => '') ?? '').replace(/\\s+/g, ' ').trim()}`)
  await expectContainerText(banner, /Selected checkpoint:/i, 'selected checkpoint summary banner')
  await expectContainerText(banner, new RegExp(expectedLabel, 'i'), `${expectedLabel} selected checkpoint banner`)
}

async function openFacultyProfileProofPanel() {
  const teacherProofPanel = visibleProofSurface('teacher-proof-panel')
  if (await teacherProofPanel.isVisible().catch(() => false)) return teacherProofPanel
  const facultyProfileButton = page.locator('[data-proof-action="open-faculty-profile"]').first()
  await focusAndActivate(facultyProfileButton, 'faculty profile navigation')
  await expectVisible(teacherProofPanel, 'teacher proof panel')
  return teacherProofPanel
}

try {
  markStep('login-system-admin')
  await loginAsSystemAdmin()
  await discoverProofRouteState()

  markStep('open-seeded-proof-route')
  const proofControlPlane = await openSeededProofRoute()
  markStep('select-s6-semester-close')
  await selectFinalCheckpoint(proofControlPlane)
  await verifyPlaybackSelectionPersisted(finalCheckpointLabel, proofControlPlane)
  markStep('reload-system-admin-proof-route')
  const refreshedSeededRouteUrl = buildSeededProofRouteUrl({ forceReload: true })
  console.log(`[smoke] refreshing seeded proof route: ${refreshedSeededRouteUrl}`)
  await page.goto(refreshedSeededRouteUrl, { waitUntil: 'domcontentloaded' })
  await page.waitForFunction(expectedHash => window.location.hash === expectedHash, proofRouteState.routeHash)
  await page.waitForTimeout(500)

  markStep('reopen-seeded-proof-route-after-reload')
  const reloadedProofControlPlane = await openSeededProofRoute()
  await verifyPlaybackSelectionPersisted(finalCheckpointLabel, reloadedProofControlPlane)
  await saveContainerScreenshot(reloadedProofControlPlane, screenshots.systemAdmin, 'system admin proof control plane')

  const storedSelectionAfterReload = await readPlaybackSelectionParsed()

  if (isLiveStack) {
    console.log('[smoke] live stack: system-admin proof control plane and checkpoint restore validated; teacher and student proof surfaces are covered by the dedicated live parity, accessibility, and keyboard suites.')
  } else {
    markStep('logout-system-admin')
    await page.getByRole('button', { name: 'Logout', exact: true }).click()
    await expectVisible(page.getByRole('button', { name: /Open Academic Portal/i }), 'portal selector')

    markStep('login-academic-portal')
    await page.getByRole('button', { name: /Open Academic Portal/i }).click()
    await expectVisible(page.getByText(/Teaching Workspace Live Mode/), 'academic login')
    await page.locator('#teacher-username').fill('devika.shetty')
    await page.locator('#teacher-password').fill('faculty1234')
    await page.getByRole('button', { name: 'Sign In', exact: true }).click()

    markStep('switch-to-course-leader')
    const courseLeaderRoleButton = page.locator('[data-proof-action="switch-role"][data-proof-entity-id="Course Leader"]').first()
    await expectVisible(courseLeaderRoleButton, 'Course Leader role switcher')
    await courseLeaderRoleButton.click()
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(400)

    markStep('open-faculty-proof-panel')
    const teacherProofPanel = await openFacultyProfileProofPanel()
    await expectProofCheckpointIdentity(teacherProofPanel, storedSelectionAfterReload.simulationStageCheckpointId, 'teacher proof panel')
    await expectContainerText(teacherProofPanel, /Proof Control Plane/i, 'teacher proof control plane heading')
    const teacherCheckpointOverlay = teacherProofPanel.locator('[data-proof-section="checkpoint-overlay"]')
    await expectVisible(teacherCheckpointOverlay, 'teacher checkpoint overlay')
    await expectContainerText(teacherCheckpointOverlay, /Checkpoint overlay/i, 'teacher checkpoint overlay heading')
    await expectContainerText(teacherCheckpointOverlay, /Post SEE/i, 'teacher checkpoint playback sync')
    await saveContainerScreenshot(teacherProofPanel, screenshots.teacher, 'teacher proof panel')

    markStep('open-teacher-risk-explorer')
    const teacherMonitoringQueue = teacherProofPanel.locator('[data-proof-section="monitoring-queue"]').first()
    await expectVisible(teacherMonitoringQueue, 'teacher monitoring queue')
    const teacherMonitoringRow = teacherMonitoringQueue.locator('[data-proof-row="teacher-monitoring-item"]').first()
    const monitoringRowVisible = await teacherMonitoringRow.isVisible().catch(() => false)
    const teacherRiskExplorerSource = monitoringRowVisible
      ? teacherMonitoringRow
      : teacherProofPanel.locator('[data-proof-row="teacher-elective-fit"]').first()
    await expectVisible(
      teacherRiskExplorerSource,
      monitoringRowVisible ? 'teacher monitoring queue row' : 'teacher elective fit row',
    )
    const trackedStudentId = await readRequiredAttribute(
      teacherRiskExplorerSource,
      'data-proof-student-id',
      monitoringRowVisible ? 'teacher monitoring queue row' : 'teacher elective fit row',
    )
    const teacherRiskExplorerButton = teacherRiskExplorerSource.locator('[data-proof-action="teacher-proof-open-risk-explorer"]').first()
    await focusAndActivate(teacherRiskExplorerButton, 'teacher risk explorer action')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(500)

    const teacherRiskExplorerSurface = visibleProofSurface('risk-explorer')
    markStep('assert-teacher-risk-explorer')
    await expectVisible(teacherRiskExplorerSurface, 'risk explorer surface', 60_000)
    await expectProofCheckpointIdentity(teacherRiskExplorerSurface, storedSelectionAfterReload.simulationStageCheckpointId, 'teacher risk explorer')
    await expectProofStudentIdentity(teacherRiskExplorerSurface, trackedStudentId, 'teacher risk explorer')
    await expectContainerText(teacherRiskExplorerSurface, /Student Success Profile/i, 'risk explorer hero heading')
    await expectContainerText(teacherRiskExplorerSurface, /Sem 6 · Post SEE/i, 'risk explorer checkpoint sync')
    const advancedDiagnosticsTab = page.getByRole('tab', { name: 'Advanced Diagnostics', exact: true }).first()
    await focusAndActivate(advancedDiagnosticsTab, 'advanced diagnostics tab')
    await waitForProofHeading('Trained Risk Heads', 60_000)
    await waitForProofHeading('Policy Comparison', 60_000)
    await saveContainerScreenshot(teacherRiskExplorerSurface, screenshots.teacherRiskExplorer, 'teacher risk explorer surface')

    markStep('return-from-teacher-risk-explorer')
    const backButton = page.locator('[data-proof-action="risk-explorer-back"]').first()
    await focusAndActivate(backButton, 'risk explorer back button')
    await expectVisible(teacherProofPanel, 'teacher proof panel after returning from risk explorer')
    await expectContainerText(teacherProofPanel, 'Post SEE', 'teacher checkpoint persistence after risk explorer return')

    markStep('open-teacher-student-shell')
    const teacherStudentShellButton = teacherRiskExplorerSource.locator('[data-proof-action="teacher-proof-open-student-shell"]').first()
    await focusAndActivate(teacherStudentShellButton, 'teacher student shell action')

    const studentShellSurface = visibleProofSurface('student-shell')
    markStep('assert-student-shell')
    await expectVisible(studentShellSurface, 'student shell surface')
    await expectProofCheckpointIdentity(studentShellSurface, storedSelectionAfterReload.simulationStageCheckpointId, 'student shell')
    await expectProofStudentIdentity(studentShellSurface, trackedStudentId, 'student shell')
    await expectContainerText(studentShellSurface, /Student Shell/i, 'student shell heading')
    await expectContainerText(studentShellSurface, /deterministic proof explainer/i, 'student shell subtitle')
    await waitForProofHeading('No-action comparator')
    await expectContainerText(studentShellSurface, /Sem 6 · Post SEE/i, 'student shell checkpoint sync')
    await saveContainerScreenshot(studentShellSurface, screenshots.studentShell, 'student shell surface')

    const shellSelection = await readPlaybackSelectionParsed()
    assert.equal(shellSelection.simulationRunId, storedSelectionAfterReload.simulationRunId, 'run selection should persist across teacher and shell navigation')
    assert.equal(shellSelection.simulationStageCheckpointId, storedSelectionAfterReload.simulationStageCheckpointId, 'checkpoint selection should persist across teacher and shell navigation')

    markStep('return-from-student-shell')
    await focusAndActivate(page.locator('[data-proof-action="student-shell-back"]').first(), 'student shell back button')
    await expectVisible(teacherProofPanel, 'teacher proof panel after returning from student shell')

    markStep('switch-to-hod')
    const hodRoleButton = page.locator('[data-proof-action="switch-role"][data-proof-entity-id="HoD"]').first()
    await expectVisible(hodRoleButton, 'HoD role switcher')
    await hodRoleButton.click()
    await page.waitForLoadState('networkidle')
    const hodProofAnalytics = await waitForSurfaceAfterOptionalLoading('hod-proof-analytics', /Loading live HoD proof analytics/i, 120_000)
    markStep('assert-hod-proof-analytics')
    await expectProofCheckpointIdentity(hodProofAnalytics, storedSelectionAfterReload.simulationStageCheckpointId, 'HoD proof analytics')
    await expectContainerText(hodProofAnalytics, /Live HoD Analytics/i, 'HoD heading')
    await expectContainerText(hodProofAnalytics, /Post SEE/i, 'HoD checkpoint sync')
    await saveContainerScreenshot(hodProofAnalytics, screenshots.hod, 'HoD proof analytics')

    markStep('open-hod-student-shell')
    const hodOverviewStudents = page.locator('[data-proof-section="hod-overview-students"]').first()
    await expectVisible(hodOverviewStudents, 'HoD overview students section', 60_000)
    const hodViewAllButton = hodOverviewStudents.getByRole('button', { name: /^View All$/i }).first()
    const hodViewAllVisible = await hodViewAllButton.isVisible().catch(() => false)
    if (hodViewAllVisible) {
      await hodViewAllButton.click()
      await page.waitForTimeout(250)
    }
    const hodStudentRow = hodOverviewStudents.locator(`[data-proof-row="hod-student-row"][data-proof-student-id="${trackedStudentId}"]`).first()
    const hodTrackedStudentRow = await hodStudentRow.isVisible().catch(() => false)
      ? hodStudentRow
      : hodOverviewStudents.locator('[data-proof-row="hod-student-row"]').first()
    const hodTrackedStudentRowVisible = await hodTrackedStudentRow.isVisible().catch(() => false)
    if (!hodTrackedStudentRowVisible) {
      await expectContainerText(
        hodOverviewStudents,
        /No students are in the current HoD watchlist for this scope\./i,
        'HoD empty watchlist state',
      )
      console.log('[smoke] HoD watchlist is empty at this checkpoint; skipping student-shell and risk-explorer subflow.')
    } else {
      const hodTrackedStudentId = await readRequiredAttribute(hodTrackedStudentRow, 'data-proof-student-id', 'HoD tracked student row')
      const hodStudentShellButton = hodTrackedStudentRow.locator('[data-proof-action="hod-open-student-shell"]').first()
      await focusAndActivate(hodStudentShellButton, 'HoD student shell action')
      await page.waitForLoadState('networkidle')
      await page.waitForTimeout(500)

      markStep('assert-hod-student-shell')
      const hodStudentShellSurface = visibleProofSurface('student-shell')
      await expectVisible(hodStudentShellSurface, 'HoD student shell surface')
      await expectProofCheckpointIdentity(hodStudentShellSurface, storedSelectionAfterReload.simulationStageCheckpointId, 'HoD student shell')
      await expectProofStudentIdentity(hodStudentShellSurface, hodTrackedStudentId, 'HoD student shell')
      await waitForProofHeading('Student Shell', 60_000)
      await waitForProofHeading('No-action comparator', 60_000)

      markStep('return-from-hod-student-shell')
      await focusAndActivate(page.locator('[data-proof-action="student-shell-back"]').first(), 'HoD student shell back button')
      await expectVisible(hodProofAnalytics, 'HoD proof analytics after returning from student shell')

      markStep('open-hod-risk-explorer')
      const hodOverviewStudentsAfterReturn = page.locator('[data-proof-section="hod-overview-students"]').first()
      await expectVisible(hodOverviewStudentsAfterReturn, 'HoD overview students section after returning from student shell', 60_000)
      const hodViewAllAfterReturnButton = hodOverviewStudentsAfterReturn.getByRole('button', { name: /^View All$/i }).first()
      const hodViewAllAfterReturnVisible = await hodViewAllAfterReturnButton.isVisible().catch(() => false)
      if (hodViewAllAfterReturnVisible) {
        await hodViewAllAfterReturnButton.click()
        await page.waitForTimeout(250)
      }
      const hodStudentRowAfterReturn = hodOverviewStudentsAfterReturn.locator(
        `[data-proof-row="hod-student-row"][data-proof-student-id="${hodTrackedStudentId}"]`,
      ).first()
      const hodTrackedStudentRowAfterReturn = await hodStudentRowAfterReturn.isVisible().catch(() => false)
        ? hodStudentRowAfterReturn
        : hodOverviewStudentsAfterReturn.locator('[data-proof-row="hod-student-row"]').first()
      await expectVisible(hodTrackedStudentRowAfterReturn, 'HoD tracked student row after returning from student shell')
      const hodTrackedStudentIdAfterReturn = await readRequiredAttribute(
        hodTrackedStudentRowAfterReturn,
        'data-proof-student-id',
        'HoD tracked student row after returning from student shell',
      )
      const hodRiskExplorerButton = hodTrackedStudentRowAfterReturn.locator('[data-proof-action="hod-open-risk-explorer"]').first()
      await focusAndActivate(hodRiskExplorerButton, 'HoD risk explorer action')
      await page.waitForLoadState('networkidle')
      await page.waitForTimeout(500)

      markStep('assert-hod-risk-explorer')
      const hodRiskExplorerSurface = visibleProofSurface('risk-explorer')
      await expectVisible(hodRiskExplorerSurface, 'risk explorer surface from HoD')
      await expectProofCheckpointIdentity(hodRiskExplorerSurface, storedSelectionAfterReload.simulationStageCheckpointId, 'HoD risk explorer')
      await expectProofStudentIdentity(hodRiskExplorerSurface, hodTrackedStudentIdAfterReturn, 'HoD risk explorer')
      await expectContainerText(hodRiskExplorerSurface, /Student Success Profile/i, 'HoD risk explorer hero heading')
      await waitForProofHeading('Top Observable Drivers', 60_000)
      await expectContainerText(hodRiskExplorerSurface, /Sem 6 · Post SEE/i, 'HoD risk explorer checkpoint sync')
      await saveContainerScreenshot(hodRiskExplorerSurface, screenshots.hodRiskExplorer, 'HoD risk explorer surface')
    }
  }

  console.log(`System admin proof-risk smoke passed.`)
  console.log(`Screenshots:`)
  for (const [label, screenshotPath] of Object.entries(screenshots)) {
    console.log(`- ${label}: ${screenshotPath}`)
  }
  await context.tracing.stop()
} catch (error) {
  try {
    console.error(`[smoke] current step: ${currentStep}`)
    console.error(`[smoke] failure url: ${page.url()}`)
    const html = await page.content().catch(() => '')
    if (html) {
      await writeFile(failureHtml, html, 'utf8')
      console.error(`Failure HTML: ${failureHtml}`)
    }
    await page.screenshot({ path: failureScreenshot, fullPage: true })
    await context.tracing.stop({ path: failureTrace })
    console.error(`System admin proof-risk smoke failed. Screenshot: ${failureScreenshot}`)
    console.error(`Trace: ${failureTrace}`)
  } catch {
    // Ignore screenshot/trace failures to preserve the root error.
  }
  throw error
} finally {
  await browser.close()
}
