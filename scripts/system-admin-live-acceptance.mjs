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
  await expectVisible(page.getByRole('textbox', { name: 'Global admin search' }), 'global admin search')

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
  const curriculumCode = `QA${facultyCode.slice(-2)}99`
  const updatedCurriculumTitle = 'Quality Governance Lab Advanced'
  const studentUsn = '1MS24CS022'

  await page.getByPlaceholder('ENG', { exact: true }).fill(facultyCode)
  await page.getByPlaceholder('Engineering and Technology', { exact: true }).fill(facultyName)
  await page.getByPlaceholder('Overview', { exact: true }).fill('Created by the live acceptance flow.')
  await page.getByRole('button', { name: 'Add Faculty', exact: true }).click()
  await expectFlash('Academic faculty created.')
  await page.getByRole('combobox').nth(0).selectOption({ label: facultyName })
  await page.getByRole('button', { name: 'Edit Faculty', exact: true }).click()
  await page.getByLabel('Faculty Name', { exact: true }).fill(updatedFacultyName)
  await page.getByRole('button', { name: 'Save Faculty', exact: true }).click()
  await expectFlash('Academic faculty updated.')
  await expectBodyText(updatedFacultyName, 'updated academic faculty name')

  await page.getByPlaceholder('CSE', { exact: true }).fill(departmentCode)
  await page.getByPlaceholder('Computer Science and Engineering', { exact: true }).fill(departmentName)
  await page.getByRole('button', { name: 'Add Department', exact: true }).click()
  await expectFlash('Department created.')
  await page.getByRole('combobox').nth(1).selectOption({ label: departmentName })
  await page.getByRole('button', { name: 'Edit Department', exact: true }).click()
  await page.getByLabel('Department Name', { exact: true }).fill(updatedDepartmentName)
  await page.getByRole('button', { name: 'Save Department', exact: true }).click()
  await expectFlash('Department updated.')
  await expectBodyText(updatedDepartmentName, 'updated department name')

  await page.getByPlaceholder('CSE-AI', { exact: true }).fill(branchCode)
  await page.getByPlaceholder('AI and Data Science', { exact: true }).fill(branchName)
  await page.getByPlaceholder('8', { exact: true }).fill('8')
  await page.getByRole('button', { name: 'Add Branch', exact: true }).click()
  await expectFlash('Branch created.')
  await page.getByRole('combobox').nth(2).selectOption({ label: branchName })
  await page.getByRole('button', { name: 'Edit Branch', exact: true }).click()
  await page.getByLabel('Branch Name', { exact: true }).fill(updatedBranchName)
  await page.getByRole('button', { name: 'Save Branch', exact: true }).click()
  await expectFlash('Branch updated.')
  await expectBodyText(updatedBranchName, 'updated branch name')

  await page.getByPlaceholder('2022', { exact: true }).fill(batchYear)
  await page.getByPlaceholder('5', { exact: true }).first().fill('5')
  await page.getByPlaceholder('A, B', { exact: true }).fill('A')
  await page.getByRole('button', { name: 'Add Batch', exact: true }).click()
  await expectFlash('Batch created.')
  await page.getByRole('combobox').nth(3).selectOption({ index: 1 })
  await page.getByRole('button', { name: 'Edit Batch', exact: true }).click()
  await page.getByLabel('Batch Label', { exact: true }).fill(batchLabel)
  await page.getByLabel('Batch Active Semester', { exact: true }).fill('6')
  await page.getByLabel('Batch Section Labels', { exact: true }).fill('A, B')
  await page.getByRole('button', { name: 'Save Batch', exact: true }).click()
  await expectFlash('Batch updated.')
  await expectVisible(page.getByText(/^Sem 6$/).first(), 'updated batch semester chip')

  await page.getByRole('button', { name: /Save Batch Policy/i }).click()
  await expectFlash('Batch policy saved.')

  await page.getByPlaceholder('2026-27', { exact: true }).fill('2028-29')
  await page.getByPlaceholder('5', { exact: true }).last().fill('6')
  await page.getByPlaceholder('YYYY-MM-DD', { exact: true }).nth(0).fill('2028-07-10')
  await page.getByPlaceholder('YYYY-MM-DD', { exact: true }).nth(1).fill('2028-11-20')
  await page.getByRole('button', { name: 'Add Term', exact: true }).click()
  await expectFlash('Academic term created.')
  await page.getByRole('button', { name: 'Edit', exact: true }).nth(0).click()
  await page.getByLabel('Term Academic Year Label', { exact: true }).fill('2028-30')
  await page.getByRole('button', { name: 'Save Term', exact: true }).click()
  await expectFlash('Academic term updated.')
  await expectBodyText('Semester 6 · 2028-30', 'updated term row')

  await page.getByPlaceholder('Semester', { exact: true }).fill('6')
  await page.getByPlaceholder('CS699', { exact: true }).fill(curriculumCode)
  await page.getByPlaceholder('Advanced Governance Systems', { exact: true }).fill('Quality Governance Lab')
  await page.getByPlaceholder('4', { exact: true }).last().fill('4')
  await page.getByRole('button', { name: 'Add Curriculum Course', exact: true }).click()
  await expectFlash('Curriculum course created.')
  await expectBodyText(curriculumCode, 'new curriculum course row')
  await page.getByRole('button', { name: 'Edit', exact: true }).nth(1).click()
  await page.getByLabel('Curriculum Course Title', { exact: true }).fill(updatedCurriculumTitle)
  await page.getByRole('button', { name: 'Save Curriculum Course', exact: true }).click()
  await expectFlash('Curriculum course updated.')
  await expectBodyText(updatedCurriculumTitle, 'updated curriculum course row')

  await page.goto(`${appUrl}#/admin/faculties`, { waitUntil: 'networkidle' })
  await page.getByRole('combobox').nth(0).selectOption({ label: updatedFacultyName })
  await page.getByRole('combobox').nth(1).selectOption({ label: updatedDepartmentName })
  await page.getByRole('combobox').nth(2).selectOption({ label: updatedBranchName })
  await page.getByRole('combobox').nth(3).selectOption({ index: 1 })
  await expectBodyText(updatedCurriculumTitle, 'persisted curriculum after refresh')
  await page.getByText(`${curriculumCode} · ${updatedCurriculumTitle}`, { exact: true }).locator('xpath=ancestor::*[@data-surface="card"][1]').getByRole('button', { name: 'Delete', exact: true }).click()
  await expectFlash('Curriculum course archived.')
  await page.waitForFunction((text) => !Array.from(document.querySelectorAll('*')).some(node => node.textContent?.includes(text)), updatedCurriculumTitle)
  await page.getByText('Semester 6 · 2028-30', { exact: true }).locator('xpath=ancestor::*[@data-surface="card"][1]').getByRole('button', { name: 'Delete', exact: true }).click()
  await page.waitForFunction(() => !Array.from(document.querySelectorAll('*')).some(node => node.textContent?.includes('Semester 6 · 2028-30')))

  const search = page.getByRole('textbox', { name: 'Global admin search' })
  await search.fill(studentUsn)
  await page.getByRole('button', { name: new RegExp(studentUsn) }).first().click()
  await expectVisible(page.getByText(/^Student Detail$/).last(), 'student detail panel')
  await expectVisible(page.getByText(/CGPA/).last(), 'student cgpa chip')

  await page.goto(`${appUrl}#/admin/faculty-members/t1`, { waitUntil: 'networkidle' })
  await expectVisible(page.getByText(/^Faculty Detail$/).last(), 'faculty detail panel')
  await page.getByRole('button', { name: /^Teaching/ }).click()
  await expectVisible(page.getByText(/Current Owned Classes/), 'faculty assigned classes')

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
