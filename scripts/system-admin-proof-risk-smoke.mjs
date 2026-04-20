import assert from 'node:assert/strict'
import { copyFile, mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import {
  buildSemesterProofSummaryPath,
  buildSemesterScopedArtifactPath as buildSemesterScopedArtifactCopyPath,
  parseProofTargetSemester,
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
const proofCoverageTargetRaw = (process.env.AIRMENTOR_PROOF_COVERAGE_TARGET ?? 'full').trim().toLowerCase()
const proofCoverageTarget = proofCoverageTargetRaw === 'teaching'
  ? 'teacher'
  : proofCoverageTargetRaw
assert(
  proofCoverageTarget === 'full' || proofCoverageTarget === 'teacher',
  `Unsupported AIRMENTOR_PROOF_COVERAGE_TARGET: ${proofCoverageTargetRaw}`,
)

assert(playwrightRoot, 'PLAYWRIGHT_ROOT is required')

const { firefox } = await import(`file://${playwrightRoot}/lib/node_modules/playwright/index.mjs`)

const proofPlaybackSelectionStorageKey = 'airmentor-proof-playback-selection'
const seededProofRoute = '#/admin/faculties/academic_faculty_engineering_and_technology/departments/dept_cse/branches/branch_mnc_btech/batches/batch_branch_mnc_btech_2023'
const seededProofBatchId = 'batch_branch_mnc_btech_2023'
const proofTargetSemesterRaw = (process.env.AIRMENTOR_PROOF_TARGET_SEMESTER ?? '').trim()
const proofArtifactPrefixRaw = (process.env.AIRMENTOR_PROOF_ARTIFACT_PREFIX ?? '').trim()
const proofTeacherUsername = process.env.AIRMENTOR_LIVE_TEACHER_IDENTIFIER?.trim()
  || (isLiveStack ? 'kavitha.rao' : 'devika.shetty')
const teachingPasswordCandidates = ['faculty1234', '1234']
let proofRouteState = {
  routeHash: seededProofRoute,
  batchId: seededProofBatchId,
}
let targetCheckpointDescriptor = null
const systemAdminCredentials = resolveSystemAdminLiveCredentials({
  scriptLabel: 'System admin proof-risk smoke',
})
const targetedProofSemester = parseProofTargetSemester(proofTargetSemesterRaw)

const proofArtifactPrefix = proofArtifactPrefixRaw.length > 0
  ? sanitizeArtifactPrefix(proofArtifactPrefixRaw)
  : null

await mkdir(outputDir, { recursive: true })

const screenshots = {
  systemAdmin: path.join(outputDir, 'system-admin-proof-control-plane.png'),
  teacher: path.join(outputDir, 'teacher-proof-panel.png'),
  teacherRiskExplorer: path.join(outputDir, 'teacher-risk-explorer-proof.png'),
  hod: path.join(outputDir, 'hod-proof-analytics.png'),
  hodRiskExplorer: path.join(outputDir, 'hod-risk-explorer-proof.png'),
  studentShell: path.join(outputDir, 'student-shell-proof.png'),
}
const capturedScreenshots = {}
const activationArtifactStem = isLiveStack
  ? 'system-admin-proof-semester-activation-live'
  : 'system-admin-proof-semester-activation-local'
const activationArtifacts = {
  request: path.join(outputDir, `${activationArtifactStem}-request.json`),
  response: path.join(outputDir, `${activationArtifactStem}-response.json`),
}
const failureScreenshot = path.join(outputDir, 'system-admin-proof-risk-smoke-failure.png')
const failureTrace = path.join(outputDir, 'system-admin-proof-risk-smoke-failure.zip')
const failureHtml = path.join(outputDir, 'system-admin-proof-risk-smoke-failure.html')
let currentStep = 'launch-browser'
let activatedProofSemesterContext = null
let proofWalkSummary = null

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

async function resolveTeachingPassword(username) {
  return resolveTeachingPasswordViaSession({
    appUrl,
    apiUrl,
    username,
    candidates: teachingPasswordCandidates,
    logPrefix: 'proof-risk',
  })
}

function markStep(label) {
  currentStep = label
  console.log(`[smoke] step: ${label}`)
}

async function waitForSessionCookies(requestUrl, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const requestCookies = await context.cookies(requestUrl, appUrl, apiUrl)
    if (requestCookies.some(cookie => cookie.name === 'airmentor_session')) {
      return requestCookies
    }
    await page.waitForTimeout(250)
  }
  return context.cookies(requestUrl, appUrl, apiUrl)
}

async function expectContainerText(container, pattern, description) {
  const locator = typeof pattern === 'string'
    ? container.getByText(pattern).first()
    : container.getByText(pattern).first()
  await expectVisible(locator, description)
}

async function writeJsonArtifact(filePath, payload) {
  await writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')
}

function buildSemesterScopedArtifactPath(filePath) {
  if (!proofArtifactPrefix) return null
  if (targetedProofSemester == null) {
    return path.join(path.dirname(filePath), `${proofArtifactPrefix}-${path.basename(filePath)}`)
  }
  return buildSemesterScopedArtifactCopyPath(filePath, proofArtifactPrefix, targetedProofSemester)
}

function buildSemesterWalkSummaryPath() {
  if (!proofArtifactPrefix) return null
  if (targetedProofSemester == null) {
    return path.join(outputDir, `${proofArtifactPrefix}-proof-risk-smoke-summary.json`)
  }
  return buildSemesterProofSummaryPath(outputDir, proofArtifactPrefix, targetedProofSemester)
}

async function copySemesterScopedArtifact(filePath) {
  const targetPath = buildSemesterScopedArtifactPath(filePath)
  if (!targetPath) return null
  try {
    await copyFile(filePath, targetPath)
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') return null
    throw error
  }
  return targetPath
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
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

async function captureProofScreenshot(label, container, description) {
  const filePath = screenshots[label]
  await saveContainerScreenshot(container, filePath, description)
  capturedScreenshots[label] = filePath
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

function isTransientAdminApiFailure(error) {
  const message = error instanceof Error ? error.message : String(error)
  return /failed with (502|503|504)/i.test(message)
    || /application failed to respond/i.test(message)
    || /timed out/i.test(message)
    || /abort/i.test(message)
}

async function adminApiRequest(apiPath, init = {}) {
  const { body, ...restInit } = init
  const requestUrl = new URL(apiPath, apiUrl).toString()
  const browserRequestUrl = new URL(apiPath, appUrl).toString()
  const timeoutMs = typeof restInit.timeout === 'number' ? restInit.timeout : 180_000
  if (!isLiveStack) {
    const payload = await page.evaluate(async request => {
      const controller = new AbortController()
      const timeoutHandle = setTimeout(() => controller.abort(), request.timeoutMs)
      try {
        const csrfToken = document.cookie
          .split('; ')
          .find(item => item.startsWith('airmentor_csrf='))
          ?.slice('airmentor_csrf='.length) ?? null
        const response = await fetch(request.requestUrl, {
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
          signal: controller.signal,
        })
        return {
          ok: response.ok,
          status: response.status,
          contentType: response.headers.get('content-type') ?? '',
          text: await response.text().catch(() => ''),
        }
      } finally {
        clearTimeout(timeoutHandle)
      }
    }, {
      requestUrl: browserRequestUrl,
      method: restInit.method ?? 'GET',
      body,
      headers: restInit.headers ?? null,
      timeoutMs,
    })
    if (!payload.ok) {
      throw new Error(`Admin API ${apiPath} failed with ${payload.status}: ${payload.text.slice(0, 800)}`)
    }
    return payload.contentType.includes('application/json')
      ? JSON.parse(payload.text)
      : payload.text
  }
  const requestCookies = await waitForSessionCookies(requestUrl)
  const csrfToken = requestCookies.find(cookie => cookie.name === 'airmentor_csrf')?.value ?? null
  const cookieHeader = requestCookies.map(cookie => `${cookie.name}=${cookie.value}`).join('; ')
  const controller = new AbortController()
  const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs)
  let response
  try {
    // Always issue admin proof requests from Node with the browser session cookies.
    // On the deployed Pages -> Railway path the API-domain CSRF cookie is not visible
    // to `document.cookie`, so browser-origin POSTs can fail even though the session is valid.
    response = await fetch(requestUrl, {
      method: restInit.method ?? 'GET',
      headers: {
        accept: 'application/json',
        origin: new URL(appUrl).origin,
        ...(csrfToken ? { 'x-airmentor-csrf': decodeURIComponent(csrfToken) } : {}),
        ...(cookieHeader ? { cookie: cookieHeader } : {}),
        ...(body === undefined ? {} : { 'content-type': 'application/json' }),
        ...(restInit.headers ?? {}),
      },
      body: body === undefined
        ? undefined
        : typeof body === 'string'
          ? body
          : JSON.stringify(body),
      signal: controller.signal,
    })
  } finally {
    clearTimeout(timeoutHandle)
  }
  const payload = {
    ok: response.ok,
    status: response.status,
    contentType: response.headers.get('content-type') ?? '',
    text: await response.text().catch(() => ''),
  }
  if (!payload.ok) {
    throw new Error(`Admin API ${apiPath} failed with ${payload.status}: ${payload.text.slice(0, 800)}`)
  }
  if (payload.contentType.includes('application/json')) {
    return JSON.parse(payload.text)
  }
  return payload.text
}

async function readProofDashboard(batchId = proofRouteState.batchId) {
  const apiPath = `/api/admin/batches/${batchId}/proof-dashboard`
  const maxAttempts = isLiveStack ? 4 : 1
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await adminApiRequest(apiPath)
    } catch (error) {
      if (attempt >= maxAttempts || !isTransientAdminApiFailure(error)) throw error
      const waitMs = 1_500 * attempt
      console.log(`[smoke] transient proof dashboard read failure on attempt ${attempt}/${maxAttempts}: ${error instanceof Error ? error.message : String(error)}; retrying in ${waitMs}ms`)
      await page.waitForTimeout(waitMs)
    }
  }
  throw new Error(`Proof dashboard read exhausted retries for ${apiPath}`)
}

