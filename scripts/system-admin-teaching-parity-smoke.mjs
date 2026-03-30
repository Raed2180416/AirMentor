import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { resolveSystemAdminLiveCredentials } from './system-admin-live-auth.mjs'

const playwrightRoot = process.env.PLAYWRIGHT_ROOT
const appUrl = process.env.PLAYWRIGHT_APP_URL ?? 'http://127.0.0.1:5173'
const apiUrl = process.env.PLAYWRIGHT_API_URL ?? appUrl
const outputDir = process.env.PLAYWRIGHT_OUTPUT_DIR ?? 'output/playwright'

assert(playwrightRoot, 'PLAYWRIGHT_ROOT is required')

const { firefox } = await import(`file://${playwrightRoot}/lib/node_modules/playwright/index.mjs`)

await mkdir(outputDir, { recursive: true })

const successScreenshot = path.join(outputDir, 'system-admin-teaching-parity-smoke.png')
const courseLeaderDashboardScreenshot = path.join(outputDir, 'course-leader-dashboard-proof.png')
const mentorViewScreenshot = path.join(outputDir, 'mentor-view-proof.png')
const queueHistoryScreenshot = path.join(outputDir, 'queue-history-proof.png')
const failureScreenshot = path.join(outputDir, 'system-admin-teaching-parity-smoke-failure.png')
const systemAdminCredentials = resolveSystemAdminLiveCredentials({
  scriptLabel: 'System admin teaching parity smoke',
})

const browser = await firefox.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1440, height: 1400 } })

const updatedDisplayName = 'Dr. Kavitha Rao QA'
const updatedPhone = '+91-9000001111'
const updatedDesignation = 'Senior Associate Professor'
const teachingPasswordCandidates = ['faculty1234', '1234']

async function expectVisible(locator, description) {
  await locator.waitFor({ state: 'visible', timeout: 20_000 })
  assert(await locator.isVisible(), `${description} should be visible`)
}

async function expectFlash(message) {
  await expectVisible(page.getByText(message, { exact: true }), `flash "${message}"`)
}

async function resolveTeachingPassword(username) {
  const sessionUrl = new URL('/api/session/login', apiUrl)
  const origin = new URL(appUrl).origin
  for (const password of teachingPasswordCandidates) {
    const response = await fetch(sessionUrl, {
      method: 'POST',
      headers: {
        origin,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ identifier: username, password }),
    })
    if (response.ok) return password
  }
  throw new Error(`Could not resolve a working teaching password for ${username}`)
}

async function clickAndSettle(locator, description) {
  await expectVisible(locator, description)
  await locator.click()
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(400)
}

async function openFacultyProfile() {
  await clickAndSettle(page.locator('[data-proof-action="open-faculty-profile"]').first(), 'faculty profile navigation')
  await expectVisible(page.getByText(/^Teaching Profile$/).first(), 'teaching profile heading')
}

async function openNavItem(label) {
  const navItem = page.locator('[data-nav-item="true"]').filter({ hasText: label }).first()
  await clickAndSettle(navItem, `${label} navigation`)
}

async function switchRole(role) {
  const roleButton = page.locator(`[data-proof-action="switch-role"][data-proof-entity-id="${role}"]`).first()
  await clickAndSettle(roleButton, `${role} role switcher`)
}

async function waitForAcademicProofSummary(surfaceDescription) {
  const summary = page.locator('[data-proof-surface="academic-proof-summary"]').first()
  await expectVisible(summary, `${surfaceDescription} proof summary`)
  return summary
}

async function readAcademicProofSummary(summary) {
  const metricIds = [
    'operational-semester',
    'high-watch',
    'open-queue',
    'mentor-scope',
    'requests',
    'owned-classes',
  ]
  const values = {}
  for (const metricId of metricIds) {
    const valueLocator = summary.locator(`[data-proof-summary-value="${metricId}"]`).first()
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
  await page.getByRole('button', { name: 'Save Faculty', exact: true }).click()
  await expectFlash('Faculty profile updated.')

  const appointmentsSwitch = page.locator('button, [role="tab"]').filter({ hasText: /^Appointments/ }).first()
  await expectVisible(appointmentsSwitch, 'appointments switcher')
  await appointmentsSwitch.click()
  const appointmentsCard = page.getByText(/^Appointments$/).last().locator('xpath=ancestor::*[@data-surface][1]')
  await appointmentsCard.getByRole('button', { name: 'Edit', exact: true }).first().click()
  await appointmentsCard.getByRole('combobox').nth(0).selectOption({ label: 'Electronics and Communication Engineering' })
  await appointmentsCard.getByRole('combobox').nth(1).selectOption({ label: 'B.Tech ECE' })
  await appointmentsCard.getByRole('button', { name: 'Save Appointment', exact: true }).click()
  await expectFlash('Appointment updated.')

  await page.getByRole('button', { name: 'Logout', exact: true }).click()
  await expectVisible(page.getByRole('button', { name: /Open Academic Portal/i }), 'portal selector')

  await page.getByRole('button', { name: /Open Academic Portal/i }).click()
  await expectVisible(page.getByText(/Teaching Workspace Live Mode/), 'academic login')

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

  await openNavItem('Queue History')
  await expectVisible(page.getByText(/^Queue History$/).first(), 'mentor queue history page')
  const queueSummary = await waitForAcademicProofSummary('mentor queue history')
  const queueSummarySnapshot = await readAcademicProofSummary(queueSummary)
  assertAcademicProofSummaryParity(queueSummarySnapshot, dashboardSummarySnapshot, 'mentor queue history')
  await page.screenshot({ path: queueHistoryScreenshot, fullPage: true })

  console.log(`System admin -> teaching parity smoke passed.`)
  console.log(`Screenshots:`)
  console.log(`- faculty profile: ${successScreenshot}`)
  console.log(`- course leader dashboard: ${courseLeaderDashboardScreenshot}`)
  console.log(`- mentor view: ${mentorViewScreenshot}`)
  console.log(`- queue history: ${queueHistoryScreenshot}`)
} catch (error) {
  try {
    await page.screenshot({ path: failureScreenshot, fullPage: true })
    console.error(`System admin -> teaching parity smoke failed. Screenshot: ${failureScreenshot}`)
  } catch {
    // Ignore screenshot failures so the original error is preserved.
  }
  throw error
} finally {
  await browser.close()
}
