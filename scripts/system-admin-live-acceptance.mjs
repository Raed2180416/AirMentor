import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'

const playwrightRoot = process.env.PLAYWRIGHT_ROOT
const appUrl = process.env.PLAYWRIGHT_APP_URL ?? 'http://127.0.0.1:4173'
const outputDir = process.env.PLAYWRIGHT_OUTPUT_DIR ?? 'output/playwright'

assert(playwrightRoot, 'PLAYWRIGHT_ROOT is required')

const { firefox } = await import(`file://${playwrightRoot}/lib/node_modules/playwright/index.mjs`)

await mkdir(outputDir, { recursive: true })

const successScreenshot = path.join(outputDir, 'system-admin-live-acceptance.png')
const failureScreenshot = path.join(outputDir, 'system-admin-live-acceptance-failure.png')

const browser = await firefox.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1440, height: 1400 } })

async function expectVisible(locator, description) {
  await locator.waitFor({ state: 'visible', timeout: 20_000 })
  assert(await locator.isVisible(), `${description} should be visible`)
}

async function expectFlash(message) {
  await expectVisible(page.getByText(message, { exact: true }), `flash "${message}"`)
}

async function expectBodyText(text, description) {
  await page.waitForFunction((value) => document.body.innerText.includes(value), text, { timeout: 20_000 })
  assert.ok(true, `${description} should be present`)
}

async function expectBodyTextOneOf(values, description) {
  await page.waitForFunction((candidates) => {
    const bodyText = document.body.innerText
    return candidates.some(value => bodyText.includes(value))
  }, values, { timeout: 20_000 })
  assert.ok(true, `${description} should be present`)
}

async function findVisibleRequestAction() {
  for (const action of ['Take Review', 'Approve', 'Mark Implemented', 'Close']) {
    const button = page.getByRole('button', { name: action, exact: true })
    if (await button.isVisible().catch(() => false)) return { action, button }
  }
  return null
}

async function advanceRequestToClosed() {
  for (let step = 0; step < 6; step += 1) {
    const closedStatus = page.getByText(/^Closed$/).first()
    if (await closedStatus.isVisible().catch(() => false)) return

    const nextAction = await findVisibleRequestAction()
    assert(nextAction, 'Expected a visible request action button before closure')

    await nextAction.button.click()
    await expectFlash('Request advanced.')
    await page.waitForFunction((previousAction) => {
      const hasClosed = Array.from(document.querySelectorAll('*')).some(node => node.textContent?.trim() === 'Closed')
      if (hasClosed) return true
      return !Array.from(document.querySelectorAll('button')).some(button => button.textContent?.trim() === previousAction)
    }, nextAction.action)
  }

  await expectVisible(page.getByText(/^Closed$/).first(), 'closed request status')
}

