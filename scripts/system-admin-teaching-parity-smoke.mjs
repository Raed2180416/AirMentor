import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'

const playwrightRoot = process.env.PLAYWRIGHT_ROOT
const appUrl = process.env.PLAYWRIGHT_APP_URL ?? 'http://127.0.0.1:5173'
const outputDir = process.env.PLAYWRIGHT_OUTPUT_DIR ?? 'output/playwright'

assert(playwrightRoot, 'PLAYWRIGHT_ROOT is required')

const { firefox } = await import(`file://${playwrightRoot}/lib/node_modules/playwright/index.mjs`)

await mkdir(outputDir, { recursive: true })

const successScreenshot = path.join(outputDir, 'system-admin-teaching-parity-smoke.png')
const failureScreenshot = path.join(outputDir, 'system-admin-teaching-parity-smoke-failure.png')

const browser = await firefox.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1440, height: 1400 } })

const updatedDisplayName = 'Dr. Kavitha Rao QA'
const updatedPhone = '+91-9000001111'
const updatedDesignation = 'Senior Associate Professor'

async function expectVisible(locator, description) {
  await locator.waitFor({ state: 'visible', timeout: 20_000 })
  assert(await locator.isVisible(), `${description} should be visible`)
}

async function expectFlash(message) {
  await expectVisible(page.getByText(message, { exact: true }), `flash "${message}"`)
}

try {
  await page.goto(appUrl, { waitUntil: 'networkidle' })

  await page.getByRole('button', { name: /Open System Admin/i }).click()
  await expectVisible(page.getByText(/System Admin Live Mode/), 'system admin login')

  await page.getByPlaceholder('sysadmin', { exact: true }).fill('sysadmin')
  await page.getByPlaceholder('••••••••', { exact: true }).fill('admin1234')
  await page.getByRole('button', { name: 'Sign In', exact: true }).click()

  await expectVisible(page.getByText('Operations Dashboard', { exact: true }).last(), 'sysadmin dashboard')

  await page.goto(`${appUrl}#/admin/faculty-members/t1`, { waitUntil: 'networkidle' })
  await expectVisible(page.getByText(/^Faculty Detail$/).last(), 'faculty detail page')
  const facultyDetailCard = page.getByText(/^Faculty Detail$/).last().locator('xpath=ancestor::*[@data-surface="card"][1]')

  await facultyDetailCard.getByRole('button', { name: 'Edit Faculty', exact: true }).evaluate(button => button.click())
  await expectVisible(facultyDetailCard.getByRole('button', { name: 'Save Faculty', exact: true }), 'faculty save button')
  await facultyDetailCard.getByPlaceholder('Faculty name', { exact: true }).fill(updatedDisplayName)
  await facultyDetailCard.getByPlaceholder('+91…', { exact: true }).fill(updatedPhone)
  await facultyDetailCard.getByPlaceholder('Assistant Professor', { exact: true }).fill(updatedDesignation)
  await facultyDetailCard.getByRole('button', { name: 'Save Faculty', exact: true }).click()
  await expectFlash('Faculty profile updated.')

  await page.getByRole('button', { name: /^Appointments/ }).click()
  await page.getByRole('button', { name: 'Edit', exact: true }).nth(0).click()
  await page.getByRole('combobox').nth(0).selectOption({ label: 'Electronics and Communication Engineering' })
  await page.getByRole('combobox').nth(1).selectOption({ label: 'B.Tech ECE' })
  await page.getByRole('button', { name: 'Save Appointment', exact: true }).click()
  await expectFlash('Appointment updated.')

  await page.getByRole('button', { name: 'Portal', exact: true }).click()
  await expectVisible(page.getByRole('button', { name: /Open Academic Portal/i }), 'portal selector')

  await page.getByRole('button', { name: /Open Academic Portal/i }).click()
  await expectVisible(page.getByText(/Teaching Workspace Live Mode/), 'academic login')

  await page.locator('#teacher-login').selectOption('t1')
  await page.waitForFunction((name) => document.body.innerText.includes(name), updatedDisplayName)
  await page.waitForFunction((department) => document.body.innerText.includes(department), 'ECE')
  await page.waitForFunction((designation) => document.body.innerText.includes(designation), updatedDesignation)
  await page.waitForFunction((roles) => document.body.innerText.includes(roles), 'Course Leader / Mentor / HoD')

  await page.locator('#teacher-password').fill('1234')
  await page.getByRole('button', { name: 'Sign In', exact: true }).click()

  await expectVisible(page.getByRole('button', { name: 'Faculty Profile', exact: true }), 'faculty profile nav button')
  await page.getByRole('button', { name: 'Faculty Profile', exact: true }).click()

  await expectVisible(page.getByText(/^Teaching Profile$/).first(), 'teaching profile heading')
  await expectVisible(page.getByText(updatedDisplayName, { exact: true }).first(), 'updated display name on teaching profile')
  await expectVisible(page.getByText(updatedPhone, { exact: true }).first(), 'updated phone on teaching profile')
  await expectVisible(page.getByText(updatedDesignation, { exact: true }).first(), 'updated designation on teaching profile')
  await expectVisible(page.getByText(/^Electronics and Communication Engineering$/).first(), 'updated department on teaching profile')
  await expectVisible(page.getByText(/Course Leader/).first(), 'course leader permission chip')
  await expectVisible(page.getByText(/Mentor/).first(), 'mentor permission chip')
  await expectVisible(page.getByText(/HoD/).first(), 'hod permission chip')

  await page.screenshot({ path: successScreenshot, fullPage: true })
  console.log(`System admin -> teaching parity smoke passed. Screenshot: ${successScreenshot}`)
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
