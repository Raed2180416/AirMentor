import assert from 'node:assert/strict'
import { copyFile, mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { sanitizeArtifactPrefix } from './proof-risk-semester-walk.mjs'
import { resolveSystemAdminLiveCredentials } from './system-admin-live-auth.mjs'
import { resolveTeachingPasswordViaSession } from './teaching-password-resolution.mjs'

const playwrightRoot = process.env.PLAYWRIGHT_ROOT
const appUrl = process.env.PLAYWRIGHT_APP_URL ?? 'http://127.0.0.1:5173'
const apiUrl = process.env.PLAYWRIGHT_API_URL ?? appUrl
const outputDir = process.env.PLAYWRIGHT_OUTPUT_DIR ?? 'output/playwright'
const teachingParityArtifactPrefix = sanitizeArtifactPrefix((process.env.AIRMENTOR_TEACHING_PARITY_ARTIFACT_PREFIX ?? '').trim())

assert(playwrightRoot, 'PLAYWRIGHT_ROOT is required')

const { firefox } = await import(`file://${playwrightRoot}/lib/node_modules/playwright/index.mjs`)

await mkdir(outputDir, { recursive: true })

const successScreenshot = path.join(outputDir, 'system-admin-teaching-parity-smoke.png')
const courseLeaderDashboardScreenshot = path.join(outputDir, 'course-leader-dashboard-proof.png')
const mentorViewScreenshot = path.join(outputDir, 'mentor-view-proof.png')
const queueHistoryScreenshot = path.join(outputDir, 'queue-history-proof.png')
const failureScreenshot = path.join(outputDir, 'system-admin-teaching-parity-smoke-failure.png')
const failureReport = path.join(outputDir, 'system-admin-teaching-parity-smoke-failure.json')
const systemAdminCredentials = resolveSystemAdminLiveCredentials({
  scriptLabel: 'System admin teaching parity smoke',
})

const browser = await firefox.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1440, height: 1400 } })
const pageErrors = []
const consoleMessages = []
page.on('pageerror', error => {
  pageErrors.push({ name: error.name, message: error.message })
  if (pageErrors.length > 20) pageErrors.shift()
})
page.on('console', message => {
  consoleMessages.push({ type: message.type(), text: message.text() })
  if (consoleMessages.length > 20) consoleMessages.shift()
})

const updatedDisplayName = 'Dr. Kavitha Rao QA'
const updatedPhone = '+91-9000001111'
const updatedDesignation = 'Senior Associate Professor'
const teachingPasswordCandidates = ['faculty1234', '1234']

function buildPortalHomeUrl() {
  return `${appUrl.replace(/\/$/, '')}/#/home`
}

function buildPrefixedArtifactPath(rawPath) {
  if (!teachingParityArtifactPrefix) return null
  return path.join(path.dirname(rawPath), `${teachingParityArtifactPrefix}-${path.basename(rawPath)}`)
}

async function copyPrefixedArtifact(rawPath) {
  const prefixedPath = buildPrefixedArtifactPath(rawPath)
  if (!prefixedPath) return null
  await copyFile(rawPath, prefixedPath)
  return prefixedPath
}

async function expectVisible(locator, description, timeout = 20_000) {
  await locator.waitFor({ state: 'visible', timeout })
  assert(await locator.isVisible(), `${description} should be visible`)
}

async function expectFlash(message) {
  await expectVisible(page.getByText(message, { exact: true }), `flash "${message}"`)
}

async function readSelectedOptionLabel(locator) {
  return locator.evaluate(node => {
    if (!(node instanceof HTMLSelectElement)) return ''
    return node.options[node.selectedIndex]?.textContent?.trim() ?? ''
  })
}

async function waitForFacultyCanonicalState(timeout = 5_000) {
  await page.waitForFunction(({ displayName, phone, designation }) => {
    const text = document.body.innerText || ''
    return text.includes(displayName) && text.includes(phone) && text.includes(designation)
  }, {
    displayName: updatedDisplayName,
    phone: updatedPhone,
    designation: updatedDesignation,
  }, { timeout })
}

