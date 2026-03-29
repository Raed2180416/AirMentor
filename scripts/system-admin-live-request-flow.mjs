import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { resolveSystemAdminLiveCredentials } from './system-admin-live-auth.mjs'

const playwrightRoot = process.env.PLAYWRIGHT_ROOT
const appUrl = process.env.PLAYWRIGHT_APP_URL ?? 'http://127.0.0.1:4173'
const outputDir = process.env.PLAYWRIGHT_OUTPUT_DIR ?? 'output/playwright'

assert(playwrightRoot, 'PLAYWRIGHT_ROOT is required')

const { firefox } = await import(`file://${playwrightRoot}/lib/node_modules/playwright/index.mjs`)

await mkdir(outputDir, { recursive: true })

const successScreenshot = path.join(outputDir, 'system-admin-live-request-flow.png')
const failureScreenshot = path.join(outputDir, 'system-admin-live-request-flow-failure.png')
const successReport = path.join(outputDir, 'system-admin-live-request-flow-report.json')
const failureReport = path.join(outputDir, 'system-admin-live-request-flow-failure.json')
const report = {
  generatedAt: new Date().toISOString(),
  appUrl,
  checks: [],
}
const systemAdminCredentials = resolveSystemAdminLiveCredentials({
  scriptLabel: 'System admin live request flow',
})

const browser = await firefox.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1440, height: 1200 } })

async function expectVisible(locator, description) {
  await locator.waitFor({ state: 'visible', timeout: 20_000 })
  assert(await locator.isVisible(), `${description} should be visible`)
}

async function expectFlash(message) {
  await expectVisible(page.getByText(message, { exact: true }), `flash "${message}"`)
}

async function focusAndActivate(locator, description, key = 'Enter') {
  await expectVisible(locator, description)
  await locator.focus()
  const isFocused = await locator.evaluate(node => node === document.activeElement)
  assert.equal(isFocused, true, `${description} should receive focus before keyboard activation`)
  await page.keyboard.press(key)
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

    await focusAndActivate(nextAction.button, `${nextAction.action} request action`)
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

  await page.getByPlaceholder('sysadmin', { exact: true }).fill(systemAdminCredentials.identifier)
  await page.getByPlaceholder('••••••••', { exact: true }).fill(systemAdminCredentials.password)
  await page.getByRole('button', { name: 'Sign In', exact: true }).click()
  report.checks.push({ name: 'system-admin-login', status: 'passed' })

  await focusAndActivate(page.getByRole('button', { name: 'Requests', exact: true }), 'requests navigation')
  await expectVisible(page.getByText(/^Requests$/).last(), 'requests heading')
  report.checks.push({ name: 'request-list-open', status: 'passed' })

  const requestSummary = /Grant additional mentor mapping coverage/i
  await focusAndActivate(page.getByRole('button', { name: requestSummary }).first(), 'request summary row')
  await expectVisible(page.getByText(requestSummary).last(), 'selected request detail title')
  assert(/#\/admin\/requests\//.test(page.url()), `expected deep-linked request URL, got ${page.url()}`)

  await expectVisible(page.getByText(/Linked Targets/i), 'linked targets section')
  await expectVisible(page.getByText(/Status History/i), 'status history section')
  report.checks.push({ name: 'request-detail-open', status: 'passed', summary: 'Grant additional mentor mapping coverage' })

  await page.reload({ waitUntil: 'networkidle' })
  await expectVisible(page.getByText(requestSummary).last(), 'request detail after reload')
  assert(/#\/admin\/requests\//.test(page.url()), `expected request URL after reload, got ${page.url()}`)
  report.checks.push({ name: 'request-deep-link-persists', status: 'passed' })

  await advanceRequestToClosed()
  await expectVisible(page.getByText(/^Closed$/).first(), 'closed request status')
  report.checks.push({ name: 'request-closeout', status: 'passed' })

  await writeFile(successReport, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
  await page.screenshot({ path: successScreenshot, fullPage: true })
  console.log(`System admin live request flow passed. Screenshot: ${successScreenshot}`)
} catch (error) {
  try {
    await writeFile(failureReport, `${JSON.stringify({
      ...report,
      failedAt: new Date().toISOString(),
      error: error instanceof Error ? { name: error.name, message: error.message } : { message: String(error) },
    }, null, 2)}\n`, 'utf8')
    await page.screenshot({ path: failureScreenshot, fullPage: true })
    console.error(`System admin live request flow failed. Screenshot: ${failureScreenshot}`)
  } catch {
    // Ignore screenshot failures so the original error is preserved.
  }
  throw error
} finally {
  await browser.close()
}
