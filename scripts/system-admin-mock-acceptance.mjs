import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'

const playwrightRoot = process.env.PLAYWRIGHT_ROOT
const appUrl = process.env.PLAYWRIGHT_APP_URL ?? 'http://127.0.0.1:4173'
const outputDir = process.env.PLAYWRIGHT_OUTPUT_DIR ?? 'output/playwright'

assert(playwrightRoot, 'PLAYWRIGHT_ROOT is required')

const { firefox } = await import(`file://${playwrightRoot}/lib/node_modules/playwright/index.mjs`)

await mkdir(outputDir, { recursive: true })

const successScreenshot = path.join(outputDir, 'system-admin-mock-acceptance.png')
const failureScreenshot = path.join(outputDir, 'system-admin-mock-acceptance-failure.png')

const browser = await firefox.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1440, height: 1180 } })

async function expectVisible(locator, description) {
  await locator.waitFor({ state: 'visible', timeout: 15_000 })
  assert(await locator.isVisible(), `${description} should be visible`)
}

try {
  await page.goto(appUrl, { waitUntil: 'networkidle' })

  await page.getByRole('button', { name: /Open System Admin/i }).click()
  await expectVisible(page.getByText(/System Admin Mock Mode/), 'mock admin login')

  await page.getByPlaceholder('1234').fill('1234')
  await page.getByRole('button', { name: 'Sign In', exact: true }).click()

  await expectVisible(page.getByText(/System Admin Dashboard/), 'admin overview')
  await expectVisible(page.getByRole('textbox', { name: 'Admin search' }), 'admin search')
  assert.equal(await page.getByText(/^Navigation$/).count(), 0, 'left navigation panel should be removed')

  await page.getByRole('button', { name: /Reset Mock Data/i }).click()
  await expectVisible(page.getByText(/Mock data reset\./), 'mock data reset toast')

  await page.getByRole('button', { name: /Open Faculties/i }).click()
  await expectVisible(page.getByText(/^Faculties$/).last(), 'faculties workspace')
  await page.getByRole('button', { name: /Engineering and Technology/i }).click()
  await page.getByRole('button', { name: /Computer Science and Engineering/i }).nth(0).click()
  await page.getByRole('button', { name: /Computer Science and Engineering/i }).nth(1).click()
  await page.getByRole('button', { name: /Batch 2022/i }).click()
  await expectVisible(page.getByText(/Semester 1-8 Curriculum/), 'batch curriculum panel')
  await page.getByRole('button', { name: /Save Batch Policy/i }).click()
  await expectVisible(page.getByText(/Batch policy saved\./), 'policy save flash')

  await page.getByPlaceholder('CS699').fill('CS699')
  await page.getByPlaceholder('Special Topics in AI Governance').fill('AI Governance')
  await page.getByRole('button', { name: /Add Course/i }).click()
  await expectVisible(page.getByText(/CS699/), 'new curriculum course')

  const search = page.getByRole('textbox', { name: 'Admin search' })
  await search.fill('Aisha')
  await page.getByRole('button', { name: /Aisha Khan/i }).click()
  await expectVisible(page.getByText(/Aisha Khan/).last(), 'student detail')
  await expectVisible(page.getByText(/CGPA 8\.42/).last(), 'student cgpa')

  await page.getByRole('button', { name: 'Faculty Members', exact: true }).click()
  await page.getByRole('button', { name: /Prof\. Nandini Shah/i }).click()
  await expectVisible(page.getByText(/Assigned Classes/), 'faculty assignment section')
  await expectVisible(page.getByText(/MLOps Studio/), 'faculty course ownership')
  await expectVisible(page.getByText(/Governance Rule/), 'faculty governance panel')

  await page.getByRole('button', { name: 'Requests', exact: true }).click()
  await page.getByRole('button', { name: /Reassign Aisha Khan to Dr\. Neha Kulkarni as mentor/i }).click()
  await expectVisible(page.getByText(/Implement Request/), 'request implementation action')
  await page.getByRole('button', { name: /Implement Request/i }).click()
  await expectVisible(page.getByText(/Request implemented\./), 'request implemented flash')

  await page.getByRole('button', { name: 'Students', exact: true }).click()
  await page.getByRole('button', { name: /Aisha Khan/i }).click()
  await expectVisible(page.getByText(/Dr\. Neha Kulkarni/).last(), 'updated mentor assignment')

  await page.screenshot({ path: successScreenshot, fullPage: true })
  console.log(`System admin mock acceptance flow passed. Screenshot: ${successScreenshot}`)
} catch (error) {
  try {
    await page.screenshot({ path: failureScreenshot, fullPage: true })
    console.error(`System admin mock acceptance flow failed. Screenshot: ${failureScreenshot}`)
  } catch {
    // Ignore screenshot failures so the original error is preserved.
  }
  throw error
} finally {
  await browser.close()
}
