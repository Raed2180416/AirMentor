import assert from 'node:assert/strict'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import path from 'node:path'
import { resolveSystemAdminLiveCredentials } from './system-admin-live-auth.mjs'
import { resolveTeachingPasswordViaSession } from './teaching-password-resolution.mjs'

const require = createRequire(import.meta.url)
const axeScriptPath = require.resolve('axe-core/axe.min.js')

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
const teachingPasswordCandidates = ['faculty1234', '1234']
const defaultTeachingUsername = isLiveStack ? 'kavitha.rao' : 'devika.shetty'
const requestSummary = /Grant additional mentor mapping coverage/i
const reportPath = path.join(outputDir, 'system-admin-live-accessibility-report.json')
const screenReaderTranscriptPath = path.join(outputDir, 'system-admin-live-screen-reader-preflight.md')
const successScreenshot = path.join(outputDir, 'system-admin-live-accessibility-regression.png')
const failureScreenshot = path.join(outputDir, 'system-admin-live-accessibility-regression-failure.png')
const failureTrace = path.join(outputDir, 'system-admin-live-accessibility-regression-failure.zip')
const failureHtml = path.join(outputDir, 'system-admin-live-accessibility-regression-failure.html')
let currentStep = 'launch-browser'
const reports = []
let proofRouteState = {
  routeHash: seededProofRoute,
  batchId: seededProofBatchId,
}
const systemAdminCredentials = resolveSystemAdminLiveCredentials({
  scriptLabel: 'System admin live accessibility regression',
})

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
  console.log(`[accessibility] step: ${label}`)
}

async function expectVisible(locator, description, timeout = 30_000) {
  await locator.waitFor({ state: 'visible', timeout })
  assert(await locator.isVisible(), `${description} should be visible`)
}

async function ensureAxeLoaded() {
  const hasAxe = await page.evaluate(() => Boolean(window.axe?.run)).catch(() => false)
  if (hasAxe) return
  await page.addScriptTag({ path: axeScriptPath })
  await page.waitForFunction(() => Boolean(window.axe?.run))
}

function pageScanOptions() {
  return {
    runOnly: {
      type: 'tag',
      values: ['wcag2a', 'wcag2aa'],
    },
  }
}

function scopedScanOptions() {
  return {
    ...pageScanOptions(),
    rules: {
      'landmark-one-main': { enabled: false },
      'page-has-heading-one': { enabled: false },
      region: { enabled: false },
    },
  }
}

function summarizeViolations(label, result) {
  return (result.violations ?? []).map(item => ({
    label,
    impact: item.impact ?? 'unknown',
    rule: item.id,
    help: item.help,
    helpUrl: item.helpUrl,
    nodes: (item.nodes ?? []).slice(0, 5).map(node => ({
      targets: node.target,
      html: node.html,
      failureSummary: node.failureSummary ?? null,
    })),
  }))
}

function flattenAccessibilityTree(node, acc = []) {
  if (!node || typeof node !== 'object') return acc
  const record = {
    role: typeof node.role === 'string' ? node.role : null,
    name: typeof node.name === 'string' ? node.name : null,
  }
  if (record.role || record.name) {
    acc.push(record)
  }
  const children = Array.isArray(node.children) ? node.children : []
  children.forEach(child => flattenAccessibilityTree(child, acc))
  return acc
}

function buildScreenReaderTranscript(items) {
  const lines = [
    '# AirMentor Screen Reader Preflight',
    '',
    `Generated: ${new Date().toISOString()}`,
    '',
    'This transcript is generated from the live accessibility regression accessibility-tree and aria-snapshot checks.',
    'It is meant to make the remaining human screen-reader review deterministic, not to replace a real NVDA/JAWS/VoiceOver pass.',
    '',
  ]

  for (const item of items) {
    lines.push(`## ${item.label}`)
    lines.push('')
    if (item.scope === 'accessibility-tree' && Array.isArray(item.nodes)) {
      const visibleNodes = item.nodes
        .filter(node => node.role || node.name)
        .slice(0, 40)
      if (visibleNodes.length === 0) {
        lines.push('- no nodes recorded')
      } else {
        for (const node of visibleNodes) {
          lines.push(`- ${node.role ?? 'node'}${node.name ? `: ${node.name}` : ''}`)
        }
      }
    } else if (item.scope === 'aria-snapshot' && typeof item.snapshot === 'string') {
      lines.push('```text')
      lines.push(item.snapshot.trim())
      lines.push('```')
    } else if (Array.isArray(item.violations)) {
      const blocking = item.violations.filter(violation => violation.impact === 'serious' || violation.impact === 'critical')
      lines.push(blocking.length === 0 ? '- no blocking violations' : `- blocking violations: ${blocking.length}`)
    } else {
      lines.push(`- scope: ${item.scope}`)
    }
    lines.push('')
  }

  return `${lines.join('\n')}\n`
}