async function facultyCanonicalStateSatisfied(timeout = 5_000) {
  try {
    await waitForFacultyCanonicalState(timeout)
    return true
  } catch {
    return false
  }
}

async function appointmentCanonicalStateSatisfied(appointmentsCard) {
  try {
    const departmentLabel = await readSelectedOptionLabel(appointmentsCard.getByRole('combobox').nth(0))
    const branchLabel = await readSelectedOptionLabel(appointmentsCard.getByRole('combobox').nth(1))
    return departmentLabel === 'Electronics and Communication Engineering' && branchLabel === 'B.Tech ECE'
  } catch {
    return false
  }
}

async function submitPatchWithStaleVersionGuard({
  submitLocator,
  responseUrlFragment,
  successMessage,
  description,
  isCanonicalStateSatisfied,
  maxAttempts = 2,
}) {
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    await expectVisible(submitLocator, `${description} submit button`)
    const responsePromise = page.waitForResponse(response => (
      response.request().method() === 'PATCH'
      && response.url().includes(responseUrlFragment)
    ), { timeout: 20_000 })
    await submitLocator.click()
    const response = await responsePromise
    if (response.ok()) {
      await expectFlash(successMessage)
      return
    }

    const responseText = await response.text().catch(() => '')
    const staleVersion = response.status() === 409 && /stale version/i.test(responseText)
    if (!staleVersion) {
      throw new Error(`${description} failed with status ${response.status()}: ${responseText || response.statusText()}`)
    }

    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(400)
    if (await isCanonicalStateSatisfied()) return
    if (attempt >= maxAttempts) {
      throw new Error(`${description} hit a stale version response after ${maxAttempts} attempts.`)
    }
  }
}

async function resolveTeachingPassword(username) {
  return resolveTeachingPasswordViaSession({
    appUrl,
    apiUrl,
    username,
    candidates: teachingPasswordCandidates,
    logPrefix: 'teaching-parity',
  })
}

async function clickAndSettle(locator, description) {
  await expectVisible(locator, description)
  await locator.click()
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(400)
}

async function focusAndActivate(locator, description, key = 'Enter') {
  await expectVisible(locator, description)
  await locator.focus()
  const isFocused = await locator.evaluate(node => node === document.activeElement)
  assert.equal(isFocused, true, `${description} should receive focus before keyboard activation`)
  await page.keyboard.press(key)
}

async function readVisibleNavLabels() {
  return page.evaluate(() => {
    return Array.from(document.querySelectorAll('[data-nav-item="true"]'))
      .filter(node => node instanceof HTMLElement && node.offsetParent !== null)
      .map(node => node.textContent?.replace(/\s+/g, ' ').trim() ?? '')
      .filter(Boolean)
  })
}

async function readNavState() {
  return page.evaluate(() => {
    return Array.from(document.querySelectorAll('[data-nav-item="true"]')).map(node => ({
      label: node.textContent?.replace(/\s+/g, ' ').trim() ?? '',
      active: node.getAttribute('data-active') === 'true',
      visible: node instanceof HTMLElement ? node.offsetParent !== null : false,
    }))
  })
}

async function readProofSurfaceState() {
  return page.evaluate(() => {
    return Array.from(document.querySelectorAll('[data-proof-surface]')).map(node => ({
      surface: node.getAttribute('data-proof-surface'),
      scope: node.getAttribute('data-proof-scope'),
      visible: node instanceof HTMLElement ? node.offsetParent !== null : false,
      label: node.textContent?.replace(/\s+/g, ' ').trim().slice(0, 160) ?? '',
    }))
  })
}

