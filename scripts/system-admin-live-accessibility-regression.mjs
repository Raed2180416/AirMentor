import assert from 'node:assert/strict'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import path from 'node:path'

const require = createRequire(import.meta.url)
const axeScriptPath = require.resolve('axe-core/axe.min.js')

const playwrightRoot = process.env.PLAYWRIGHT_ROOT
const appUrl = process.env.PLAYWRIGHT_APP_URL ?? 'http://127.0.0.1:4173'
const outputDir = process.env.PLAYWRIGHT_OUTPUT_DIR ?? 'output/playwright'
const firefoxExecutablePath = process.env.PLAYWRIGHT_FIREFOX_EXECUTABLE_PATH || undefined

assert(playwrightRoot, 'PLAYWRIGHT_ROOT is required')

const { firefox } = await import(`file://${playwrightRoot}/lib/node_modules/playwright/index.mjs`)

const proofPlaybackSelectionStorageKey = 'airmentor-proof-playback-selection'
const seededProofRoute = '#/admin/faculties/academic_faculty_engineering_and_technology/departments/dept_cse/branches/branch_mnc_btech/batches/batch_branch_mnc_btech_2023'
const seededProofBatchId = 'batch_branch_mnc_btech_2023'
const requestSummary = /Grant additional mentor mapping coverage/i
const reportPath = path.join(outputDir, 'system-admin-live-accessibility-report.json')
const successScreenshot = path.join(outputDir, 'system-admin-live-accessibility-regression.png')
const failureScreenshot = path.join(outputDir, 'system-admin-live-accessibility-regression-failure.png')
const failureTrace = path.join(outputDir, 'system-admin-live-accessibility-regression-failure.zip')
const failureHtml = path.join(outputDir, 'system-admin-live-accessibility-regression-failure.html')
let currentStep = 'launch-browser'
const reports = []

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
    apiPath,
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
  return adminApiRequest(`/api/admin/batches/${seededProofBatchId}/proof-dashboard`)
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
    await adminApiRequest(`/api/admin/batches/${seededProofBatchId}/proof-imports`, {
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
    await adminApiRequest(`/api/admin/batches/${seededProofBatchId}/proof-runs`, {
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
  await page.waitForTimeout(500)
}

async function loginAsSystemAdmin() {
  await page.goto(appUrl, { waitUntil: 'networkidle' })
  await runPageAxeScan('Portal home')
  await page.getByRole('button', { name: /Open System Admin/i }).click()
  await expectVisible(page.getByText(/System Admin Live Mode/), 'system admin login')
  await runPageAxeScan('System admin login')
  await page.getByPlaceholder('sysadmin', { exact: true }).fill('sysadmin')
  await page.getByPlaceholder('••••••••', { exact: true }).fill('admin1234')
  await page.getByRole('button', { name: 'Sign In', exact: true }).click()
  await waitForSystemAdminShellReady()
}

async function primeSeededProofRouteState() {
  const routeStorageKey = `airmentor-admin-ui:${seededProofRoute}`
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
  return `${baseUrl}${query}${seededProofRoute}`
}

function buildPortalHomeUrl() {
  return `${appUrl.replace(/\/$/, '')}/#/home`
}

function visibleProofSurface(name) {
  return page.locator(`[data-proof-surface="${name}"]:visible`).first()
}

async function openSeededProofRoute(forceReload = false, reloadAttempt = 0) {
  await primeSeededProofRouteState()
  const seededRouteUrl = buildSeededProofRouteUrl(forceReload)
  await page.goto(seededRouteUrl, { waitUntil: 'domcontentloaded' })
  await page.waitForFunction(expectedHash => window.location.hash === expectedHash, seededProofRoute)
  await page.waitForTimeout(500)
  await expectVisible(page.getByText('Batch 2023 Proof', { exact: true }).last(), 'seeded proof batch breadcrumb')
  let proofControlPlane = visibleProofSurface('system-admin-proof-control-plane')
  if (!(await proofControlPlane.isVisible().catch(() => false))) {
    const overviewTab = page.locator('button[data-tab="true"]').filter({ hasText: 'Overview' }).first()
    await overviewTab.click()
    await page.waitForTimeout(250)
    proofControlPlane = visibleProofSurface('system-admin-proof-control-plane')
  }
  await expectVisible(proofControlPlane, 'system admin proof control plane')
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
  await page.locator('#teacher-username').fill('devika.shetty')
  await page.locator('#teacher-password').fill('faculty1234')
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

try {
  markStep('login-system-admin')
  await loginAsSystemAdmin()

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
  const studentDisplayName = 'Aarav Sharma'
  const studentRegistryButton = page.getByRole('button', { name: /Aarav Sharma.*1MS23CS001/i }).first()
  await studentRegistryButton.click()
  await expectVisible(page.getByText('Student Detail', { exact: true }).first(), 'student detail heading')
  const editStudentButton = page.getByRole('button', { name: 'Edit Student', exact: true }).first()
  await editStudentButton.click()
  const studentDialog = page.locator('[role="dialog"]:visible').first()
  await runScopedAxeScan(studentDialog, 'System admin student edit dialog')
  await runAccessibilityTreeAssertion(studentDialog, 'System admin student edit dialog tree', [
    { role: 'dialog' },
    { name: `Edit ${studentDisplayName}` },
    { role: 'button', name: 'Close dialog' },
  ])
  await page.getByRole('button', { name: 'Close dialog', exact: true }).first().click()

  markStep('proof-dashboard-a11y')
  await ensureProofRunReady()
  const proofControlPlane = await openSeededProofRoute()
  await page.evaluate(key => window.localStorage.getItem(key), proofPlaybackSelectionStorageKey)
  await runScopedAxeScan(proofControlPlane, 'System admin proof dashboard')
  await runAccessibilityTreeAssertion(proofControlPlane, 'System admin proof dashboard tree', [
    { name: 'Queue Health' },
    { name: 'Worker Lease' },
    { name: 'Checkpoint Readiness' },
    { role: 'button', name: 'Reset To Start' },
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
  if (teacherProofActionSource) {
    await runAccessibilityTreeAssertion(teacherProofPanel, 'Teacher proof panel tree', [
      { role: 'button', name: 'Open Risk Explorer' },
      { role: 'button', name: 'Open Student Shell' },
    ])
  } else {
    await runAccessibilityTreeAssertion(teacherProofPanel, 'Teacher proof panel tree', [
      { name: 'No active run is linked to this faculty context.' },
      { name: 'No governed queue items are currently linked to this profile.' },
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

  await writeFile(reportPath, JSON.stringify(reports, null, 2))
  await page.screenshot({ path: successScreenshot, fullPage: true })
  console.log(`System admin live accessibility regression passed. Report: ${reportPath}`)
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
    await page.screenshot({ path: failureScreenshot, fullPage: true })
    await context.tracing.stop({ path: failureTrace })
    console.error(`System admin live accessibility regression failed. Report: ${reportPath}`)
    console.error(`Screenshot: ${failureScreenshot}`)
    console.error(`Trace: ${failureTrace}`)
  } catch {
    // Preserve the root failure.
  }
  throw error
} finally {
  await browser.close()
}