function assertAccessibilityEvidenceRecorded(items) {
  const skipped = items.filter(item => item.scope === 'accessibility-tree-skipped')
  assert.equal(skipped.length, 0, 'Accessibility regression must record accessibility-tree or aria-snapshot evidence for every declared tree assertion.')
}

async function runAccessibilityTreeAssertion(locator, label, expectedNodes) {
  await expectVisible(locator, label)
  const accessibilityApi = page.accessibility
  if (accessibilityApi?.snapshot) {
    const handle = await locator.elementHandle()
    assert(handle, `${label} should provide a stable root element for accessibility tree checks`)
    const snapshot = await accessibilityApi.snapshot({
      root: handle,
      interestingOnly: false,
    })
    assert(snapshot, `${label} should expose an accessibility tree snapshot`)
    const flattened = flattenAccessibilityTree(snapshot)
    reports.push({
      label,
      url: page.url(),
      scope: 'accessibility-tree',
      nodes: flattened.slice(0, 120),
    })
    expectedNodes.forEach(expectedNode => {
      const matched = flattened.some(node => {
        const roleMatches = !expectedNode.role || node.role === expectedNode.role
        const nameMatches = !expectedNode.name || (node.name ?? '').includes(expectedNode.name)
        return roleMatches && nameMatches
      })
      assert(
        matched,
        `${label} accessibility tree should include ${expectedNode.role ? `${expectedNode.role} ` : ''}${expectedNode.name ?? 'node'}`,
      )
    })
    return
  }

  if (typeof locator.ariaSnapshot === 'function') {
    const snapshot = await locator.ariaSnapshot()
    reports.push({
      label,
      url: page.url(),
      scope: 'aria-snapshot',
      snapshot,
    })
    expectedNodes.forEach(expectedNode => {
      if (expectedNode.role) {
        assert(
          snapshot.includes(expectedNode.role),
          `${label} aria snapshot should reference role ${expectedNode.role}`,
        )
      }
      if (expectedNode.name) {
        assert(
          snapshot.includes(expectedNode.name),
          `${label} aria snapshot should include name ${expectedNode.name}`,
        )
      }
    })
    return
  }

  reports.push({
    label,
    url: page.url(),
    scope: 'accessibility-tree-skipped',
    reason: 'Browser runtime does not expose accessibility or aria snapshot APIs.',
  })
}

async function runPageAxeScan(label) {
  await page.waitForTimeout(450)
  await ensureAxeLoaded()
  const result = await page.evaluate(async options => window.axe.run(document, options), pageScanOptions())
  reports.push({
    label,
    url: page.url(),
    scope: 'page',
    violations: summarizeViolations(label, result),
  })
  const blocking = (result.violations ?? []).filter(item => item.impact === 'serious' || item.impact === 'critical')
  if (blocking.length > 0) {
    throw new Error(`${label} has blocking accessibility violations: ${blocking.map(item => `${item.id} (${item.impact ?? 'unknown'})`).join(', ')}`)
  }
}

async function runScopedAxeScan(locator, label) {
  await expectVisible(locator, label)
  await page.waitForTimeout(450)
  await ensureAxeLoaded()
  const result = await locator.evaluate(async (node, options) => window.axe.run(node, options), scopedScanOptions())
  reports.push({
    label,
    url: page.url(),
    scope: 'fragment',
    violations: summarizeViolations(label, result),
  })
  const blocking = (result.violations ?? []).filter(item => item.impact === 'serious' || item.impact === 'critical')
  if (blocking.length > 0) {
    throw new Error(`${label} has blocking accessibility violations: ${blocking.map(item => `${item.id} (${item.impact ?? 'unknown'})`).join(', ')}`)
  }
}