async function resolveVisibleNavItem(label, timeout = 10_000) {
  const deadline = Date.now() + timeout
  while (Date.now() < deadline) {
    const navItems = page.locator('[data-nav-item="true"]')
    const count = await navItems.count()
    for (let index = 0; index < count; index += 1) {
      const candidate = navItems.nth(index)
      const matchesLabel = await candidate.evaluate((node, expectedLabel) => {
        const text = node.textContent?.replace(/\s+/g, ' ').trim() ?? ''
        return text.includes(expectedLabel)
      }, label).catch(() => false)
      if (!matchesLabel) continue
      if (await candidate.isVisible().catch(() => false)) return candidate
    }
    await page.waitForTimeout(150)
  }

  const visibleLabels = await readVisibleNavLabels().catch(() => [])
  throw new Error(`Could not find visible navigation item "${label}". Visible nav items: ${visibleLabels.join(', ') || 'none'}`)
}

async function waitForNavItemActive(label, timeout = 10_000) {
  await page.waitForFunction(expectedLabel => {
    return Array.from(document.querySelectorAll('[data-nav-item="true"]')).some(node => {
      const text = node.textContent?.replace(/\s+/g, ' ').trim() ?? ''
      const isVisible = node instanceof HTMLElement ? node.offsetParent !== null : false
      return isVisible && text.includes(expectedLabel) && node.getAttribute('data-active') === 'true'
    })
  }, label, { timeout })
}

async function openFacultyProfile() {
  await clickAndSettle(page.locator('[data-proof-action="open-faculty-profile"]').first(), 'faculty profile navigation')
  await expectVisible(page.getByText(/^Teaching Profile$/).first(), 'teaching profile heading')
}

async function openAcademicPortalFromHome() {
  await page.goto(buildPortalHomeUrl(), { waitUntil: 'networkidle' })
  await page.waitForFunction(() => document.readyState === 'complete')
  await focusAndActivate(page.getByRole('button', { name: /Open Academic Portal/i }), 'open academic portal')
  await page.waitForFunction(() => window.location.hash === '#/app', { timeout: 60_000 })
  await expectVisible(page.locator('#teacher-username'), 'academic username input', 60_000)
  await expectVisible(page.getByText(/Teaching Workspace Live Mode/), 'academic login', 60_000)
}

async function openNavItem(label) {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const navItem = await resolveVisibleNavItem(label)
    await expectVisible(navItem, `${label} navigation`)
    if ((await navItem.getAttribute('data-active')) === 'true') {
      await page.waitForLoadState('networkidle')
      await page.waitForTimeout(400)
      return
    }
    await navItem.scrollIntoViewIfNeeded()
    if (attempt === 1) await navItem.click()
    else await focusAndActivate(navItem, `${label} navigation`)
    await page.waitForLoadState('networkidle')
    try {
      await waitForNavItemActive(label)
      await page.waitForTimeout(400)
      return
    } catch (error) {
      if (attempt >= 3) throw error
      await page.waitForTimeout(250)
    }
  }
}

async function switchRole(role) {
  const roleButton = page.locator(`[data-proof-action="switch-role"][data-proof-entity-id="${role}"]`).first()
  await clickAndSettle(roleButton, `${role} role switcher`)
}

async function waitForAcademicProofSummary(surfaceDescription) {
  const summary = page.locator('[data-proof-surface="academic-proof-summary"]').first()
  await expectVisible(summary, `${surfaceDescription} proof summary`)
  await expectVisible(summary.locator('[data-proof-summary-metric]').first(), `${surfaceDescription} proof summary metrics`)
  return summary
}

async function waitForScopedAcademicProofSummary(surfaceScope, surfaceDescription) {
  const summary = page.locator(`[data-proof-surface="academic-proof-summary"][data-proof-scope="${surfaceScope}"]`).first()
  await expectVisible(summary, `${surfaceDescription} proof summary`)
  await expectVisible(summary.locator('[data-proof-summary-metric]').first(), `${surfaceDescription} proof summary metrics`)
  return summary
}

async function waitForMentorWorkspaceSettled() {
  await waitForNavItemActive('My Mentees')
  await expectVisible(
    page.locator('[data-proof-surface="academic-proof-summary"][data-proof-scope="mentor-view"]').first(),
    'mentor view proof summary',
  )
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(1_000)
  await waitForNavItemActive('My Mentees')
}