try {
  await page.goto(appUrl, { waitUntil: 'networkidle' })

  await page.getByRole('button', { name: /Open System Admin/i }).click()
  await expectVisible(page.getByText(/System Admin Live Mode/), 'live admin login')

  await page.getByPlaceholder('sysadmin', { exact: true }).fill('sysadmin')
  await page.getByPlaceholder('••••••••', { exact: true }).fill('admin1234')
  await page.getByRole('button', { name: 'Sign In', exact: true }).click()

  await expectVisible(page.getByText('Operations Dashboard', { exact: true }).last(), 'live admin overview')
  await expectVisible(page.getByRole('textbox', { name: 'Admin search' }), 'admin search')

  await page.goto(`${appUrl}#/admin/faculties`, { waitUntil: 'networkidle' })
  await expectVisible(page.getByText(/^Academic Faculties$/).last(), 'faculties workspace')

  const facultyCode = `QA${Date.now().toString().slice(-4)}`
  const facultyName = `Quality Assurance Faculty ${facultyCode}`
  const updatedFacultyName = `${facultyName} Updated`
  const departmentCode = `Q${facultyCode.slice(-3)}`
  const departmentName = `Quality Systems ${facultyCode}`
  const updatedDepartmentName = `${departmentName} Updated`
  const branchCode = `QS-${facultyCode.slice(-2)}`
  const branchName = `Quality Analytics ${facultyCode}`
  const updatedBranchName = `${branchName} Updated`
  const batchYear = '2028'
  const batchLabel = `${batchYear}-A`
  const studentUsn = '1MS24CS022'

  const addFacultyForm = page.getByText('Add Academic Faculty', { exact: true }).locator('xpath=ancestor::form[1]')
  await addFacultyForm.locator('input').nth(0).fill(facultyCode)
  await addFacultyForm.locator('input').nth(1).fill(facultyName)
  await addFacultyForm.locator('textarea').fill('Created by the live acceptance flow.')
  await addFacultyForm.getByRole('button', { name: 'Add Faculty', exact: true }).click()
  await expectFlash('Academic faculty created.')
  await page.getByRole('combobox').nth(0).selectOption({ label: facultyName })
  await page.getByRole('button', { name: 'Edit Faculty', exact: true }).click()
  await page.getByLabel('Faculty Name', { exact: true }).fill(updatedFacultyName)
  await page.getByRole('button', { name: 'Save Faculty', exact: true }).click()
  await expectFlash('Academic faculty updated.')
  await expectBodyText(updatedFacultyName, 'updated academic faculty name')

  const addDepartmentForm = page.getByText('Add Department', { exact: true }).locator('xpath=ancestor::form[1]')
  await addDepartmentForm.locator('input').nth(0).fill(departmentCode)
  await addDepartmentForm.locator('input').nth(1).fill(departmentName)
  await addDepartmentForm.getByRole('button', { name: 'Add Department', exact: true }).click()
  await expectFlash('Department created.')
  await page.getByRole('combobox').nth(1).selectOption({ label: departmentName })
  await page.getByRole('button', { name: 'Edit Department', exact: true }).click()
  await page.getByLabel('Department Name', { exact: true }).fill(updatedDepartmentName)
  await page.getByRole('button', { name: 'Save Department', exact: true }).click()
  await expectFlash('Department updated.')
  await expectBodyText(updatedDepartmentName, 'updated department name')

  const addBranchForm = page.getByText('Add Branch', { exact: true }).locator('xpath=ancestor::form[1]')
  await addBranchForm.locator('input').nth(0).fill(branchCode)
  await addBranchForm.locator('input').nth(1).fill(branchName)
  await addBranchForm.locator('select').first().selectOption('UG')
  await addBranchForm.locator('input').nth(2).fill('8')
  await addBranchForm.getByRole('button', { name: 'Add Branch', exact: true }).click()
  await expectFlash('Branch created.')
  await page.getByRole('combobox').nth(2).selectOption({ label: branchName })
  await page.getByRole('button', { name: 'Edit Branch', exact: true }).click()
  await page.getByLabel('Branch Name', { exact: true }).fill(updatedBranchName)
  await page.getByRole('button', { name: 'Save Branch', exact: true }).click()
  await expectFlash('Branch updated.')
  await expectBodyText(updatedBranchName, 'updated branch name')

  const addBatchForm = page.getByText('Add Batch', { exact: true }).locator('xpath=ancestor::form[1]')
  await addBatchForm.locator('input').nth(0).fill(batchYear)
  await addBatchForm.locator('input').nth(1).fill('5')
  await addBatchForm.locator('input').nth(2).fill('A')
  await addBatchForm.getByRole('button', { name: 'Add Batch', exact: true }).click()
  await expectFlash('Batch created.')
  await page.getByRole('combobox').nth(3).selectOption({ index: 1 })
  await page.getByRole('button', { name: 'Edit Batch', exact: true }).click()
  await page.getByLabel('Batch Label', { exact: true }).fill(batchLabel)
  await page.getByLabel('Batch Active Semester', { exact: true }).fill('6')
  await page.getByLabel('Batch Section Labels', { exact: true }).fill('A, B')
  await page.getByRole('button', { name: 'Save Batch', exact: true }).click()
  await expectFlash('Batch updated.')
  await expectVisible(page.getByText(/^Sem 6$/).first(), 'updated batch semester chip')

  await expectVisible(page.getByText('Scope Governance Override', { exact: true }).first(), 'scope governance section')
  await expectBodyTextOneOf(
    ['Curriculum Model Inputs', 'Academic Term', 'Academic Terms', 'Semester Conditions', 'Batch Configuration'],
    'batch workspace content after save',
  )
  await expectVisible(page.getByText('Students View', { exact: true }).first(), 'student launch card')
  await expectVisible(page.getByText('Faculty View', { exact: true }).first(), 'faculty launch card')

  await page.goto(`${appUrl}#/admin/faculties`, { waitUntil: 'networkidle' })
  await page.getByRole('combobox').nth(0).selectOption({ label: updatedFacultyName })
  await page.getByRole('combobox').nth(1).selectOption({ label: updatedDepartmentName })
  await page.getByRole('combobox').nth(2).selectOption({ label: updatedBranchName })
  await page.getByRole('combobox').nth(3).selectOption({ index: 1 })
  await expectVisible(page.getByText('Scope Governance Override', { exact: true }).first(), 'scope governance section after refresh')
  await expectBodyTextOneOf(
    ['Curriculum Model Inputs', 'Academic Term', 'Academic Terms', 'Semester Conditions', 'Batch Configuration'],
    'batch workspace content after refresh',
  )

  await page.goto(`${appUrl}#/admin/overview`, { waitUntil: 'networkidle' })
  await expectVisible(page.getByText('Operations Dashboard', { exact: true }).last(), 'overview before global search')
  const search = page.getByRole('textbox', { name: 'Admin search' })
  await search.fill(studentUsn)
  await page.getByRole('button', { name: new RegExp(studentUsn) }).first().click()
  await expectVisible(page.getByText(/^Student Detail$/).last(), 'student detail panel')
  await expectVisible(page.getByText(/CGPA/).last(), 'student cgpa chip')

  await page.goto(`${appUrl}#/admin/requests`, { waitUntil: 'networkidle' })
  await page.getByRole('button').filter({ hasText: 'Grant additional mentor mapping coverage' }).first().click()
  await advanceRequestToClosed()

  await page.screenshot({ path: successScreenshot, fullPage: true })
  console.log(`System admin live acceptance flow passed. Screenshot: ${successScreenshot}`)
} catch (error) {
  try {
    await page.screenshot({ path: failureScreenshot, fullPage: true })
    console.error(`System admin live acceptance flow failed. Screenshot: ${failureScreenshot}`)
  } catch {
    // Ignore screenshot failures so the original error is preserved.
  }
  throw error
} finally {
  await browser.close()
}
