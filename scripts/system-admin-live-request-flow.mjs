import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'

const playwrightRoot = process.env.PLAYWRIGHT_ROOT
const appUrl = process.env.PLAYWRIGHT_APP_URL ?? 'http://127.0.0.1:4173'
const outputDir = process.env.PLAYWRIGHT_OUTPUT_DIR ?? 'output/playwright'

assert(playwrightRoot, 'PLAYWRIGHT_ROOT is required')

const { firefox } = await import(`file://${playwrightRoot}/lib/node_modules/playwright/index.mjs`)

await mkdir(outputDir, { recursive: true })

const successScreenshot = path.join(outputDir, 'system-admin-live-request-flow.png')
const failureScreenshot = path.join(outputDir, 'system-admin-live-request-flow-failure.png')

const browser = await firefox.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1440, height: 1200 } })

async function expectVisible(locator, description) {
  await locator.waitFor({ state: 'visible', timeout: 20_000 })
  assert(await locator.isVisible(), `${description} should be visible`)
}

async function expectFlash(message) {
  await expectVisible(page.getByText(message, { exact: true }), `flash "${message}"`)
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

  await page.getByRole('button', { name: 'Requests', exact: true }).click()
  await expectVisible(page.getByText(/^Requests$/).last(), 'requests heading')

  const requestSummary = /Grant additional mentor mapping coverage/i
  await page.getByRole('button', { name: requestSummary }).first().click()
  await expectVisible(page.getByText(requestSummary).last(), 'selected request detail title')
  assert(/#\/admin\/requests\//.test(page.url()), `expected deep-linked request URL, got ${page.url()}`)

  await expectVisible(page.getByText(/Linked Targets/i), 'linked targets section')
  await expectVisible(page.getByText(/Status History/i), 'status history section')

  await page.reload({ waitUntil: 'networkidle' })
  await expectVisible(page.getByText(requestSummary).last(), 'request detail after reload')
  assert(/#\/admin\/requests\//.test(page.url()), `expected request URL after reload, got ${page.url()}`)

  await advanceRequestToClosed()
  await expectVisible(page.getByText(/^Closed$/).first(), 'closed request status')

  await page.screenshot({ path: successScreenshot, fullPage: true })
  console.log(`System admin live request flow passed. Screenshot: ${successScreenshot}`)
} catch (error) {
  try {
    await page.screenshot({ path: failureScreenshot, fullPage: true })
    console.error(`System admin live request flow failed. Screenshot: ${failureScreenshot}`)
  } catch {
    // Ignore screenshot failures so the original error is preserved.
  }
  throw error
} finally {
  await browser.close()
}