async function adminApiRequest(apiPath, init = {}) {
  const { body, ...restInit } = init
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
    apiPath: new URL(apiPath, apiUrl).toString(),
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
    console.log(
      `[accessibility] live proof route pinned to seeded batch: batch=2023 checkpoints=${seededCheckpointCount} proofRuns=${seededProofRunCount} imports=${seededImportCount}`,
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
  assert(selected, 'No live proof-enabled active batch is available for accessibility validation')
  proofRouteState = {
    routeHash: `#/admin/faculties/${selected.faculty.academicFacultyId}/departments/${selected.department.departmentId}/branches/${selected.branch.branchId}/batches/${selected.batch.batchId}`,
    batchId: selected.batch.batchId,
  }
  console.log(`[accessibility] live proof route discovered: faculty=${selected.faculty.name} department=${selected.department.name} branch=${selected.branch.name} batch=${selected.batch.batchLabel} checkpoints=${selected.checkpointCount}`)
  return proofRouteState
}

async function readProofDashboardForBatch(batchId) {
  return adminApiRequest(`/api/admin/batches/${batchId}/proof-dashboard`)
}

async function resolveTeachingPassword(username) {
  return resolveTeachingPasswordViaSession({
    appUrl,
    apiUrl,
    username,
    candidates: teachingPasswordCandidates,
    logPrefix: 'live-accessibility',
  })
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
          overrideReason: 'Deterministic accessibility regression prewarm.',
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
    expectVisible(page.getByText(/Operations Dashboard|MNC Proof Operations|Sysadmin Control Plane/i).first(), 'system admin operations dashboard heading'),
  ]
  await Promise.any(readinessChecks)
  await page.waitForTimeout(500)
}

async function loginAsSystemAdmin() {
  await page.goto(appUrl, { waitUntil: 'networkidle' })
  await runPageAxeScan('Portal home')
  await page.getByRole('button', { name: /Open System Admin/i }).click()
  await expectVisible(page.getByText(/System Admin Live Mode/), 'system admin login')
  await runPageAxeScan('System admin login')
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
  const query = forceReload ? `/?a11y-reload=${Date.now()}` : '/'
  return `${baseUrl}${query}${proofRouteState.routeHash}`
}

function buildPortalHomeUrl() {
  return `${appUrl.replace(/\/$/, '')}/#/home`
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
    await tab.click()
    await page.waitForTimeout(250)
  }
  throw new Error(`${label} proof tab did not become selected`)
}