async function openMentorQueueHistory() {
  let lastError = null
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      await openNavItem('Queue History')
      await waitForNavItemActive('Queue History', 15_000)
      await waitForScopedAcademicProofSummary('queue-history', 'mentor queue history')
      await page.waitForLoadState('networkidle')
      await page.waitForTimeout(800)
      await waitForNavItemActive('Queue History', 15_000)
      return
    } catch (error) {
      lastError = error
      await page.waitForTimeout(500)
    }
  }
  throw lastError ?? new Error('Queue History did not settle in mentor mode.')
}

async function readAcademicProofSummary(summary, surfaceDescription = 'proof summary') {
  const metricLocators = summary.locator('[data-proof-summary-metric]')
  await expectVisible(metricLocators.first(), `${surfaceDescription} first proof summary metric`)
  const metricCount = await metricLocators.count()
  assert(metricCount > 0, 'proof summary should expose at least one metric')

  const values = {}
  for (let index = 0; index < metricCount; index += 1) {
    const metric = metricLocators.nth(index)
    const metricId = await metric.getAttribute('data-proof-summary-metric')
    assert(metricId, `proof summary metric ${index + 1} should expose an id`)
    const valueLocator = metric.locator('[data-proof-summary-value]').first()
    await expectVisible(valueLocator, `${metricId} proof summary value`)
    values[metricId] = (await valueLocator.textContent() ?? '').trim()
  }
  const scopeLabel = await summary.locator('[data-proof-summary-scope-label]').first().getAttribute('data-proof-summary-scope-label')
  const mode = await summary.locator('[data-proof-summary-mode]').first().getAttribute('data-proof-summary-mode')
  assert(scopeLabel, 'proof summary should expose a scope label')
  assert(mode, 'proof summary should expose a scope mode')
  return {
    scopeLabel,
    mode,
    ...values,
  }
}

function assertAcademicProofSummaryParity(actual, expected, surfaceDescription) {
  assert.deepEqual(actual, expected, `${surfaceDescription} proof summary should match the course leader dashboard summary`)
}

