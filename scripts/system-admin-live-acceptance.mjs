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

async function clickTab(name) {
  await page.getByRole('button', { name, exact: true }).click()
}

try {
  await page.goto(appUrl, { waitUntil: 'networkidle' })

  await page.getByRole('button', { name: /Open System Admin/i }).click()
  await expectVisible(page.getByText(/System Admin Live Mode/), 'live admin login')

  await page.getByPlaceholder('sysadmin', { exact: true }).fill('sysadmin')
  await page.getByPlaceholder('••••••••', { exact: true }).fill('admin1234')
  await page.getByRole('button', { name: 'Sign In', exact: true }).click()

  await expectVisible(page.getByText(/Search-first academic configuration\./), 'live admin overview')
  await expectVisible(page.getByRole('textbox', { name: 'Global admin search' }), 'global admin search')

  await clickTab('Faculties')
  await expectVisible(page.getByText(/^Academic Faculties$/).last(), 'faculties workspace')

  const facultyCode = `QA${Date.now().toString().slice(-4)}`
  const facultyName = `Quality Assurance Faculty ${facultyCode}`
  const departmentCode = `Q${facultyCode.slice(-3)}`
  const departmentName = `Quality Systems ${facultyCode}`
  const branchCode = `QS-${facultyCode.slice(-2)}`
  const branchName = `Quality Analytics ${facultyCode}`
  const batchYear = '2028'
  const curriculumCode = `QA${facultyCode.slice(-2)}99`
  const studentUsn = '1MS24CS022'

  await page.getByPlaceholder('ENG', { exact: true }).fill(facultyCode)
  await page.getByPlaceholder('Engineering and Technology', { exact: true }).fill(facultyName)
  await page.getByPlaceholder('Overview', { exact: true }).fill('Created by the live acceptance flow.')
  await page.getByRole('button', { name: 'Add Academic Faculty', exact: true }).click()
  await expectFlash('Academic faculty created.')
  await page.getByText(facultyName, { exact: true }).click()

  await page.getByPlaceholder('CSE', { exact: true }).fill(departmentCode)
  await page.getByPlaceholder('Computer Science and Engineering', { exact: true }).fill(departmentName)
  await page.getByRole('button', { name: 'Add Department', exact: true }).click()
  await expectFlash('Department created.')
  await page.getByText(departmentName, { exact: true }).click()

  await page.getByPlaceholder('CSE-AI', { exact: true }).fill(branchCode)
  await page.getByPlaceholder('AI and Data Science', { exact: true }).fill(branchName)
  await page.getByPlaceholder('8', { exact: true }).fill('8')
  await page.getByRole('button', { name: 'Add Branch', exact: true }).click()
  await expectFlash('Branch created.')
  await page.getByText(branchName, { exact: true }).click()

  await page.getByPlaceholder('2022', { exact: true }).fill(batchYear)
  await page.getByPlaceholder('5', { exact: true }).first().fill('5')
  await page.getByPlaceholder('A, B', { exact: true }).fill('A')
  await page.getByRole('button', { name: 'Add Batch', exact: true }).click()
  await expectFlash('Batch created.')
  await page.getByRole('button', { name: new RegExp(`Batch ${batchYear}`) }).first().click()

  await page.getByRole('button', { name: /Save Batch Policy/i }).click()
  await expectFlash('Batch policy saved.')

  await page.getByPlaceholder('2026-27', { exact: true }).fill('2028-29')
  await page.getByPlaceholder('5', { exact: true }).last().fill('5')
  await page.getByPlaceholder('YYYY-MM-DD', { exact: true }).nth(0).fill('2028-07-10')
  await page.getByPlaceholder('YYYY-MM-DD', { exact: true }).nth(1).fill('2028-11-20')
  await page.getByRole('button', { name: 'Add Term', exact: true }).click()
  await expectFlash('Academic term created.')

  await page.getByPlaceholder('Semester', { exact: true }).fill('5')
  await page.getByPlaceholder('CS699', { exact: true }).fill(curriculumCode)
  await page.getByPlaceholder('Advanced Governance Systems', { exact: true }).fill('Quality Governance Lab')
  await page.getByPlaceholder('4', { exact: true }).last().fill('4')
  await page.getByRole('button', { name: 'Add Curriculum Course', exact: true }).click()
  await expectFlash('Curriculum course created.')
  await expectVisible(page.getByText(new RegExp(curriculumCode)), 'new curriculum course row')

  await page.reload({ waitUntil: 'networkidle' })
  await clickTab('Faculties')
  await page.getByText(facultyName, { exact: true }).click()
  await page.getByText(departmentName, { exact: true }).click()
  await page.getByText(branchName, { exact: true }).click()
  await page.getByRole('button', { name: new RegExp(`Batch ${batchYear}`) }).first().click()
  await expectVisible(page.getByText(new RegExp(curriculumCode)), 'persisted curriculum after refresh')

  const search = page.getByRole('textbox', { name: 'Global admin search' })
  await search.fill(studentUsn)
  await page.getByRole('button', { name: new RegExp(studentUsn) }).first().click()
  await expectVisible(page.getByText(/^Student Detail$/).last(), 'student detail panel')
  await expectVisible(page.getByText(/CGPA/).last(), 'student cgpa chip')

  await clickTab('Faculty Members')
  await page.getByRole('button', { name: /Dr\. Kavitha Rao/i }).click()
  await expectVisible(page.getByText(/^Faculty Detail$/).last(), 'faculty detail panel')
  await expectVisible(page.getByText(/Assigned Classes/), 'faculty assigned classes')

  await clickTab('Requests')
  await page.getByText(/Grant additional mentor mapping coverage/i).click()
  await page.getByRole('button', { name: 'Take Review', exact: true }).click()
  await expectFlash('Request advanced.')
  await page.getByRole('button', { name: 'Approve', exact: true }).click()
  await expectFlash('Request advanced.')
  await page.getByRole('button', { name: 'Mark Implemented', exact: true }).click()
  await expectFlash('Request advanced.')
  await page.getByRole('button', { name: 'Close', exact: true }).click()
  await expectFlash('Request advanced.')
  await expectVisible(page.getByText(/^Closed$/).first(), 'closed request status')

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