async function openSeededProofRoute(forceReload = false, reloadAttempt = 0) {
  await primeSeededProofRouteState()
  const seededRouteUrl = buildSeededProofRouteUrl(forceReload)
  await page.goto(seededRouteUrl, { waitUntil: 'domcontentloaded' })
  await page.waitForFunction(expectedHash => window.location.hash === expectedHash, proofRouteState.routeHash)
  await page.waitForTimeout(500)
  const batchNotFound = page.getByText('Batch not found', { exact: true }).first()
  if (await batchNotFound.isVisible().catch(() => false)) {
    throw new Error(`Proof batch route ${proofRouteState.routeHash} resolved to "Batch not found"`)
  }
  let proofControlPlane = visibleProofSurface('system-admin-proof-control-plane')
  if (!(await proofControlPlane.isVisible().catch(() => false))) {
    const overviewTab = page.locator('button[data-tab="true"]').filter({ hasText: 'Overview' }).first()
    if (await overviewTab.isVisible().catch(() => false)) {
      await overviewTab.click()
      await page.waitForTimeout(250)
    }
    proofControlPlane = visibleProofSurface('system-admin-proof-control-plane')
  }
  if (!(await proofControlPlane.isVisible().catch(() => false))) {
    const openProofDashboardButton = page.getByRole('button', { name: 'Open Proof Dashboard', exact: true }).first()
    if (await openProofDashboardButton.isVisible().catch(() => false)) {
      await openProofDashboardButton.click()
      await page.waitForLoadState('networkidle')
      await page.waitForTimeout(500)
    }
    proofControlPlane = visibleProofSurface('system-admin-proof-control-plane')
  }
  await expectVisible(proofControlPlane, 'system admin proof control plane')
  await ensureProofControlPlaneTab(proofControlPlane, 'Checkpoint')
  const checkpointPlayback = proofControlPlane.locator('[data-proof-section="checkpoint-playback"]').first()
  if (!(await checkpointPlayback.isVisible().catch(() => false))) {
    await ensureProofRunReady()
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

async function openAcademicPortal() {
  await page.goto(buildPortalHomeUrl(), { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: /Open Academic Portal/i }).click()
  await expectVisible(page.getByText(/Teaching Workspace Live Mode/), 'academic login')
  await runPageAxeScan('Academic portal login')
  const teachingPassword = await resolveTeachingPassword(defaultTeachingUsername)
  await page.locator('#teacher-username').fill(defaultTeachingUsername)
  await page.locator('#teacher-password').fill(teachingPassword)
  await page.getByRole('button', { name: 'Sign In', exact: true }).click()
}

async function openFacultyProfileProofPanel() {
  const teacherProofPanel = visibleProofSurface('teacher-proof-panel')
  if (await teacherProofPanel.isVisible().catch(() => false)) return teacherProofPanel
  const facultyProfileButton = page.locator('[data-proof-action="open-faculty-profile"]').first()
  await facultyProfileButton.click()
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

async function assertTeacherProofPanelBaseline(teacherProofPanel) {
  await runAccessibilityTreeAssertion(teacherProofPanel, 'Teacher proof panel tree', [
    { name: 'Proof Control Plane' },
    { name: 'Monitoring queue' },
    { name: 'elective fit' },
  ])
}

try {
  markStep('login-system-admin')
  await loginAsSystemAdmin()
  await discoverProofRouteState()

  markStep('request-detail-a11y')
  await page.getByRole('button', { name: 'Requests', exact: true }).first().click()
  await expectVisible(page.getByText(/^Requests$/).last(), 'requests heading')
  await page.getByRole('button', { name: requestSummary }).first().click()
  await expectVisible(page.getByText(requestSummary).last(), 'selected request detail')
  await runPageAxeScan('System admin requests detail')
  await runAccessibilityTreeAssertion(page.locator('body'), 'System admin requests detail tree', [
    { name: 'Requests' },
    { name: 'Grant additional mentor mapping coverage' },
  ])

  markStep('student-dialog-a11y')
  await page.getByRole('button', { name: 'Students', exact: true }).first().click()
  const studentRegistryButton = page.getByRole('button', { name: /1MS/i }).first()
  await expectVisible(studentRegistryButton, 'student registry entry')
  await studentRegistryButton.click()
  await expectVisible(page.getByText('Student Detail', { exact: true }).first(), 'student detail heading')
  await runAccessibilityTreeAssertion(page.locator('[role="tablist"][aria-label="Student detail sections"]').first(), 'System admin student detail tabs', [
    { role: 'tab', name: 'Profile' },
    { role: 'tab', name: 'Academic' },
    { role: 'tab', name: 'Mentor' },
  ])
  const editStudentButton = page.getByRole('button', { name: 'Edit Student', exact: true }).first()
  await editStudentButton.click()
  const studentDialog = page.locator('[role="dialog"]:visible').first()
  await runScopedAxeScan(studentDialog, 'System admin student edit dialog')
  await runAccessibilityTreeAssertion(studentDialog, 'System admin student edit dialog tree', [
    { role: 'dialog' },
    { name: 'Edit' },
    { role: 'button', name: 'Close dialog' },
  ])
  await page.getByRole('button', { name: 'Close dialog', exact: true }).first().click()

  markStep('proof-dashboard-a11y')
  await ensureProofRunReady()
  const proofControlPlane = await openSeededProofRoute()
  await page.evaluate(key => window.localStorage.getItem(key), proofPlaybackSelectionStorageKey)
  await runAccessibilityTreeAssertion(page.locator('[role="tablist"][aria-label="Proof control-plane sections"]').first(), 'System admin proof dashboard tabs', [
    { role: 'tab', name: 'Summary' },
    { role: 'tab', name: 'Checkpoint' },
  ])
  await runScopedAxeScan(proofControlPlane, 'System admin proof dashboard')
  await page.getByRole('tab', { name: 'Summary', exact: true }).click()
  await expectVisible(page.getByText('Action Pressure', { exact: true }).first(), 'proof dashboard summary tab heading')
  await runAccessibilityTreeAssertion(proofControlPlane, 'System admin proof dashboard tree', [
    { name: 'Queue Health' },
    { name: 'Worker Lease' },
    { name: 'Checkpoint Readiness' },
    { role: 'button', name: 'Reset Playback To Semester 1' },
  ])

  markStep('academic-portal-a11y')
  await page.getByRole('button', { name: 'Logout', exact: true }).click()
  await expectVisible(page.getByRole('button', { name: /Open Academic Portal/i }), 'portal home after sysadmin logout', 60_000)
  await openAcademicPortal()
  const courseLeaderRoleButton = page.locator('[data-proof-action="switch-role"][data-proof-entity-id="Course Leader"]').first()
  await courseLeaderRoleButton.click()
  const teacherProofPanel = await openFacultyProfileProofPanel()
  await runScopedAxeScan(teacherProofPanel, 'Teacher proof panel')
  const teacherProofActionSource = await resolveTeacherProofActionSource(teacherProofPanel)
  await assertTeacherProofPanelBaseline(teacherProofPanel)
  if (teacherProofActionSource) {
    await runAccessibilityTreeAssertion(teacherProofPanel, 'Teacher proof panel actions tree', [
      { role: 'button', name: 'Open Risk Explorer' },
      { role: 'button', name: 'Open Student Shell' },
    ])
  }

  markStep('teacher-risk-explorer-a11y')
  if (teacherProofActionSource) {
    const riskExplorerButton = teacherProofActionSource.locator('[data-proof-action="teacher-proof-open-risk-explorer"]').first()
    await riskExplorerButton.click()
    const riskExplorerSurface = visibleProofSurface('risk-explorer')
    await runScopedAxeScan(riskExplorerSurface, 'Teacher risk explorer')
    await runAccessibilityTreeAssertion(riskExplorerSurface, 'Teacher risk explorer tree', [
      { role: 'button', name: 'Back' },
      { name: 'Overall Course Fail' },
    ])

    const riskExplorerBackButton = page.locator('[data-proof-action="risk-explorer-back"]').first()
    await riskExplorerBackButton.click()
    await expectVisible(teacherProofPanel, 'teacher proof panel after risk explorer return')

    const studentShellButton = teacherProofActionSource.locator('[data-proof-action="teacher-proof-open-student-shell"]').first()
    await studentShellButton.click()
    const studentShellSurface = visibleProofSurface('student-shell')
    await runScopedAxeScan(studentShellSurface, 'Teacher student shell')
    await runAccessibilityTreeAssertion(studentShellSurface, 'Teacher student shell tree', [
      { role: 'button', name: 'Back' },
      { name: 'Student Shell' },
    ])
  }

  markStep('faculty-detail-tabs-a11y')
  await page.getByRole('button', { name: 'Logout', exact: true }).click()
  await expectVisible(page.getByRole('button', { name: /Open System Admin/i }), 'portal home before system admin relogin', 60_000)
  await loginAsSystemAdmin()
  await page.getByRole('button', { name: 'Faculty Members', exact: true }).first().click()
  await expectVisible(page.getByText(/^Faculty Members$/).last(), 'faculty members registry')
  const facultyRegistryEntry = page.getByRole('button').filter({ hasText: /Has Permissions|No Permissions/ }).first()
  const emptyFacultyRegistryBanner = page.getByText('No active faculty profiles yet. Create the first faculty record from this panel.').first()
  await Promise.any([
    expectVisible(facultyRegistryEntry, 'faculty registry entry'),
    expectVisible(emptyFacultyRegistryBanner, 'empty faculty registry banner'),
  ])
  if (await facultyRegistryEntry.isVisible().catch(() => false)) {
    await facultyRegistryEntry.click()
    await expectVisible(page.getByText('Faculty Detail', { exact: true }).first(), 'faculty detail heading')
  } else {
    await expectVisible(page.getByText('Create Faculty', { exact: true }).first(), 'create faculty heading')
  }
  await runAccessibilityTreeAssertion(page.locator('[role="tablist"][aria-label="Faculty detail sections"]').first(), 'System admin faculty detail tabs', [
    { role: 'tab', name: 'Profile' },
    { role: 'tab', name: 'Appointments' },
    { role: 'tab', name: 'Permissions' },
  ])

  assertAccessibilityEvidenceRecorded(reports)
  await writeFile(reportPath, JSON.stringify(reports, null, 2))
  await writeFile(screenReaderTranscriptPath, buildScreenReaderTranscript(reports), 'utf8')
  await page.screenshot({ path: successScreenshot, fullPage: true })
  console.log(`System admin live accessibility regression passed. Report: ${reportPath}`)
  console.log(`Screen-reader preflight transcript: ${screenReaderTranscriptPath}`)
  console.log(`Screenshot: ${successScreenshot}`)
  await context.tracing.stop()
} catch (error) {
  try {
    console.error(`[accessibility] current step: ${currentStep}`)
    console.error(`[accessibility] failure url: ${page.url()}`)
    const html = await page.content().catch(() => '')
    if (html) {
      await writeFile(failureHtml, html, 'utf8')
      console.error(`Failure HTML: ${failureHtml}`)
    }
    await writeFile(reportPath, JSON.stringify(reports, null, 2))
    await writeFile(screenReaderTranscriptPath, buildScreenReaderTranscript(reports), 'utf8')
    await page.screenshot({ path: failureScreenshot, fullPage: true })
    await context.tracing.stop({ path: failureTrace })
    console.error(`System admin live accessibility regression failed. Report: ${reportPath}`)
    console.error(`Screen-reader preflight transcript: ${screenReaderTranscriptPath}`)
    console.error(`Screenshot: ${failureScreenshot}`)
    console.error(`Trace: ${failureTrace}`)
  } catch {
    // Preserve the root failure.
  }
  throw error
} finally {
  await browser.close()
}