async function discoverProofRouteState() {
  if (!isLiveStack) return proofRouteState

  try {
    const seededDashboard = await readProofDashboard(seededProofBatchId)
    proofRouteState = {
      routeHash: seededProofRoute,
      batchId: seededProofBatchId,
    }
    console.log(`[smoke] live proof route pinned to seeded batch: batch=${seededProofBatchId} checkpoints=${seededDashboard.activeRunDetail?.checkpoints?.length ?? 0} proofRuns=${seededDashboard.proofRuns?.length ?? 0} imports=${seededDashboard.imports?.length ?? 0}`)
    return proofRouteState
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.log(`[smoke] seeded proof batch probe failed, falling back to live discovery: ${message}`)
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

async function activateProofSemesterForContract() {
  const dashboardBefore = await ensureProofRunReady()
  const activeRun = dashboardBefore.activeRunDetail
  assert(activeRun?.simulationRunId, 'proof dashboard should expose an active run before semester activation')

  const availableSemesters = Array.from(new Set(
    (activeRun.checkpoints ?? [])
      .map(item => item.semesterNumber)
      .filter(value => Number.isFinite(value)),
  )).sort((left, right) => left - right)
  assert(availableSemesters.length > 0, 'proof dashboard should expose at least one operational semester before activation')
  if (targetedProofSemester != null) {
    assert(
      availableSemesters.includes(targetedProofSemester),
      `proof dashboard does not expose targeted semester ${targetedProofSemester}; available semesters: ${availableSemesters.join(', ')}`,
    )
  }

  const previousOperationalSemester = activeRun.activeOperationalSemester ?? null
  const targetOperationalSemester = targetedProofSemester
    ?? availableSemesters.find(value => value === 4 && value !== previousOperationalSemester)
    ?? availableSemesters.find(value => value !== previousOperationalSemester)
    ?? availableSemesters[0]

  assert.equal(typeof targetOperationalSemester, 'number', 'proof semester activation should resolve a target semester')

  const requestPayload = {
    simulationRunId: activeRun.simulationRunId,
    batchId: proofRouteState.batchId,
    availableSemesters,
    previousOperationalSemester,
    semesterNumber: targetOperationalSemester,
  }
  await writeJsonArtifact(activationArtifacts.request, requestPayload)

  const responsePayload = await adminApiRequest(
    `/api/admin/proof-runs/${encodeURIComponent(activeRun.simulationRunId)}/activate-semester`,
    {
      method: 'POST',
      body: {
        semesterNumber: targetOperationalSemester,
      },
    },
  )
  await writeJsonArtifact(activationArtifacts.response, responsePayload)

  assert.equal(responsePayload.simulationRunId, activeRun.simulationRunId, 'semester activation response should target the active run')
  assert.equal(responsePayload.batchId, proofRouteState.batchId, 'semester activation response should target the seeded proof batch')
  assert.equal(
    responsePayload.activeOperationalSemester,
    targetOperationalSemester,
    'semester activation response should surface the requested operational semester',
  )

  const dashboardAfter = await readProofDashboard()
  assert.equal(
    dashboardAfter.activeRunDetail?.activeOperationalSemester,
    targetOperationalSemester,
    'proof dashboard should expose the activated operational semester after activation',
  )

  activatedProofSemesterContext = {
    simulationRunId: activeRun.simulationRunId,
    batchId: proofRouteState.batchId,
    availableSemesters,
    previousOperationalSemester,
    activeOperationalSemester: targetOperationalSemester,
  }
  console.log(`[smoke] activated proof operational semester ${targetOperationalSemester} for run ${activeRun.simulationRunId} (previous=${previousOperationalSemester ?? 'none'})`)
  console.log(`[smoke] activation request artifact: ${activationArtifacts.request}`)
  console.log(`[smoke] activation response artifact: ${activationArtifacts.response}`)
  return activatedProofSemesterContext
}

async function restoreActivatedProofSemester() {
  if (!activatedProofSemesterContext) return

  const {
    simulationRunId,
    previousOperationalSemester,
    activeOperationalSemester,
    availableSemesters,
  } = activatedProofSemesterContext

  if (
    previousOperationalSemester == null
    || previousOperationalSemester === activeOperationalSemester
    || !availableSemesters.includes(previousOperationalSemester)
  ) {
    return
  }

  await adminApiRequest(
    `/api/admin/proof-runs/${encodeURIComponent(simulationRunId)}/activate-semester`,
    {
      method: 'POST',
      body: {
        semesterNumber: previousOperationalSemester,
      },
    },
  )
  const dashboardAfterRestore = await readProofDashboard()
  assert.equal(
    dashboardAfterRestore.activeRunDetail?.activeOperationalSemester,
    previousOperationalSemester,
    'proof dashboard should restore the prior operational semester after the contract proof',
  )
  console.log(`[smoke] restored proof operational semester ${previousOperationalSemester} for run ${simulationRunId}`)
}

function visibleProofSurface(name) {
  return page.locator(`[data-proof-surface="${name}"]:visible`).first()
}

async function waitForSystemAdminShellReady() {
  const readinessChecks = [
    expectVisible(page.getByRole('button', { name: 'Logout', exact: true }), 'system admin logout action'),
    expectVisible(page.getByText(/Operations Dashboard|MNC Proof Operations|Sysadmin Control Plane/i).first(), 'system admin operations dashboard heading'),
  ]
  await Promise.any(readinessChecks)
  const facultiesButton = page.getByRole('button', { name: 'Faculties', exact: true }).first()
  if (await facultiesButton.isVisible().catch(() => false)) {
    await expectVisible(facultiesButton, 'system admin faculties rail entry')
  }
  await page.waitForTimeout(750)
}

async function resolveSystemAdminEntryState(attempt = 1) {
  await page.goto(appUrl, { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: /Open System Admin/i }).click()

  const loginHeading = page.getByText(/System Admin Live Mode/)
  const bootingBanner = page.getByText(/Restoring system admin session/i)
  const dashboardHeading = page.getByText(/Operations Dashboard|MNC Proof Operations|Sysadmin Control Plane/i).first()

  await Promise.any([
    expectVisible(loginHeading, 'system admin login', 15_000),
    expectVisible(dashboardHeading, 'system admin dashboard', 15_000),
    expectVisible(bootingBanner, 'system admin booting banner', 15_000),
  ])

  if (await dashboardHeading.isVisible().catch(() => false)) return 'shell'
  if (await loginHeading.isVisible().catch(() => false)) return 'login'

  try {
    await Promise.any([
      expectVisible(loginHeading, 'system admin login after restore', 45_000),
      waitForSystemAdminShellReady(),
    ])
  } catch (error) {
    if (attempt >= 2) throw error
    await page.goto(`${appUrl.replace(/\/$/, '')}/#/`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(1_000)
    return resolveSystemAdminEntryState(attempt + 1)
  }

  if (await dashboardHeading.isVisible().catch(() => false)) return 'shell'
  return 'login'
}

async function loginAsSystemAdmin() {
  const entryState = await resolveSystemAdminEntryState()
  if (entryState === 'shell') {
    await waitForSystemAdminShellReady()
    return
  }
  await page.getByPlaceholder('sysadmin', { exact: true }).fill(systemAdminCredentials.identifier)
  await page.getByPlaceholder('••••••••', { exact: true }).fill(systemAdminCredentials.password)
  await page.getByRole('button', { name: 'Sign In', exact: true }).click()
  await page.waitForTimeout(500)
  console.log(`[smoke] cookies after login: ${JSON.stringify(await waitForSessionCookies(apiUrl))}`)
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

function describeCheckpointDescriptor(checkpoint) {
  assert(checkpoint?.simulationStageCheckpointId, 'Target checkpoint should include a simulationStageCheckpointId')
  assert.equal(typeof checkpoint.semesterNumber, 'number', 'Target checkpoint should include a semester number')
  assert.equal(typeof checkpoint.stageLabel, 'string', 'Target checkpoint should include a stage label')
  return {
    simulationStageCheckpointId: checkpoint.simulationStageCheckpointId,
    semesterNumber: checkpoint.semesterNumber,
    stageKey: checkpoint.stageKey ?? null,
    stageLabel: checkpoint.stageLabel,
    stageDescription: checkpoint.stageDescription ?? null,
    stageOrder: typeof checkpoint.stageOrder === 'number' ? checkpoint.stageOrder : null,
    stageAdvanceBlocked: typeof checkpoint.stageAdvanceBlocked === 'boolean' ? checkpoint.stageAdvanceBlocked : null,
    blockingQueueItemCount: Number.isFinite(Number(checkpoint.blockingQueueItemCount))
      ? Number(checkpoint.blockingQueueItemCount)
      : Number.isFinite(Number(checkpoint.openQueueCount))
        ? Number(checkpoint.openQueueCount)
        : null,
    playbackAccessible: typeof checkpoint.playbackAccessible === 'boolean' ? checkpoint.playbackAccessible : null,
    blockedByCheckpointId: typeof checkpoint.blockedByCheckpointId === 'string' ? checkpoint.blockedByCheckpointId : null,
    blockedProgressionReason: typeof checkpoint.blockedProgressionReason === 'string' ? checkpoint.blockedProgressionReason : null,
    noActionHighRiskCount: Number.isFinite(Number(checkpoint.noActionHighRiskCount))
      ? Number(checkpoint.noActionHighRiskCount)
      : null,
    averageCounterfactualLiftScaled: Number.isFinite(Number(checkpoint.averageCounterfactualLiftScaled))
      ? Number(checkpoint.averageCounterfactualLiftScaled)
      : null,
    electiveVisibleCount: Number.isFinite(Number(checkpoint.electiveVisibleCount))
      ? Number(checkpoint.electiveVisibleCount)
      : null,
    buttonLabel: `S${checkpoint.semesterNumber} · ${checkpoint.stageLabel}`,
    surfaceLabel: `Sem ${checkpoint.semesterNumber} · ${checkpoint.stageLabel}`,
    bannerLabel: `semester ${checkpoint.semesterNumber} · ${checkpoint.stageLabel}`,
  }
}

async function resolveTargetCheckpointDescriptor() {
  const dashboard = await readProofDashboard()
  const checkpoints = Array.isArray(dashboard.activeRunDetail?.checkpoints)
    ? dashboard.activeRunDetail.checkpoints.slice()
    : []
  targetCheckpointDescriptor = describeCheckpointDescriptor(resolveSemesterWalkCheckpoint(checkpoints, targetedProofSemester))
  return targetCheckpointDescriptor
}

function targetCheckpointButton(proofControlPlane) {
  assert(targetCheckpointDescriptor, 'Target checkpoint descriptor must be resolved before locating the checkpoint button')
  return proofControlPlane
    .locator(`[data-proof-action="proof-select-checkpoint"][data-proof-entity-id="${targetCheckpointDescriptor.simulationStageCheckpointId}"]`)
    .first()
}

async function ensureProofControlPlaneTab(proofControlPlane, label) {
  const tab = proofControlPlane.getByRole('tab', { name: label, exact: true }).first()
  if (!(await tab.isVisible().catch(() => false))) return
  const deadline = Date.now() + 15_000
  while (Date.now() < deadline) {
    const isSelected = (await tab.getAttribute('aria-selected').catch(() => null)) === 'true'
    if (isSelected) return
    await tab.click()
    await page.waitForTimeout(250)
  }
  throw new Error(`${label} proof tab did not become selected`)
}

async function waitForCheckpointPlaybackVisible(proofControlPlane, timeout = 15_000) {
  const checkpointPlayback = proofControlPlane.locator('[data-proof-section="checkpoint-playback"]').first()
  const deadline = Date.now() + timeout
  while (Date.now() < deadline) {
    if (await checkpointPlayback.isVisible().catch(() => false)) return checkpointPlayback
    await ensureProofControlPlaneTab(proofControlPlane, 'Checkpoint')
    await page.waitForTimeout(750)
  }
  await checkpointPlayback.waitFor({ state: 'visible', timeout: 1 })
  return checkpointPlayback
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
    proofControlPlane = visibleProofSurface('system-admin-proof-control-plane')
  }
  if (!(await proofControlPlane.isVisible().catch(() => false))) {
    const openProofDashboardButton = page.getByRole('button', { name: 'Open Proof Dashboard', exact: true }).first()
    await openProofDashboardButton.waitFor({ state: 'visible', timeout: 12_000 }).catch(() => {})
    if (await openProofDashboardButton.isVisible().catch(() => false)) {
      console.log('[smoke] opening dedicated proof dashboard from the batch workspace')
      await focusAndActivate(openProofDashboardButton, 'open proof dashboard button')
      await page.waitForFunction(() => window.location.hash.startsWith('#/admin/proof-dashboard'))
      await page.waitForTimeout(350)
      proofControlPlane = visibleProofSurface('system-admin-proof-control-plane')
    } else {
      const directProofDashboardUrl = `${appUrl}/#/admin/proof-dashboard`
      console.log(`[smoke] proof dashboard shortcut unavailable, navigating directly: ${directProofDashboardUrl}`)
      await page.goto(directProofDashboardUrl, { waitUntil: 'domcontentloaded' })
      await page.waitForFunction(() => window.location.hash.startsWith('#/admin/proof-dashboard'))
      await page.waitForTimeout(350)
      proofControlPlane = visibleProofSurface('system-admin-proof-control-plane')
    }
  }
  await expectVisible(proofControlPlane, 'system admin proof control plane')
  await expectContainerText(proofControlPlane, /Simulation Controls|Proof Control Plane/i, 'system admin proof control plane heading')
  try {
    await waitForCheckpointPlaybackVisible(proofControlPlane, 15_000)
  } catch {
    console.log('[smoke] checkpoint playback missing, verifying proof controls and prewarming through admin endpoints')
    const proofActionSelectors = [
      '[data-proof-action="proof-create-import"]',
      '[data-proof-action="proof-run-rerun"]',
      '[data-proof-action="proof-recompute-risk"]',
    ]
    for (const selector of proofActionSelectors) {
      const actionVisible = await proofControlPlane
        .locator(selector)
        .first()
        .isVisible()
        .catch(() => false)
      console.log(`[smoke] proof action "${selector}" visible=${actionVisible}`)
    }
    await ensureProofRunReady()
    const reloadedProofDashboardUrl = `${appUrl}/#/admin/proof-dashboard`
    console.log(`[smoke] reopening dedicated proof dashboard after server-side prewarm: ${reloadedProofDashboardUrl}`)
    await page.goto(reloadedProofDashboardUrl, { waitUntil: 'domcontentloaded' })
    await page.waitForFunction(() => window.location.hash.startsWith('#/admin/proof-dashboard'))
    await page.waitForTimeout(500)
    proofControlPlane = visibleProofSurface('system-admin-proof-control-plane')
    await expectVisible(proofControlPlane, 'system admin proof control plane after prewarm', 180_000)
    await waitForCheckpointPlaybackVisible(proofControlPlane, 180_000)
    await page.waitForTimeout(500)
  }
  const checkpointPlayback = await waitForCheckpointPlaybackVisible(proofControlPlane, 30_000)
  await resolveTargetCheckpointDescriptor()
  await expectVisible(targetCheckpointButton(proofControlPlane), 'target checkpoint button')
  return proofControlPlane
}

async function selectTargetCheckpoint(proofControlPlane) {
  assert(targetCheckpointDescriptor, 'Target checkpoint descriptor must be resolved before selecting the checkpoint')
  await focusAndActivate(targetCheckpointButton(proofControlPlane), 'target checkpoint button')
}

async function verifyPlaybackSelectionPersisted(expectedDescriptor, proofControlPlane = page.locator('[data-proof-surface="system-admin-proof-control-plane"]')) {
  const selection = await readPlaybackSelectionParsed()
  console.log(`[smoke] stored playback selection: ${JSON.stringify(selection)}`)
  assert.equal(selection.simulationStageCheckpointId, expectedDescriptor.simulationStageCheckpointId, 'stored playback selection should keep the selected checkpoint id')
  const banner = proofControlPlane.locator('[data-proof-section="selected-checkpoint-banner"]')
  await expectVisible(banner, 'selected checkpoint banner')
  console.log(`[smoke] selected checkpoint banner: ${(await banner.textContent().catch(() => '') ?? '').replace(/\\s+/g, ' ').trim()}`)
  await expectContainerText(banner, /(Selected checkpoint:|Viewing Semester)/i, 'selected checkpoint summary banner')
  await expectContainerText(
    banner,
    new RegExp(escapeRegExp(expectedDescriptor.bannerLabel), 'i'),
    `${expectedDescriptor.bannerLabel} selected checkpoint banner`,
  )
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

async function loginToAcademicPortal(username) {
  await page.getByRole('button', { name: /Open Academic Portal/i }).click()
  await expectVisible(page.getByText(/Teaching Workspace Live Mode/), 'academic login')
  await page.locator('#teacher-username').fill(username)
  const teachingPassword = await resolveTeachingPassword(username)
  await page.locator('#teacher-password').fill(teachingPassword)
  await page.getByRole('button', { name: 'Sign In', exact: true }).click()
}

try {
  markStep('login-system-admin')
  await loginAsSystemAdmin()
  await discoverProofRouteState()
  markStep('activate-proof-semester')
  await activateProofSemesterForContract()

  markStep('open-seeded-proof-route')
  const proofControlPlane = await openSeededProofRoute()
  if (activatedProofSemesterContext) {
    await expectContainerText(
      proofControlPlane,
      new RegExp(`Semester ${activatedProofSemesterContext.activeOperationalSemester}\\b`, 'i'),
      'activated operational semester',
    )
    await ensureProofControlPlaneTab(proofControlPlane, 'Summary')
    const activeSemesterButton = proofControlPlane.locator(
      `[data-proof-action="proof-activate-semester-${activatedProofSemesterContext.activeOperationalSemester}"]`,
    ).first()
    await expectVisible(activeSemesterButton, 'activated operational semester button')
    assert.equal(
      await activeSemesterButton.isDisabled(),
      true,
      'the activated operational semester button should be disabled after activation',
    )
    await ensureProofControlPlaneTab(proofControlPlane, 'Checkpoint')
  }
  markStep('select-target-checkpoint')
  await selectTargetCheckpoint(proofControlPlane)
  await verifyPlaybackSelectionPersisted(targetCheckpointDescriptor, proofControlPlane)
  markStep('reload-system-admin-proof-route')
  const refreshedSeededRouteUrl = buildSeededProofRouteUrl({ forceReload: true })
  console.log(`[smoke] refreshing seeded proof route: ${refreshedSeededRouteUrl}`)
  await page.goto(refreshedSeededRouteUrl, { waitUntil: 'domcontentloaded' })
  await page.waitForFunction(expectedHash => window.location.hash === expectedHash, proofRouteState.routeHash)
  await page.waitForTimeout(500)

  markStep('reopen-seeded-proof-route-after-reload')
  const reloadedProofControlPlane = await openSeededProofRoute()
  await verifyPlaybackSelectionPersisted(targetCheckpointDescriptor, reloadedProofControlPlane)
  if (
    activatedProofSemesterContext
    && targetCheckpointDescriptor
    && targetCheckpointDescriptor.semesterNumber !== activatedProofSemesterContext.activeOperationalSemester
  ) {
    await expectContainerText(
      reloadedProofControlPlane,
      new RegExp(`(operational semester remains|Live operations stay on) Semester ${activatedProofSemesterContext.activeOperationalSemester}`, 'i'),
      'activated operational semester override banner',
    )
  }
  await captureProofScreenshot('systemAdmin', reloadedProofControlPlane, 'system admin proof control plane')

  const storedSelectionAfterReload = await readPlaybackSelectionParsed()
  markStep('restore-proof-semester')
  await restoreActivatedProofSemester()

  markStep('logout-system-admin')
  await page.getByRole('button', { name: 'Logout', exact: true }).click()
  await expectVisible(page.getByRole('button', { name: /Open Academic Portal/i }), 'portal selector')

  markStep('login-academic-portal')
  await loginToAcademicPortal(proofTeacherUsername)

  markStep('switch-to-course-leader')
  const courseLeaderRoleButton = page.locator('[data-proof-action="switch-role"][data-proof-entity-id="Course Leader"]').first()
  await expectVisible(courseLeaderRoleButton, 'Course Leader role switcher')
  await courseLeaderRoleButton.click()
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(400)

  markStep('open-faculty-proof-panel')
  const teacherProofPanel = await openFacultyProfileProofPanel()
  await expectProofCheckpointIdentity(teacherProofPanel, storedSelectionAfterReload.simulationStageCheckpointId, 'teacher proof panel')
  await expectContainerText(teacherProofPanel, /Simulation Controls|Proof Control Plane/i, 'teacher proof control plane heading')
  const teacherCheckpointOverlay = teacherProofPanel.locator('[data-proof-section="checkpoint-overlay"]')
  await expectVisible(teacherCheckpointOverlay, 'teacher checkpoint overlay')
  await expectContainerText(teacherCheckpointOverlay, /Checkpoint overlay/i, 'teacher checkpoint overlay heading')
  await expectContainerText(
    teacherCheckpointOverlay,
    new RegExp(escapeRegExp(targetCheckpointDescriptor.surfaceLabel), 'i'),
    'teacher checkpoint playback sync',
  )
  await captureProofScreenshot('teacher', teacherProofPanel, 'teacher proof panel')
  if (proofCoverageTarget === 'teacher') {
    console.log('[smoke] Proof coverage target=teacher; stopping after system-admin and teacher proof surfaces.')
  } else {
    markStep('open-teacher-risk-explorer')
    const teacherRiskExplorerSource = await resolveTeacherProofActionSource(teacherProofPanel)
    let trackedStudentId = null
    if (!teacherRiskExplorerSource) {
      await expectVisible(teacherProofPanel.locator('[data-proof-section="active-run-contexts"]').first(), 'teacher active-run contexts')
      await expectContainerText(
        teacherProofPanel,
        /No governed queue items are currently linked to this profile\./i,
        'teacher proof panel empty monitoring state',
      )
      await expectVisible(teacherProofPanel.locator('[data-proof-section="elective-fit"]').first(), 'teacher elective-fit section')
      await expectContainerText(
        teacherProofPanel,
        /No elective recommendation is currently available for this profile\./i,
        'teacher proof panel empty elective-fit state',
      )
      console.log('[smoke] Teacher proof panel has no row-backed monitoring or elective-fit entries at this checkpoint; skipping teacher-specific risk-explorer and student-shell subflow.')
    } else {
      trackedStudentId = await readRequiredAttribute(teacherRiskExplorerSource, 'data-proof-student-id', 'teacher proof action source')
      const teacherPartialProfileButton = teacherRiskExplorerSource.locator('[data-proof-action="teacher-proof-open-partial-profile"]').first()
      const teacherPartialProfileVisible = await teacherPartialProfileButton.isVisible().catch(() => false)
      if (teacherPartialProfileVisible) {
        markStep('open-teacher-partial-profile')
        await focusAndActivate(teacherPartialProfileButton, 'teacher partial profile action')
        await expectVisible(page.getByRole('button', { name: 'Open Full Profile', exact: true }).first(), 'teacher partial profile drawer')
        await expectVisible(page.getByRole('button', { name: 'Close student details', exact: true }).first(), 'teacher partial profile close button')
        await focusAndActivate(page.getByRole('button', { name: 'Close student details', exact: true }).first(), 'teacher partial profile close action')
        await expectVisible(teacherProofPanel, 'teacher proof panel after returning from partial profile')
      }
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
      await expectContainerText(
        teacherRiskExplorerSurface,
        new RegExp(escapeRegExp(targetCheckpointDescriptor.surfaceLabel), 'i'),
        'risk explorer checkpoint sync',
      )
      const advancedDiagnosticsTab = page.getByRole('tab', { name: 'Advanced Diagnostics', exact: true }).first()
      await focusAndActivate(advancedDiagnosticsTab, 'advanced diagnostics tab')
      await waitForProofHeading('Trained Risk Heads', 60_000)
      await captureProofScreenshot('teacherRiskExplorer', teacherRiskExplorerSurface, 'teacher risk explorer surface')

      markStep('return-from-teacher-risk-explorer')
      const backButton = page.locator('[data-proof-action="risk-explorer-back"]').first()
      await focusAndActivate(backButton, 'risk explorer back button')
      await expectVisible(teacherProofPanel, 'teacher proof panel after returning from risk explorer')
      await expectContainerText(
        teacherProofPanel,
        new RegExp(escapeRegExp(targetCheckpointDescriptor.surfaceLabel), 'i'),
        'teacher checkpoint persistence after risk explorer return',
      )

      markStep('open-teacher-student-shell')
      const teacherStudentShellButton = teacherRiskExplorerSource.locator('[data-proof-action="teacher-proof-open-student-shell"]').first()
      await focusAndActivate(teacherStudentShellButton, 'teacher student shell action')

      const studentShellSurface = visibleProofSurface('student-shell')
      markStep('assert-student-shell')
      await expectVisible(studentShellSurface, 'student shell surface')
      await expectProofCheckpointIdentity(studentShellSurface, storedSelectionAfterReload.simulationStageCheckpointId, 'student shell')
      await expectProofStudentIdentity(studentShellSurface, trackedStudentId, 'student shell')
      await expectContainerText(studentShellSurface, /Student Shell/i, 'student shell heading')
      await expectContainerText(studentShellSurface, /(proof snapshot|Simulation only|This student proof page keeps)/i, 'student shell subtitle')
      await expectContainerText(
        studentShellSurface,
        new RegExp(escapeRegExp(targetCheckpointDescriptor.surfaceLabel), 'i'),
        'student shell checkpoint sync',
      )
      await captureProofScreenshot('studentShell', studentShellSurface, 'student shell surface')

      const shellSelection = await readPlaybackSelectionParsed()
      assert.equal(shellSelection.simulationRunId, storedSelectionAfterReload.simulationRunId, 'run selection should persist across teacher and shell navigation')
      assert.equal(shellSelection.simulationStageCheckpointId, storedSelectionAfterReload.simulationStageCheckpointId, 'checkpoint selection should persist across teacher and shell navigation')

      markStep('return-from-student-shell')
      await focusAndActivate(page.locator('[data-proof-action="student-shell-back"]').first(), 'student shell back button')
      await expectVisible(teacherProofPanel, 'teacher proof panel after returning from student shell')
    }

    markStep('switch-to-hod')
    const hodRoleButton = page.locator('[data-proof-action="switch-role"][data-proof-entity-id="HoD"]').first()
    await expectVisible(hodRoleButton, 'HoD role switcher')
    await hodRoleButton.click()
    await page.waitForLoadState('networkidle')
    const hodProofAnalytics = await waitForSurfaceAfterOptionalLoading('hod-proof-analytics', /Loading live HoD proof analytics/i, 120_000)
    markStep('assert-hod-proof-analytics')
    await expectProofCheckpointIdentity(hodProofAnalytics, storedSelectionAfterReload.simulationStageCheckpointId, 'HoD proof analytics')
    await expectContainerText(hodProofAnalytics, /Live HoD Analytics/i, 'HoD heading')
    await expectContainerText(
      hodProofAnalytics,
      new RegExp(escapeRegExp(targetCheckpointDescriptor.surfaceLabel), 'i'),
      'HoD checkpoint sync',
    )
    await captureProofScreenshot('hod', hodProofAnalytics, 'HoD proof analytics')

    markStep('open-hod-student-shell')
    const hodOverviewStudents = page.locator('[data-proof-section="hod-overview-students"]').first()
    await expectVisible(hodOverviewStudents, 'HoD overview students section', 60_000)
    const hodViewAllButton = hodOverviewStudents.getByRole('button', { name: /^View All$/i }).first()
    const hodViewAllVisible = await hodViewAllButton.isVisible().catch(() => false)
    if (hodViewAllVisible) {
      await hodViewAllButton.click()
      await page.waitForTimeout(250)
    }
    let hodTrackedStudentRow = hodOverviewStudents.locator('[data-proof-row="hod-student-row"]').first()
    if (trackedStudentId) {
      const hodPreferredStudentRow = hodOverviewStudents.locator(
        `[data-proof-row="hod-student-row"][data-proof-student-id="${trackedStudentId}"]`,
      ).first()
      if (await hodPreferredStudentRow.isVisible().catch(() => false)) {
        hodTrackedStudentRow = hodPreferredStudentRow
      }
    }
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
      await expectContainerText(hodStudentShellSurface, /Student Shell/i, 'HoD student shell heading')
      await expectContainerText(hodStudentShellSurface, /(proof snapshot|Simulation only|This student proof page keeps)/i, 'HoD student shell subtitle')
      if (!trackedStudentId) {
        await captureProofScreenshot('studentShell', hodStudentShellSurface, 'HoD student shell surface')
      }

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
      let hodTrackedStudentRowAfterReturn = hodOverviewStudentsAfterReturn.locator('[data-proof-row="hod-student-row"]').first()
      const hodPreferredStudentRowAfterReturn = hodOverviewStudentsAfterReturn.locator(
        `[data-proof-row="hod-student-row"][data-proof-student-id="${hodTrackedStudentId}"]`,
      ).first()
      if (await hodPreferredStudentRowAfterReturn.isVisible().catch(() => false)) {
        hodTrackedStudentRowAfterReturn = hodPreferredStudentRowAfterReturn
      }
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
      await expectContainerText(
        hodRiskExplorerSurface,
        new RegExp(escapeRegExp(targetCheckpointDescriptor.surfaceLabel), 'i'),
        'HoD risk explorer checkpoint sync',
      )
      await captureProofScreenshot('hodRiskExplorer', hodRiskExplorerSurface, 'HoD risk explorer surface')
    }
  }

  const semesterScopedScreenshots = Object.fromEntries((await Promise.all(
    Object.entries(capturedScreenshots).map(async ([label, screenshotPath]) => [label, await copySemesterScopedArtifact(screenshotPath)]),
  )).filter(([, copiedPath]) => !!copiedPath))
  const semesterScopedActivationArtifacts = Object.fromEntries((await Promise.all(
    Object.entries(activationArtifacts).map(async ([label, artifactPath]) => [label, await copySemesterScopedArtifact(artifactPath)]),
  )).filter(([, copiedPath]) => !!copiedPath))
  const summaryArtifactPath = buildSemesterWalkSummaryPath()
  if (summaryArtifactPath) {
    const prefixedArtifacts = {
      screenshots: semesterScopedScreenshots,
      activationArtifacts: semesterScopedActivationArtifacts,
    }
    proofWalkSummary = {
      summaryKind: targetedProofSemester == null ? 'proof-risk-smoke' : 'semester-walk',
      stack: isLiveStack ? 'live' : 'local',
      proofCoverageTarget,
      simulationRunId: activatedProofSemesterContext?.simulationRunId
        ?? storedSelectionAfterReload?.simulationRunId
        ?? null,
      batchId: proofRouteState.batchId,
      routeHash: proofRouteState.routeHash,
      appUrl,
      apiUrl,
      targetedSemester: targetedProofSemester,
      activatedOperationalSemester: activatedProofSemesterContext?.activeOperationalSemester ?? null,
      previousOperationalSemester: activatedProofSemesterContext?.previousOperationalSemester ?? null,
      availableOperationalSemesters: activatedProofSemesterContext?.availableSemesters ?? null,
      selectedCheckpoint: targetCheckpointDescriptor,
      storedPlaybackSelection: storedSelectionAfterReload,
      genericArtifacts: {
        screenshots: capturedScreenshots,
        activationArtifacts,
      },
      prefixedArtifacts,
      ...(targetedProofSemester == null
        ? {}
        : {
            semesterScopedArtifacts: prefixedArtifacts,
          }),
    }
    await writeJsonArtifact(summaryArtifactPath, proofWalkSummary)
  }

  console.log(`System admin proof-risk smoke passed.`)
  if (targetedProofSemester != null) {
    console.log(`Targeted semester: ${targetedProofSemester}`)
  }
  console.log(`Screenshots:`)
  for (const [label, screenshotPath] of Object.entries(capturedScreenshots)) {
    console.log(`- ${label}: ${screenshotPath}`)
  }
  console.log('Semester activation artifacts:')
  console.log(`- request: ${activationArtifacts.request}`)
  console.log(`- response: ${activationArtifacts.response}`)
  if (Object.keys(semesterScopedScreenshots).length > 0 || Object.keys(semesterScopedActivationArtifacts).length > 0) {
    console.log(targetedProofSemester == null ? 'Prefixed proof artifacts:' : 'Semester-scoped artifact copies:')
    for (const [label, copiedPath] of Object.entries(semesterScopedScreenshots)) {
      console.log(`- ${label}: ${copiedPath}`)
    }
    for (const [label, copiedPath] of Object.entries(semesterScopedActivationArtifacts)) {
      console.log(`- activation-${label}: ${copiedPath}`)
    }
  }
  if (summaryArtifactPath) {
    console.log(`Semester walk summary: ${summaryArtifactPath}`)
  }
  await context.tracing.stop()
} catch (error) {
  try {
    console.error(`[smoke] current step: ${currentStep}`)
    console.error(`[smoke] failure url: ${page.url()}`)
    const html = await page.content().catch(() => '')
    const scopedFailureArtifacts = {}
    if (html) {
      await writeFile(failureHtml, html, 'utf8')
      console.error(`Failure HTML: ${failureHtml}`)
      scopedFailureArtifacts.html = await copySemesterScopedArtifact(failureHtml).catch(() => null)
    }
    await page.screenshot({ path: failureScreenshot, fullPage: true })
    scopedFailureArtifacts.screenshot = await copySemesterScopedArtifact(failureScreenshot).catch(() => null)
    await context.tracing.stop({ path: failureTrace })
    scopedFailureArtifacts.trace = await copySemesterScopedArtifact(failureTrace).catch(() => null)
    console.error(`System admin proof-risk smoke failed. Screenshot: ${failureScreenshot}`)
    console.error(`Trace: ${failureTrace}`)
    if (Object.values(scopedFailureArtifacts).some(Boolean)) {
      console.error('Semester-scoped failure artifact copies:')
      for (const [label, copiedPath] of Object.entries(scopedFailureArtifacts)) {
        if (copiedPath) console.error(`- ${label}: ${copiedPath}`)
      }
    }
  } catch {
    // Ignore screenshot/trace failures to preserve the root error.
  }
  throw error
} finally {
  await browser.close()
}