try {
  await page.goto(appUrl, { waitUntil: 'networkidle' })

  await page.getByRole('button', { name: /Open System Admin/i }).click()
  await expectVisible(page.getByText(/System Admin Live Mode/), 'system admin login')

  await page.getByPlaceholder('sysadmin', { exact: true }).fill(systemAdminCredentials.identifier)
  await page.getByPlaceholder('••••••••', { exact: true }).fill(systemAdminCredentials.password)
  await page.getByRole('button', { name: 'Sign In', exact: true }).click()

  await expectVisible(page.getByText('Operations Dashboard', { exact: true }).last(), 'sysadmin dashboard')

  await page.goto(`${appUrl}#/admin/faculty-members/t1`, { waitUntil: 'networkidle' })
  await expectVisible(page.getByText(/^Faculty Detail$/).last(), 'faculty detail page')
  const facultyDetailCard = page.getByText(/^Faculty Detail$/).last().locator('xpath=ancestor::*[@data-surface][1]')

  await facultyDetailCard.getByRole('button', { name: 'Edit Faculty', exact: true }).click()
  await expectVisible(page.getByRole('button', { name: 'Save Faculty', exact: true }), 'faculty save button')
  const teachingUsername = await page.getByLabel('Faculty Username', { exact: true }).inputValue()
  await page.getByLabel('Faculty Display Name', { exact: true }).fill(updatedDisplayName)
  await page.getByLabel('Faculty Phone', { exact: true }).fill(updatedPhone)
  await page.getByLabel('Faculty Designation', { exact: true }).fill(updatedDesignation)
  await submitPatchWithStaleVersionGuard({
    submitLocator: page.getByRole('button', { name: 'Save Faculty', exact: true }),
    responseUrlFragment: '/api/admin/faculty/t1',
    successMessage: 'Faculty profile updated.',
    description: 'faculty profile save',
    isCanonicalStateSatisfied: () => facultyCanonicalStateSatisfied(),
  })
  await waitForFacultyCanonicalState()

  const appointmentsSwitch = page.locator('button, [role="tab"]').filter({ hasText: /^Appointments/ }).first()
  await expectVisible(appointmentsSwitch, 'appointments switcher')
  await appointmentsSwitch.click()
  const appointmentsCard = page.getByText(/^Appointments$/).last().locator('xpath=ancestor::*[@data-surface][1]')
  await appointmentsCard.getByRole('button', { name: 'Edit', exact: true }).first().click()
  await appointmentsCard.getByRole('combobox').nth(0).selectOption({ label: 'Electronics and Communication Engineering' })
  await appointmentsCard.getByRole('combobox').nth(1).selectOption({ label: 'B.Tech ECE' })
  await submitPatchWithStaleVersionGuard({
    submitLocator: appointmentsCard.getByRole('button', { name: 'Save Appointment', exact: true }),
    responseUrlFragment: '/api/admin/appointments/',
    successMessage: 'Appointment updated.',
    description: 'faculty appointment save',
    isCanonicalStateSatisfied: () => appointmentCanonicalStateSatisfied(appointmentsCard),
  })
  assert.equal(await appointmentCanonicalStateSatisfied(appointmentsCard), true, 'appointment should remain pinned to ECE / B.Tech ECE')

  await page.getByRole('button', { name: 'Logout', exact: true }).click()
  await expectVisible(page.getByRole('button', { name: /Open Academic Portal/i }), 'portal selector', 60_000)
  await openAcademicPortalFromHome()

  await page.locator('#teacher-username').fill(teachingUsername)
  await expectVisible(page.getByText('Selected profile', { exact: true }), 'selected teaching profile preview')
  await page.waitForFunction((name) => document.body.innerText.includes(name), updatedDisplayName)
  await page.waitForFunction((department) => document.body.innerText.includes(department), 'ECE')
  await page.waitForFunction((designation) => document.body.innerText.includes(designation), updatedDesignation)
  await page.waitForFunction(() => (
    document.body.innerText.includes('Course Leader')
    && document.body.innerText.includes('Mentor')
    && document.body.innerText.includes('HoD')
  ))
  await page.waitForFunction((username) => (document.querySelector('#teacher-username') instanceof HTMLInputElement) && document.querySelector('#teacher-username').value === username, teachingUsername)

  const teachingPassword = await resolveTeachingPassword(teachingUsername)
  await page.locator('#teacher-password').fill(teachingPassword)
  await page.getByRole('button', { name: 'Sign In', exact: true }).click()

  await openFacultyProfile()
  await expectVisible(page.getByText(updatedDisplayName, { exact: true }).first(), 'updated display name on teaching profile')
  await expectVisible(page.getByText(updatedPhone, { exact: true }).first(), 'updated phone on teaching profile')
  await expectVisible(page.getByText(updatedDesignation, { exact: true }).first(), 'updated designation on teaching profile')
  await expectVisible(page.getByText(/^Electronics and Communication Engineering$/).first(), 'updated department on teaching profile')
  await expectVisible(page.getByText(/Course Leader/).first(), 'course leader permission chip')
  await expectVisible(page.getByText(/Mentor/).first(), 'mentor permission chip')
  await expectVisible(page.getByText(/HoD/).first(), 'hod permission chip')
  await expectVisible(page.locator('[data-proof-surface="teacher-proof-panel"]').first(), 'teacher proof panel')

  await page.screenshot({ path: successScreenshot, fullPage: true })

  await openNavItem('Dashboard')
  await expectVisible(page.getByText(/Good/).first(), 'course leader dashboard greeting')
  const dashboardSummary = await waitForAcademicProofSummary('course leader dashboard')
  const dashboardSummarySnapshot = await readAcademicProofSummary(dashboardSummary)
  await page.screenshot({ path: courseLeaderDashboardScreenshot, fullPage: true })

  await switchRole('Mentor')
  await expectVisible(page.getByText(/^My Mentees$/).first(), 'mentor landing page')
  const mentorSummary = await waitForAcademicProofSummary('mentor view')
  const mentorSummarySnapshot = await readAcademicProofSummary(mentorSummary)
  assertAcademicProofSummaryParity(mentorSummarySnapshot, dashboardSummarySnapshot, 'mentor view')
  await page.screenshot({ path: mentorViewScreenshot, fullPage: true })

  await waitForMentorWorkspaceSettled()
  await openMentorQueueHistory()
  const queueSummary = await waitForScopedAcademicProofSummary('queue-history', 'mentor queue history')
  const queueSummarySnapshot = await readAcademicProofSummary(queueSummary, 'mentor queue history')
  assertAcademicProofSummaryParity(queueSummarySnapshot, dashboardSummarySnapshot, 'mentor queue history')
  await page.screenshot({ path: queueHistoryScreenshot, fullPage: true })

  const prefixedSuccessScreenshot = await copyPrefixedArtifact(successScreenshot)
  const prefixedCourseLeaderDashboardScreenshot = await copyPrefixedArtifact(courseLeaderDashboardScreenshot)
  const prefixedMentorViewScreenshot = await copyPrefixedArtifact(mentorViewScreenshot)
  const prefixedQueueHistoryScreenshot = await copyPrefixedArtifact(queueHistoryScreenshot)

  console.log(`System admin -> teaching parity smoke passed.`)
  console.log(`Screenshots:`)
  console.log(`- faculty profile: ${successScreenshot}`)
  console.log(`- course leader dashboard: ${courseLeaderDashboardScreenshot}`)
  console.log(`- mentor view: ${mentorViewScreenshot}`)
  console.log(`- queue history: ${queueHistoryScreenshot}`)
  if (
    prefixedSuccessScreenshot
    || prefixedCourseLeaderDashboardScreenshot
    || prefixedMentorViewScreenshot
    || prefixedQueueHistoryScreenshot
  ) {
    console.log('Prefixed teaching-parity artifacts:')
    if (prefixedSuccessScreenshot) console.log(`- faculty profile: ${prefixedSuccessScreenshot}`)
    if (prefixedCourseLeaderDashboardScreenshot) console.log(`- course leader dashboard: ${prefixedCourseLeaderDashboardScreenshot}`)
    if (prefixedMentorViewScreenshot) console.log(`- mentor view: ${prefixedMentorViewScreenshot}`)
    if (prefixedQueueHistoryScreenshot) console.log(`- queue history: ${prefixedQueueHistoryScreenshot}`)
  }
} catch (error) {
  const failurePayload = {
    failedAt: new Date().toISOString(),
    appUrl,
    apiUrl,
    pageUrl: page.url(),
    error: error instanceof Error ? { name: error.name, message: error.message } : { message: String(error) },
    pageErrors,
    consoleMessages,
    navState: await readNavState().catch(() => []),
    proofSurfaces: await readProofSurfaceState().catch(() => []),
  }
  let prefixedFailureReport = null
  let prefixedFailureScreenshot = null
  try {
    await writeFile(failureReport, `${JSON.stringify(failurePayload, null, 2)}\n`, 'utf8')
    prefixedFailureReport = await copyPrefixedArtifact(failureReport).catch(() => null)
    await page.screenshot({ path: failureScreenshot, fullPage: true })
    prefixedFailureScreenshot = await copyPrefixedArtifact(failureScreenshot).catch(() => null)
    console.error(`System admin -> teaching parity smoke failed. Screenshot: ${failureScreenshot}`)
    if (prefixedFailureReport || prefixedFailureScreenshot) {
      console.error('Prefixed teaching-parity failure artifacts:')
      if (prefixedFailureReport) console.error(`- report: ${prefixedFailureReport}`)
      if (prefixedFailureScreenshot) console.error(`- screenshot: ${prefixedFailureScreenshot}`)
    }
  } catch {
    // Ignore screenshot failures so the original error is preserved.
  }
  throw error
} finally {
  await browser.close()
}
