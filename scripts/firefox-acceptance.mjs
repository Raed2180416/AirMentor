import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'

const playwrightRoot = process.env.PLAYWRIGHT_ROOT
const appUrl = process.env.PLAYWRIGHT_APP_URL ?? 'http://127.0.0.1:4173'
const outputDir = process.env.PLAYWRIGHT_OUTPUT_DIR ?? 'output/playwright'

assert(playwrightRoot, 'PLAYWRIGHT_ROOT is required')

const { firefox } = await import(`file://${playwrightRoot}/lib/node_modules/playwright/index.mjs`)

await mkdir(outputDir, { recursive: true })

const successScreenshot = path.join(outputDir, 'firefox-acceptance.png')
const failureScreenshot = path.join(outputDir, 'firefox-acceptance-failure.png')

const browser = await firefox.launch({ headless: true })
const page = await browser.newPage()

async function expectVisible(locator, description) {
  await locator.waitFor({ state: 'visible', timeout: 15_000 })
  const visible = await locator.isVisible()
  assert(visible, `${description} should be visible`)
}

try {
  await page.goto(appUrl, { waitUntil: 'networkidle' })

  await page.getByLabel('Password').fill('1234')
  await page.getByRole('button', { name: /login/i }).click()
  await expectVisible(page.getByText(/Good (Morning|Afternoon|Evening),/), 'dashboard greeting')

  const desktopSidebarToggle = page.locator('.sidebar-edge-toggle')
  await expectVisible(desktopSidebarToggle, 'desktop sidebar toggle')
  await desktopSidebarToggle.click()
  await expectVisible(page.getByRole('button', { name: /Expand sidebar/i }), 'desktop expand control after collapse')
  await page.getByRole('button', { name: /Expand sidebar/i }).click()
  await expectVisible(page.getByRole('button', { name: /Collapse sidebar/i }), 'desktop collapse control after expand')

  await page.setViewportSize({ width: 860, height: 1180 })
  const compactExpandToggle = page.locator('.top-bar-shell button[aria-label="Expand sidebar"]')
  await expectVisible(compactExpandToggle, 'compact top-bar expand toggle')
  await compactExpandToggle.click()
  await expectVisible(page.locator('.top-bar-shell button[aria-label="Collapse sidebar"]'), 'compact collapse toggle after expand')
  await page.setViewportSize({ width: 1440, height: 1180 })

  await page.getByRole('button', { name: /Open Data Entry Hub/i }).click()
  await expectVisible(page.getByText(/^Data Entry Hub$/).last(), 'data entry hub')

  await expectVisible(page.getByText(/This entry is locked\. You cannot modify TT1 Marks\./), 'locked TT1 notice')

  await page.getByText('TT2 Marks').first().click()
  await expectVisible(page.getByText(/Direct Entry Workspace/), 'direct entry workspace')

  await page.getByRole('button', { name: /Back to Data Entry Hub/i }).click()
  await page.getByRole('button', { name: 'Queue History', exact: true }).click()
  await expectVisible(page.getByText(/^Queue History$/).last(), 'queue history')

  page.once('dialog', dialog => dialog.accept())
  await page.getByRole('button', { name: /Hard reset development data/i }).click()
  await expectVisible(page.getByText('AirMentor Login'), 'login page after reset')

  await page.screenshot({ path: successScreenshot, fullPage: true })
  console.log(`Firefox acceptance flow passed. Screenshot: ${successScreenshot}`)
} catch (error) {
  try {
    await page.screenshot({ path: failureScreenshot, fullPage: true })
    console.error(`Firefox acceptance flow failed. Screenshot: ${failureScreenshot}`)
  } catch {
    // Ignore screenshot failures so the original automation error is preserved.
  }
  throw error
} finally {
  await browser.close()
}
